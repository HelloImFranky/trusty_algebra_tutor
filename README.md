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
| **Scaffolded lesson player** — numbered STEP 1/2/3 explanations, worked examples (KaTeX), persistent mnemonic chip | `packages/app/src/screens/lesson.tsx` |
| **Classroom scaffolds in-app** — every section of the class's scaffolds document, attached to the lesson it teaches and shown exactly as the teacher made it ("Original scaffold notes from class", expandable per topic — see below) | `scripts/ingest_scaffold_images.py`, `lesson_scaffolds` table |
| **Guided problem solving (the tutor loop)** — wrong answers walk the scaffold one checkable step at a time; hints escalate nudge → mnemonic → step-by-step → LLM tutor | `packages/app/src/screens/practice.tsx`, `packages/api/src/routers/practice.ts` |
| **Deterministic CAS grading** — 4 grading modes (`equivalent`, `canonical_form`, `exact`, `numeric_tolerance`); never string equality, never the LLM | `packages/core/src/math/engine.ts` |
| **Exit tickets & mastery** — 4–8 question auto-graded check per lesson; rolling-accuracy mastery with recency decay; soft gates | `packages/core/src/mastery.ts` |
| **Adaptive differentiation** — modified / standard / challenge tiers selected from live mastery | `packages/api/src/routers/practice.ts` |
| **Procedural problem generation** — 30+ templates validated through the CAS at seed time (~570 problems seeded) | `packages/core/src/math/generators.ts` |
| **LLM tutor** — backend-mediated, scaffold-constrained system prompt, never gives the answer, streams over tRPC, PII-scrubbed transcripts | `packages/core/src/tutor/`, `packages/api/src/routers/tutor.ts` |
| **Sprints** — 90-second timed fluency drills | `packages/app/src/screens/sprint.tsx` |
| **Regents review mode** — mixed-unit sessions weighted toward stale/weak skills + in-app Reference Sheet drawer (EN/ES) | `packages/app/src/screens/review.tsx`, `packages/core/src/content/referenceSheet.ts` |
| **Progress dashboard** — streaks, 9-unit mastery map, exit-ticket history, struggle flags; guardian/teacher read-only view | `packages/app/src/screens/progress.tsx` |
| **Built-in graphing calculator** | `packages/app/src/components/GraphCalculator*.tsx` |
| **EN/ES everywhere** — all UI strings, lesson content, problems, hints, and the LLM tutor | `packages/app/src/lib/i18n.tsx`, `*_en`/`*_es` columns |
| **PWA + offline** — app shell + lesson content cached; offline attempts queue and sync | `apps/web/public/sw.js`, `packages/app/src/lib/offline.ts` |
| **Native iOS/Android app** — the same screens, shared via Tamagui + Solito, on Expo | `apps/native/` |
| **COPPA/FERPA posture** — students never store an email; under-13 signup requires a guardian email; progress scoped to the student + linked guardians; export & delete endpoints | `packages/api/src/routers/auth.ts`, `progress.ts` |

## Architecture

A Turborepo monorepo. One Next.js server hosts the student PWA, the typed
tRPC API, and the scaffold images on a single URL; the Expo app reuses the
exact same screens and talks to that URL.

```
apps/
  web/       Next.js 15 (App Router) — student PWA + tRPC API on one port
  native/    Expo (expo-router) — iOS/Android app sharing the same screens
packages/
  app/       shared UI: Tamagui components + Solito navigation, i18n,
             tRPC client (auto token refresh), offline attempt queue
  api/       tRPC v11 routers (Zod-validated): auth, curriculum, practice,
             progress, tutor (streaming chat)
  db/        Prisma schema + client, idempotent SQL migrations, curriculum seed
  core/      pure logic: CAS math engine (mathjs), problem generators,
             mastery model, curriculum content (EN/ES), tutor providers
```

```
[Next.js PWA + Expo app] ──tRPC (superjson, streaming)──▶ [Next.js route handler]
        │                                                     │
        │                                                     ├── Prisma → PostgreSQL
        │                                                     ├── Math engine (mathjs CAS)
        └── KaTeX rendering, function-plot graphing           └── LLM providers (HF / self-hosted / Claude)
```

