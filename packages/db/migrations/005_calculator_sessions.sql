-- Saved calculator sessions (graphing-calculator architecture doc): every
-- calculation runs client-side in the math engine; the backend only stores
-- the session snapshot (expressions, window, history, variables) so work
-- follows the student across devices. One row per user, upserted.
CREATE TABLE IF NOT EXISTS calculator_sessions (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
