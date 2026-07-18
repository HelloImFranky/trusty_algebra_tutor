-- Completed sprint rounds, one row per finished sprint. Powers the
-- per-difficulty sprint badges (5 / 15 / 30 completions at each difficulty)
-- and future sprint history / personal-best views. Difficulty mirrors the
-- problem tiers; skill_slug is NULL for mixed-topic ("all topics") sprints.
-- Idempotent like every migration here.

CREATE TABLE IF NOT EXISTS sprint_sessions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('modified','standard','challenge')),
  skill_slug TEXT,
  total      INT NOT NULL CHECK (total >= 1),
  correct    INT NOT NULL CHECK (correct >= 0 AND correct <= total),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sprint_sessions_user
  ON sprint_sessions(user_id, created_at);
