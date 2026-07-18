-- Auto-generated runtime secrets (currently the JWT signing secret) for
-- deploys where the filesystem isn't writable (serverless: Vercel's bundle
-- fs is read-only). Every instance shares the database, so a secret stored
-- here is one secret for the whole deployment — the property the JWT
-- fail-hard security fix protects (no silent per-instance secrets).
-- JWT_SECRET in the environment still takes precedence over this table.
-- Idempotent like every migration here.

CREATE TABLE IF NOT EXISTS app_secrets (
  name       TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
