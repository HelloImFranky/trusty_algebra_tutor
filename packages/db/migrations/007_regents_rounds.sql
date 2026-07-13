-- Regents Review rounds: round 0 is the handwritten question bank; rounds
-- >= 1 are procedurally generated "practice again" sets (question ids like
-- "linear-equations:r2:q3"). Generated questions are never stored — they are
-- reconstructed deterministically from (user, topic, round, slot) — so the
-- existing (user_id, question_id) uniqueness still gives one try per
-- question. The round column lets progress queries separate first-run
-- results (badges) from extra practice.
ALTER TABLE regents_answers ADD COLUMN IF NOT EXISTS round INT NOT NULL DEFAULT 0;
