# Security Review #2 — Follow-up Findings

> [!IMPORTANT]
> **🚧 MIXED STATUS — verify before acting.** Findings marked ✅ in the
> status column landed on the review branch; 📝 items were scoped as
> follow-ups and may still be open. This is a security record — confirm each
> item against the current code rather than assuming. Status index:
> [`README.md`](README.md).

A second pass over the codebase, after the first review branch
(`claude/repo-security-review-stw5sn`) closed items #1–#5 (self-registration
privilege escalation, teacher scoping, tokens in web storage, unthrottled
public endpoints, unpinned JWT alg) plus the COPPA-consent-from-unverified-email
fix. This document lists the issues that pass found beyond those, ranked by
severity, with the fix that landed on this branch
(`claude/report-vulnerabilities-40bui9`).

Status legend: ✅ fixed on this branch · 📝 follow-up scoped (not yet built).

---

## High

### H1 — Unverified guardian link auto-activated at student signup ✅
`packages/api/src/routers/auth.ts` — `register`

When an under-13 student signs up with a `guardianEmail` that matches *any*
existing guardian account, the server created a `GuardianLink` with
`status: 'active'`. Guardian emails are never verified when the guardian signs
up, so this granted a stranger read access (`progress.student`) to a child's
records purely by claiming an email address at guardian-registration time — a
FERPA/COPPA leak wearing the costume of consent. The first review only closed
the *teacher* self-registration path and set `guardianConsent` pending; the
guardian *link* itself was still auto-activated.

**Fix:** the link is now created `status: 'pending'`. `progress.student`
already fails closed on any non-`active` link, so no access is granted until
the link is activated out-of-band (the same verification step that flips
`guardianConsent`). A verification endpoint is the natural next step (📝).

### H2 — Rate limits bypassable via spoofed `X-Forwarded-For` ✅
`packages/api/src/trpc.ts` — `clientIp`

`clientIp()` returned `xff.split(',')[0]` — the *leftmost* `X-Forwarded-For`
hop. Behind Vercel (and most proxies) the leftmost value is whatever the client
sent; the platform appends the real client IP. An attacker rotates
`X-Forwarded-For: 1.1.1.1`, `1.1.1.2`, … and every request lands in a fresh
rate-limit bucket, defeating the login/register/refresh throttles the first
review added.

**Fix:** prefer `x-real-ip` (set by the trusted proxy, not forwarded from the
client), and when only `X-Forwarded-For` is present take the **rightmost** hop
(closest to our proxy) rather than the leftmost.

### H3 — `guardianConsent` captured but never enforced ✅ (tutor path) / 📝 (rest)
`packages/api/src/routers/auth.ts`, `packages/api/src/routers/tutor.ts`

`guardianConsent` was written at signup and then read *nowhere* in the app.
Under-13 students with consent pending could still open the LLM tutor, which
ships their (PII-scrubbed) text to a third-party inference API — the single
most sensitive COPPA data-flow in the product.

**Fix:** the tutor entry points (`createSession`, `sendMessage`) now refuse a
student whose `guardianConsent` is `false`, with a clear "ask your parent or
guardian" message. Gating the rest of the app (practice attempts, roster
enrollment) behind consent is a broader product decision, scoped as a
follow-up (📝) — the tutor is fixed first because it is the external
data-sharing boundary.

### H4 — Unescaped fallback in the web KaTeX renderer (XSS) ✅
`packages/app/src/components/Katex.web.tsx`

