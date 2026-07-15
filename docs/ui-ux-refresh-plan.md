# UI/UX Refresh — Plan (branch `ui-ux-redesign-v1.0`)

Follow-up polish pass on top of the "modern but round" redesign
(commits `866bc1a` → `f193897`). Five phases, ordered so each ships
independently and the branch stays reviewable.

Every phase lives on `ui-ux-redesign-v1.0`. Baseline for all work:
`git fetch origin && git checkout ui-ux-redesign-v1.0`.

---

## Phase 1 — Lock reminder/hint yellow to be theme-invariant

**Goal.** Hint and reminder surfaces read as yellow no matter what
accent (or, later, what light/dark mode) the user picks. Hints exist
to be *noticed*; letting the accent recolor them destroys that
signal.

**Where it lives today.**
- `packages/app/src/components/ui.tsx` — `COLORS.warn` (`#c98a00`)
  and `COLORS.warnBg` (`#fff9db`) already power the `Feedback` banner
  with `kind="warn"`.
- `packages/app/src/screens/practice.tsx:256` — hint text uses
  `<Feedback kind="warn" icon={<Lightbulb color={COLORS.warn} />}>`.
- `packages/app/src/screens/lesson.tsx:133–137` — inline step hint
  with `Lightbulb` in `COLORS.warn`.
- `packages/app/src/components/calculator/CalcView.tsx:319` — the
  "that's an equation, use the Graph tab" nudge, also `Feedback
  kind="warn"`.
- `Badge` "warn" tier in `ui.tsx:266–272` (used for `pending`).

**Tasks.**
1. Introduce a `HINT` design token in `ui.tsx` (fg `#c98a00`, bg
   `#fff9db`, border `#f4dfa8`) that is *deliberately not derived*
   from `useAccent()`. Add a one-line comment stating the invariant
   so a future dark-mode refactor doesn't recolor it.
2. Point `Feedback kind="warn"`, the inline lesson hint, and the
   `Badge` "warn" tier at `HINT.*` instead of the general
   `COLORS.warn` tokens. Keep `COLORS.warn` for non-hint warnings
   (form validation, offline-queued) so we can diverge later if we
   want.
3. In Phase 2 (dark mode), pin the same `HINT` tokens to both
   themes — only tweak `HINT.bg` to a low-saturation dark surface
   (`#3a2f10`) so contrast stays AA in dark mode, but keep `HINT.fg`
   yellow.
4. Add one Storybook-style visual sanity page (or a demo route under
   `/appearance/preview`) that renders a Hint, a warn Feedback, and
   a warn Badge — used as a checklist in later phases.

**Done when.** Changing accent to blue/purple/green in
`/appearance` leaves every hint/reminder surface unmistakably
yellow.

---

## Phase 2 — Honor the device's light/dark preference

**Goal.** On web, follow `prefers-color-scheme` so the page's
primary surface (`#f3f2f2` today) inverts to a dark neutral when the
OS/browser is in dark mode. Native inherits the same tokens.

**Current state.**
- `apps/web/app/layout.tsx` hard-codes `body { background: #f3f2f2 }`
  and `themeColor: '#ec3013'` in the viewport meta.
- `packages/app/src/components/ui.tsx` hard-codes `INK`, `NEUTRAL`,
  card backgrounds (`#ffffff`), and chrome background (`#f3f2f2`) as
  literal hex strings scattered across components.
- No `useColorScheme` usage anywhere except an unrelated hit in
  `CalcView.tsx`.

**Tasks.**
1. Introduce a light/dark token pair in `packages/app/src/lib/theme.tsx`:
   - Extend `ThemeContext` with `mode: 'light' | 'dark' | 'auto'`,
     `resolvedMode: 'light' | 'dark'`, `setMode(...)`.
   - Default `mode` = `'auto'`; on `'auto'`, resolve with React
     Native's `useColorScheme()` (works on web and native).
   - Persist `mode` in the same `storage` layer as the accent.
