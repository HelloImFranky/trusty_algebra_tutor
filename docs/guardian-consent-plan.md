# Guardian Consent — Design & Implementation Plan

Follow-up to `docs/security-review-2.md` **H1** (guardian links are created
`pending` from an unverified email) and **H3** (the tutor is gated on
`guardianConsent`). Those fixes closed the *hole* — nothing grants access from
an unverified email anymore — but left no supported way to actually **grant**
consent except a manual SQL `UPDATE`. This doc specifies that mechanism.

Written so a fresh session can pick it up tier by tier. Tier 0 is fully
specified and ready to build; Tiers 1–2 are scoped and flagged with their
blockers.

---

## Background: two different things called "consent"

The code has two separate gates, and it's important not to conflate them:

1. **`student.guardianConsent`** (a `Boolean` on the student's `users` row) —
   permission for *the child* to use data-collecting features. Today only the
   **tutor** reads it (`packages/api/src/routers/tutor.ts`,
   `assertTutorConsent`), because the tutor is the one path that sends student
   text to a third-party LLM. This is the COPPA "verifiable parental consent"
   flag.

2. **`GuardianLink.status`** (`pending` | `active`) — a *specific guardian's*
   read access to a *specific child's* records via `progress.student`. This is
   about a parent seeing the dashboard, not about the child using the app.

**These are independent.** School-provided consent (Tier 0) satisfies #1 for
the child without any guardian account existing. A parent seeing the dashboard
(#2) always requires that parent's own verified account and is handled by the
email flow (Tier 1) or guardian-account approval (an alternative below). Tier 0
deliberately does **not** auto-activate guardian *links* — attestation that the
school collected consent is not proof that a given email address belongs to a
given parent.

### Current persisted state (facts the spec relies on)
- `under13` is **not** stored — it's only used at signup to set the
  `guardianConsent` default (`packages/api/src/routers/auth.ts`). Therefore
  **`role = 'student' AND guardianConsent = false` is exactly the set of
  students who still need consent.** (13+ students and all non-students are
  created `guardianConsent = true`.)
- A `GuardianLink` is created at signup **only if a guardian account already
  exists** for the supplied email; otherwise the under-13 student has no link
  at all — just `guardianConsent = false`.
- There is **no mail infrastructure** in the repo today.

---

## Deployment model (the decision that drives everything)

**Primary: school-deployed.** The app is built around teachers, classes, admin
approval, and is modeled on a real classroom. Under COPPA, a **school may
provide consent on the parent's behalf** for ed-tech used for a school
purpose. That path needs **no parent-email round-trip** and is the primary
mechanism here (Tier 0).

**Secondary: direct-to-consumer**, handled later by an email verification flow
(Tier 1). Likely mail provider: **Gmail / Google Workspace** — needs research
(see Tier 1 for the sub-options and caveats). Not required for Tier 0.

---

## Data model (shared by all tiers)

A consent **record** is the audit source of truth (COPPA requires keeping a
record of consent obtained). The `guardianConsent` boolean becomes a derived
cache of "an active consent record exists," flipped in the same transaction.

### Migration `013_guardian_consent.sql` (idempotent, like the others)
```sql
-- Guardian consent audit records (docs/guardian-consent-plan.md).
-- One row per consent event; the student's users.guardian_consent boolean is a
-- derived cache flipped in the same transaction. Never delete rows on revoke —
-- set status='revoked' so the history is preserved for COPPA record-keeping.
CREATE TABLE IF NOT EXISTS guardian_consents (
  id                BIGSERIAL PRIMARY KEY,
  student_user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method            TEXT NOT NULL
                      CHECK (method IN ('school','admin_manual','email_plus','guardian_account')),
  granted_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, -- teacher/admin actor; NULL for email flows
  guardian_email    TEXT,          -- recorded for email flows / audit
  note              TEXT,          -- free-text (e.g. "signed form on file 2026-09-01")
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_guardian_consents_student
  ON guardian_consents (student_user_id);
```

### Prisma model (mirror in `packages/db/prisma/schema.prisma`)
```prisma
model GuardianConsent {
  id              BigInt    @id @default(autoincrement())
  studentUserId   BigInt    @map("student_user_id")
  method          String
  grantedByUserId BigInt?   @map("granted_by_user_id")
  guardianEmail   String?   @map("guardian_email")
  note            String?
  status          String    @default("active")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  revokedAt       DateTime? @map("revoked_at")
  student         User      @relation("consentStudent", fields: [studentUserId], references: [id], onDelete: Cascade)

  @@index([studentUserId], map: "idx_guardian_consents_student")
  @@map("guardian_consents")
}
```
(Add the back-relation on `User`, and remember to re-run
`node packages/db/scripts/embed-migrations.mjs` so the runner embeds `013`.)

**Source-of-truth rule:** `guardianConsent = (an active guardian_consents row
exists)`. Every tier writes a record and flips the boolean in one transaction,
so they can never disagree.

---

## Tier 0 — School / admin attestation (build first)

Goal: let a teacher (or admin) record that the school obtained parental consent
for a student, unblocking that student's use of the tutor. No new infra. This
is the whole answer for a pure school deployment.

### Endpoints

**`teacher.verifyGuardianConsent`** — primary path.
- Procedure: `teacherProcedure` (active teacher only).
- Input: `{ studentId: number, note?: string (max 500) }`. `method` is fixed to
  `'school'` server-side.
- Authorization: the student must be **actively enrolled in a class the caller
  owns** — reuse the exact check already in `progress.student`'s teacher branch
  (active `ClassEnrollment` in a non-archived class where
  `teacherUserId = ctx.user.id`). Factor that check into a shared
  `teacherCanSeeStudent(teacherId, studentId)` helper and use it in both
  places. Fail closed → `FORBIDDEN`.
- Effect (one transaction):
  1. Confirm the target is `role = 'student'` (else `NOT_FOUND`).
  2. Insert a `guardian_consents` row: `method='school'`,
     `grantedByUserId = ctx.user.id`, `note`.
  3. `UPDATE users SET guardian_consent = true WHERE id = studentId`.
  4. Do **not** touch `GuardianLink` rows (see "two different things" above).
- Idempotent: attesting again for an already-consented student is allowed and
  succeeds; it appends a fresh audit row (multiple attestations are legitimate
  history) but the boolean is already true. Return `{ ok: true }`.

**`admin.verifyGuardianConsent`** — optional override / governance.
- Procedure: `adminProcedure`. Same effect, `method='admin_manual'`, any
  student (no roster scope).
- **Least-privilege note:** the admin router is currently documented as
  *not* reaching student records (`packages/api/src/routers/admin.ts`). Adding
  this widens that surface by exactly one write. Acceptable for governance, but
  call it out in the PR. If we'd rather keep admin fully student-data-free, drop
  this endpoint and rely on the teacher path only. **Open decision.**

### Read surfacing (so teachers know who's outstanding)
Add `guardianConsent` to the roster projection in
`teacher.classes.roster` (`packages/api/src/routers/teacher.ts` already selects
`student: { select: { id, displayName, grade } }` — add `guardianConsent`).
Surface a `consentPending: role==='student' && !guardianConsent` flag per
student so the roster UI can badge "needs consent" and offer the attest action.
No new query.

### Validation / errors
- `studentId` — `z.number().int()`.
- `note` — `z.string().max(500).optional()`.
- Non-teacher/non-admin → `FORBIDDEN` (procedure guard).
- Student not in roster (teacher path) → `FORBIDDEN`.
- Target not a student → `NOT_FOUND`.

### Tests (extend `packages/api/src/api.test.ts`)
- Teacher attests for a student in their class → `guardianConsent` becomes
  true, a `guardian_consents` row exists with `method='school'` and the
  teacher's id, and the previously-blocked `tutor.createSession` now succeeds
  for that student.
- Teacher attesting for a student **not** in their class → `FORBIDDEN`, no row
  written, `guardianConsent` unchanged.
- Non-teacher (student/guardian) → `FORBIDDEN`.
- Idempotent re-attestation succeeds and appends a second audit row.
- Roster surfaces `consentPending` correctly before/after attestation.
- (If kept) admin override attests for an out-of-roster student.

### Explicitly out of scope for Tier 0
- Activating guardian *links* / guardian dashboard access (Tier 1 / alt A).
- Revocation (Tier 2).
- Any email.

---

## Tier 1 — Email "email-plus" verification (direct-to-consumer)

**Blocked on choosing a mail provider** (leaning Gmail / Google Workspace —
needs research). Scoped now so it's ready when infra lands.

### Flow
- Table `guardian_consent_tokens`: `studentUserId`, `tokenHash` (sha256, same
  pattern as `refresh_tokens`), `guardianEmail`, `expiresAt` (~72h),
  `consumedAt`.
- `auth.requestGuardianConsent` — issued at under-13 signup and re-sendable;
  per-IP + per-student rate-limited; emails the guardian a one-time link
  (`/consent?token=…`) or a short code.
- `auth.confirmGuardianConsent({ token })` — **public**, throttled; verifies +
  in one transaction writes a `guardian_consents` row (`method='email_plus'`,
  `guardianEmail`), flips `guardianConsent`, marks the token consumed, and
  (this being proof the email is controlled) may activate the matching
  `GuardianLink`. Idempotent on replay of a consumed/expired token.
- "email-plus": send a second confirmation to the same address after
  activation — the standard low-friction COPPA method for internal-use data.

### Gmail / Google Workspace sub-options (to research)
- **SMTP relay** via a Workspace account + app password / SMTP relay service —
  simplest to wire (nodemailer), but Gmail sending limits (~500–2000/day) and
  deliverability (SPF/DKIM/DMARC alignment on the sending domain) need review.
- **Gmail API** with a service account + domain-wide delegation — more setup,
  better for a Workspace-owned domain.
- Either way: never commit credentials; read from encrypted host env vars
  (same discipline as `ANTHROPIC_API_KEY`).
- Decision criteria to capture during research: expected volume, sending
  domain, deliverability, bounce handling, cost.

---

## Tier 2 — Revocation & re-verification (hardening)

- `revokeGuardianConsent({ studentId })` (teacher/admin, scoped as Tier 0): set
  the active `guardian_consents` row(s) `status='revoked'`, `revoked_at=now()`,
  set `guardianConsent=false`, and re-gate the tutor immediately (already reads
  fresh each request). Also flip any active `GuardianLink` back to `pending`.
- Optional policy: consent expiry / annual re-attestation.

---

## Alternatives considered (for the record)

| Option | Proof strength | Infra | Notes |
|---|---|---|---|
| **School/teacher attestation** (Tier 0, chosen primary) | Strongest for ed-tech (COPPA school exception) | None | Matches deployment; audit row records who/when |
| **Email one-time code / link** (Tier 1) | Medium ("email-plus") | Mailer | The D2C path |
| **Guardian-account approval** | Medium (controls account, not proof of parenthood) | None | Guardian logs in, approves a pending request in their dashboard. Chicken-and-egg: link only exists if guardian pre-registered, so needs a "claim on later signup" path. A good complement to Tier 1 for the *guardian-link* half. |
| **Admin manual endpoint** | Human | None | Folded into Tier 0 as the admin override |
| **Third-party verifiable consent** (card auth, ID, KBA) | Gold standard | Heavy (vendor) | Overkill unless disclosing data to third parties at D2C scale |

---

## Open decisions
1. **Admin override endpoint** — keep `admin.verifyGuardianConsent` (widens the
   admin surface by one write) or teacher-only? (Leaning: keep, clearly noted.)
2. **Guardian-link activation** — pursue the email flow (Tier 1) or
   guardian-account approval (alt A) for the *guardian dashboard* half? (Can
   decide when Tier 1 is scheduled.)
3. **Mail provider** — Gmail SMTP relay vs Gmail API vs another provider
   (research in progress).

## Build order
1. **Tier 0** — migration `013` + `GuardianConsent` model, shared
   `teacherCanSeeStudent` helper, `teacher.verifyGuardianConsent` (+ optional
   admin override), roster `consentPending` surfacing, tests. No new infra.
2. **Tier 1** — after a mail provider is chosen.
3. **Tier 2** — revocation, once Tier 0/1 are in use.
