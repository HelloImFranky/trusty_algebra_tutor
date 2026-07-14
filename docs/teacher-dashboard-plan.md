# Teacher Dashboard — Design & Implementation Plan

Scheduled follow-up to the branch `claude/repo-security-review-stw5sn`
(security review, 2026-07-14). That branch fixed the access-control and
COPPA issues; this doc plans the teacher-facing feature those fixes cleared
the way for. Written so a fresh session can pick it up phase by phase.

**Status (2026-07-14):** Stage 1 **and** Stage 2 are implemented on branch
`admin-teacher-dash` (classes/join-codes/roster + admin-approval provisioning,
with `npm run create-admin` as the bootstrap). This doc is kept as the design
record; the sections below describe what was built.

## Why this exists

The security review found that teachers had **blanket read access to every
student's records**, and that anyone could **self-register as a teacher**.
Both were closed on the review branch:

- Teacher self-signup was removed (public registration is `student` |
  `guardian` only).
- `progress.student` now fails closed for teachers — a teacher needs an
  active link to a student, and (interim) that link is a `guardian_links`
  row that nothing yet creates.

The consequence: **teachers currently have no way to reach any student**,
which is the correct secure default but leaves the role unusable. This plan
builds the legitimate, consent-preserving path: teachers create classes,
students opt in with a join code, and teacher accounts themselves are
provisioned through an admin-approval flow rather than open self-signup.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Linking model | **Classes + join codes** | Classroom-shaped; student-initiated enrollment preserves the same consent posture as the guardian-email flow. A teacher never attaches to an arbitrary student id. |
| Roster depth (MVP) | **Lightweight per-student summary** | Streak, #mastered, struggle-flag count, last-active. Cheap across a 30-student class; full detail via drill-down to the existing `progress.student`. |
| Teacher provisioning | **Admin role + in-app approval** | Best governance for a school: audit trail, revocation, self-serve teacher onboarding. Bootstrapped by a one-time admin CLI. |
| Pending teachers | **Can log in** to an "awaiting approval" screen | Better UX than a hard block; every teacher feature is still fail-closed until approved. |
| Admin scope | **Governance only** | Admins approve/reject/disable teacher accounts. They do **not** get blanket access to student PII/progress — least privilege keeps the highest-value role from also being a data superuser. |

## Delivery strategy — two stages

B (admin approval) is the largest of the provisioning options, so the work
is split so the dashboard itself lands first and the approval machinery
second. Each stage is independently shippable and reviewable.

- **Stage 1** — classes, enrollment, roster, authz. Teachers provisioned by
  a temporary CLI so the feature is usable and testable end to end.
- **Stage 2** — admin role, `pending` status, approval console. Replaces the
  temporary CLI with the real provisioning flow.

Both stages are cloud-session friendly (verifiable via the `verify` skill:
vitest + typecheck + web build).

---

## Stage 1 — Classes, enrollment, roster, authorization

### Data model — migration `010_classes.sql`

Follow the numbered-SQL convention (idempotent; `embed-migrations.mjs`
embeds it; `migrate.ts` applies it in order). Mirror both tables in
`schema.prisma`.

```sql
CREATE TABLE IF NOT EXISTS classes (
  id              BIGSERIAL PRIMARY KEY,
  teacher_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  join_code       TEXT NOT NULL UNIQUE,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_user_id);

CREATE TABLE IF NOT EXISTS class_enrollments (
  class_id        BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','removed')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_user_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student
  ON class_enrollments(student_user_id);
```

### Authorization change

`progress.student` teacher branch changes from the interim
"needs a `guardian_links` row" to the real check:

> A teacher may view a student **iff** there exists a class the teacher owns
> in which the student has an `active` enrollment and the class is not
> archived.

Guardians keep the existing `guardian_links` path unchanged. This removes
the interim stopgap left by the security-review branch.

### API — `teacher` router (new) + a student-facing `classes.join`

All teacher endpoints are **ownership-scoped**: every query/mutation filters
by `teacher_user_id = ctx.user.id`, so a teacher can only ever touch their
own classes.

- `teacher.classes.list` → the caller's classes with `{ studentCount }`.
- `teacher.classes.create({ name })` → creates a class; generates a unique
  `join_code`.