2. Split `ui.tsx` palette into `LIGHT` / `DARK` maps and export a
   `useTheme()`-derived `useTokens()` hook returning the active
   surface / ink / neutral scale. Refactor the hard-coded literals
   (`Screen`, `AppChrome`, `AppCard`, `Badge`, buttons, etc.) to
   consume `useTokens()`.
3. `apps/web/app/layout.tsx`:
   - Add a small blocking `<script>` before hydration that reads
     `localStorage.getItem('tutor.theme.mode')`, falls back to
     `window.matchMedia('(prefers-color-scheme: dark)')`, and sets
     `data-theme="dark"` (or `"light"`) on `<html>` — prevents the
     white-flash on first paint.
   - Replace the inline `body` background with a CSS rule keyed on
     `:root[data-theme="dark"]`.
   - Update `themeColor` metadata to a `media` array so Safari/PWA
     shells match.
4. Add a `SegmentedControl` in the new Options screen (Phase 5) for
   `Auto / Light / Dark`.
5. Verify no regression: run through login, curriculum, lesson,
   practice, sprint, review, progress, calculator in both modes;
   confirm Phase 1's yellow hints still read as yellow in dark mode
   (see the demo page).

**Done when.** With the app open, toggling the OS setting from
light to dark repaints the whole app (with no flash); the manual
Options control overrides `auto`.

---

## Phase 3 — Rebuild the color picker with H/S/L controls and A/B preview

**Goal.** Replace the single `Panel1` "click somewhere in the box
and it just becomes that" with three explicit controls, and show
*current* vs *new* side-by-side so the change is obvious before Save.

**Current state.** `packages/app/src/screens/appearance.tsx` uses
`reanimated-color-picker`'s `Panel1` (saturation × brightness) plus
`HueSlider` plus a single `Preview` strip. The example preview card
sits *below* the picker; the user asked for it to sit near/above so
the picker's effect is visible without scrolling.

**Tasks.**
1. Layout re-arrange (top → bottom of screen):
   1. `Title` + back arrow.
   2. **Side-by-side preview strip.** Two cards labelled
      *Current* (renders with `accent`) and *New* (renders with
      `liveColor`). Each card shows: a `PrimaryButton`, a
      `ProgressBar`, a `Badge` set. This replaces the single
      preview at the bottom.
   3. Three separate controls (each with its own value read-out):
      - **Hue** — full-width `HueSlider` (0–360°).
      - **Saturation** — `SaturationSlider` (0–100%).
      - **Brightness/Lightness** — `BrightnessSlider` (0–100%).
      `reanimated-color-picker` exposes each of these as a discrete
      component; wire them under one `<ColorPicker>` root so they
      share state.
   4. Optional hex text input (so power users can paste `#3366ff`).
   5. Recent colors row (unchanged).
   6. Save button.
