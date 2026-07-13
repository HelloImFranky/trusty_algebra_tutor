# Step Animator — Status & Next Steps

Roadmap for the token-morphing step animator ("stepanim"). Written so a
fresh session can implement any item without re-deriving context. Last
updated on branch `claude/stepanim-app-features` (2026-07-13).

## Current state (what already exists)

The animator is a first-class app feature (no longer a demo):

- **Library screen**: `packages/app/src/screens/examples.tsx` at
  `/examples` (web + native routes), linked from a card at the top of the
  curriculum screen. Auth-gated like every other screen.
- **Lesson embeds**: `LessonAnimations` card in the lesson player, keyed
  by `scriptsByLessonCode`. Registered: 2.1, 2.2, 3.1, 3.2, 3.3.
- **Practice embeds**: buttons in the guided-steps phase (counts as a
  hint), after a wrong answer, and after a correct answer (free,
  reinforcement). Flip mistakes (`misconceptionId` containing "flip")
  auto-open the animation on the flip step via `startAtStep`.

Code layout:

| File | Purpose |
|---|---|
| `packages/core/src/anim/model.ts` | Types, 6 hand-authored scripts, lesson-code registry, text helpers. Pure data — no React |
| `packages/core/src/anim/builders.ts` | Param → script builders: `two_step_equation`, `two_step_inequality` (flip beat), `var_both_sides`, `multi_step_equation` (distribute + combine). Dispatch by skill slug + params shape via `buildScriptForProblem` |
| `packages/core/src/anim/builders.test.ts` | 17 vitest cases asserting `stepToText` lines across sign permutations + dispatch nulls |
| `packages/app/src/components/stepanim/model.ts`, `builders.ts` | Re-export shims → `@tutor/core` (keep app import paths stable) |
| `packages/app/src/components/stepanim/AnimatedEquation.tsx` | The player: token morphing (RN `Animated`), whiteboard history, auto-play with per-step `holdMs`, `startAtStep`, reduced-motion support, `accessibilityLiveRegion` on explanations, overflow auto-scale |
| `packages/app/src/components/stepanim/BalanceScale.tsx` | Pans + beam; wobbles on "apply" steps; hidden unless relation is `=` |
| `packages/app/src/components/stepanim/ScriptPicker.tsx` | Shared chip row (examples screen + lesson card) |
| `packages/app/src/components/stepanim/LessonAnimations.tsx` | Lesson-player card |

API: `problemPayload` in `packages/api/src/routers/practice.ts` returns
`params` + `skillSlug`; the attempt response already returned
`misconceptionId`.

Core invariants (do not break):

- **Token ids drive the morph.** Same id in consecutive steps → slides;
  new id → drops in; missing id → fades out. A token may change `text`
  under the same id (the flip uses this on id `rel`).
- Emphasis palette: `apply` orange, `focus` blue, `result` green,
  `cancel` gray strikethrough, `flip` red.
- Cross-platform via react-native-web: RN primitives + `Animated` only
  (translate/opacity/scale, `useNativeDriver` gated on `Platform.OS`).
  No DOM, no SVG, no web-only APIs.
- Token widths come from a hidden measurement pass rendering the same
  `RNText` style as live tokens.

Verification recipe: `.claude/skills/verify/SKILL.md` (Postgres → `npm
install` → tests/typecheck → `turbo build --filter=@tutor/web` → `next
start` → Playwright at `/opt/pw-browsers/chromium`; native via
`npx expo export --platform ios`).

## Done (this branch)

1. ~~Builder for `multi_step_equation`~~ — distribute → combine like
   terms → hand off to `solveLinearSteps`; dispatched on `{k, c}` params.
2. ~~Misconception-triggered animation~~ — `startAtStep` prop; flip
   mistakes auto-open on the flip step; 🎬 button offered after any
   wrong answer when a builder matches.
3. ~~Unit tests for builders~~ — moved model + builders to
   `packages/core/src/anim/` (app keeps shims); 17 tests green.
4. ~~Promote demo to app feature~~ — `/anim-demo` removed; `/examples`
   library screen, curriculum link, i18n keys, shared `ScriptPicker`.
5. ~~2.1 evaluate-expressions script~~ (substitution morph).
6. ~~Auto-play `holdMs`~~ — flip/cancel steps dwell ~3s.
7. ~~Reduced motion + live region~~ — zero-duration morphs when the OS
   asks; explanations announced politely.

## Remaining

### A. Real device pass on native (needs a local session)

Only bundle-checked (`expo export`). On simulator/device check: token
measurement timing, chip radius on Android, the border-trick triangle,
wobble performance, lesson/practice embeds, reduced-motion path.

### B. Reanimated driver on native (measure first)

Swap RN `Animated` for Reanimated **only if** a real device shows jank
(prereq: item A). Surface is contained to `AnimatedEquation.tsx` +
`BalanceScale.tsx`. Reanimated ~4.1 is installed in `apps/native` but
NOT for web — keep the current web path.

### C. More scripts

- **2.3 polynomial addition** — needs a two-line layout (model currently
  assumes one line per step).
- **5.x slope / slope-intercept** — `y = mx + b` slot-filling; pairs
  with the calculator's `GraphPlot`. Needs fraction tokens (item D).
- Keep scripts ≤ 8 steps, EN + ES, reuse existing emph colors.

### D. Fraction tokens

Add `kind: 'frac'` with `num`/`den`, rendered as a small column (two
`RNText` + 1px rule); width = `max(numW, denW) + pad` in the measurement
pass. Morph machinery unchanged. Build together with the first script
that needs it (5.x).

### E. Usage analytics

Opening the animation currently increments `hintsUsed` (except after a
correct answer). To measure whether animations help mastery, add a
dedicated `anim_views` column to `attempts` (SQL migration in
`packages/db`) + thread through `attemptInput` and `practice.tsx`.

### F. Sprint / review surfaces

Sprint mid-round is wrong (timed); post-sprint review of misses is the
right slot. Regents review problems are fixed seeds without params —
needs hand-authored scripts keyed by problem id, or params added to
seeds. Decide product-side first.

### G. Tutor chat handoff

`startAtStep` exists now; let `TutorChat` deep-link the animation at a
referenced step. Prompt changes live in `packages/core/src/tutor/`.

### H. Small nits

- The player's Back button replays enter animations for tokens that
  exited going forward (acceptable; reverse-aware exits would be nicer).
- `BalanceScale` pan chips can overflow their 70px slot for very long
  hand-authored sides.
- Optional auto-play speed toggle (1×/1.5×) if teachers ask.
