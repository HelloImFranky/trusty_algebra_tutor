-- Teacher classes + student enrollments (docs/teacher-dashboard-plan.md,
-- Stage 1). A teacher owns classes; students opt in with a join code, which
-- is the consent signal (mirrors the guardian-email flow). Idempotent like
-- every migration here.

CREATE TABLE IF NOT EXISTS classes (
  id              BIGSERIAL PRIMARY KEY,
  teacher_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- bearer secret: high-entropy, unique, rotatable (see regenerateCode).
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