Content is **data, not code**: the curriculum lives in versioned Postgres rows
(`content_version` on lessons) seeded from `packages/core/src/content/`, so
lessons can be edited without deploys. The attempts log is append-only. The
server runs migrations + seed itself at startup — there are no manual database
steps anywhere below.

## Running the app

**Students and teachers don't set anything up** — they just open the app's web
address on their phone or Chromebook and (optionally) tap "Add to Home Screen"
to install it. Everything below is the *one-time* job of whoever hosts the app.
There are no environment variables to configure and no database commands to
run — the app creates a secure login key, sets up its own database, and loads
the full curriculum automatically on first start.

### Option A — Put it online with Fly.io (recommended for a class/school)

Install the [Fly CLI](https://fly.io/docs/flyctl/install/), sign up for a
[Fly.io](https://fly.io) account, then run:

```bash
./scripts/deploy-fly.sh
```

The script creates the app, a managed Postgres database, and a small volume
for the login key, wires them together, deploys, and prints your web address
(`https://algebra-tutor.fly.dev`). Re-run the same script to ship updates.
If the app name is taken, change the `app = "..."` line in `fly.toml` first.

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

### The mobile app (optional)

The web app already installs to a home screen as a PWA. For the native
iOS/Android app (same screens, built with Expo):

```bash
cd apps/native
cp .env.example .env    # point EXPO_PUBLIC_API_URL at your deployment
npm run dev             # scan the QR code with Expo Go
```

Ship real builds with [EAS](https://docs.expo.dev/eas/): `npx eas build`.

### Turning on the AI tutor chat (optional)

The step-by-step hints work out of the box with **no** LLM. The conversational
"I don't get it" tutor is optional and **provider-agnostic** — point it at a
free open model, a self-hosted model, or Claude. Whichever you choose, it gets
the same scaffold-constrained system prompt (teach the classroom method, never
give the final answer, age-appropriate, EN/ES) and grading always stays in the
deterministic math engine. If nothing is configured, the app quietly falls back
to the built-in hint ladder.

**Option 1 — Free open math model on Hugging Face.** Get a free token at
[huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) and set:

```
TUTOR_PROVIDER=openai
HF_TOKEN=hf_xxx
TUTOR_MODEL=Qwen/Qwen2.5-7B-Instruct
```

[Qwen2.5-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct) is
Apache-2.0, strong at math, follows instructions well, and speaks Spanish — a
good fit for the tutoring role. For a math-specialized model use
[`Qwen/Qwen2.5-Math-7B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-Math-7B-Instruct)
(see the note below). Hugging Face's free tier is rate-limited — great for a
pilot; for a full class, self-host (Option 2) or use a paid provider.

**Option 2 — Self-hosted model (free and private).** Run any model with
[Ollama](https://ollama.com) (`ollama pull qwen2.5` then `ollama serve`) or
vLLM/TGI/LM Studio, and point the app at it — no key, and **student chat never
leaves your machine** (a real COPPA/FERPA win, since prompts are also
PII-scrubbed before sending):

```
TUTOR_PROVIDER=openai
TUTOR_BASE_URL=http://localhost:11434/v1   # Ollama
TUTOR_MODEL=qwen2.5
```

**Option 3 — Claude.** Set `ANTHROPIC_API_KEY=sk-...` (auto-detected). Highest
quality and strongest guardrails; paid.

> **Tutor vs. solver — worth knowing.** Math-*solver* models (Qwen2.5-Math,
> Mathstral, DeepSeek-Math) are tuned to *produce answers and full solutions*,
> which is the opposite of what a Socratic tutor should do — they can be more
> likely to blurt the answer or drift off the scaffold than a good general
> instruct model. Because our grading is deterministic (the CAS math engine)
> and the free step-by-step hint ladder is the primary help path, the LLM is
> only the "explain it to me differently" layer, so either kind works — but if
> the tutor gives away answers, prefer a general instruct model
> (`Qwen2.5-7B-Instruct`, `Llama-3.1-8B-Instruct`) over a pure solver.

Set these with `fly secrets set KEY=value` (Option A — or just put them in
`.env` before running the deploy script) or in a `.env` file next to
`docker-compose.yml` (Option B). See `.env.example`.

### Configuration (all optional)

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://tutor:tutor@localhost:5432/algebra_tutor` | Postgres connection |
| `JWT_SECRET` | auto-generated & persisted | login-token signing key; set it to share one across multiple instances |
| `TUTOR_PROVIDER` | auto-detect | `openai` (Hugging Face / self-hosted / OpenAI-compatible), `anthropic`, or `none` |
| `HF_TOKEN` / `TUTOR_API_KEY` | *(unset)* | bearer token for the OpenAI-compatible endpoint |
| `TUTOR_BASE_URL` | `https://router.huggingface.co/v1` | OpenAI-compatible endpoint (e.g. `http://localhost:11434/v1` for Ollama) |
| `TUTOR_MODEL` | `Qwen/Qwen2.5-7B-Instruct` | model id for the OpenAI-compatible endpoint |
| `ANTHROPIC_API_KEY` | *(unset)* | use Claude for the tutor (auto-detected if set) |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | Claude model |
| `PORT` | `3000` | port the web app listens on |
| `DATA_DIR` | `.data` | where the generated login key is stored |
| `EXPO_PUBLIC_API_URL` | *(unset)* | native app only: where the API lives |

### For developers

```bash
npm install
npm run dev          # Next.js web app (+ API) with hot reload on :3000
npm run dev:native   # Expo dev server for the mobile app
npm test             # turbo: math engine, generators, mastery, tRPC API integration
npm run typecheck    # turbo: every workspace
npm run build        # turbo: production build
```

Everything is TypeScript end-to-end: Prisma generates the database types,
tRPC + Zod carry them to the client, so a schema change that breaks a screen
fails `typecheck` instead of failing in class. The dev setup needs a local
PostgreSQL and an `algebra_tutor_test` database for the API tests.

## Ingesting the scaffold images/diagrams

The scaffolds are the teacher's hand-annotated worked examples, graphs, and
anchor charts — a mix of embedded images, tables, and vector-drawn math. The
source document lives at `scripts/Algebra Scaffolds__891.docx`, and its
rendered sections are committed under `apps/web/public/scaffolds/` (one image
set per scaffold, shown in each lesson as the "Original scaffold notes from
class"). To re-ingest after the document changes:

```bash
pip install pymupdf Pillow      # LibreOffice (soffice) also required for .docx
python3 scripts/ingest_scaffold_images.py "scripts/Algebra Scaffolds__891.docx"
npm run seed                    # also happens automatically on server start
```

The script converts the document to PDF, locates each scaffold's title in the
flow, and slices the document between consecutive titles — so every section is
rendered whole (text, photos, and vector-drawn math alike), whitespace-cropped,
and stitched into that scaffold's image(s). Nothing is re-typeset: students see
each scaffold exactly as it was made for class. Images write to
`apps/web/public/scaffolds/`, the manifest to
`packages/db/content/scaffoldImages.json` (bundled into the server build so
Docker/Fly images seed with images), and the seed syncs them into
`lesson_scaffolds`. A PDF export of the same document is also accepted.

## Design notes

- **Grading**: `canonical_form` enforces the *taught* final shape — standard
  form ordering for polynomials, fully simplified radicals, factored form for
  factoring skills — and tells students "your value is right, but it's not in
  final form yet," exactly like the classroom.
- **Math input**: a structured input with a middle-school toolbar (fraction,
  exponent, radical, ≤/≥) over typed shortcuts (`x^2`, `sqrt()`, `<=`) with a
  live KaTeX preview. Swapping in MathLive is a contained upgrade inside
  `packages/app/src/components/MathInput.tsx`.
- **LLM cost control**: the deterministic hint ladder is free and always
  first; the tutor chat is rate-limited per user, capped at 12 turns per
  session, and its system prompt (lesson scaffold) is cache-friendly.
- **Mastery**: rolling accuracy with recency weighting — correct answers move
  the score up (discounted by hints used), inactivity decays toward
  uncertainty, which is what re-surfaces stale skills in review mode.
- **One shared UI**: screens are written once in Tamagui primitives and run on
  web (react-native-web under Next.js) and native (Expo). Web-only pieces
  (KaTeX, function-plot) have `.web.tsx` variants with native fallbacks
  (unicode math, WebView plotting).
