# Trusty Algebra Tutor

A self-paced middle school Algebra 1 tutor modeled on a real accelerated 8th
grade classroom (the "Algebra 891" curriculum): scaffolded, step-by-step
instruction with frequent low-stakes checks, differentiated practice tiers,
and full English/Spanish localization — aligned to the NY Algebra I (NGLS)
Regents standards.

The curriculum content (scaffold steps, mnemonics like FOIL and PEMDAS,
lesson codes, exit-ticket structure) is derived directly from the source
classroom's scaffolds document and pacing calendar.

## What's inside

| Feature | Where |
|---|---|
| **Scaffolded lesson player** — numbered STEP 1/2/3 explanations, worked examples (KaTeX), persistent mnemonic chip | `web/src/pages/Lesson.tsx` |
| **Classroom scaffolds in-app** — the original scaffold sections from the class's scaffolds document, attached to the lesson each one teaches, as expandable reference notes (with the document's images/diagrams once ingested — see below) | `server/src/content/classroomScaffolds.ts`, `lesson_scaffolds` table |
| **Guided problem solving (the tutor loop)** — wrong answers walk the scaffold one checkable step at a time; hints escalate nudge → mnemonic → step-by-step → LLM tutor | `web/src/pages/Practice.tsx`, `server/src/routes/practice.ts` |
| **Deterministic CAS grading** — 4 grading modes (`equivalent`, `canonical_form`, `exact`, `numeric_tolerance`); never string equality, never the LLM | `server/src/math/engine.ts` |
| **Exit tickets & mastery** — 4–8 question auto-graded check per lesson; rolling-accuracy mastery with recency decay; soft gates | `server/src/mastery.ts` |
| **Adaptive differentiation** — modified / standard / challenge tiers selected from live mastery | `server/src/routes/practice.ts` |
| **Procedural problem generation** — 30+ templates validated through the CAS at seed time (~570 problems seeded) | `server/src/math/generators.ts` |
| **LLM tutor (Claude)** — backend-mediated, scaffold-constrained system prompt, never gives the answer, streams over SSE, PII-scrubbed transcripts | `server/src/tutor/service.ts` |
| **Sprints** — 90-second timed fluency drills | `web/src/pages/Sprint.tsx` |
| **Regents review mode** — mixed-unit sessions weighted toward stale/weak skills + in-app Reference Sheet drawer (EN/ES) | `web/src/pages/Review.tsx`, `server/src/content/referenceSheet.ts` |
| **Progress dashboard** — streaks, 9-unit mastery map, exit-ticket history, struggle flags; guardian/teacher read-only view | `web/src/pages/Progress.tsx` |
| **Built-in graphing calculator** | `web/src/components/GraphCalculator.tsx` |
| **EN/ES everywhere** — all UI strings, lesson content, problems, hints, and the LLM tutor | `web/src/i18n.tsx`, `*_en`/`*_es` columns |
| **PWA + offline** — app shell + lesson content cached; offline attempts queue and sync | `web/public/sw.js`, `web/src/api.ts` |
| **COPPA/FERPA posture** — students never store an email; under-13 signup requires a guardian email; progress scoped to the student + linked guardians; export & delete endpoints | `server/src/routes/auth.ts`, `progress.ts` |

## Architecture

```
[React + TS PWA (Vite)] ──HTTPS──▶ [Express + TS API]
       │                                │
       │                                ├── PostgreSQL (users, content, attempts, mastery)
       │                                ├── Math engine (mathjs in-process CAS)
       │                                └── LLM proxy → Anthropic API (SSE tutor chat)
       └── KaTeX rendering, function-plot graphing (client-side)
```

Content is **data, not code**: the curriculum lives in versioned Postgres rows
(`content_version` on lessons) seeded from `server/src/content/`, so lessons
can be edited without deploys. The attempts log is append-only.

## Running the app

**Students and teachers don't set anything up** — they just open the app's web
address on their phone or Chromebook and (optionally) tap "Add to Home Screen"
to install it. Everything below is the *one-time* job of whoever hosts the app.
There are no environment variables to configure and no database commands to
run — the app creates a secure login key, sets up its own database, and loads
the full curriculum automatically on first start.

### Option A — Put it online (no terminal, recommended for a class/school)

