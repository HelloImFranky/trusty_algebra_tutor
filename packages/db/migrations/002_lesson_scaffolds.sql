-- The original classroom scaffold sections, attached to the lesson they
-- teach, so students can open the real resource inside the lesson player.
CREATE TABLE IF NOT EXISTS lesson_scaffolds (
  id        BIGSERIAL PRIMARY KEY,
  lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position  INT NOT NULL,
  title     TEXT NOT NULL,
  body_md   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lesson_scaffolds_lesson ON lesson_scaffolds(lesson_id, position);
