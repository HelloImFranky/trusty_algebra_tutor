# Step Animator — Implementation Plan for Remaining Work

> [!NOTE]
> **✅ MOSTLY SHIPPED — historical design record.** Phases 1–5 landed. Only
> Phase 6 (the native-device pass + conditional Reanimated swap) remains, and
> it needs a local simulator/device — it cannot run in a cloud container.
> Status index: [`README.md`](README.md).

Companion to `stepanim-next-steps.md` (items A–H). That doc describes
*what* remains; this one sequences it, sizes it, and pins down the design
decisions so each phase can be picked up by a fresh session. Written on
branch `claude/stepanim-next-steps-plan-tn1jrj` (2026-07-13).

**Status (2026-07-14):** Phases 1–5 are shipped on this branch (analytics,
fraction tokens + slope scripts, polynomial two-row layout, tutor handoff,
sprint/Regents review surfaces). Only Phase 6 (A → B, the native device
pass and the conditional Reanimated swap) remains, and it needs a local
session with a simulator/device — it cannot run in a cloud container. See
the "Done (follow-up branch)" section of `stepanim-next-steps.md`.

## Sequencing at a glance

| Phase | Items | Why this order |
|---|---|---|
| 1 | E — usage analytics | Smallest item; start collecting data *before* new scripts land so there's a baseline |
| 2 | D + C(5.x) — fraction tokens + slope scripts | D is only needed by 5.x, so they ship together (the next-steps doc already says so) |
| 3 | C(2.3) — polynomial addition | Needs a multi-line model change; isolate it from the fraction change so regressions are attributable |
| 4 | G — tutor chat handoff | Independent, medium; benefits from more scripts existing first (more steps to deep-link) |
| 5 | F — sprint / review surfaces | Blocked on a product decision; recommendation below so the decision is cheap |
| 6 | A → B — device pass, then Reanimated *only if* jank | Requires a local session with a simulator/device; B is explicitly gated on A's findings |
| — | H — nits | Fold the pan-chip overflow fix into whichever phase touches `BalanceScale` first; defer the rest |

Phases 1–4 are cloud-session friendly (each verifiable via the `verify`
skill: vitest + typecheck + web build + Playwright, `expo export` for the
native bundle check). Phase 6 needs a human with a device.

---

## Phase 1 — E: usage analytics (`anim_views`)

**Goal**: measure whether watching animations correlates with mastery,
instead of lumping animation opens into `hintsUsed`.

- `packages/db/migrations/009_anim_views.sql`: `ALTER TABLE attempts ADD
  COLUMN anim_views INTEGER NOT NULL DEFAULT 0;` (follow the existing
  numbered-migration pattern; `embed-migrations.mjs` picks it up).
- `packages/db/prisma/schema.prisma`: add `animViews` to the attempt model.
- `packages/api/src/routers/practice.ts`: extend `attemptInput`
  (`animViews: z.number().int().min(0).max(20).default(0)` alongside
  `hintsUsed` at line 54) and persist it where the attempt row is written
  (~line 134).
- `packages/app/src/screens/practice.tsx`: count every animation open in
  local state; submit with the attempt. **Keep** the existing behavior
  where opening during guided steps also increments `hintsUsed` (it *is*
  a hint there) — the new column is additive, not a replacement, so
  mastery math (`applyMastery`) is untouched.
- Tests: extend the practice router test (or add one) asserting the
  column round-trips; run migration against local Postgres via the
  verify recipe.

**Size**: small (half-day). **Risk**: low — additive column, defaulted.

## Phase 2 — D + C(5.x): fraction tokens + slope scripts

**Goal**: `kind: 'frac'` tokens, then the first scripts that need them.

Order within the phase:

1. **Model** (`packages/core/src/anim/model.ts`): add
   `{ kind: 'frac', id, num, den, emph? }` to the token union.
   `stepToText` renders it as `num/den` so existing text-based tests and
   the live region keep working.
2. **Player** (`AnimatedEquation.tsx`): render frac tokens as a small
   column — two `RNText` + a 1px `View` rule (RN primitives only, per
   the cross-platform invariant). Measurement pass renders num and den
   with the same hidden-text trick; token width =
   `max(numW, denW) + pad`. Morph machinery (id-based slide/enter/exit)
   is unchanged.
3. **Scripts/builders**: target skills `slope-intercepts` (lesson 5.2)
   and `slope-intercept-form` (lesson 5.3):
   - Builder `slope_from_points`: plot Δy/Δx as a frac token, simplify,
     land on `m = …` (result green). Dispatch in `buildScriptForProblem`
     on the params shape the 5.2 generator emits — confirm that shape in
     `problemPayload` before writing the builder.
   - Builder or hand-authored script for `y = mx + b` slot-filling
     (5.3): substitute m and b into the template — reuse the
     substitution-morph pattern from the 2.1 script.
   - Register both under `scriptsByLessonCode` (5.2, 5.3); ≤ 8 steps,
     EN + ES, existing emphasis palette.