One click deploys the whole app plus a managed database to
[Render](https://render.com) and gives you a web address to share:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/HelloImFranky/trusty_algebra_tutor)

Sign in with GitHub, click **Apply**, wait a few minutes, and open the URL
Render shows you. A secure login key is generated for you and the database is
wired up automatically (settings come from `render.yaml`). The free plan is
fine to try it out.

### Option B — Run it on one computer with one command

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then
from this folder run:

```bash
docker compose up
```

Wait for it to finish (the first run builds the app), then open
**http://localhost:8080**. That's it — no other setup.

No Docker? This one command sets up and starts everything (it uses Docker if
present, otherwise Node 20+ and PostgreSQL):

```bash
./scripts/start.sh
```

### Turning on the AI tutor chat (optional)

The step-by-step hints work out of the box. The conversational AI tutor is
optional and only needs a [Claude API key](https://console.anthropic.com/):
set `ANTHROPIC_API_KEY` in the Render dashboard (Option A), or add a line
`ANTHROPIC_API_KEY=sk-...` to a file named `.env` next to `docker-compose.yml`
(Option B). Without it, the app quietly falls back to the built-in hint ladder.

### Configuration (all optional)

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://tutor:tutor@localhost:5432/algebra_tutor` | Postgres connection |
| `JWT_SECRET` | auto-generated & persisted | login-token signing key; set it to share one across multiple instances |
| `ANTHROPIC_API_KEY` | *(unset)* | enables the AI tutor chat; without it the app uses the deterministic hint ladder |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | tutor model |
| `PORT` | `4000` | port the app listens on |
| `DATA_DIR` | `server/.data` | where the generated login key is stored |

### For developers

```bash
npm install
npm run dev     # API on :4000, web (hot-reload) on :5173
npm test        # 95 tests: math engine, generators, mastery model, API integration
```

`npm run serve` builds and runs the whole app as a single service on one port
(what the Docker/Render images run). The dev setup needs a local PostgreSQL and
a `algebra_tutor_test` database for the tests.

## Ingesting the scaffold images/diagrams

The scaffold pages are the teacher's hand-annotated worked examples, graphs,
and anchor charts — a mix of embedded images and vector-drawn math. These are
ingested from the scaffolds document (already committed under
`web/public/scaffolds/`). To re-ingest after the source changes:

1. Export the Google Doc as **PDF** (File → Download → PDF Document) — the PDF
   preserves the vector-drawn math and graphs that a `.docx` export would drop.
2. Run the ingest script and reseed:

   ```bash
   pip install pymupdf Pillow
   python3 scripts/ingest_scaffold_images.py ~/Downloads/Algebra\ Scaffolds__891.pdf
   npm run seed
   ```

Each of the document's 92 pages is rendered whole, whitespace-cropped, and
mapped to its scaffold section by a fixed page→section table in the script
(calibrated to this export). Images write to `web/public/scaffolds/` and the
manifest to `server/src/content/scaffoldImages.json`; the seed attaches them to
`lesson_scaffolds.images`. Sections that exist only as images in the source
(Exponents Rules, the Factors Cheat Sheet, the Desmos how-tos, ...) are created
automatically. A `.docx` export is also accepted as a fallback (extracts
embedded raster images by heading; loses vector-drawn content).

## Design notes

- **Grading**: `canonical_form` enforces the *taught* final shape — standard
  form ordering for polynomials, fully simplified radicals, factored form for
  factoring skills — and tells students "your value is right, but it's not in
  final form yet," exactly like the classroom.
- **Math input**: a structured input with a middle-school toolbar (fraction,
  exponent, radical, ≤/≥) over typed shortcuts (`x^2`, `sqrt()`, `<=`) with a
  live KaTeX preview. Swapping in MathLive is a contained upgrade inside
  `web/src/components/MathInput.tsx`.
- **LLM cost control**: the deterministic hint ladder is free and always
  first; the tutor chat is rate-limited per user, capped at 12 turns per
  session, and its system prompt (lesson scaffold) is cache-friendly.
- **Mastery**: rolling accuracy with recency weighting — correct answers move
  the score up (discounted by hints used), inactivity decays toward
  uncertainty, which is what re-surfaces stale skills in review mode.

## Repo layout

```
server/            Express + TypeScript API
  migrations/      SQL schema (design doc §7)
  src/content/     curriculum seed data (EN/ES) + reference sheet
  src/math/        CAS grading engine + problem generators
  src/routes/      auth, curriculum, practice, progress, tutor
web/               React + TypeScript PWA (Vite)
  src/pages/       curriculum map, lesson player, practice, exit ticket,
                   sprint, review, progress
  src/components/  math input, KaTeX, tutor chat, reference sheet, calculator
```
