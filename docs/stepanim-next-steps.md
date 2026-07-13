# Step Animator — Next Steps

Roadmap for the token-morphing step animator ("stepanim"). Written so a
fresh session can implement any item without re-deriving context. Last
updated on branch `claude/algebra-animation-stack-pe0e7b` (2026-07-13).

## Current state (what already exists)

All feature code lives in `packages/app/src/components/stepanim/`:

| File | Purpose |
|---|---|
| `model.ts` | Token/step/script types, 5 hand-authored scripts, `scriptsByLessonCode` registry, `splitSides`/`stepToText` helpers |
| `AnimatedEquation.tsx` | The player: token morphing (RN `Animated`), whiteboard history, auto-play, progress dots, overflow auto-scale, controls |
| `BalanceScale.tsx` | Pans + beam visual; wobbles on "apply to both sides" steps; hidden unless the relation is `=` |
| `LessonAnimations.tsx` | "Watch it step by step" card used by the lesson player (keyed by lesson code) |
| `builders.ts` | Param → script builders for generated problems: `two_step_equation`, `two_step_inequality` (flip beat), `var_both_sides`; dispatched by skill slug + params shape via `buildScriptForProblem` |

Integration points outside the folder:

- `packages/app/src/screens/anim-demo.tsx` + routes `apps/web/app/anim-demo/page.tsx`, `apps/native/app/anim-demo.tsx` — demo playground.
- `packages/app/src/screens/lesson.tsx` — renders `LessonAnimations` once all lesson steps are revealed. Registered codes: 2.2, 3.1, 3.2, 3.3.
- `packages/app/src/screens/practice.tsx` — "🎬 Watch it step by step" button in the guided-steps phase (increments `hintsUsed`) and the done phase; renders `AnimatedEquation` with the builder output.
- `packages/api/src/routers/practice.ts` — `problemPayload` returns `params` (the generator's `paramsJson`) and `skillSlug`.
- `packages/app/src/lib/i18n.tsx` — key `animatedExample` (EN/ES).

Core invariants (do not break):

- **Token ids drive the morph.** Same id in consecutive steps → slides;
  new id → drops in; missing id → fades out. A token may change `text`
  between steps under the same id (used for the inequality flip on id
  `rel`).
- Emphasis palette: `apply` = orange chip (operation on both sides),
  `focus` = blue chip, `result` = green chip, `cancel` = gray
  strikethrough, `flip` = red chip.
- The player is cross-platform via react-native-web. Only RN primitives +
  `Animated` (translateX/translateY/opacity/scale, `useNativeDriver`
  gated by `Platform.OS !== 'web'`). No DOM, no SVG, no web-only APIs.
- Token widths come from a hidden measurement pass rendering the same
  `RNText` style as the live tokens; layout math assumes those widths.

Verification recipe: `.claude/skills/verify/SKILL.md` (Postgres → `npm
install` → tests/typecheck → `turbo build --filter=@tutor/web` → `next
start` → Playwright at `/opt/pw-browsers/chromium`; native via
`npx expo export --platform ios`).

---

## Next steps, in rough priority order

### 1. Builder for `multi_step_equation` (lesson 3.1's harder tier)

Template: `k(ax + b) + cx = d`, params `{k, a, b, c, x}` (see
`packages/core/src/math/generators.ts`). Currently returns `null` →
button hidden for those problems.

- Steps to author: focus the distribution (`k` chip + inside terms) →
  distributed form `(ka)x + kb + cx = d` → combine like terms
  `(ka+c)x + kb = d` → hand off to the existing `solveLinearSteps(ka+c,
  kb, d, 'x', '=', x)` with matching token ids (`ax`, `op`, `b`, `rel`,
  `c0`) so the transition is seamless (same pattern as
  `buildVarBothSides`).
- Watch the sign rendering: reuse `M()` / `cf()` helpers; `k` and `c`
  can be negative; generator guarantees `ka + c ≠ 0`.
- Add dispatch in `buildScriptForProblem`: slug `multi-step-equations` +
  `typeof p.k === 'number'`.
- Acceptance: on `/practice/10`, a multi-step problem shows the button
  and the history lines match hand-solving the prompt.

### 2. Misconception-triggered animation

When a wrong answer matches a known misconception (server already
diagnoses this — `practice.attempt` returns targeted feedback), show the
animation button right next to the feedback, or auto-open it for
specific ids:

- `missed_inequality_flip` → open the builder script; it lands exactly on
  the red flip step. Consider a `startAtStep` prop on `AnimatedEquation`
  so the player can open on the flip step rather than step 0.
- `inverse_operation_error`, `skipped_division` → open at step 0.
- Files: `packages/app/src/screens/practice.tsx` (the `feedback === 'bad'`
  branch has `message` but not the misconception id — extend the
  `attempt` response payload in `packages/api/src/routers/practice.ts`
  to include `misconceptionId`), `AnimatedEquation.tsx` (`startAtStep`).
- Acceptance: submit `x > value` on a negative-coefficient inequality →
  feedback plus the animation opened on the flip step.

### 3. Unit tests for builders

`builders.ts` is pure — test it in `packages/app` (no test runner is set
up there; either add vitest to `@tutor/app` or move builders + model
types into `packages/core` where vitest exists — moving also lets the
API/tutor reuse script generation later. Prefer the move; keep re-exports
in `stepanim/` so imports don't churn).

- Cases: all four sign permutations of `(a, b)` for two-step; inequality
  flip on `a < 0` for both `>` and `<`; `var_both_sides` with `c < 0`
  (gather becomes `+ |c|n`); `a = 1` and `a = -1` coefficient rendering
  (`x`, `−x`); dispatch returns `null` for unknown shapes (`{k,...}`,
  missing keys, `a === 0`, `a === c`).
- Assert on `stepToText(step)` lines — they read like the whiteboard
  history, so failures are legible.

### 4. Reanimated driver on native

The animation surface is isolated in `AnimatedEquation.tsx` +
`BalanceScale.tsx` (per-token x/y/opacity, line scale, beam rotate).
Swap RN `Animated` for Reanimated on native for UI-thread smoothness:

- `react-native-reanimated ~4.1` is already installed in `apps/native`.
  It is NOT installed for web — keep the RN `Animated` path on web (via
  `.web.tsx` split or a small driver interface), or add Reanimated to
  web properly (needs Next.js transpile config; test with the Tamagui
  next plugin before committing to it).
- Measure first: only do this if real devices show jank. The web build
  is fine as is.

### 5. Real device pass on native

Native has only been bundle-checked (`expo export`). Run the Expo app on
a simulator/device and check: token measurement (`onLayout` timing),
chip border radius on Android `Text` vs the `View` wrapper, the balance
scale's border-trick triangle, wobble performance, and the lesson/practice
embeds. `.claude/skills/verify/SKILL.md` notes there's no device in the
cloud environment — this needs a local session.

### 6. More lesson scripts (hand-authored registry)

The registry (`scriptsByLessonCode` in `model.ts`) covers 2.2, 3.1, 3.2,
3.3. Candidates worth authoring, in curriculum order:

- **2.1 evaluating expressions**: substitution as token replacement —
  `x` tokens morph into `(value)` tokens, then arithmetic collapses.
- **2.3 polynomial addition**: like-terms merging is already proven by
  `likeTermsScript`; polynomials need aligned columns — consider a
  two-line layout (new capability: `EqStep` currently models one line).
- **5.x slope / slope-intercept**: `y = mx + b` with m and b sliding into
  labeled slots; pairs well with the existing calculator `GraphPlot`.
- Keep each script ≤ 8 steps; reuse the `t()` helper and existing emph
  colors; add EN + ES for every step.

### 7. Fraction rendering for tokens

Everything is linear today (`÷ 2` instead of a stacked fraction).
Middle-school-friendly, but Unit 5+ (slope) needs real fractions.

- Add `kind: 'frac'` with `num`/`den` strings, rendered as a small
  column (two `RNText` + a 1px rule) inside the token wrapper; measure
  width as `max(numW, denW) + padding`.
- The morph machinery needs no changes — a frac token is just a wider
  token.

### 8. Auto-play polish

- Per-step hold time: add optional `holdMs` to `EqStep` (flip steps and
  cancel steps deserve a longer beat than mechanical ones). Default
  stays 2200ms in `AnimatedEquation`.
- Optional speed toggle (1×/1.5×) if teachers ask for it. Keep controls
  minimal.

### 9. Accessibility

- Respect reduced motion: `AccessibilityInfo.isReduceMotionEnabled()`
  (RN + RNW) → skip morphs, jump between steps (history still tells the
  story).
- Announce the current explanation to screen readers on step change
  (`AccessibilityInfo.announceForAccessibility` / `aria-live` — RNW maps
  `accessibilityLiveRegion`).
- The whiteboard history + `stepToText` already provide a full text
  transcript; make sure it's not hidden from readers.

### 10. Usage analytics

`hintsUsed` already increments when the animation opens during guided
steps, but that conflates it with other hints. If we want to know
whether animations help mastery: add `animViews` (or a
`hint_types_json`) to the `attempts` table + `attemptInput` in
`packages/api/src/routers/practice.ts`, thread it from
`practice.tsx`, and read it in the progress views later. Needs a SQL
migration (see `packages/db` migrations + `schema.prisma`).

### 11. Sprint / review surfaces

`SprintScreen` and `ReviewScreen` also serve problems (sprint problems
are timed — an animation mid-sprint is wrong; post-sprint review of
missed problems is the right slot). Review (Regents) problems are fixed,
not generated — they'd need either hand-authored scripts keyed by
problem id or params added to their seeds. Decide product-side before
building.

### 12. Tutor chat handoff

`TutorChat` receives `problemId`/`stepReached`. When the tutor references
a step ("look at how the −3 cancels"), it could deep-link the animation
at that step. Blocked on item 2's `startAtStep` prop; otherwise a small
lift in `TutorChat.tsx`. LLM prompt changes live in
`packages/core/src/tutor/`.

---

## Known small nits (fix opportunistically)

- `anim-demo.tsx` title/subtitle use inline `locale === 'es'` ternaries
  instead of i18n keys (fine for a prototype page; move to `i18n.tsx` if
  the page becomes permanent).
- The demo screen's script picker and `LessonAnimations`' picker are
  near-duplicates — extract a shared `ScriptPicker` if a third copy
  appears.
- `BalanceScale` pan chips can overflow their 70px slot on very long
  sides (cosmetic; only reachable in hand-authored scripts with long
  sides).
- The player's Back button replays enter animations for tokens that
  exited in the forward direction (acceptable; a reverse-aware exit
  animation would be nicer).
