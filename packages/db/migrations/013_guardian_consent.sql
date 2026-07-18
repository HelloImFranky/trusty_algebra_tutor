-- Guardian consent audit records (docs/guardian-consent-plan.md, Tier 0).
-- One row per consent event; the student's users.guardian_consent boolean is a
-- derived cache flipped in the same transaction. Never delete rows on revoke —
-- set status='revoked' so the history is preserved for COPPA record-keeping.
-- Idempotent like every migration here.

CREATE TABLE IF NOT EXISTS guardian_consents (
  id                 BIGSERIAL PRIMARY KEY,
  student_user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method             TEXT NOT NULL
                       CHECK (method IN ('school','admin_manual','email_plus','guardian_account')),
  -- teacher/admin who attested; NULL for the email flows (Tier 1).
  granted_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  guardian_email     TEXT,
  note               TEXT,
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','revoked')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_guardian_consents_student
  ON guardian_consents(student_user_id);
