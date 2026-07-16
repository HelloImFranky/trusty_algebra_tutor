import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminUsageAvailable, fetchUsageSummary, fillDays } from './usage.js';

/** Build a one-page report response. */
function page(data: unknown[], hasMore = false, nextPage: string | null = null) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data, has_more: hasMore, next_page: nextPage }),
    text: async () => '',
  } as unknown as Response;
}

function usageBucket(startingAt: string, results: unknown[]) {
  return { starting_at: startingAt, ending_at: startingAt, results };
}

const usageResult = (model: string, over: Partial<Record<string, unknown>> = {}) => ({
  model,
  uncached_input_tokens: 1000,
  cache_read_input_tokens: 3000,
  cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 500 },
  output_tokens: 200,
  ...over,
});

const costResult = (over: Partial<Record<string, unknown>> = {}) => ({
  amount: '250', // cents-string → $2.50
  currency: 'USD',
  workspace_id: 'wrkspc_tutor',
  model: 'claude-haiku-4-5',
  cost_type: 'tokens',
  ...over,
});

/** fetchFn that routes by endpoint path and records requested URLs. */
function makeFetch(routes: { usage: Response[]; cost: Response[] }) {
  const calls: string[] = [];
  const queues = { usage: [...routes.usage], cost: [...routes.cost] };
  const fetchFn = (async (url: unknown) => {
    const u = String(url);
    calls.push(u);
    const q = u.includes('/usage_report/') ? queues.usage : queues.cost;
    const next = q.shift();
    if (!next) throw new Error(`unexpected extra request: ${u}`);
    return next;
  }) as typeof fetch;
  return { fetchFn, calls };
}

