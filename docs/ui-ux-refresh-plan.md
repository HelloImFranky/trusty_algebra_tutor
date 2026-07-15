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
2. Remove the `/calculator` entry from the `tabs` array so it no
   longer appears in the bottom tab bar.
3. Add a new `{ href: '/settings', icon: Settings, label: t('settings') }`
   entry to the `tabs` array in place of Calculator, so Settings
   becomes the fifth tab on phones and the fifth top-nav item on
   desktop. (Admins/teachers keep their existing role-scoped tabs
   untouched.)
4. Because Calculator now lives in chrome and is available from
   every route, verify it doesn't obstruct the practice/lesson
   flows — the button just links to a route today, so state is
   preserved by normal router history; nothing to persist. Confirm
   by starting a practice set, opening Calculator, hitting the
   back arrow, and landing back on the same question.
5. `apps/web/app/settings/page.tsx` and `apps/native/app/settings.tsx`
   already exist — no route changes needed.
6. Update the redesign README/plan blurb in `docs/` if any doc
   references the old bottom-tab order.

**Done when.** On phone width, the bottom bar shows
Curriculum / Sprint / Review / Progress / Settings; the top-right
button row shows Reference / Appearance / Calculator / Language /
Logout. On desktop, the same swap is reflected.

---

## Phase 5 — Consolidate Options: profile, password, language, appearance-mode

**Goal.** The Settings ("Options") screen becomes the single home
for account & preference toggles. Language moves out of the chrome.
Each concern gets its own titled section so nothing is buried.

**Current state.**
- `packages/app/src/screens/settings.tsx` has two `AppCard`
  sections: *Profile* (displayName + username) and *Change
  password*.
- `AppChrome.tsx:128–135` renders the 🇪🇸/🇺🇸 toggle button in the
  top chrome cluster.

**Tasks.**
1. In `AppChrome.tsx`, delete the top-bar language toggle button
   (lines 128–135). Keep the `useI18n` import only if still used
   elsewhere in the file (it is — `t(...)` labels).
2. Extend `screens/settings.tsx` with three new `AppCard` sections
   *below* the existing Profile card, in this order:
   - **Change password.** (Move the existing password `AppCard`
     into a dedicated section with a `SubTitle` — already
     effectively separate, but title it `t('changePasswordTitle')`
     consistently.)
   - **Language.** `SubTitle` + a segmented `Row` of two buttons
     (English / Español) driven by `useI18n().setLocale`. Highlight
     the active locale with the accent.
   - **Appearance mode.** `SubTitle` + a segmented control
     (Auto / Light / Dark) that calls the Phase 2 `setMode(...)`.
     Include a small `Muted` explainer under the label:
     *"Auto follows your device setting."*
3. Wrap each section in its own `AppCard` (matching the existing
   pattern) so the screen reads as a stack of cards, each with a
   `SubTitle`. Add generous `gap` so tapping on phone is
   comfortable.
4. New i18n strings (add to both `en` and `es`):
   `languageSectionTitle`, `english`, `spanish`,
   `appearanceModeTitle`, `modeAuto`, `modeLight`, `modeDark`,
   `modeAutoNote`.
5. If Phase 3 already added a link *from* `/settings` *to*
   `/appearance`, keep it — the color picker stays on its own
   screen (it's too tall for the settings stack). Add a small
   "Change accent color →" row inside the Appearance-mode card
   that navigates to `/appearance`.
6. Manual QA on phone + desktop: switching language reflows
   immediately without a reload; changing mode repaints;
   password/profile flows unchanged.

**Done when.** The chrome no longer has a language button. Opening
Options shows four cards — Profile, Change password, Language,
Appearance mode — each with its own `SubTitle` and its own
action(s).

---

## Sequencing & branch hygiene

- Each phase is a single commit (or a small stack) pushed to
  `ui-ux-redesign-v1.0`. Open one PR per phase to keep review
  scoped.
- Phases 1 → 2 → 5 have a soft dependency chain (Phase 5's
  appearance-mode toggle needs Phase 2's `setMode`). Phases 3 and 4
  are independent and can be worked in parallel.
- Suggested merge order into `main`: 1, 4, 2, 3, 5 — ships the
  smallest visible wins first (yellow-safe hints, calculator moved
  where students want it), then the deeper theming work.
