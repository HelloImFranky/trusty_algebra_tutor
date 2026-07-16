# Dark-mode audit + robust theming plan

## Why this exists

The UI/UX refresh (branch `ui-ux-redesign-v1.0`) shipped light/dark
mode in Phase 2 and a per-screen migration in Phase 2.1. Every time
we've hit a "still white in dark mode" bug since — the graph function
label, the MCQ math, the worked example, the Reference-sheet pill,
the animated-equation numbers — the fix was the same shape: a hard-
coded `INK` / `NEUTRAL[200]` / `#111827` / `#6b7280` literal that
should have been reading `tokens.*`. Whack-a-mole works but a token
that gets missed once is a token that will get missed again, and
every new screen brings the risk of a new one.

This plan swaps the whack-a-mole for two systemic fixes:

1. **A one-time codemod pass** that finishes the migration for every
   remaining literal.
2. **A guardrail** — an ESLint rule (`no-hardcoded-theme-color`) plus
   a `docs/theme-tokens.md` reference — that stops new literals from
   sneaking into the codebase.

The end state: every UI color comes from `useTokens()`,
`useFeedbackColors()`, `useAccent()`, or `HINT`. Component authors
never write a hex literal for a themeable color.

---

## Current state (audit as of `1ebaff7`)

Direct-hex literals still in `packages/app/src`:
| File | count | notes |
|---|---|---|
| `components/ui.tsx` | 48 | palette source — expected, out of scope |
| `components/calculator/CalcView.tsx` | 13 | chassis-tier button colors — intentional, but tab bar bg + inactive tab color aren't |
| `components/calculator/graphSvg.ts` | 6 | GRID / AXIS / LABEL / bg on the SVG — pass in from React side |
| `screens/appearance.tsx` | 4 | color-picker literals (`#000000`, `#ffffff` in gradients) — deliberate |
| `screens/curriculum.tsx` | 3 | CONTINUE hero-card accent-tint pinks — intentional per spec |
| `screens/progress.tsx` | 4 | medal tier ring / fill / label — intentional |
| `screens/review.tsx` | 3 | mostly `#ff9783` accent-tint on HeroCard — intentional |
| `screens/lesson.tsx` | 2 | scaffold image `#fff` — intentional (teacher JPGs) |
| `components/stepanim/BalanceScale.tsx` | 4 | scale illustration — self-contained widget |
| `components/stepanim/AnimatedEquation.tsx` | 3 | emphasis tokens (`#eef1fd`, cancel grey) — TBD |
| `components/calculator/Calculator.tsx` | 3 | tab-bar bg (`#f1f3f9`), active pill (`#fff`), inactive color (`#6b7280`) — **needs migration** |
| `components/calculator/GraphView.tsx` | 4 | quick-key chip colors (`#e8ebf1`, `#1f2937`, etc.) — **needs migration** |
| `components/calculator/GraphPlot.web.tsx` | 1 | host div border `#e5e7eb` — **needs migration** |
| `components/calculator/GraphPlot.tsx` | 1 | same border, native |
| `components/calculator/graphSvg.ts` | 6 | grid/axis/label + white bg — **needs migration** (SVG can accept tokens as props) |
| `components/TutorChat.tsx` | 2 | bubble colors — **needs migration** |
| `components/ReferenceSheet.tsx` | 2 | frame bg `#fff` + row text `#374151` — **needs migration** (this is the "Ref pill still white in dark mode" bug) |
| `components/Mascot.tsx` | 1 | SVG stroke — intentional |
| `components/MathInput.tsx` | 3 | input surface + text — **needs migration** |
| `components/calculator/store.ts` | 1 | default plot color palette — intentional |
| `screens/settings.tsx` | 1 | `#ffffff` on active SegmentedOption button text — accent-safe, intentional |
| `lib/theme.tsx` | 1 | `#ec3013` DEFAULT_ACCENT — source of truth |

