-- Case-insensitive usernames (docs/security-review-2.md M3).
-- The exact-case UNIQUE from 001 let 'admin', 'Admin', and 'ADMIN' coexist as
-- three distinct accounts, enabling look-alike impersonation of a teacher or
-- admin. Enforce uniqueness on lower(username) so casing can never fork an
-- identity. The API compares case-insensitively to match. Idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (lower(username));