describe('admin usage client', () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env.ANTHROPIC_ADMIN_KEY = 'sk-ant-admin-test';
    process.env.ANTHROPIC_TUTOR_WORKSPACE_ID = 'wrkspc_tutor';
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('is unavailable without a key, and fetchUsageSummary refuses to run', async () => {
    delete process.env.ANTHROPIC_ADMIN_KEY;
    expect(adminUsageAvailable()).toBe(false);
    await expect(fetchUsageSummary()).rejects.toThrow('ANTHROPIC_ADMIN_KEY');
  });

  it('requests both reports with window, grouping, and workspace scoping', async () => {
    const { fetchFn, calls } = makeFetch({ usage: [page([])], cost: [page([])] });
    const summary = await fetchUsageSummary({ days: 7, fetchFn });

    const usageUrl = calls.find((c) => c.includes('/usage_report/'))!;
    const costUrl = calls.find((c) => c.includes('/cost_report'))!;
    expect(usageUrl).toContain('bucket_width=1d');
    expect(usageUrl).toContain('group_by%5B%5D=model');
    // usage endpoint filters natively to the tutor workspace
    expect(usageUrl).toContain('workspace_ids%5B%5D=wrkspc_tutor');
    // cost endpoint has no filter — it groups, and rows are filtered client-side
    expect(costUrl).toContain('group_by%5B%5D=workspace_id');
    expect(costUrl).toContain('group_by%5B%5D=description');
    expect(costUrl).not.toContain('workspace_ids');

    expect(summary.windowDays).toBe(7);
    expect(summary.workspaceScoped).toBe(true);
    expect(summary.totals.totalTokens).toBe(0);
    expect(summary.cacheHitRate).toBe(0);
  });

  it('normalizes tokens, converts cents→USD, and computes cache hit rate', async () => {
    const { fetchFn } = makeFetch({
      usage: [
        page([
          usageBucket('2026-07-01T00:00:00Z', [usageResult('claude-haiku-4-5')]),
          usageBucket('2026-07-02T00:00:00Z', [usageResult('claude-haiku-4-5')]),
        ]),
      ],
      cost: [
        page([
          usageBucket('2026-07-01T00:00:00Z', [costResult()]),
          usageBucket('2026-07-02T00:00:00Z', [costResult({ amount: '50' })]),
        ]),
      ],
    });
    const s = await fetchUsageSummary({ days: 30, fetchFn });

    // per usage result: 1000 uncached + 3000 cacheRead + 500 cacheCreate + 200 out = 4700; ×2 buckets
    expect(s.totals.uncachedInputTokens).toBe(2000);
    expect(s.totals.cacheReadInputTokens).toBe(6000);
    expect(s.totals.cacheCreationInputTokens).toBe(1000);
    expect(s.totals.outputTokens).toBe(400);
    expect(s.totals.totalTokens).toBe(9400);
    // cache hit rate = 6000 / (2000 + 6000 + 1000)
    expect(s.cacheHitRate).toBeCloseTo(6000 / 9000, 5);
    // $2.50 + $0.50
    expect(s.totals.costUsd).toBeCloseTo(3.0, 5);

    expect(s.byDay.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02']);
    expect(s.byDay[0].costUsd).toBeCloseTo(2.5, 5);
    expect(s.byModel).toHaveLength(1);
    expect(s.byModel[0].model).toBe('claude-haiku-4-5');
    expect(s.byModel[0].costUsd).toBeCloseTo(3.0, 5);
  });

  it('filters cost rows to the tutor workspace and keeps model-less rows out of byModel', async () => {
    const { fetchFn } = makeFetch({
      usage: [page([])],
      cost: [
        page([
          usageBucket('2026-07-01T00:00:00Z', [
            costResult(), // tutor workspace → counted
            costResult({ workspace_id: 'wrkspc_other', amount: '99999' }), // other → dropped
            costResult({ workspace_id: null, amount: '99999' }), // default ws → dropped when scoped
            costResult({ model: null, cost_type: 'web_search', amount: '100' }), // counted, no model
          ]),
        ]),
      ],
    });
    const s = await fetchUsageSummary({ fetchFn });
    expect(s.totals.costUsd).toBeCloseTo(2.5 + 1.0, 5);
    expect(s.byModel.find((m) => m.model === 'claude-haiku-4-5')?.costUsd).toBeCloseTo(2.5, 5);
  });

  it('includes all workspaces when scoping is unset', async () => {
    delete process.env.ANTHROPIC_TUTOR_WORKSPACE_ID;
    const { fetchFn, calls } = makeFetch({
      usage: [page([])],
      cost: [
        page([
          usageBucket('2026-07-01T00:00:00Z', [
            costResult(),
            costResult({ workspace_id: null, amount: '100' }),
          ]),
        ]),
      ],
    });
    const s = await fetchUsageSummary({ fetchFn });
    expect(calls.find((c) => c.includes('/usage_report/'))).not.toContain('workspace_ids');
    expect(s.workspaceScoped).toBe(false);
    expect(s.totals.costUsd).toBeCloseTo(3.5, 5);
  });

  it('follows pagination until has_more is false', async () => {
    const { fetchFn, calls } = makeFetch({
      usage: [
        page([usageBucket('2026-07-01T00:00:00Z', [usageResult('claude-haiku-4-5')])], true, 'page_2'),
        page([usageBucket('2026-07-02T00:00:00Z', [usageResult('claude-haiku-4-5')])]),
      ],
      cost: [page([])],
    });
    const s = await fetchUsageSummary({ fetchFn });
    expect(s.byDay).toHaveLength(2);
    const usageCalls = calls.filter((c) => c.includes('/usage_report/'));
    expect(usageCalls).toHaveLength(2);
    expect(usageCalls[1]).toContain('page=page_2');
  });

  it('fillDays zero-fills the window, ending at endingAt, in date order', async () => {
    const { fetchFn } = makeFetch({
      usage: [
        page([usageBucket('2026-07-10T00:00:00Z', [usageResult('claude-haiku-4-5')])]),
      ],
      cost: [page([])],
    });
    const s = await fetchUsageSummary({
      days: 7,
      fetchFn,
      now: new Date('2026-07-14T12:00:00Z'),
    });
    const days = fillDays(s);
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-07-08');
    expect(days[days.length - 1].date).toBe('2026-07-14');
    // the one active day keeps its numbers; the rest are zero-filled
    expect(days.find((d) => d.date === '2026-07-10')?.totalTokens).toBe(4700);
    expect(days.filter((d) => d.totalTokens === 0)).toHaveLength(6);
  });

  it('surfaces HTTP errors without leaking the key', async () => {
    const err = {
      ok: false,
      status: 403,
      text: async () => 'permission_error: not an admin key',
      json: async () => ({}),
    } as unknown as Response;
    const { fetchFn } = makeFetch({ usage: [err], cost: [page([])] });
    await expect(fetchUsageSummary({ fetchFn })).rejects.toThrow(/HTTP 403/);
    await expect(
      fetchUsageSummary({ fetchFn: (async () => err) as typeof fetch }),
    ).rejects.not.toThrow(/sk-ant/);
  });
});