And still using symbolic light-only tokens (`INK`, `NEUTRAL[N]`,
`COLORS.muted`, `COLORS.border`, `BRAND`) inside components:

| File | count | notes |
|---|---|---|
| `components/ui.tsx` | 19 | palette definitions — expected |
| `components/ReferenceSheet.tsx` | 6 | **most severe** — the visible chrome pill + sheet contents |
| `screens/classRoster.tsx` | 5 | teacher screen, unaudited so far |
| `components/AppChrome.tsx` | 1 | `NEUTRAL[700]` for inactive tab color — has token version already; unused, drop |
| `screens/auth.tsx` | 2 | placeholder padding — TBD |
| `screens/progress.tsx` | 2 | `NEUTRAL[400]` in the Lock icon on unearned medals — accepted (medallions are painted metal, not themed) |
| `components/calculator/*` | 6 | see the calculator hex table above; INK/NEUTRAL usage is entangled with those literals |
| `components/stepanim/AnimatedEquation.tsx` | 3 | see emphasis tokens above |
| `components/TutorChat.tsx` | 2 | see hex table above |
| `components/MathInput.tsx` | 1 | see hex table above |

**Real remaining work**, ranked by user impact:
1. `ReferenceSheet.tsx` — visible white pill in dark mode + sheet
   contents in white on white. **Highest-value single fix.**
2. `Calculator.tsx` + `GraphView.tsx` + `graphSvg.ts` — the
   calculator's chassis colors are baked for a light-mode iOS
   palette. Split into a `calcTokens` object that the whole calc
   tree consumes so dark-mode gets a coordinated dark chassis
   instead of a light chassis with dark ink.
4. `TutorChat.tsx` — chat bubbles.
5. `MathInput.tsx` — the algebraic input widget.
6. `classRoster.tsx` — teacher roster surface.
7. `AnimatedEquation.tsx` emphasis tokens — deliberate, but need a
   deliberate dark-mode variant (currently pale-blue focus bg
   washes out on dark).

The rest (Mascot, scaffold images, medal metal, accent-tint pinks)
are *intentional theme-invariant* — they should stay pinned. This
plan explicitly excludes them so a codemod doesn't rewrite them.

---

## Phase A — one-time migration codemod

**Goal.** Land the remaining ~40 lines of "this should be a token"
in a single reviewable commit per file.

**Tasks.**
1. Migrate `ReferenceSheet.tsx`:
   - `NEUTRAL[200]` → `tokens.subtle` (chrome pill bg)
   - `INK` → `tokens.ink` (icon + label)
   - Sheet frame `backgroundColor="#fff"` → `tokens.bg`
   - Row divider `COLORS.border` → `tokens.border`
   - Row text `"#374151"` → `tokens.muted` (or `tokens.ink` if we
     want higher contrast)
2. ~~Migrate the calculator chassis~~ — **skipped**. The light-iOS
   chassis reads as intentional physical-calculator design in both
   themes; no migration.
3. Migrate `TutorChat.tsx` — chat bubble bg + border.
4. Migrate `MathInput.tsx` — surface + placeholder.
5. Migrate `classRoster.tsx` — teacher roster surface.
6. Add a dark-mode-aware `emphasis` palette to
   `AnimatedEquation.tsx` — dark variants for `apply` yellow (deep
   mustard tint) and `cancel` gray (lighter neutral so struck-out
   terms stay legible). **`focus` keeps its current pale-blue bg
   `#eef1fd` in both modes** — deliberate: the pale-blue focus tint
   reads as a highlight even on dark bg, and swapping it out shifts
   the storyboard's mental model of "look here".

**Done when.** `grep -R "NEUTRAL\|INK\b\|COLORS\.muted\|COLORS\.border"
packages/app/src` returns only `components/ui.tsx` and the intentional
callsites documented in this file's `notes` column.

---

## Phase B — the guardrail

