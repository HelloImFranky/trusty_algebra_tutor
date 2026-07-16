/**
 * Anthropic Admin API client for the in-app usage & billing dashboard
 * (docs/tutor-usage-dashboard-plan.md, Option 2).
 *
 * Talks to the org-level Usage & Cost reporting endpoints:
 *   GET /v1/organizations/usage_report/messages   (token counts)
 *   GET /v1/organizations/cost_report             (spend in USD)
 *
 * Both require an Admin API key (sk-ant-admin…) — a SEPARATE, more
 * privileged credential than the tutor's inference key. It is read here,
 * server-side only, and never leaves this module: callers receive only
 * aggregated numbers. The API route that consumes this is admin-role
 * gated on top (see packages/api/src/routers/admin.ts).
 *
 * Workspace scoping: the tutor runs in its own dedicated workspace, so
 * numbers are scoped to ANTHROPIC_TUTOR_WORKSPACE_ID when set. The usage
 * endpoint filters natively via `workspace_ids[]`; the cost endpoint has
 * no filter — only `group_by[]=workspace_id` — so cost rows are grouped
 * and then filtered here. Unset = org-wide totals. (Note: usage/cost in
 * the org's Default workspace reports `workspace_id: null`, which cannot
 * be targeted by the filter — the tutor workspace must be a real,
 * non-default workspace for scoping to work.)
 */

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

/** Read env at call time (not module load) so serverless cold starts and
 * tests see current values. */
export function getAdminUsageConfig() {
  return {
    adminApiKey: (process.env.ANTHROPIC_ADMIN_KEY ?? '').trim(),
    tutorWorkspaceId: (process.env.ANTHROPIC_TUTOR_WORKSPACE_ID ?? '').trim(),
    baseUrl: (process.env.ANTHROPIC_ADMIN_BASE_URL ?? 'https://api.anthropic.com').replace(/\/+$/, ''),
  };
}

/** Whether the native dashboard can run; false → UI falls back to the
 * Anthropic Console link-out card. */
export function adminUsageAvailable(): boolean {
  return getAdminUsageConfig().adminApiKey.length > 0;
}

/* ------------------------------------------------------------------ */
/* Normalized summary shape (what the endpoint returns to the UI)      */
/* ------------------------------------------------------------------ */

export interface TokenTotals {
  uncachedInputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  outputTokens: number;
  /** Sum of the four token counts — the headline "tokens used" number. */
  totalTokens: number;
  costUsd: number;
}

export interface ModelUsage extends TokenTotals {
  model: string;
}

export interface DayUsage extends TokenTotals {
  /** Bucket start date, YYYY-MM-DD (UTC). */
  date: string;
}

export interface UsageSummary {
  windowDays: number;
  startingAt: string;
  endingAt: string;
  /** True when scoped to the tutor's dedicated workspace. */
  workspaceScoped: boolean;
  totals: TokenTotals;
  /** cacheRead / all input tokens — how much the prompt cache is saving. */
  cacheHitRate: number;
  /** Descending by total tokens. */
  byModel: ModelUsage[];
  /** Ascending by date; one entry per day that had activity. */
  byDay: DayUsage[];
}

/* ------------------------------------------------------------------ */
/* Raw API shapes (fields we read; verified against the API reference)  */
/* ------------------------------------------------------------------ */

interface UsageResult {
  model: string | null;
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  } | null;
  output_tokens: number;
}

interface CostResult {
  amount: string; // decimal string in cents, e.g. "123.45" = $1.2345
  currency: string;
  workspace_id: string | null;
  model: string | null;
  cost_type: string | null;
}

