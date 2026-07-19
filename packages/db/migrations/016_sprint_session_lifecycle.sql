-- Sprint rounds become observable while they run: a round now OPENS a row
-- (started_at set, ended_at NULL) and CLOSES it on completion. The live
-- leaderboards count correct sprint attempts since started_at for open
-- rounds, so classmates' scores tick up mid-sprint. Pre-existing rows were
-- written only at completion — backfill both timestamps from created_at so
-- they all count as finished rounds. total relaxes to >= 0 because an open
-- round has no attempts yet. Idempotent like every migration here.

ALTER TABLE sprint_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE sprint_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

UPDATE sprint_sessions SET started_at = created_at WHERE started_at IS NULL;
UPDATE sprint_sessions SET ended_at = created_at
  WHERE ended_at IS NULL AND total > 0;

ALTER TABLE sprint_sessions ALTER COLUMN started_at SET DEFAULT now();
ALTER TABLE sprint_sessions ALTER COLUMN started_at SET NOT NULL;

ALTER TABLE sprint_sessions DROP CONSTRAINT IF EXISTS sprint_sessions_total_check;
ALTER TABLE sprint_sessions ADD CONSTRAINT sprint_sessions_total_check CHECK (total >= 0);

-- Leaderboard windows filter on started_at (open rounds, today, this week).
CREATE INDEX IF NOT EXISTS idx_sprint_sessions_started
  ON sprint_sessions(user_id, started_at);
