-- Core schema for the Algebra Tutor (design doc §7).
-- Content is data, not code: curriculum rows carry a content_version and are
-- editable without deploys.

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('student','guardian','teacher')),
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en','es')),
  grade         INT,
  -- COPPA: students never store an email; guardians/teachers may.
  email         TEXT,
  guardian_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS guardian_links (
  guardian_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','revoked')),
  PRIMARY KEY (guardian_user_id, student_user_id)
);

CREATE TABLE IF NOT EXISTS units (
  id        BIGSERIAL PRIMARY KEY,
  number    INT NOT NULL UNIQUE,
  title_en  TEXT NOT NULL,
  title_es  TEXT NOT NULL,
  position  INT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id              BIGSERIAL PRIMARY KEY,
  unit_id         BIGINT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  code            TEXT NOT NULL UNIQUE,      -- e.g. "2.3"
  title_en        TEXT NOT NULL,
  title_es        TEXT NOT NULL,
  position        INT NOT NULL,
  content_version INT NOT NULL DEFAULT 1,
  -- persistent hint chip in the lesson player (FOIL, PEMDAS, ...)
  mnemonic_en     TEXT,
  mnemonic_es     TEXT
);
CREATE INDEX IF NOT EXISTS idx_lessons_unit ON lessons(unit_id);

-- Scaffolded explanation: ordered numbered steps, exactly like the classroom
-- scaffolds doc ("STEP 1: ...", worked example, hint/mnemonic).
CREATE TABLE IF NOT EXISTS lesson_steps (
  id                    BIGSERIAL PRIMARY KEY,
  lesson_id             BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position              INT NOT NULL,
  body_en               TEXT NOT NULL,
  body_es               TEXT NOT NULL,
  worked_example_latex  TEXT,
  hint_en               TEXT,
  hint_es               TEXT
);
CREATE INDEX IF NOT EXISTS idx_lesson_steps_lesson ON lesson_steps(lesson_id);

CREATE TABLE IF NOT EXISTS skills (
  id          BIGSERIAL PRIMARY KEY,
  lesson_id   BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE,
  name_en     TEXT NOT NULL,
  name_es     TEXT NOT NULL,
  description TEXT
);
CREATE INDEX IF NOT EXISTS idx_skills_lesson ON skills(lesson_id);

CREATE TABLE IF NOT EXISTS problems (
  id           BIGSERIAL PRIMARY KEY,
  skill_id     BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  tier         TEXT NOT NULL CHECK (tier IN ('modified','standard','challenge')),
  prompt_en    TEXT NOT NULL,
  prompt_es    TEXT NOT NULL,
  answer_latex TEXT NOT NULL,
  grading_mode TEXT NOT NULL CHECK (grading_mode IN ('equivalent','canonical_form','exact','numeric_tolerance')),
  tolerance    DOUBLE PRECISION,             -- for numeric_tolerance
  params_json  JSONB,                        -- template id + params for procedurally generated variants
  is_sprint    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_problems_skill ON problems(skill_id, tier);

-- Ordered checkable steps per problem: what makes this a tutor, not a quiz.
CREATE TABLE IF NOT EXISTS problem_steps (
  id             BIGSERIAL PRIMARY KEY,
  problem_id     BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  position       INT NOT NULL,
  prompt_en      TEXT NOT NULL,
  prompt_es      TEXT NOT NULL,
  expected_latex TEXT NOT NULL,
  grading_mode   TEXT NOT NULL CHECK (grading_mode IN ('equivalent','canonical_form','exact','numeric_tolerance')),
  hint_en        TEXT,
  hint_es        TEXT
);
CREATE INDEX IF NOT EXISTS idx_problem_steps_problem ON problem_steps(problem_id);

-- Append-only attempt log (offline sync + analytics).
CREATE TABLE IF NOT EXISTS attempts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id      BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  submitted_latex TEXT NOT NULL,
  correct         BOOLEAN NOT NULL,
  hints_used      INT NOT NULL DEFAULT 0,
  step_reached    INT NOT NULL DEFAULT 0,
  duration_ms     INT,
  context         TEXT NOT NULL DEFAULT 'practice' CHECK (context IN ('practice','exit_ticket','sprint','review')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_user_problem ON attempts(user_id, problem_id);

CREATE TABLE IF NOT EXISTS mastery (
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id          BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  score             DOUBLE PRECISION NOT NULL DEFAULT 0,
  attempts_count    INT NOT NULL DEFAULT 0,
  last_practiced_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS exit_tickets (
  id          BIGSERIAL PRIMARY KEY,
  lesson_id   BIGINT NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  problem_ids BIGINT[] NOT NULL
);

CREATE TABLE IF NOT EXISTS exit_ticket_results (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exit_ticket_id BIGINT NOT NULL REFERENCES exit_tickets(id) ON DELETE CASCADE,
  score          INT NOT NULL,
  max_score      INT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_etr_user ON exit_ticket_results(user_id);

-- Tutor chat transcripts (PII-scrubbed before storage) for safety review.
CREATE TABLE IF NOT EXISTS tutor_sessions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id      BIGINT REFERENCES problems(id) ON DELETE SET NULL,
  lesson_id       BIGINT REFERENCES lessons(id) ON DELETE SET NULL,
  transcript_json JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_user ON tutor_sessions(user_id);