`Katex` renders LaTeX with `katex.renderToString(tex, { throwOnError: false })`
into `dangerouslySetInnerHTML`. On the happy path KaTeX emits its own escaped
HTML (and with the default `trust: false` it won't emit `\href`/raw HTML), so
that path is safe. But the `catch` fell back to `return tex` — the **raw,
unescaped** input — and `renderToString` can still throw on some inputs even
with `throwOnError: false`.

This component renders untrusted text: `TutorChat` passes both assistant
(model) replies and the student's own messages through `MathText`, which routes
every `$…$` segment to `Katex`. On the OpenAI-compatible provider path
(self-hosted / Hugging Face), model output is not trustworthy; a crafted `$…$`
segment that forces a KaTeX throw would have injected its raw contents as HTML
in the student's browser — stored XSS via the persisted transcript.

**Fix:** the fallback now HTML-escapes the string before it reaches
`innerHTML`, so a render failure degrades to literal text, never markup. Native
(`Katex.tsx`) renders through a React Native `<Text>` node and was never
affected.

---

## Medium

### M1 — `deleteAccount` has no re-authentication and no rate limit ✅
`packages/api/src/routers/auth.ts` — `deleteAccount`

The endpoint was a bare `protectedProcedure`: a single call from any live
access token (an unlocked device, an XSS-hijacked token) irreversibly deletes
the account. Worse, `Class.teacher` is `onDelete: Cascade`, so deleting a
teacher wipes every class they own and every student enrollment in it.

**Fix:** `deleteAccount` now requires the account's current password and is
rate-limited, so a stolen access token alone cannot trigger it.

### M2 — `regents.answer` accepts answers for un-unlocked rounds ✅
`packages/api/src/routers/regents.ts` — `answer`

The `topic` (read) endpoint refuses to serve a round beyond `maxRound + 1`, but
`answer` (write) called `resolveQuestion`, which accepts any parseable id up to
`r9999`. A student could POST answers straight into round 500 they never
opened, inflating achievement counters (`regentsCorrect`, `topicsCompleted`,
`perfectTopics`) and skewing the teacher dashboard.

**Fix:** `answer` now computes the same round-reachability check as `topic`
(shared helper) and rejects a `BAD_REQUEST` for any round the student hasn't
unlocked.

### M3 — Usernames are case-sensitive (impersonation) ✅
`packages/api/src/routers/auth.ts`, `packages/db/migrations/012_username_ci.sql`

`username` uniqueness and login lookups were case-sensitive, so `admin`,
`Admin`, and `ADMIN` were three different accounts — enabling look-alike
impersonation of a teacher or admin in a class roster, and splitting the
login rate-limit bucket (keyed on `toLowerCase()`) from the DB lookup
(exact-case).

**Fix:** a `lower(username)` unique index enforces case-insensitive uniqueness
at the database, and registration / login / profile-rename now compare
case-insensitively.

### M4 — Server-side DoS via unbounded mathjs allocation in grading ✅
`packages/core/src/math/engine.ts`, `packages/core/src/math/harden.ts`

`grade()` runs on the server for every `practice.attempt` (a `protectedProcedure`
with **no rate limit**), and for `exact` / `numeric_tolerance` modes it calls
`math.evaluate(normalizeInput(submitted))` on the student's raw answer with no
scope. The full mathjs instance (`create(all, {})`) exposes matrix/range
constructors whose memory use scales with their arguments. A submission like
`ones(30000,30000)` or `range(1,2e8)` — a few dozen characters, far under the
2000-char input cap — allocates gigabytes and OOM-kills the serverless
function. Measured locally: `range(1,2e6)` alone adds ~59 MB, `ones(4000,4000)`
~67 MB; the exponents scale linearly with the (attacker-chosen) arguments.
mathjs 13 blocks the classic `constructor` RCE at the parser, so this is
resource exhaustion (CWE-400), not code execution.

**Fix:** a shared `hardenMathInstance()` disables the expression-reachable
allocation/creation functions (`matrix`, `ones`, `zeros`, `identity`, `range`
— which also closes the `a:b` range operator — `diag`, `kron`, `concat`,
`resize`, `reshape`, `fill`, `flatten`, `rotate`, the `random*` family) plus the
config-mutating `import` / `createUnit`, by overriding them with throwing
stubs. It's a denylist of things a middle-school algebra answer never contains,
applied to the grading engine and both calculator instances (the calculator
runs client-side, but this also stops a malicious saved session from OOMing the
author's browser). The JS-level APIs the code relies on (`math.parse`,
`math.evaluate`, `node.compile`, `math.format`) are untouched. A regression
test asserts a matrix/range submission is rejected in well under a second with
no allocation.

---

## Low / latent

### L1 — Unbounded string inputs on auth paths ✅
`packages/api/src/routers/auth.ts`

`login` (`username`, `password`), `refresh`/`logout` (`refreshToken`), and
`changePassword` (`currentPassword`) accepted unbounded `z.string()`. A
multi-megabyte "password" would be handed straight to bcrypt.

**Fix:** added `.max()` bounds matching the register schema (username ≤ 32,
passwords ≤ 128, refresh token ≤ 256).

### L2 — Public `logout` is unthrottled ✅
`packages/api/src/routers/auth.ts` — `logout`

`logout` is a public, unauthenticated mutation that writes to the database on
every call. It had no rate limit — a cheap way to hammer the DB, and (given a
scraped refresh-cookie value) to pre-emptively revoke someone's session.

**Fix:** a per-IP throttle now covers `logout`.

### L3 — Service-worker API cache pattern is a latent cross-user leak ✅
`apps/web/public/sw.js` — `CACHEABLE_API`

`CACHEABLE_API = /\/api\/(curriculum|lessons\/|reference-sheet)/` currently
matches nothing (the real API lives under `/api/trpc/*`), but the moment
someone adds a plain `/api/curriculum` returning per-user mastery, the
`networkFirst` cache would store one student's response and serve it to the
next user of a shared device.

**Fix:** narrowed the pattern to only the genuinely public, user-independent
reference-sheet route, so a future per-user endpoint can never fall into it by
accident.

### L4 — JWT secret silently falls back to an ephemeral value in production ✅
`packages/api/src/config.ts` — `resolveJwtSecret`

On a serverless deploy where `.data/` is not writable and `JWT_SECRET` is
unset, each cold start minted its *own* random secret. Tokens signed by one
instance are `UNAUTHORIZED` on another — a silent, intermittent auth outage
announced only by a `console.warn`.

**Fix:** in a production/serverless environment (`NODE_ENV=production` or
`VERCEL`), a missing `JWT_SECRET` with an unwritable data dir now throws at
startup instead of degrading to an ephemeral secret. Local dev is unchanged.

### L5 — Anthropic error body echoed into server logs ✅
`packages/core/src/admin/usage.ts`, `packages/api/src/routers/admin.ts`

On an Admin-API error, `fetchAllPages` put up to 300 chars of Anthropic's raw
error body into the thrown `Error.message`, which the admin router logs.
Anthropic does not echo the API key today, but any field they add later
(workspace ids, account emails) would land verbatim in logs.

**Fix:** the thrown error now carries only the HTTP status and a short static
label, not the upstream body.