4. **Tests**: builder cases in `builders.test.ts` (sign permutations:
   negative slope, zero rise, integer slope where the frac collapses)
   plus dispatch-null cases for unrelated params.

**Size**: medium (1–2 sessions). **Risk**: the measurement pass — verify
frac width on web via Playwright screenshot; native timing is a Phase 6
checklist item.

## Phase 3 — C(2.3): polynomial addition (two-line layout)

**Goal**: a 2.3 (`polynomial-operations`, code 2.3) script showing
vertical addition of polynomials.

- **Model change**: add optional `row?: 0 | 1` to tokens (default 0)
  rather than restructuring steps into line arrays — keeps every
  existing script valid with no data migration. Player offsets row-1
  tokens by one line height and lays each row out independently;
  morphing across rows is just a bigger translate, which the id-based
  morph already handles.
- `stepToText` joins rows with a newline (check the live region reads
  acceptably).
- Script: hand-authored first (like the other x.y lesson scripts) —
  stack the two polynomials, focus like-term columns pairwise (focus
  blue), combine into the result row (result green). A params builder
  can come later if 2.3 practice generators expose params.
- Register under lesson code 2.3; EN + ES.
- Tests: `stepToText` cases for the new script; a model-level test that
  row defaults to 0 (existing scripts unaffected).

**Size**: medium. **Risk**: overflow auto-scale must account for the
tallest row and total height — test on a narrow viewport.

## Phase 4 — G: tutor chat handoff

**Goal**: `TutorChat` can deep-link "watch step 3 of this animation".

- Prompt (`packages/core/src/tutor/`): when the current problem has a
  matching builder script, include the numbered step list
  (`stepToText`) in the system context and instruct the model to emit a
  structured marker (e.g. `[[anim:3]]`) when referencing a step —
  follow whatever structured-output convention the tutor prompts
  already use for scaffolds/hints.
- `packages/app/src/components/TutorChat.tsx`: parse the marker into a
  🎬 chip that opens the existing animation modal with
  `startAtStep` (both lesson and practice hosts already render the
  modal, so this is wiring, not new UI).
- Decide whether a chat-initiated open counts as a hint — recommend
  **yes** during guided steps, matching the current practice-embed
  rule, and count it in `anim_views` either way (Phase 1 makes that
  free).
- Tests: unit test the marker parser; prompt change verified manually
  via the verify recipe.

**Size**: medium. **Risk**: model reliability emitting the marker —
degrade gracefully (unparsed marker renders as plain text stripped of
brackets).

## Phase 5 — F: sprint / review surfaces (decision first)

**Recommendation to product**:

- **Sprint**: no mid-round embed (timed pressure, wrong slot — the
  next-steps doc already concluded this). Add a 🎬 button on each miss
  in the *post-sprint review* list, reusing the practice wrong-answer
  affordance. Free (no hint cost — the round is over), counted in
  `anim_views`.
- **Regents review**: prefer **adding params to the fixed seeds**
  (migration or seed-data change in `packages/db`) over hand-authoring
  scripts keyed by problem id — params reuse the existing builders and
  dispatch, and stay correct if seeds are edited. Only hand-author for
  seed problems whose shape no builder covers, and treat those as new
  builder candidates instead.

Implementation after sign-off is small–medium: post-sprint UI reuses
existing components; the seeds change is data plus a `problemPayload`
passthrough that already exists for practice.

## Phase 6 — A then B: native device pass, Reanimated if needed

**A (needs a local session — cannot be done from a cloud container)**:
run through the checklist from the next-steps doc on iOS simulator +
one Android device: token measurement timing, chip radius on Android,
the border-trick triangle, wobble performance, lesson + practice
embeds, reduced-motion path — **plus** the Phase 2/3 additions: frac
token rendering and the two-row layout. Record findings in
`stepanim-next-steps.md`.

**B**: only if A shows jank. Surface is contained to
`AnimatedEquation.tsx` + `BalanceScale.tsx`; Reanimated ~4.1 is already
in `apps/native` but **not** web — gate on `Platform.OS` and keep the
current RN `Animated` path for web. Do not start this speculatively.

## H — nits (fold in opportunistically)

- **Pan-chip overflow** (`BalanceScale.tsx`): quick guard —
  `numberOfLines={1}` + font auto-shrink or `ellipsizeMode` when a side
  exceeds the 70px slot. Do it in whichever phase touches the file
  first (likely Phase 6's B, or standalone if a bug report lands).
- **Reverse-aware exits** on Back: acceptable as-is; revisit only if it
  comes up in the device pass.
- **Auto-play speed toggle (1×/1.5×)**: wait for a teacher request.

## Definition of done per phase

Every phase: vitest green (`packages/core` builders + any new tests),
`turbo` typecheck/build, web smoke via Playwright per the verify skill,
`npx expo export --platform ios` bundle check, and an update to the
"Done" / "Remaining" sections of `stepanim-next-steps.md` so the status
doc stays truthful.
