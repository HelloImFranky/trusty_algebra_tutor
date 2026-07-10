# ∑ Trusty Algebra Tutor

A free, self-paced **Algebra 1 tutor** for middle school, built to match a real
accelerated 8th grade classroom (the "Algebra 891" curriculum). It teaches the
same way class does: short scaffolded lessons, lots of low-stakes practice,
step-by-step help when you're stuck, and quick exit tickets — in **English and
Spanish**, on any phone, tablet, or Chromebook.

It's aligned to the NY Algebra I (NGLS) Regents standards, and every lesson
includes the **original scaffold notes from class** — the teacher's actual
worked examples and anchor charts, exactly as they were made.

---

## 📱 For students

Your teacher will give you a web address (something like
`https://algebra-tutor.fly.dev`). Open it on your phone or Chromebook — that's
it, there's nothing to install.

1. **Sign up with just a username.** No email needed. If you're under 13,
   you'll be asked for a parent or guardian's email.
2. **Tip:** in your browser menu, tap **"Add to Home Screen"** and the tutor
   becomes an app icon on your phone.

What's inside:

| Tab | What it does |
|---|---|
| 📘 **My Course** | All 9 units. Every lesson shows your level: Not started → Practicing → Proficient → Mastered |
| 📄 **Lessons** | Step-by-step explanations, worked examples, and the **original scaffold notes from class** — tap a topic to open the real notes |
| ✏️ **Practice** | Problems matched to your level. Wrong answer? The app walks you through it **one step at a time** — it never just says "incorrect" |
| 💡 **Hints** | A hint button, a "Walk me through it" button, and an AI tutor you can ask "I don't get it" (it helps you think — it won't give away answers) |
| 🎟️ **Exit Tickets** | A quick 4–8 question check at the end of each lesson, graded instantly |
| ⚡ **Sprint** | 90-second speed rounds — how many can you get? |
| 📚 **Regents Review** | Mixed practice that automatically focuses on what you're rusty on |
| 📈 **Progress** | Your streak 🔥, minutes practiced, and a mastery map of the whole course |
| 🧮 **Calculator** | A built-in graphing calculator |
| 📖 **Reference Sheet** | The Regents reference sheet, one tap away on every screen |
| 🇪🇸 **Español** | Tap the flag in the top corner — everything switches, lessons included |

Lost Wi-Fi mid-practice? Keep going — your answers save on your device and
sync when you're back online.

---

## 🍎 For teachers

**What it is.** A practice companion for your class, not a replacement for it.
Lessons follow your scaffolds document section by section, use your mnemonics
(FOIL, PEMDAS, "standard form"), and show students the *original* scaffold
pages inside every lesson. Grading is done by a math engine that accepts any
equivalent form you'd accept — and, where it matters, insists on the taught
final form ("your value is right, but it's not in standard form yet").

**What you can see.** Each student's Progress page shows their streak,
practice minutes, exit-ticket history, and a 🚩 "needs help" flag on any skill
they're struggling with. Parents/guardians who sign up with the email a
student listed get the same read-only view of just their child.

**Student privacy.** Students never enter an email. Under-13 signups require
a guardian email (COPPA). Anything typed to the AI tutor is scrubbed of names,
emails, and phone numbers before it leaves the server, and students can export
or delete their own data (FERPA).

**Differentiation is automatic.** Problems come in modified / standard /
challenge tiers, picked from each student's live mastery — strugglers get
scaffolded-down problems, high-flyers get stretch work.

**If your scaffolds document changes**, the app can re-import it — see
[Updating the scaffold notes](#updating-the-scaffold-notes) below (it's one
command; ask whoever hosts your app to run it).

---

## 🚀 Getting it online (one-time setup)

Someone — a teacher, a school IT person, a helpful parent — hosts the app
once, then shares the web address. **There is nothing else to configure**: on
first start the app creates its own login key, sets up its database, and loads
the full 9-unit curriculum by itself.

### Option A — Put it on the internet (recommended for a class)

Uses [Fly.io](https://fly.io) (their smallest setup is enough for a class and
costs little to nothing).

1. Make a free account at [fly.io](https://fly.io) and install the
   [Fly CLI](https://fly.io/docs/flyctl/install/).
2. In this folder, run:

   ```bash
   ./scripts/deploy-fly.sh
   ```

That single script creates the app, its database, and its storage, deploys
everything, and prints your class's web address
(`https://algebra-tutor.fly.dev`). Run the same script again any time to ship
an update. If the name "algebra-tutor" is taken, change the `app = "..."` line
in `fly.toml` and re-run.

### Option B — Run it on one computer (a classroom laptop works)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. In this folder, run:

   ```bash
   docker compose up
   ```

3. When it settles, open **http://localhost:8080**. Students on the same
   network can use your computer's address (e.g. `http://192.168.1.20:8080`).

No Docker? `./scripts/start.sh` sets everything up with Node + PostgreSQL
instead, automatically.

### The phone app (optional)

The website already installs to a home screen like an app. If you also want
the **native iOS/Android app** (same screens, built with Expo):

```bash
cd apps/native
cp .env.example .env      # set EXPO_PUBLIC_API_URL to your web address
npm run dev               # scan the QR code with the Expo Go app
```

App-store builds: `npx eas build` ([EAS docs](https://docs.expo.dev/eas/)).

---

## 🤖 Turning on the AI tutor chat (optional)

The step-by-step hints work out of the box with **no AI setup at all**. The
conversational "I don't get it" tutor is an optional extra layer. Whichever
provider you pick, it gets the same rules — teach the classroom method, never
give the final answer, age-appropriate tone, EN/ES — and it **never grades**
(the math engine does).

Pick ONE, put it in a `.env` file next to `docker-compose.yml` (or run
`fly secrets set KEY=value` for Fly hosting):

**Free — open model on Hugging Face.** Get a token at
[huggingface.co/settings/tokens](https://huggingface.co/settings/tokens):

```
TUTOR_PROVIDER=openai
HF_TOKEN=hf_xxx
TUTOR_MODEL=Qwen/Qwen2.5-7B-Instruct
```

**Free & private — a model on your own computer.** With
[Ollama](https://ollama.com) (`ollama pull qwen2.5`), student chat never
leaves your machine:

```
TUTOR_PROVIDER=openai
TUTOR_BASE_URL=http://localhost:11434/v1
TUTOR_MODEL=qwen2.5
```

**Paid — Claude.** Strongest quality and guardrails:

```
ANTHROPIC_API_KEY=sk-ant-...
```

If nothing is set, the tutor button quietly falls back to the built-in hints.

> **Tip:** prefer general instruct models (`Qwen2.5-7B-Instruct`,
> `Llama-3.1-8B-Instruct`) over math-*solver* models (Qwen2.5-Math,
> DeepSeek-Math). Solvers are trained to blurt full solutions — the opposite
> of a good tutor.

---

## 📄 Updating the scaffold notes

The scaffold notes students see are rendered straight from the class's
document (`scripts/Algebra Scaffolds__891.docx`) — nothing is re-typed, so
students see each page exactly as the teacher made it. When the document
changes, replace the file and run:

```bash
pip install pymupdf Pillow        # first time only; LibreOffice also required
python3 scripts/ingest_scaffold_images.py "scripts/Algebra Scaffolds__891.docx"
```

The script finds each scaffold's title in the document, slices out that
section (photos, tables, and hand-drawn math included), and saves it as the
image students see. Redeploy (or restart) and the lessons pick up the new
notes automatically.

---

## ⚙️ Settings reference (all optional)

| Setting | Default | What it does |
|---|---|---|
| `DATABASE_URL` | local `algebra_tutor` db | PostgreSQL connection |
| `JWT_SECRET` | auto-generated & saved | login-token key; set it only if you run several copies |
| `TUTOR_PROVIDER` | auto-detect | `openai` (HF / self-hosted), `anthropic`, or `none` |
| `HF_TOKEN` / `TUTOR_API_KEY` | — | token for the OpenAI-compatible tutor endpoint |
| `TUTOR_BASE_URL` | Hugging Face router | tutor endpoint (e.g. `http://localhost:11434/v1`) |
| `TUTOR_MODEL` | `Qwen/Qwen2.5-7B-Instruct` | tutor model id |
| `ANTHROPIC_API_KEY` | — | use Claude for the tutor (auto-detected) |
| `PORT` | `8080` (image) / `3000` (dev) | port the web app listens on |
| `DATA_DIR` | `.data` | where the login key is stored |
| `EXPO_PUBLIC_API_URL` | — | phone app only: your web address |

---

## 🧑‍💻 For developers

A **Turborepo** monorepo, TypeScript end-to-end. One Next.js server hosts the
student PWA, the typed tRPC API, and the scaffold images on a single URL; the
Expo app reuses the exact same screens against that URL.

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

```bash
npm install          # also generates the Prisma client
npm run dev          # Next.js web app (+ API) with hot reload on :3000
npm run dev:native   # Expo dev server for the mobile app
npm test             # math engine, generators, mastery, tRPC API integration
npm run typecheck    # every workspace
npm run build        # production build (turbo)
```

Dev needs a local PostgreSQL plus an `algebra_tutor_test` database for the
API tests. Migrations and seeding run automatically when the server starts
(`apps/web/instrumentation.ts`) — no manual db steps, ever.

Design notes worth knowing:

- **Content is data, not code** — the curriculum lives in versioned Postgres
  rows seeded from `packages/core/src/content/`; lessons are editable without
  deploys. The attempts log is append-only.
- **Grading** (`packages/core/src/math/engine.ts`) has 4 modes: `equivalent`,
  `canonical_form` (enforces the *taught* final shape), `exact`, and
  `numeric_tolerance`. Never string equality, never the LLM.
- **One shared UI** — screens are written once in Tamagui primitives and run
  on web (react-native-web under Next.js) and native (Expo). Web-only pieces
  (KaTeX, function-plot) have `.web.tsx` variants with native fallbacks
  (unicode math, WebView plotting).
- **Type-safety chain** — Prisma generates db types, tRPC + Zod carry them to
  the client; a schema change that breaks a screen fails `npm run typecheck`
  instead of failing in class.
- **LLM cost control** — the deterministic hint ladder is free and always
  first; tutor chat is rate-limited per user and capped at 12 turns/session,
  and its system prompt (the lesson scaffold) is cache-friendly.
- **Mastery model** — rolling accuracy with recency decay (hints discount
  credit; inactivity decays toward uncertainty), which is what re-surfaces
  stale skills in Regents review.
- **react/react-dom are pinned** via root `overrides` to the Expo SDK pairing
  so web and native share one React copy — keep them aligned when upgrading
  Next or Expo.
