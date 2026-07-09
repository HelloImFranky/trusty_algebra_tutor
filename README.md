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

## Getting started

Requirements: Node 20+, PostgreSQL 16.

```bash
# database
createuser tutor --pwprompt        # password: tutor (or edit DATABASE_URL)
createdb algebra_tutor -O tutor
createdb algebra_tutor_test -O tutor   # for the test suite

npm install
npm run migrate && npm run seed    # schema + 29 lessons / ~570 problems
npm run dev                        # API on :4000, web on :5173
```

Open http://localhost:5173, sign up as a student, and start Unit 1.

Environment variables (server):

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://tutor:tutor@localhost:5432/algebra_tutor` | Postgres |
| `JWT_SECRET` | dev value | sign tokens — set in prod |
| `ANTHROPIC_API_KEY` | *(unset)* | enables the LLM tutor chat; without it the app falls back gracefully to the deterministic hint ladder |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | tutor model |

### Docker

```bash
JWT_SECRET=... ANTHROPIC_API_KEY=... docker compose up --build
# web on :8080, API on :4000
```

### Tests

```bash
npm test    # 95 tests: math engine, generators (self-validating), mastery model,
            # and full API integration against algebra_tutor_test
```

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
