-- Admin role + account status (docs/teacher-dashboard-plan.md, Stage 2).
-- Teachers self-register as 'pending' and stay fail-closed until an admin
-- approves them; admins are created out-of-band (npm run create-admin).
-- Idempotent like every migration here.

-- Widen the role CHECK to include 'admin'. The inline column constraint from
-- 001 is named users_role_check by default; drop-and-recreate is safe to rerun.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student','guardian','teacher','admin'));

-- Account lifecycle: everyone active by default; self-registered teachers are
-- set to 'pending' by the API until approved; 'disabled' revokes access.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','pending','disabled'));
