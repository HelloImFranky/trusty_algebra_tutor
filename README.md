# ∑ Trusty Algebra Tutor

A free, self-paced **Algebra 1 tutor** for middle school, modeled on a real
accelerated 8th-grade classroom (the "Algebra 891" curriculum) and aligned to
the NY Algebra I (NGLS) Regents standards. Scaffolded lessons, adaptive
practice, step-by-step help, and Regents-style review — in **English and
Spanish**, on any phone, tablet, or Chromebook. No install for students: it's a
PWA you open from a link.

## Features

- **9-unit course** with per-lesson mastery tracking (Not started → Practicing → Proficient → Mastered).
- **Lessons** with worked examples and the teacher's **original scaffold notes** rendered straight from the class document.
- **Adaptive practice** in modified / standard / challenge tiers, picked from each student's live mastery.
- **Step-by-step grading** — a CAS math engine accepts any equivalent form and, where it matters, insists on the taught final form. It never just says "incorrect"; it walks you through the fix one step at a time.
- **Hints & AI tutor** — a deterministic hint ladder plus an optional chat tutor that teaches the method and never gives away answers.
- **Sprint** timed speed rounds (1 minute per 10 questions) over easy 6th/7th-grade fluency skills, **Regents Review** with freshly generated problem sets, and a built-in **graphing calculator** + **reference sheet**.
- **Progress** tracking (streaks, minutes, mastery map) visible to students, and read-only to teachers and guardians.
- **Bilingual (EN/ES)**, **offline-capable** (answers queue on-device and sync when back online), and privacy-first (no student email; COPPA/FERPA-aware; AI chat is PII-scrubbed).

## Tech stack

**Turborepo** monorepo, **TypeScript** end-to-end. One Next.js server hosts the
student PWA, the typed API, and the scaffold images on a single URL; the Expo
app reuses the exact same screens.

| Layer | Technology |
|---|---|
| Web | Next.js 15 (App Router), React 19, react-native-web |
| Native | Expo 54 / expo-router 6, React Native 0.81, Reanimated 4 |
| Shared UI | Tamagui 1.12, Solito 4 (navigation), Zustand, TanStack Query, KaTeX |
| API | tRPC v11, Zod, superjson, JWT (`jsonwebtoken`) + bcrypt auth |
| Data | Prisma 6 + PostgreSQL (`pg`) |
| Core logic | mathjs (CAS grading engine), problem generators, mastery model, curriculum content (EN/ES) |
| AI tutor | Anthropic SDK, plus any OpenAI-compatible endpoint (Hugging Face / Ollama) |
| Tooling | Turbo, Vitest, Prisma migrations, Vercel deploy |

```
apps/
  web/       Next.js 15 (App Router) — student PWA + tRPC API on one port
  native/    Expo (expo-router) — iOS/Android app sharing the same screens
packages/
  app/       shared UI: Tamagui + Solito, i18n, tRPC client, offline queue
  api/       tRPC v11 routers (Zod): auth, curriculum, practice, progress, tutor
  db/        Prisma schema + client, SQL migrations, curriculum seed
  core/      CAS math engine, problem generators, mastery model, content, tutor providers
```

## Install & run

Requires **Node.js 20+** and **PostgreSQL**. Migrations and the full 9-unit
curriculum seed run automatically on first boot — no manual DB steps.

**Local (one command):**

```bash
./scripts/start.sh          # installs deps, creates DB, seeds, starts on :3000
```

Then open **http://localhost:3000**. Students on the same network can use your
machine's address (e.g. `http://192.168.1.20:3000`).

**Dev mode:**

```bash
npm install                 # also generates the Prisma client
npm run dev                 # Next.js web app + API, hot reload on :3000
npm run dev:native          # Expo dev server for the mobile app
npm test                    # engine, generators, mastery, tRPC integration tests
npm run typecheck           # every workspace
npm run build               # production build (turbo)
```

Dev/tests need a local PostgreSQL plus an `algebra_tutor_test` database.

