# Plan: "Ask the Tutor" on Anthropic's API (Claude Haiku 4.5), keeping the key secret

Status: **planning only — no code changed yet.** This doc covers the model
switch, the security model for the API key, and pricing. Implementation is
gated on sign-off (see "Rollout checklist" at the end).

---

## TL;DR

1. **The key already never reaches a student's browser.** The tutor is
   a server-side proxy today: the Anthropic SDK is constructed in
   `packages/core/src/tutor/providers.ts` inside the Vercel serverless
   function, reading `process.env.ANTHROPIC_API_KEY`. Students call our
   tRPC endpoint; our server calls Anthropic. The key is never bundled
   into the JavaScript the browser downloads. **Nothing about "students
   use the chatbot" requires giving them the key.**
2. **A Vercel environment variable is not a committed `.env` file.** The
   security problem is a secret checked into git — not a secret that
   lives server-side. Vercel env vars are encrypted at rest and injected
   only into the serverless runtime. That is the standard, safe way to
   hold the key, and it's all we need.
3. **Switching to Haiku 4.5 is a config change, not a code change.** Set
   `TUTOR_PROVIDER=anthropic`, `ANTHROPIC_MODEL=claude-haiku-4-5`, and
   `ANTHROPIC_API_KEY=…` as Vercel env vars. The provider code already
   supports Anthropic and already prompt-caches the system prompt.
4. **The real risk isn't key exposure — it's abuse/cost.** A leaked
   session token could run up usage. We already rate-limit (10/min),
   cap turns per session, and require auth. We add an Anthropic-side
   spend limit + a dedicated scoped key as backstops.
5. **Two separate keys, both server-side.** The *tutor* key (`sk-ant-…`,
   inference, one workspace) is what students' chat runs on. Showing
   Anthropic's billing/token stats in the admin view needs a *different,
   more privileged* **Admin API key** (`sk-ant-admin…`, org-scoped). Yes —
   that one is secured too, and **more strictly**: admin-role-gated,
   server-only, never client-exposed, treated as break-glass. See
   "Surfacing usage & billing in the admin view" below.

---

## How a tutor message flows today

```
Student browser (React Native Web on Vercel)
      │  tRPC mutation  tutor.sendMessage  (over HTTPS)
      ▼
Next.js API route  /api/trpc/[trpc]   ← runs server-side (Vercel function)
      │  streamTutorReply(ctx, transcript)
      ▼
packages/core/src/tutor/providers.ts
   new Anthropic({ apiKey: config.anthropicApiKey })   ← key read from process.env HERE
      │  HTTPS to api.anthropic.com
      ▼
Anthropic API  →  streamed reply  →  back down the same path to the student
```

The key exists only in the middle box (the serverless function's
`process.env`). The student's browser only ever talks to *our* server,
authenticated with *their* login — it never sees the Anthropic key.

Guardrails already in place (see `packages/api/src/routers/tutor.ts`):
- **Auth required** — `tutorProcedure` is a protected, rate-limited
  procedure; anonymous callers can't reach it.
- **Rate limit** — `rateLimited(10)` per user.
- **Turn cap** — `tutorConfig.tutorMaxTurns` (12) messages per session.
- **PII scrub** — `scrubPii()` strips emails/phones/display name before
  anything is sent to Anthropic or stored (COPPA §9).
- **Prompt caching** — the system prompt is sent with
  `cache_control: { type: 'ephemeral' }`, so repeated turns re-read it
  at ~0.1× input cost instead of paying full price each time.

---

## The switch to Claude Haiku 4.5

Haiku 4.5 is the right tier for this: fast, cheap, and more than capable
of nudging a student through an algebra step (we never ask it to grade —
the math engine does that deterministically). Model id: `claude-haiku-4-5`.

**No application code has to change.** `getTutorProvider()` already
returns the Anthropic provider when `ANTHROPIC_API_KEY` is set (or when
`TUTOR_PROVIDER=anthropic`). The only edits are configuration:

