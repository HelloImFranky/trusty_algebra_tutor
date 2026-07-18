# Plan (Option 2): render AI-tutor usage & billing inside the admin view

> [!NOTE]
> **✅ SHIPPED — historical design record.** Option 2 is implemented:
> `UsageDashboard.tsx`, `core/admin/usage.ts`, and Admin-API numbers rendered
> in `/admin`. Kept because code comments cite it
> (`docs/tutor-usage-dashboard-plan.md, Option 2`). Status index:
> [`README.md`](README.md).

Companion to `docs/tutor-anthropic-haiku-plan.md`, which introduced the
admin-view choice. That doc's **Option 1** (link out to the Anthropic
Console) is already shipped: the `/admin` screen has an "AI tutor usage &
billing" card linking to `platform.claude.com`, with **zero secrets in
the app**.

This doc plans **Option 2**: pull the numbers from Anthropic's **Admin
API** and render them natively in `/admin`, so an admin sees token usage
and spend without leaving the app. It is **additive** — if the admin key
is unset or the API errors, the view falls back to the existing link-out
card.

Status: **implemented** (P1–P4). Decisions taken at sign-off:
- **Charts are in scope and insight-first**: stat tiles (spend + avg/day,
  tokens + output split, cache-hit rate = caching savings), a tappable
  daily-spend bar chart with peak callout, and a per-model split that
  doubles as the table view.
- **Numbers are scoped to the tutor's dedicated workspace** via
  `ANTHROPIC_TUTOR_WORKSPACE_ID` (unset = org-wide totals).

Endpoints were verified against the live Admin API reference during
implementation: `GET /v1/organizations/usage_report/messages` (1d
buckets, `group_by[]=model`, native `workspace_ids[]` filter) and
`GET /v1/organizations/cost_report` (1d only, amounts as decimal-string
cents). One notable finding: **the cost endpoint has no workspace
filter** — it only *groups* by `workspace_id` — so cost rows are grouped
and then filtered server-side to the tutor workspace. The Default
workspace reports `workspace_id: null`, so the tutor workspace must be a
real (non-default) workspace for scoping to work.

Code: `packages/core/src/admin/usage.ts` (+tests) · `admin.usage.summary`
in `packages/api/src/routers/admin.ts` (10-min cache) ·
`packages/app/src/components/UsageDashboard.tsx` + the `/admin` card.

---

## Why this is a bigger step than Option 1

Option 1 needs no credential. Option 2 introduces a **second, more
privileged key** — an **Admin API key** (`sk-ant-admin…`), scoped at the
*organization* level, distinct from the tutor's inference key. It can
read org-wide usage and cost (and, in general, manage workspaces/members/
keys). So the whole feature is really "add an org-privileged credential
and a place to spend it, safely." The security design below is the point
of the feature, not an afterthought.

---

## What we'd display

Keep it to what an admin running a classroom actually wants:

- **Spend** over a window (last 7 / 30 days) in USD.
- **Token usage** over the same window — input, output, and cache-read
  (our system prompt is cached, so this shows the savings).
- **Per-model split** (Haiku vs anything larger) — confirms the tutor is
  running on the cheap tier.
- A small **per-day bar/sparkline** for trend. (If we add a chart, load
  the `dataviz` skill first — light/dark-aware, one visual system.)

The existing link-out card stays as a "full details in the Console" link
beneath the rendered numbers.

---

## Data source: Anthropic Admin API (Usage & Cost)

Anthropic exposes org-level reporting through the Admin API:

- **Usage report** — token counts bucketed by time, and filterable /
  groupable by model, workspace, and API key.
- **Cost report** — spend in USD bucketed by time.