**Goal.** Keep new literals out.

**Tasks.**
1. Add `packages/app/eslint-rules/no-hardcoded-theme-color.js` — a
   custom ESLint rule that flags any hex-color string literal
   (`/^#[0-9a-fA-F]{3,8}$/`) appearing as a JSX attribute value
   *unless* the file path is in a small allowlist:
   - `packages/app/src/components/ui.tsx` (palette source)
   - `packages/app/src/lib/theme.tsx` (default accent)
   - `packages/app/src/screens/appearance.tsx` (color picker)
   - anything under `stepanim/` (emphasis tokens + illustrations)
   - `packages/app/src/components/Mascot.tsx`
2. Same rule for identifier `INK`, `NEUTRAL[…]`, `BRAND`,
   `COLORS.muted`, `COLORS.border` inside JSX props (not
   type-level or destructures). Message: "use useTokens() /
   useFeedbackColors() / useAccent() / HINT instead".
3. Register the rule under `packages/app/.eslintrc.json`.
4. Add `packages/app/scripts/theme-baseline.sh` — a shell script that
   runs the audit greps above and diffs against a committed
   `theme-baseline.txt`. Any increase in count fails CI. Any
   decrease requires updating the baseline. This catches the case
   where the ESLint rule can't reach (dynamically-computed string).
5. `docs/theme-tokens.md` — one-pager listing every token, what
   surface it's for, and the light + dark hex it resolves to. This
   is the reference every new screen consults.

**Done when.** Committing a new file that reads `INK` or a raw hex
into a color prop fails `npm run lint` locally and in CI. Reviewers
never need to catch it by eye again.

---

## Phase C — visual regression net (optional, high-value)

**Goal.** Prove theming stays intact through future refactors.

**Tasks.**
1. Add a Playwright snapshot test per major screen in both light and
   dark modes. Landing on curriculum, progress, review, lesson,
   practice, calculator, settings, appearance — 8 screens × 2 modes
   = 16 snapshots.
2. Run in CI on every PR that touches `packages/app/`. Any diff
   requires human approval to update the snapshot.
3. Include one snapshot of the Regents quiz mid-answer (the deep
   green/red feedback) and one of the graph tab in the popover sheet
   at both desktop and 400px mobile widths.

**Done when.** A change that inadvertently colors something wrong
in dark mode is caught by CI, not by a user report.

---

## Sequencing

| Phase | Effort | User-visible impact |
|---|---|---|
| A.1 (ReferenceSheet) | 30 min | fixes the current "Ref pill is white" complaint |
| A.2 (calculator chassis) | 2–3 h | full dark calculator, no more light-iOS chassis on dark bg |
| A.3–A.6 (remaining components) | 1–2 h | mops up TutorChat, MathInput, classRoster |
| B (lint + baseline) | 2–3 h | prevents future regressions |
| C (visual snapshots) | 3–4 h | catches regressions in review |

Ship as one branch (`dark-mode-hardening`) with Phase A commits
per-file, Phase B as one commit adding the rule + baseline, and
Phase C as a final commit adding CI + baseline snapshots. Total ~a
day of focused work. Merge into `main` after `ui-ux-redesign-v1.0`
lands.

---

## What this plan does NOT change

- The token API itself. `useTokens()`, `useFeedbackColors()`,
  `useAccent()`, `HINT`, `useHintBg()` are the surface every consumer
  reads from — that contract is stable.
- Any intentionally-invariant color: the yellow HINT palette; the
  streak flame red; medal metal; scaffold JPG white bg; the
  accent-tint pinks on HeroCards; the calculator's orange operator
  column (that's arguably iOS-ism but preserving it matches the
  brand).
- Tamagui's own theme system. We keep our token layer on top of
  Tamagui's defaults because our tokens carry brand semantics
  (chrome border, poster, HINT) that Tamagui's built-ins don't
  express.