2. `onCompleteJS` still commits, but on web the Save button remains
   the reliable commit path (already documented in
   `appearance.tsx`'s header comment — keep the note).
3. Add per-control accessible labels (`aria-label` / native
   `accessibilityLabel`) — "Hue", "Saturation", "Brightness" — so a
   screen-reader user knows which axis they're on.
4. Add English + Spanish strings: `hueLabel`, `saturationLabel`,
   `brightnessLabel`, `currentThemeLabel`, `newThemeLabel`,
   `hexInputPlaceholder`.
5. Manual QA on iOS Safari + Chrome desktop + Expo iOS: the split
   sliders must remain smooth (60fps) and Save must persist.

**Done when.** The picker screen renders A/B swatches at the top,
three clearly-labelled sliders below, and each slider only changes
its own axis (moving the hue slider doesn't reset saturation).

---

## Phase 4 — Swap Calculator ⇄ Options in the navigation

**Goal.** The calculator should be reachable from every screen
without losing the student's place. Move it to the top bar (where
Settings lives today) and move Options to the bottom tab bar
(where Calculator lives today).

**Current state.** `packages/app/src/components/AppChrome.tsx`:
- Line 66: `{ href: '/calculator', icon: Calculator, label: t('calculator') }`
  is the last entry in the student `tabs` array, so it appears in
  the bottom tab bar (phone) and in the top nav row (desktop ≥768).
- Lines 121–127: Settings icon lives in the top-right chrome
  button cluster.

**Tasks.**
1. In the top-right chrome cluster, swap the `Settings` icon-button
   for a `Calculator` icon-button linking to `/calculator`. Keep the
   existing `CHROME_BTN` styling. Update the `aria-label` to
   `t('calculator')`.
2. Also remove the `Appearance` (palette) icon-button from the top
   chrome cluster (`AppChrome.tsx:114–120`); Phase 5 relocates it
   into the Options screen alongside the other preferences. Drop
   the `Palette` import if nothing else in `AppChrome` uses it.
3. Remove the `/calculator` entry from the `tabs` array so it no
   longer appears in the bottom tab bar.
4. Add a new `{ href: '/settings', icon: Settings, label: t('settings') }`
   entry to the `tabs` array in place of Calculator, so Settings
   becomes the fifth tab on phones and the fifth top-nav item on
   desktop. (Admins/teachers keep their existing role-scoped tabs
   untouched.)
5. Because Calculator now lives in chrome and is available from
   every route, verify it doesn't obstruct the practice/lesson
   flows — the button just links to a route today, so state is
   preserved by normal router history; nothing to persist. Confirm
   by starting a practice set, opening Calculator, hitting the
   back arrow, and landing back on the same question.
6. `apps/web/app/settings/page.tsx` and `apps/native/app/settings.tsx`
   already exist — no route changes needed.
7. Update the redesign README/plan blurb in `docs/` if any doc
   references the old bottom-tab order.

**Done when.** On phone width, the bottom bar shows
Curriculum / Sprint / Review / Progress / Settings; the top-right
button row shows Reference / Calculator / Logout (Appearance and
Language now live inside Options; see Phase 5). On desktop, the
same swap is reflected.

---

## Phase 5 — Consolidate Options: profile, password, language, appearance

**Goal.** The Settings ("Options") screen becomes the single home
for account & preference toggles. Language *and* the appearance
entry-point move out of the chrome (chrome removals are done in
Phase 4). Each concern gets its own titled section so nothing is
buried.

**Current state.**
- `packages/app/src/screens/settings.tsx` has two `AppCard`
  sections: *Profile* (displayName + username) and *Change
  password*.
- `AppChrome.tsx:114–120` renders the `Palette` (Appearance)
  icon-button; `AppChrome.tsx:128–135` renders the 🇪🇸/🇺🇸 toggle
  button. Both live in the top chrome cluster today.

**Tasks.**
1. Chrome cleanup happens in Phase 4 (`Palette` button removed) and
   here (delete the top-bar language toggle at
   `AppChrome.tsx:128–135`). Keep the `useI18n` import only if
   still used elsewhere in the file (it is — `t(...)` labels).
2. Extend `screens/settings.tsx` with three new `AppCard` sections
   *below* the existing Profile card, in this order — mirroring
   the "each concern its own card" pattern that already applies to
   Profile and Change password:
   - **Change password.** (Move the existing password `AppCard`
     into a dedicated section with a `SubTitle` — already
     effectively separate, but title it `t('changePasswordTitle')`
     consistently.)
   - **Language.** `SubTitle` + a segmented `Row` of two buttons
     (English / Español) driven by `useI18n().setLocale`. Highlight
     the active locale with the accent.
   - **Appearance.** `SubTitle` + two rows:
     - A segmented control (Auto / Light / Dark) that calls the
       Phase 2 `setMode(...)`, with a small `Muted` explainer:
       *"Auto follows your device setting."*
     - A tappable "Change accent color →" row that navigates to
       `/appearance` (the full picker screen from Phase 3 — kept on
       its own route because it's too tall for the settings stack).
       This row is the sole replacement for the removed chrome
       palette icon, so it must be visually prominent — full-width,
       chevron on the right, generous vertical padding.
3. Wrap each section in its own `AppCard` (matching the existing
   pattern) so the screen reads as a stack of cards, each with a
   `SubTitle`. Add generous `gap` so tapping on phone is
   comfortable. Final card order in Options: **Profile → Change
   password → Language → Appearance.**
4. New i18n strings (add to both `en` and `es`):
   `languageSectionTitle`, `english`, `spanish`,
   `appearanceSectionTitle`, `modeAuto`, `modeLight`, `modeDark`,
   `modeAutoNote`, `changeAccentColor`.
5. Manual QA on phone + desktop: verify the Appearance chrome
   button is gone from every route; opening Options → "Change
   accent color →" lands on the picker; switching language reflows
   immediately without a reload; changing mode repaints;
   password/profile flows unchanged.

**Done when.** The top chrome shows no Appearance or Language
button (verified across every route). Opening Options shows four
cards — Profile, Change password, Language, Appearance — each with
its own `SubTitle` and its own action(s); Appearance's second row
is the only path into the color picker.

---

## Phase 2.1 — Finish the dark-mode migration for inner surfaces

**Goal.** Phase 2 flipped the load-bearing chrome (page bg, top bar,
tab bar, cards) but every screen still had per-component literals
(`INK` text, `NEUTRAL[100/200/300]` hover/press states, `#ffffff`
scaffold bgs, the `backgroundColor={INK}` "CONTINUE" hero card).
Playwright screenshots after Phase 2 showed Curriculum, Progress,
Review, Sprint, and Lesson with dark-on-dark text and invisible
list items in dark mode. Phase 2.1 makes every student-visible
screen actually usable in dark mode.

**Where the problem lives (from the dark-mode audit).**
- `curriculum.tsx`: unit titles ("Number Sense", …), `IconCircle`
  unit numbers, lesson-row hover/press states, and the CONTINUE
  hero card all consume `INK` / `NEUTRAL[100/200]` directly.
- `progress.tsx`: Regents Review topic titles, Mastery-map heading,
  achievement labels, and StatChip subtitles (`COLORS.muted` is a
  fixed light-mode gray).
- `review.tsx`: topic titles inside AppCards, the CONTINUE hero
  card, answer-choice card backgrounds.
- `sprint.tsx`: intro card text uses `INK`.
- `lesson.tsx`: back arrow, step titles, worked-example bg, scaffold
  image container (`#fff`), mnemonic panel accent (`#ae1800`),
  scaffold list items (`NEUTRAL[100/200]`).
- `practice.tsx`: step dots (INK completed / NEUTRAL[300] pending),
  locked/collapsed step pills, primary step text color.
- `auth.tsx`: field `Label` uses hard-coded `#374151`; input
  backgrounds forced to `#fff` are readable but out of place on a
  dark card.
- `settings.tsx`: already migrated `AppInput` backgrounds in Phase 5;
  the SegmentedOption helper reads correctly.

**Deliberately out of scope for this pass** (future decision):
- Calculator button chassis (`CalcView.tsx` — sci/util/digit/op
  buttons with baked-in light greys and an orange operator column).
  This reads like a physical calculator; either keep as a chassis
  or design a dedicated dark-mode variant.
- Animated equation token colors (`AnimatedEquation.tsx` — `apply`
  yellow, `focus` blue-tint, cancel gray). These are step-animation
  emphasis tokens; if they change, the whole animation storyboard
  needs re-testing.
- Tutor chat bubble tints and balance-scale illustration colors —
  low-traffic, self-contained widgets.

**Tasks.**
1. **Semantic token additions in `components/ui.tsx`:**
   - Add `tokens.muted` (mid-neutral text that reads correctly in
     both modes) so `COLORS.muted` — a fixed light-mode gray — is no
     longer the go-to for secondary text.
   - Add a `HeroCard` component (or a mode-aware "poster" surface
     token) so `backgroundColor={INK}` panels don't collapse into
     the page background in dark mode. In light mode it stays INK;
     in dark mode it renders on `DARK_NEUTRAL[200]` (`#3a3737`)
     with a subtle border so it still reads as a raised feature
     panel.
   - Point `Muted` at `tokens.muted` (its current
     `tokens.mode === 'dark' ? DARK_NEUTRAL[700] : NEUTRAL[700]`
     conditional migrates into the token).
2. **Curriculum (`screens/curriculum.tsx`):**
   - Swap every `INK` (title/text/icon) for `tokens.ink`;
     `NEUTRAL[100/200]` (hover/press) for `tokens.subtle` / `tokens.border`;
     `NEUTRAL[700]` (uppercase caption) for `tokens.muted`.
   - Replace the CONTINUE hero card with `HeroCard`; use `tokens.ink`
     for its title / progress fill readable-inverse.
3. **Progress (`screens/progress.tsx`):** same swap pattern; the
   Mastery-map "Unit N" headings and Regents-review topic titles
   become `tokens.ink`; StatChip subtitles pick up `tokens.muted`.
4. **Review (`screens/review.tsx`):** topic titles → `tokens.ink`;
   CONTINUE hero → `HeroCard`; answer-choice card default surface →
   `tokens.surface` (was `#ffffff`); border/hover neutrals →
   `tokens.border` / `tokens.subtle`.
5. **Sprint (`screens/sprint.tsx`):** intro card text and timer
   surface consume tokens.
6. **Lesson (`screens/lesson.tsx`):**
   - Text/icon `INK` → `tokens.ink`.
   - Scaffold thumbnail container `#fff` → `tokens.surface`.
   - Worked-example and mnemonic panels → mode-aware surface tint
     (a subtle accent-tinted bg in both modes; the current
     `NEUTRAL[200]` reads as white in dark).
   - Scaffold list-row hover/press → `tokens.subtle`.
7. **Practice (`screens/practice.tsx`):**
   - Step-progress dots: completed uses `tokens.ink`, pending uses
     `tokens.border`, current stays accent.
   - Locked / crossed-out step rows use `tokens.subtle` and
     `tokens.muted`.
   - The "step done" chip (`backgroundColor={INK}`) becomes a
     mode-aware surface.
8. **Auth (`screens/auth.tsx`):** `Label` color → `tokens.ink`;
   `AppInput` backgroundColor → `tokens.surface`; borderColor →
   `tokens.border` — same treatment already applied to Settings in
   Phase 5.
9. **Classes / JoinClassCard (`screens/classes.tsx`,
   `components/JoinClassCard.tsx`):** teacher-side surface literals
   (`#fff` join card bg) migrate to `tokens.surface`. Same treatment
   applied inline where it appears.
10. **Sanity re-audit.** Re-run the Playwright dark-mode audit
    (`scratchpad/audit-dark.mjs`) after every migrated screen; add a
    light-mode pass to confirm no regression there.

**Done when.** Toggle the OS to dark mode and every signed-in
student route (Curriculum, Sprint, Review, Progress, Lesson,
Practice) reads with legible text and visible list items. Yellow
hints from Phase 1 still read as yellow. Light mode is
pixel-identical to pre-Phase-2.1 (no regression).

**Sequencing.** Ship as one branch stack of small commits (one
screen per commit) so review can catch any per-screen contrast
regression. Suggested order — same as the "impact per commit" order:
Curriculum → Progress → Review → Sprint → Lesson → Practice →
Auth → Classes → HeroCard/Muted refactor pulled up front so the
per-screen commits reference the finished helpers. Merge into
`main` as a single squashed commit under "Phase 2.1: finish dark
mode."

---

## Sequencing & branch hygiene

- Each phase is a single commit (or a small stack) pushed to
  `ui-ux-redesign-v1.0`. Open one PR per phase to keep review
  scoped.
- Phases 1 → 2 → 5 have a soft dependency chain (Phase 5's
  appearance-mode toggle needs Phase 2's `setMode`). Phases 3 and 4
  are independent and can be worked in parallel. Phase 2.1 depends
  on Phase 2's `useTokens()` hook.
- Suggested merge order into `main`: 1, 4, 2, 3, 5, 2.1 — ships the
  smallest visible wins first (yellow-safe hints, calculator moved
  where students want it), then the deeper theming work, then the
  dark-mode polish pass.