Both require an **Admin API key** created by an org admin in the Anthropic
Console. They report *historical* usage (there's a short settlement lag);
calling them does **not** consume model tokens (reporting is free).

> ⚠️ **Verify exact endpoint paths, query params, and response field
> names against the current Admin API docs at implementation time**
> (WebFetch the Admin API / Usage & Cost reference). This plan is written
> to the shape of the feature, not pinned to field names that may drift.
> Scope the key to a **read-only / usage-reporting** capability if the
> Console offers it, rather than a full-privilege admin key.

---

## Architecture — mirror the tutor proxy, admin-gated

Same server-side-proxy shape as the tutor, with an extra auth gate. The
browser never sees the key; only computed numbers cross the wire.

```
Admin browser  (/admin, role === 'admin')
      │  tRPC query  admin.usage.summary   (auth required + admin-gated)
      ▼
Next.js API route (Vercel function, server-side)
      │  adminProcedure  →  role === 'admin' enforced here
      │  read ANTHROPIC_ADMIN_KEY from process.env  (server only)
      │  call Anthropic Admin API (usage + cost reports)
      │  aggregate → { spendUsd, tokens{in,out,cacheRead}, byModel[], byDay[] }
      ▼
Admin browser renders the summary (no key ever leaves the server)
```

### Pieces to build

1. **Config** (`packages/core/src/tutor/config.ts` or a new
   `packages/core/src/admin/config.ts`): read `ANTHROPIC_ADMIN_KEY` and an
   optional `ANTHROPIC_ORG_ID` from env. A helper `adminUsageAvailable()`
   returns `false` when the key is unset (drives the graceful fallback).
2. **Admin-API client** (`packages/core/src/admin/usageReport.ts`): thin
   wrapper that calls the usage + cost endpoints with the admin key and
   returns a normalized `UsageSummary`. Kept in `core` so it's testable
   without the web layer. No SDK dependency needed if we use `fetch`, but
   the Anthropic SDK's admin surface can be used if it's cleaner —
   decide at implementation.
3. **tRPC endpoint** (`packages/api/src/routers/admin.ts`): add a
   `usage` sub-router with `summary: adminProcedure.input({ window })`.
   `adminProcedure` already enforces `role === 'admin'` (see the existing
   teacher endpoints), so the gate is reused, not reinvented.
4. **Server-side cache**: memoize the report for ~10–15 min (the data is
   coarse-grained and laggy anyway). Prevents every admin page load from
   hitting the Admin API and keeps us well under its rate limits.
5. **UI** (`packages/app/src/screens/admin.tsx`): replace the body of the
   existing usage card — when `admin.usage.summary` resolves, show the
   numbers; on `undefined`/error/unset-key, show the current link-out
   card. Bilingual strings for the new labels.

---

## Security — the crux (answers "is the admin/usage key secured too?")

Yes — and **more strictly than the tutor key**, because it's org-scoped.
The tutor-key rules all apply, plus extra gating:

| Control | How |
|---|---|
| Server-side only | Read `ANTHROPIC_ADMIN_KEY` only in the API route / core; never in `packages/app` client code. |
| Never in the client bundle | No `NEXT_PUBLIC_` prefix — ever. Grep the built client for `sk-ant` in CI-style check; expect zero hits. |
| Admin-role gated | Endpoint uses `adminProcedure` — a student/teacher token is rejected before any Admin API call happens. |
| Least privilege | Prefer a read/usage-scoped key over a full admin key, if the Console allows it. |
| Its own secret | Separate `ANTHROPIC_ADMIN_KEY` var (not reusing the tutor key), separate Vercel entry. |
| Never logged | Never echo the key in errors/tracing; only surface aggregated numbers. |
| Break-glass posture | Scheduled rotation; regenerate immediately on any suspicion. Blast radius is the whole org, so treat it accordingly. |
| Fails safe | If the key is unset or the call errors, the endpoint returns "unavailable" and the UI falls back to the link-out — never a hard error, never a leaked detail. |

Net: the numbers become visible in-app, but the credential that fetches
them stays exactly as locked-down as the plan's two-key model requires.

---

## Graceful degradation

Option 2 is strictly additive to Option 1:

- `ANTHROPIC_ADMIN_KEY` unset → `adminUsageAvailable()` is `false` →
  endpoint short-circuits → UI shows today's link-out card. (This is the
  default state, so shipping the code with no key set changes nothing.)
- Admin API error / rate limit / settlement gap → same fallback, plus a
  quiet "couldn't load live numbers — open the Console" note.

So we can merge the code before the key exists, and it lights up the
moment the key is added in Vercel.

---

## Phasing & rough effort

| Phase | Scope | Effort |
|---|---|---|
| P1 | `core` admin-API client + `UsageSummary` type + unit test (mocked HTTP); `adminUsageAvailable()` | ~half day |
| P2 | `admin.usage.summary` tRPC endpoint (admin-gated) + server-side cache | ~half day |
| P3 | Admin UI: render numbers, keep link-out fallback, bilingual strings | ~half day |
| P4 (optional) | Per-day chart (via `dataviz` skill), window selector, per-model breakdown | ~half–1 day |

Testing to include: a `core` unit test that mocks the Admin API and
asserts the normalized summary; an API test asserting `admin.usage`
**rejects a non-admin** (reuse the existing admin-gating test pattern).

---

## Rollout checklist (execute after sign-off)

1. Anthropic Console: create an **Admin API key** (read/usage-scoped if
   available); note the org id if the endpoints need it.
2. Vercel (Prod + Preview): add `ANTHROPIC_ADMIN_KEY` (and
   `ANTHROPIC_ORG_ID` if required). Confirm **no** `NEXT_PUBLIC_` prefix.
3. Land P1–P3 behind the availability check (safe to merge before step 1
   — with no key, the UI just shows the link-out).
4. After the key is set, verify `/admin` renders live numbers for an
   admin, and that a teacher/student hitting the endpoint is rejected.
5. Confirm `sk-ant` is absent from the built client bundle.
6. Set a rotation reminder for the admin key.

---

## Open questions for sign-off

- **Do we even need P4 charts**, or are headline numbers + link-out
  enough? (Cheapest useful version is P1–P3.)
- **Window(s)**: fixed "last 30 days", or a small selector (7 / 30 / 90)?
- **Per-workspace scoping**: if the tutor runs in its own dedicated
  workspace (recommended in the main plan), we can filter the report to
  that workspace so the numbers are tutor-only rather than org-wide —
  worth doing if the org has other Anthropic usage.
