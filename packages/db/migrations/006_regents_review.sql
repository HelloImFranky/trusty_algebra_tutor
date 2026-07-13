-- Regents Review answers. The question bank itself lives in the content
-- package (@tutor/core regentsTopics) and is served straight from the API,
-- so only the student's answers persist here. One row per (user, question):
-- students get a single try per question, enforced by the unique constraint.
CREATE TABLE IF NOT EXISTS regents_answers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_slug TEXT NOT NULL,
  question_id TEXT NOT NULL,
  choice_index INT NOT NULL,
  correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT regents_answers_user_question_key UNIQUE (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_regents_answers_user_topic
  ON regents_answers (user_id, topic_slug);
