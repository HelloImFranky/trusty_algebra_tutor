-- Weekly mastery history (docs/statistics-plan.md, Phase 3). The mastery
-- table is a live snapshot that overwrites itself on every attempt, so
-- growth over time was unrecoverable. This table keeps one row per
-- (student, skill, week): the practice path upserts the CURRENT week's row
-- whenever mastery is written, so each row converges to that week's closing
-- score. History accrues from deploy forward — there is nothing to
-- backfill, because the old scores are gone by design. Idempotent like
-- every migration here.

CREATE TABLE IF NOT EXISTS mastery_snapshots (
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id       BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  -- Monday (date) of the ISO week the row describes.
  week_start     DATE NOT NULL,
  score          DOUBLE PRECISION NOT NULL,
  attempts_count INT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_mastery_snapshots_week ON mastery_snapshots(week_start);