- `teacher.classes.roster({ classId })` → enrolled students, each with the
  lightweight summary (streak, #mastered, struggle-flag count, last-active).
  Computed with a couple of grouped queries, not a full `buildProgress` per
  student.
- `teacher.classes.regenerateCode({ classId })` — rotate a leaked code.
- `teacher.classes.archive({ classId })` — soft-close a class.
- `teacher.classes.removeStudent({ classId, studentId })` — set enrollment
  `status='removed'`.
- `classes.join({ code })` — **student** procedure; enrolls the caller in
  the matching class (idempotent; re-activates a `removed` row).

Drill-down into a single student reuses the existing `progress.student`
(now authorized via class enrollment).

### Join-code security

Join codes are bearer secrets, so:

- **High entropy** — e.g. 8 chars of Crockford base32 (~40 bits), ambiguous
  characters removed; unique index enforces no collisions.
- **Rotatable** — `regenerateCode` invalidates the old one.
- **Rate-limited** — `classes.join` uses the existing `fixedWindowLimiter`
  (keyed by user id + IP) so codes can't be brute-forced or used to mass-
  enroll.

### UI (Solito screens + Next routes)

- `/classes` — teacher dashboard: list classes, create a class, show/copy a
  class's join code.
- `/classes/[classId]` — roster table; each row links to the existing
  `/progress/[studentId]`.
- Student "join a class" entry — a small screen or a field (enter code).
- **Role-aware nav** — `AppChrome` currently renders a fixed tab set. Make
  the tabs depend on `auth.user.role`: teachers see **Classes**; students
  keep the learner tabs.
- i18n (EN/ES) strings for every new label (`packages/app/src/lib/i18n.tsx`).

### Tests (`packages/api/src/api.test.ts`)

- create class → student joins with code → roster lists the student.
- teacher **cannot** view a non-enrolled student (`FORBIDDEN`); **can**
  after enrollment.
- bad code / rotated (old) code rejected; `join` is rate-limited.
- cross-teacher isolation: teacher B can't read teacher A's class or roster.

---

## Stage 2 — Admin role + approval provisioning

### Data model — migration `011_admin_and_status.sql`

- Add `admin` to the `users.role` CHECK constraint.
- Add account status:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','pending','disabled'));
```

Students/guardians default `active`. Self-registered teachers are forced to
`pending`.

### Bootstrap — `npm run create-admin`

The one and only out-of-band step. An idempotent CLI (in `packages/db` or a
root script) that creates the first admin and **refuses to clobber** an
existing account. This is the root of trust; everything else is in-app.

### Provisioning flow

- Reopen teacher self-signup, but the server forces `role='teacher',
  status='pending'` regardless of input.
- A `teacherProcedure` guard requires `role==='teacher' && status==='active'`.
  Pending teachers can authenticate and see an "awaiting approval" screen,
  but every class/roster endpoint is fail-closed until approved.
- The existing per-IP register rate-limit blunts pending-account spam.

### API — `admin` router (least privilege)

- `admin.teachers.listPending` / `admin.teachers.list`
- `admin.teachers.approve({ userId })` → `status='active'`
- `admin.teachers.reject({ userId })` → delete / `disabled`
- `admin.teachers.disable({ userId })` → revoke an active teacher

An `adminProcedure` guard requires `role==='admin' && status==='active'`.
**No admin endpoint reads student progress or PII** — governance only.

### UI

- `/admin` — pending-approval queue (approve / reject), teacher list
  (disable). Role-gated nav entry, admin-only.

### Tests

- a `pending` teacher is fully fail-closed (every teacher endpoint 403s).
- approve → the teacher gains class access; disable → loses it.
- a non-admin cannot reach any `admin.*` endpoint.
- an admin **cannot** read student progress (least-privilege assertion).

---

## Cross-cutting conventions

- Keep the numbered-SQL → Prisma-mirror pattern; run the `generate` script so
  `migrationsData.ts` is regenerated.
- Preserve the BigInt→number conversion at the DTO boundary.
- Reuse `fixedWindowLimiter` (from `packages/api/src/trpc.ts`) for
  `join`/rate-sensitive endpoints rather than adding new limiter machinery.
- All new user-facing text ships EN + ES.

## Open items / future

- ~~**Account settings screen (rename + change password)**~~ — ✅ shipped
  (2026-07-14). Before this, an account's display name, username, and password
  could only be changed with a direct SQL `UPDATE`. Delivered:
    - `auth.updateProfile({ displayName?, username? })` — protected +
      rate-limited (`rateLimited(20)`); a username change re-checks the
      `^[a-zA-Z0-9_.-]{3,32}$` rule and the unique constraint (`CONFLICT` on
      collision) and re-issues the access token (username is embedded in it).
    - `auth.changePassword({ currentPassword, newPassword })` — protected +
      `rateLimited(10)`; verifies the current password before hashing the new
      one (min 8), then `revokeAllUserTokens` boots every other session and
      `issueSession` mints a fresh token for the current device (cookie on
      web, body on native) so the caller stays signed in.
    - No new tables. `/settings` Solito screen (all roles) with a ⚙️ entry in
      the `AppChrome` top bar; web route `apps/web/app/settings` + native
      `apps/native/app/settings.tsx`; EN + ES strings.
    - Tests (`api.test.ts` → "account settings"): rename collision →
      `CONFLICT`; wrong current password → `UNAUTHORIZED`; successful change
      revokes old refresh tokens and rotates the credential. Browser-driven
      end-to-end via the verify skill.
  This also removes the "lost admin password ⇒ re-run the CLI" caveat noted
  in the provisioning section — the bootstrapped admin can now change their
  own credentials in-app.

- **Multi-school scoping** — a single global admin is fine for one
  deployment; per-school admin scoping is a later concern.
- **SSO / rostering (Google Classroom, Clever)** — the eventual
  institutional answer to both provisioning and enrollment; out of scope
  here but the classes/enrollment model is compatible with importing rosters
  later.
- ~~**Refresh token in httpOnly cookie (security review item #3)**~~ — ✅
  shipped. See the dedicated spec below (with an implementation note on the
  streaming correction).

---

## Spec — httpOnly refresh cookie (security review item #3)

### Problem
On web, both tokens sit in one `localStorage` blob (`packages/app/src/lib/
auth.ts`). The access token is short-lived (20 min), but the **refresh token
is valid 7 days**, so any XSS that reads `localStorage` gets a long-lived
credential — "an XSS bug" becomes persistent account takeover. The only real
fix is to put the refresh token **out of JavaScript's reach** (an `HttpOnly`
cookie). Shorter TTLs / in-memory access tokens don't remove the exfiltration.

### Constraints
- **Shared web + native client.** `trpc.ts`/`auth.ts` build for both web and
  Expo. Native has no browser cookies and AsyncStorage isn't XSS-exposed, so
  the cookie path is **web-only** and the API must support both transports.
- **tRPC sets no response headers today** (`apps/web/app/api/trpc/[trpc]/
  route.ts`) — cookie emission has to be plumbed through the fetch adapter.
- Startup currently reads tokens from storage; web must switch to a silent
  refresh on boot.
- A cookie-borne refresh token introduces a **CSRF** surface on `refresh`.

### Design
Web: refresh token → `HttpOnly; Secure(prod); SameSite=Strict; Path=/api/trpc`
cookie; access token held **in memory only** (zustand, not persisted).
Native: unchanged — refresh token in the response body + AsyncStorage.

1. **Context cookie collector.** Add a mutable `cookies: string[]` to
   `Context` (`packages/api/src/trpc.ts`). `login`/`register`/`refresh` push
   `Set-Cookie` strings onto it.
2. **Emit headers.** In `route.ts`, add `responseMeta({ ctx })` that returns
   the collected cookies as `Set-Cookie` headers. The only streamed procedure
   (`tutor.sendMessage`) sets no cookies, so this doesn't collide with
   `httpBatchStreamLink`.
3. **Dual transport.** The web client tags auth calls with a header
   (`x-auth-transport: cookie`, gated on `Platform.OS === 'web'`). Server:
   header present ⇒ read/write the refresh token via cookie and **omit it
   from the response body**; absent ⇒ today's body behavior (native).
4. **createContext** parses the refresh cookie from the `Cookie` header (it
   already inspects headers for auth/IP).
5. **Boot (web):** call `refresh` on load to get a fresh access token + user;
   failure ⇒ logged out. Native keeps `hydrateAuth`.
6. **`auth.logout` (new):** revoke the current refresh token server-side and
   clear the cookie (`Max-Age=0`). Also fixes a today-bug: logout is
   client-only, so the DB refresh token currently stays valid until expiry.
7. **Secure flag** only when serving over https (localhost dev is http).

**CSRF:** `SameSite=Strict` keeps the refresh cookie off cross-site requests,
so a malicious page can't trigger a refresh; the access token stays a header
(never auto-sent), so every other endpoint remains CSRF-immune.

### Tests & verification
- API: web mode sets the cookie + omits the body token; native mode returns
  the body token; `logout` revokes + clears; cookie carries `HttpOnly` /
  `SameSite`.
- Browser drive (verify skill): after web login, assert `localStorage` holds
  **no** refresh token and the cookie is `HttpOnly`; run login → reload →
  still-authed → logout.

### Effort
~half a day; login-critical and touches both platforms — verify in-browser
before merge. Independent of the teacher-dashboard feature; can ship anytime.

### Implementation note (shipped)
One correction to design step 2: `httpBatchStreamLink` streams **every**
response as jsonl, not just `tutor.sendMessage`, and the fetch adapter drops
`responseMeta` headers on streamed responses — so the `Set-Cookie` never
reached the browser. Fix: the client now uses a `splitLink` that routes only
`tutor.sendMessage` through `httpBatchStreamLink` and everything else through
the plain `httpBatchLink`, where `responseMeta` (and thus the cookie) works.
`responseMeta` still emits the collected `ctx.cookies` in `route.ts`.

Verified end-to-end in-browser: web register/login sets an `HttpOnly;
SameSite=Strict; Path=/api/trpc` cookie, `localStorage` holds no refresh token,
reload silently refreshes from the cookie, and logout revokes server-side +
clears the cookie. Native still returns the refresh token in the body. Covered
by the `httpOnly refresh cookie (web transport, security #3)` API tests.
