---
name: verify
description: Build, launch, and drive the Algebra Tutor app (Turborepo: Postgres + Next.js web/API + Expo native) to verify changes end-to-end.
---

# Verifying the Algebra Tutor

## Build & launch

```bash
# 1. Postgres (local cluster)
service postgresql start
# roles/dbs if missing:
#   sudo -u postgres psql -c "CREATE ROLE tutor WITH LOGIN PASSWORD 'tutor' CREATEDB;" \
#     -c "CREATE DATABASE algebra_tutor OWNER tutor;" -c "CREATE DATABASE algebra_tutor_test OWNER tutor;"

# 2. Deps (also runs prisma generate + migration embed via postinstall)
npm install

# 3. Tests + typecheck (API tests hit algebra_tutor_test)
npm test && npm run typecheck

# 4. Build + run the web app (serves the PWA AND the tRPC API on :3000;
#    migrations + seed run automatically at startup via instrumentation.ts)
npx turbo build --filter=@tutor/web
cd apps/web && npx next start        # or: npm run dev (hot reload)
curl -s localhost:3000/              # 200 = up; watch stdout for "scaffolds synced"

# 5. Expo native app: bundle checks (no device here)
cd apps/native && npx expo export --platform ios --output-dir /tmp/e2e-ios
```

## Drive it (headless browser)

Playwright chromium is at `/opt/pw-browsers/chromium` (use
`executablePath`, never `playwright install`). Key flows:

1. Register at `/register` — 4 inputs: username, password, display name,
   grade (check the under-13 box → guardian email appears).
2. Curriculum map `/` — 9 unit cards with mastery badges.
3. Lesson `/lesson/:id` — "Original scaffold notes from class" panel; click a
   `text=▸` row to open a scaffold; expect `img[src*="/scaffolds/"]`.
   Click "Continue →" until "✏️ Practice" appears.
4. Practice — answers can be looked up in Postgres
   (`SELECT answer_latex FROM problems WHERE id=...`). Wrong answer → "Not
   quite"; Hint escalates; "Walk me through it" enters per-step mode.
5. Tutor chat streams a graceful fallback when no LLM key is configured.
6. `/progress`, `/sprint`, `/review`, `/calculator` (Calculate/Graph/Table tabs;
   engine-rendered svg, drag-pan + wheel-zoom; autosaves to
   `calculator_sessions`),
   language toggle (button `aria-label="language"`), reference-sheet button.

## Gotchas

- The API is tRPC at `/api/trpc` (superjson + httpBatchStreamLink) — drive it
  through the client libs or the UI, not by hand-rolled curl.
- `npm test --workspace @tutor/api` truncates users in `algebra_tutor_test`
  but keeps the seeded curriculum.
- Prisma returns BIGINT ids as BigInt — the API converts at its DTO boundary;
  keep `Number(...)` on new id fields.
- react/react-dom are pinned via root `overrides` (Expo SDK pairing); a
  duplicate react manifests as "Cannot read properties of null (useContext)"
  during `next build` prerender.