| Env var | Value | Why |
|---|---|---|
| `TUTOR_PROVIDER` | `anthropic` | Force the Anthropic branch (don't rely on auto-detect). |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | Switch the model off the `claude-opus-4-8` default. |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | The secret. Set in Vercel, never committed. |

Optionally we bump the default in `config.ts` from `claude-opus-4-8` to
`claude-haiku-4-5` so a missing `ANTHROPIC_MODEL` still lands on Haiku —
decide during implementation.

---

## Holding the key without exposing it

Ranked best-fit-first for a Vercel-hosted app.

### Option A — Vercel encrypted env var + the existing server proxy (recommended)

This is the standard approach and what the codebase is already built for.

- Set `ANTHROPIC_API_KEY` in **Vercel → Project → Settings → Environment
  Variables** (or `vercel env add ANTHROPIC_API_KEY production`). Vercel
  stores it encrypted and injects it into `process.env` only in the
  serverless runtime.
- Scope it to the environments that need it (Production, Preview).
- It is **never** exposed to the browser because (a) it has no
  `NEXT_PUBLIC_` prefix, and (b) it's only read in server code.

Pros: zero new infrastructure, nothing in git, works today.
Cons: rotation is manual (mitigated by Option B if that ever matters).

### Option B — External secret manager (rotation / audit)

If you later want automatic rotation, per-access audit logs, or shared
secrets across services: put the key in Doppler / Infisical / AWS Secrets
Manager / Vercel's own secret integrations, and let Vercel pull it at
build/deploy. Same runtime result (`process.env` server-side), plus a
rotation workflow. Overkill for one key today; noted for the future.

### Option C — Workload Identity Federation (no stored static key at all)

The Anthropic SDK supports WIF: instead of a long-lived `sk-ant-…` key,
the runtime presents a short-lived OIDC token (Vercel can issue one) that
Anthropic exchanges for a temporary credential. Nothing secret is stored
anywhere — not even in Vercel's encrypted store. This is the strongest
posture but the most setup (a federation rule on the Anthropic side +
OIDC wiring). Recommend only if a compliance requirement rules out
storing a static key.

### What we must NOT do

- ❌ **Never prefix the key with `NEXT_PUBLIC_`.** That is the one action
  that would inline it into the client bundle. `NEXT_PUBLIC_ANTHROPIC_API_KEY`
  = the key shipped to every student. This is the single most important
  rule in this doc.
- ❌ **Never call `api.anthropic.com` from client code.** Any browser-side
  fetch would need the key in the browser. Always go through our tRPC
  endpoint.
- ❌ **Never commit a real key.** `.env` / `.env.*` are gitignored already;
  keep it that way. Use `.env.example` with a placeholder only.
- ❌ **Never log the key** or echo it in error messages / tracing.

---

## Abuse & cost hardening (the actual risk surface)

Key exposure is solved by the proxy. The remaining risk is a
*legitimate-but-costly* or *abusive* stream of requests (a student
hammering the button, or someone who extracted a session token). Layers:

| Layer | Where | Status |
|---|---|---|
| Login required to reach the tutor | `tutorProcedure` (protected) | ✅ in place |
| Per-user rate limit (10/min) | `rateLimited(10)` | ✅ in place |
| Turns capped per session (12) | `tutorConfig.tutorMaxTurns` | ✅ in place |
| `max_tokens` capped at 1024 per reply | `providers.ts` | ✅ in place |
| PII scrub before send/store | `scrubPii()` | ✅ in place |
| **Anthropic workspace spend limit** | Anthropic Console | ➕ add |
| **Dedicated, workspace-scoped key** | Anthropic Console | ➕ add |
| **Usage/billing alert** | Anthropic Console | ➕ add |

The two `➕` items: create a **separate API key inside a dedicated
Anthropic workspace** used only by this app, and set a **monthly spend
cap + alert** on that workspace. If the key ever leaks or usage spikes,
the blast radius is one workspace with a hard ceiling, and rotation is a
one-click key regenerate + one Vercel env update — no code change.

---

## Surfacing usage & billing in the app's admin view

The app already has an `admin` role and an `/admin` route. Anthropic's
statistics — token usage and spend — can live there so an admin sees them
without leaving the app. Two ways, pick per how native it needs to feel.

### Option 1 — Link out to the Anthropic Console (zero secrets)

Put a card/link in the admin view pointing at the Anthropic Console's
usage & billing dashboards (`platform.claude.com`). The admin logs into
Anthropic directly with their own Anthropic account; **no key of any kind
is involved**, nothing is proxied, nothing can leak. Simplest and safest —
recommended unless you specifically need the numbers rendered in-app.

### Option 2 — Render usage/billing natively via the Admin/Usage API

To draw the charts inside our own admin view, we pull the numbers from
Anthropic's **Admin API** (the Usage & Cost reporting endpoints). **This
requires a different, more privileged key than the tutor key** — an
**Admin API key** (`sk-ant-admin…`), created by an org admin, scoped at
the *organization* level (not a single workspace). It can read usage and
cost across the org and manage workspaces/members/keys.

### "Will the billing/usage key also be secured?" — yes, and more strictly

Short answer: **yes.** The two keys are separate on purpose, and the admin
key is the *more* sensitive of the two — so it gets the same protections
as the tutor key **plus extra**:

| Concern | Tutor key (`sk-ant-…`) | Admin/usage key (`sk-ant-admin…`) |
|---|---|---|
| Privilege | Inference only, one workspace | Org-wide: usage, cost, member & key management |
| Where it lives | Vercel env var, server-side only | Vercel env var, server-side only |
| Client exposure | Never (`NEXT_PUBLIC_` forbidden) | Never — **even more critical** |
| Who can trigger a call | Any logged-in student (tutor) | **Admin-role users only** — the server endpoint is gated to `role === 'admin'` |
| Blast radius if leaked | One capped workspace | Whole org — treat as break-glass |
| Rotation | On suspicion | On suspicion, **and on a schedule** |

Concretely, if we do Option 2:
- The admin key is read **only** in a server-side, **admin-role-gated**
  tRPC/route handler (mirror the existing `/admin` auth check). It is
  never read anywhere a student request can reach.
- Same proxy shape as the tutor: the browser calls *our* admin endpoint;
  our server calls Anthropic's Admin API; only the rendered numbers (not
  the key) go back to the browser.
