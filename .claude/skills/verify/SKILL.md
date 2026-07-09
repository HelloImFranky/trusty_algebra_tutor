---
name: verify
description: Build, launch, and drive the Algebra Tutor app (Postgres + Express API + React PWA) to verify changes end-to-end.
---

# Verifying the Algebra Tutor

## Build & launch

```bash
# 1. Postgres (local cluster)
service postgresql start
# roles/dbs if missing:
#   sudo -u postgres psql -c "CREATE ROLE tutor WITH LOGIN PASSWORD 'tutor' CREATEDB;" \
#     -c "CREATE DATABASE algebra_tutor OWNER tutor;" -c "CREATE DATABASE algebra_tutor_test OWNER tutor;"

# 2. Deps + DB schema + content
npm install
npm run migrate && npm run seed          # seed is a no-op when already seeded

# 3. Run both (API :4000, web :5173 with /api proxy)
cd server && npx tsx src/index.ts &      # or: npm run dev --workspace server
cd web && npx vite --port 5173 &
curl -s localhost:4000/api/health        # {"ok":true}
```

## Drive it (headless browser)

Playwright chromium is at `/opt/pw-browsers/chromium` (use
`executablePath`, never `playwright install`). A working driver script
pattern lives in the session scratchpad (`e2e/drive.mjs`); the key flows:

1. Register at `/register` (check the under-13 box → guardian email required).
2. Curriculum map `/` — 9 `.unit-card`s with mastery badges.
3. Lesson player — click a `.lesson-row`, click Continue until Practice appears.
4. Practice — the problem card carries `data-problem-id`; answers can be
   looked up in Postgres (`SELECT answer_latex FROM problems WHERE id=...`,
   steps in `problem_steps`). Wrong answer → `.feedback.bad`; Hint →
   `.feedback.warn`; "Walk me through it" enters per-step mode.
5. Exit ticket `/exit-ticket/:lessonId` — inputs in `exit_tickets.problem_ids` order.
6. `/progress`, language toggle (button `aria-label="language"`), `.fab`
   reference-sheet drawer, `/calculator`.

## Gotchas

- The tutor chat streams a graceful fallback when `ANTHROPIC_API_KEY` is unset.
- Server tests (`npm test --workspace server`) truncate users in
  `algebra_tutor_test` but keep seeded curriculum.
- pg returns BIGINT as string unless parsed — handled in `server/src/db/pool.ts`.
