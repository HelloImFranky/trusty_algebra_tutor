-- Track animated-walkthrough opens per attempt, separately from hints.
-- Opening the animator during guided practice still costs a hint (client
-- behavior, unchanged); this column exists so we can measure whether
-- watching animations correlates with mastery.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS anim_views INTEGER NOT NULL DEFAULT 0;