interface ReportPage<R> {
  data: { starting_at: string; ending_at: string; results: R[] }[];
  has_more: boolean;
  next_page: string | null;
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

const MAX_PAGES = 10; // 31 daily buckets fit in one page; this is a hard stop, not a tuning knob

async function fetchAllPages<R>(
  url: URL,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<ReportPage<R>['data']> {
  const buckets: ReportPage<R>['data'] = [];
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const pageUrl = new URL(url);
    if (page) pageUrl.searchParams.set('page', page);
    const res = await fetchFn(pageUrl.toString(), {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Deliberately does NOT include the key; detail is Anthropic's error body.
      throw new Error(`admin usage API HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }
    const body = (await res.json()) as ReportPage<R>;
    buckets.push(...body.data);
    if (!body.has_more || !body.next_page) return buckets;
    page = body.next_page;
  }
  throw new Error('admin usage API: pagination did not terminate');
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

function emptyTotals(): TokenTotals {
  return {
    uncachedInputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };
}

function addUsage(t: TokenTotals, r: UsageResult): void {
  const cacheCreation =
    (r.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
    (r.cache_creation?.ephemeral_5m_input_tokens ?? 0);
  t.uncachedInputTokens += r.uncached_input_tokens;
  t.cacheReadInputTokens += r.cache_read_input_tokens;
  t.cacheCreationInputTokens += cacheCreation;
  t.outputTokens += r.output_tokens;
  t.totalTokens +=
    r.uncached_input_tokens + r.cache_read_input_tokens + cacheCreation + r.output_tokens;
}

/** "123.45" cents → 1.2345 USD. Malformed amounts count as 0 rather than NaN-poisoning the sum. */
function centsToUsd(amount: string): number {
  const n = Number(amount);
  return Number.isFinite(n) ? n / 100 : 0;
}

const dayOf = (iso: string) => iso.slice(0, 10);

export interface FetchUsageSummaryOptions {
  /** Report window; the cost endpoint is daily-only, max 31 buckets. */
  days?: 7 | 30;
  now?: Date;
  /** Injectable for tests. */
  fetchFn?: typeof fetch;
}

/**
 * Fetch + merge the usage and cost reports into one normalized summary.
 * Throws on HTTP errors or a missing key — the API layer catches and
 * degrades to the link-out card, so nothing here needs to be forgiving.
 */
/**
 * Expand byDay to one entry per day of the window (zero-filled), ending at
 * the summary's endingAt — so a quiet week charts as flat, not shorter.
 */
export function fillDays(summary: UsageSummary): DayUsage[] {
  const byDate = new Map(summary.byDay.map((d) => [d.date, d]));
  const out: DayUsage[] = [];
  const end = new Date(summary.endingAt);
  for (let i = summary.windowDays - 1; i >= 0; i--) {
    const date = new Date(end.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    out.push(byDate.get(date) ?? { date, ...emptyTotals() });
  }
  return out;
}

export async function fetchUsageSummary(opts: FetchUsageSummaryOptions = {}): Promise<UsageSummary> {
  const { adminApiKey, tutorWorkspaceId, baseUrl } = getAdminUsageConfig();
  if (!adminApiKey) throw new Error('ANTHROPIC_ADMIN_KEY is not set');
  const days = opts.days ?? 30;
  const fetchFn = opts.fetchFn ?? fetch;
  const now = opts.now ?? new Date();
  const startingAt = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const endingAt = now.toISOString();

  const usageUrl = new URL(`${baseUrl}/v1/organizations/usage_report/messages`);
  usageUrl.searchParams.set('starting_at', startingAt);
  usageUrl.searchParams.set('ending_at', endingAt);
  usageUrl.searchParams.set('bucket_width', '1d');
  usageUrl.searchParams.set('limit', '31');
  usageUrl.searchParams.append('group_by[]', 'model');
  if (tutorWorkspaceId) usageUrl.searchParams.append('workspace_ids[]', tutorWorkspaceId);

  const costUrl = new URL(`${baseUrl}/v1/organizations/cost_report`);
  costUrl.searchParams.set('starting_at', startingAt);
  costUrl.searchParams.set('ending_at', endingAt);
  costUrl.searchParams.set('bucket_width', '1d');
  costUrl.searchParams.set('limit', '31');
  // No workspace filter exists on cost — group by workspace and filter below.
  costUrl.searchParams.append('group_by[]', 'workspace_id');
  costUrl.searchParams.append('group_by[]', 'description');

  const [usageBuckets, costBuckets] = await Promise.all([
    fetchAllPages<UsageResult>(usageUrl, adminApiKey, fetchFn),
    fetchAllPages<CostResult>(costUrl, adminApiKey, fetchFn),
  ]);

  const totals = emptyTotals();
  const byModel = new Map<string, ModelUsage>();
  const byDay = new Map<string, DayUsage>();
  const dayFor = (date: string): DayUsage => {
    let d = byDay.get(date);
    if (!d) byDay.set(date, (d = { date, ...emptyTotals() }));
    return d;
  };

  for (const bucket of usageBuckets) {
    const date = dayOf(bucket.starting_at);
    for (const r of bucket.results) {
      addUsage(totals, r);
      addUsage(dayFor(date), r);
      const model = r.model ?? 'unknown';
      let m = byModel.get(model);
      if (!m) byModel.set(model, (m = { model, ...emptyTotals() }));
      addUsage(m, r);
    }
  }

  for (const bucket of costBuckets) {
    const date = dayOf(bucket.starting_at);
    for (const r of bucket.results) {
      // Scope: keep only the tutor workspace's rows when configured.
      if (tutorWorkspaceId && r.workspace_id !== tutorWorkspaceId) continue;
      const usd = centsToUsd(r.amount);
      totals.costUsd += usd;
      dayFor(date).costUsd += usd;
      // Only token costs carry a model; web-search/code-exec rows don't.
      if (r.model) {
        let m = byModel.get(r.model);
        if (!m) byModel.set(r.model, (m = { model: r.model, ...emptyTotals() }));
        m.costUsd += usd;
      }
    }
  }

  const allInput =
    totals.uncachedInputTokens + totals.cacheReadInputTokens + totals.cacheCreationInputTokens;

  return {
    windowDays: days,
    startingAt,
    endingAt,
    workspaceScoped: tutorWorkspaceId.length > 0,
    totals,
    cacheHitRate: allInput > 0 ? totals.cacheReadInputTokens / allInput : 0,
    byModel: [...byModel.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
