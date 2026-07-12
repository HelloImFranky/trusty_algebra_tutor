-- Misconception tagging: problems carry predicted wrong answers with targeted
-- feedback (generated from template parameters), and attempts record which
-- misconception an incorrect submission matched, so mastery/analytics can see
-- *why* students miss problems, not just that they did.
ALTER TABLE problems ADD COLUMN IF NOT EXISTS misconceptions_json JSONB;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS misconception_id TEXT;