**Deploy to the web (Vercel):**

```bash
npm run deploy              # links, sets the login secret, deploys, prints the URL
```

The first run asks you to create a Postgres database in the Vercel dashboard
(**Storage → Create Database → Postgres**), connect it, and re-run — a one-time
click. Every deploy after that is just the one command.

**Native app (optional):**

```bash
cd apps/native
cp .env.example .env        # set EXPO_PUBLIC_API_URL to your web address
npm run dev                 # scan the QR code with Expo Go
```

App-store builds use `npx eas build` ([EAS docs](https://docs.expo.dev/eas/)).

## AI tutor (optional)

Step-by-step hints work with no AI setup. The conversational tutor is an extra
layer — set **one** provider in a `.env` file at the repo root (never grades;
that's the math engine's job):

```bash
# Free — open model on Hugging Face
TUTOR_PROVIDER=openai
HF_TOKEN=hf_xxx
TUTOR_MODEL=Qwen/Qwen2.5-7B-Instruct

# Free & private — local model via Ollama
TUTOR_PROVIDER=openai
TUTOR_BASE_URL=http://localhost:11434/v1
TUTOR_MODEL=qwen2.5

# Paid — Claude (strongest quality & guardrails)
ANTHROPIC_API_KEY=sk-ant-...
```

If nothing is set, the tutor button falls back to the built-in hints. Prefer
general instruct models over math-*solver* models — solvers blurt full
solutions, the opposite of a good tutor.

## Configuration

All settings are optional.

| Setting | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | local `algebra_tutor` db | PostgreSQL connection |
| `JWT_SECRET` | auto-generated & saved | login-token signing key. **Recommended: set it explicitly in production** (the deploy script sets it on Vercel for you) — it keeps the key out of database backups. Without it, the key is saved to `DATA_DIR` locally, or to the database on read-only hosts like Vercel. Setting it later is safe: users stay logged in (sessions refresh seamlessly) and the database copy is removed automatically. |
| `TUTOR_PROVIDER` | auto-detect | `openai`, `anthropic`, or `none` |
| `HF_TOKEN` / `TUTOR_API_KEY` | — | token for the OpenAI-compatible tutor endpoint |
| `TUTOR_BASE_URL` | Hugging Face router | tutor endpoint (e.g. `http://localhost:11434/v1`) |
| `TUTOR_MODEL` | `Qwen/Qwen2.5-7B-Instruct` | tutor model id |
| `ANTHROPIC_API_KEY` | — | use Claude for the tutor |
| `PORT` | `3000` | web app port |
| `DATA_DIR` | `.data` | where the login key is stored (local hosting only) |
| `EXPO_PUBLIC_API_URL` | — | native app only: your web address |

## Updating the scaffold notes

Scaffold notes render straight from the class document
(`scripts/Algebra Scaffolds__891.docx`). To refresh them, replace the file and
run:

```bash
pip install pymupdf Pillow        # first time only; LibreOffice also required
python3 scripts/ingest_scaffold_images.py "scripts/Algebra Scaffolds__891.docx"
```

Redeploy or restart, and lessons pick up the new notes automatically.

## Design notes

- **Content is data, not code** — the curriculum lives in versioned Postgres rows seeded from `packages/core/src/content/`; the attempts log is append-only.
- **Grading** (`packages/core/src/math/engine.ts`) has 4 modes: `equivalent`, `canonical_form`, `exact`, `numeric_tolerance`. Never string equality, never the LLM.
- **One shared UI** — screens written once in Tamagui run on web and native; web-only pieces (KaTeX, graph pan/zoom) have `.web.tsx` variants with native fallbacks.
- **Type-safety chain** — Prisma → tRPC + Zod → client; a schema change that breaks a screen fails `npm run typecheck`, not class.
- **Mastery model** — rolling accuracy with recency decay, which re-surfaces stale skills in Regents review.
- **react/react-dom are pinned** via root `overrides` to the Expo SDK pairing so web and native share one React copy.