- Same hard rules apply, doubly: no `NEXT_PUBLIC_`, no client-side call to
  Anthropic, never committed, never logged.
- Because it's org-privileged, prefer **read-scoped** usage/cost access if
  Anthropic offers a narrower scope, keep it in its own Vercel var
  (`ANTHROPIC_ADMIN_KEY`), and rotate it on a schedule as break-glass.

**Recommendation:** start with **Option 1** (link-out) — it delivers the
admin-facing stats with zero new secret to secure. Move to Option 2 only
if you want the numbers rendered inside the app, and treat the admin key
as a higher-sensitivity credential than the tutor key when you do.

---

## Pricing per token, by model

Anthropic bills per **million tokens (MTok)**, separately for input and
output. Cached input (our system prompt after the first turn) reads at
~0.1× the input rate. Current published rates:

| Model | Model id | Context | Input $/MTok | Output $/MTok |
|---|---|---|---|---|
| Claude Haiku 4.5 | `claude-haiku-4-5` | 200K | **$1.00** | **$5.00** |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | 1M | $3.00 | $15.00 |
| Claude Sonnet 5 | `claude-sonnet-5` | 1M | $3.00 ($2.00 intro thru 2026-08-31) | $15.00 ($10.00 intro) |
| Claude Opus 4.6 | `claude-opus-4-6` | 1M | $5.00 | $25.00 |
| Claude Opus 4.7 | `claude-opus-4-7` | 1M | $5.00 | $25.00 |
| Claude Opus 4.8 | `claude-opus-4-8` | 1M | $5.00 | $25.00 |
| Claude Fable 5 | `claude-fable-5` | 1M | $10.00 | $50.00 |

(Rates as published to the build; confirm live numbers on the Anthropic
pricing page before finalizing budgets. Haiku's 200K context is far more
than a tutoring turn needs.)

### What a tutoring session actually costs on Haiku

Rough per-turn shape for our prompt (lesson scaffold + rules ≈ 1.5K input
tokens, student message ≈ 50, reply capped at ~200 output tokens):

- Input: ~1,500 tok → **$0.0015** full price, ~**$0.0003** once cached.
- Output: ~200 tok → **$0.001**.
- **≈ $0.0013–0.0025 per turn** on Haiku.

A full 12-turn session ≈ **$0.02–0.03**. A class of 30 students each doing
a few sessions a week lands in the **low single digits of dollars per
week**. (The same session on Opus 4.8 would be ~5–7× that on output —
part of why Haiku is the right default here.)

---

## Rollout checklist (execute after sign-off)

1. In the Anthropic Console: create a dedicated **workspace**, generate an
   **API key** scoped to it, set a **monthly spend limit + alert**.
2. In Vercel (Production + Preview): add `ANTHROPIC_API_KEY`,
   `TUTOR_PROVIDER=anthropic`, `ANTHROPIC_MODEL=claude-haiku-4-5`.
   Confirm **none** carry a `NEXT_PUBLIC_` prefix.
3. (Optional) Change the `anthropicModel` default in
   `packages/core/src/tutor/config.ts` from `claude-opus-4-8` to
   `claude-haiku-4-5` so a missing env var still lands on Haiku.
4. Update `.env.example` to document the three vars with placeholder
   values (no real key).
5. Redeploy; verify in a Preview build that "Ask the Tutor" streams a
   reply and that `getTutorProvider()` reports `anthropic` / `claude-haiku-4-5`.
6. Confirm the key is absent from the client bundle (grep the built
   client output for `sk-ant` — expect zero hits).
7. Admin-view stats: add a link-out card to the Anthropic Console in
   `/admin` (Option 1, no secret). Only if native in-app charts are
   wanted, do Option 2 — create an org **Admin API key**, store it as a
   separate `ANTHROPIC_ADMIN_KEY` Vercel var, and read it **only** from an
   admin-role-gated server endpoint (never client-exposed, never
   `NEXT_PUBLIC_`).

The switch itself (items 1–6) needs no application code beyond the small
optional polish in items 3–4. Item 7 Option 2 is a separate feature —
a new admin-gated endpoint + UI — and would be planned/estimated on its
own.
