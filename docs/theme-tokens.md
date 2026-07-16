# Theme tokens

Every UI color in `packages/app/` comes from one of these five hooks /
constants. If you're writing a `color=` or `backgroundColor=` prop, this
is the palette you reach for. **Never inline a hex or reach for a raw
`INK` / `NEUTRAL[N]` / `BRAND` — the `theme-baseline.sh` check will
fail on the next `npm test`.**

Related docs: `dark-mode-audit-plan.md` (why this exists, what's
intentionally invariant), `scripts/theme-baseline.sh` (the CI guard).

---

## `useTokens()` — mode-aware surface + text tokens

`import { useTokens } from '@tutor/app/components/ui'`

The primary tokens. Adapt to light / dark automatically via
`useResolvedMode()`. Return type: `ThemeTokens`.

| Token | Light | Dark | Use for |
|---|---|---|---|
| `bg` | `#f3f2f2` | `#141313` | The page background. `Screen` uses it; anything full-bleed too. |
| `surface` | `#ffffff` | `#232121` | Card / raised-surface bg. `AppCard` uses it; use anywhere a "sits above the page" panel is needed. |
| `ink` | `#201e1d` | `#f3f2f2` | Primary text. Use as the default text color on any card or surface. |
| `muted` | `#605d5d` | `#bab6b6` | Secondary text — captions, subtitles, StatChip labels, muted rows. |
| `border` | `#d7d3d3` | `#4a4646` | Dividers, input outlines, subtle strokes. |
| `subtle` | `#eae7e7` | `#3a3737` | Input backgrounds, hover / press states, chip / pill bg. |
| `poster` | `#201e1d` | `#3a3737` | "Poster" surface — the CONTINUE hero card on Curriculum/Review. Anything that used to be `backgroundColor={INK}`. |
| `posterInk` | `#f3f2f2` | `#f3f2f2` | Text on a `poster` surface. |
| `posterBorder` | `#201e1d` (invisible) | `#605d5d` | Subtle stroke that lifts the poster off the bg in dark mode. |
| `chromeBorder` | `#201e1d1f` | `#f3f2f224` | Top-bar / bottom-tab separator (8-digit hex = alpha). |
| `mode` | `'light'` | `'dark'` | Escape hatch when you need to branch on mode. Rarely needed — reach for a dedicated token first. |

There's also a convenience component: `HeroCard` in `ui.tsx` wraps
`poster` + `posterBorder` + `posterInk` so callers don't have to
assemble the surface every time.

---

## `useFeedbackColors(kind)` — mode-aware feedback surfaces

`import { useFeedbackColors } from '@tutor/app/components/ui'`

Returns `{ bg, ink }` for each of `'good' | 'bad' | 'warn' | 'hint'`.
Use it for anything that renders as a colored banner or answer card —
correct / incorrect answers on Regents review, the "how to solve"
explanation panel, the mnemonic strip, etc.

| Kind | Light bg | Light ink | Dark bg | Dark ink | Use for |
|---|---|---|---|---|---|
| `good` | `#e6fcf5` | `#0ca678` | `#0f3d2e` | `#67e8b8` | "Correct!" banners, right-answer highlight |
| `bad` | `#fff2ef` | `#ae1800` | `#3d1414` | `#ff9783` | "Not quite" banners, wrong-answer highlight, "how to solve" panels |
| `warn` | `#fff9db` | `#c98a00` | `#3a2f10` | `#c98a00` | Form validation, offline-queued messages |
| `hint` | `#fff9db` | `#c98a00` | `#3a2f10` | `#c98a00` | Yellow hint bubbles, "Remember:" strips, calculator "that's an equation" nudge |

The `Feedback` component in `ui.tsx` already consumes this hook, so
in most cases `<Feedback kind="good">…</Feedback>` is what you want.
Reach for the raw hook when you need to color a bespoke surface
(e.g. an answer-choice card that has its own layout).

---

## `useAccent()` — the picked accent color

`import { useAccent } from '@tutor/app/components/ui'`

Returns the current accent as a `Hex`. Follows the user's color-picker
choice; defaults to `#ec3013` (brand red). Use for:
- `PrimaryButton` — already consumes it
- `ProgressBar` fill — already consumes it
- Active nav tab tint
- "Start →" / "Continue →" link text
- Any interactive element the user identifies as "the accent"

**Do not** use for text on colored backgrounds (accent might be light
or dark depending on the user's pick) — reach for `useFeedbackColors`
or `tokens.ink` instead.

---

## `HINT` — theme-invariant yellow

`import { HINT } from '@tutor/app/components/ui'`

The yellow hint color is deliberately **not** derived from
`useAccent()` — hints only work if students notice them, and letting
the accent recolor them destroys that signal (see Phase 1 rationale).

| Token | Value | Use for |
|---|---|---|
| `HINT.fg` | `#c98a00` | Yellow icon or text on any hint surface. Same in light and dark. |
| `HINT.bg` | `#fff9db` | Light-mode hint bg — but usually consume via `useFeedbackColors('hint').bg` |
| `HINT.bgDark` | `#3a2f10` | Dark-mode hint bg — same routing note |
| `HINT.border` | `#f4dfa8` | Border for a hint-colored pill |

Also: `useHintBg()` returns the mode-correct `HINT.bg` / `HINT.bgDark`.

---

## Intentional exceptions

Some literals are pinned on purpose. The `theme-baseline.sh` count
includes them so a NEW literal (even in an "allowed" file) still
triggers the check. Existing pinned callsites:

- **`ui.tsx`** — the palette source itself.
- **`lib/theme.tsx`** — `DEFAULT_ACCENT = #ec3013` (brand red).
- **`screens/appearance.tsx`** — color picker gradient endpoints
  (`#000000`, `#ffffff`) and the initial hue placeholder.
- **`components/Mascot.tsx`** — SVG illustration lines.
- **`components/stepanim/BalanceScale.tsx`** — physical scale
  illustration (metal grays, wood browns).
- **`components/calculator/*`** — the calculator chassis is
  deliberately a light-iOS-style physical calculator in both themes;
  see `dark-mode-audit-plan.md` Phase A.2 exclusion.
- **`components/stepanim/AnimatedEquation.tsx` `focus` bg** —
  `#eef1fd` pale blue kept in both modes as a storyboard "look here"
  cue; see Phase A.6 exclusion.
- **Streak flame** on Curriculum + Progress: `#ec3013` hard-pinned
  so the fire signal doesn't shift with the accent.
- **Medal tier metal** on Progress — one triple per tier in the
  stacking ladder: bronze (`#b08d57`), silver (`#97a2b0`), gold
  (`#e6a817`), platinum (`#8a99ad`), mathematician (`#7c3aed`), math
  wizard (`#c026d3`). Medallions represent literal metal /
  prestige regalia, not themed surfaces — they stay the same in
  light and dark so a gold badge is always visibly gold.
- **HeroCard accent-tint pinks** (`#ff9783`) on Curriculum + Review
  CONTINUE captions — a fixed warm-pink tint so the caption reads
  consistently across every accent choice.
- **Scaffold image bg** in `screens/lesson.tsx` (`#fff`) — teacher-
  supplied JPGs with white matte; clipping to a themed bg would
  crop transparent regions.
- **`ffffff` on active SegmentedOption text** in `settings.tsx` — the
  segmented pill fills with the accent (which could be any color)
  and white text is the accent-safe contrast.
- **Timer alerts** in `screens/sprint.tsx` (`COLORS.bad`, `COLORS.warn`)
  — time-critical signals that keep their traffic-light semantics.

If you're pinning a new literal for one of these reasons, run
`scripts/theme-baseline.sh --update` and mention the exception in
your PR description.

---

## Quick cheat sheet

```tsx
import { useAccent, useFeedbackColors, useTokens, HINT } from '../components/ui';

function MyScreen() {
  const tokens = useTokens();
  const accent = useAccent();
  const good = useFeedbackColors('good');

  return (
    <Screen>
      <Text color={tokens.ink}>Primary text</Text>
      <Text color={tokens.muted}>Secondary caption</Text>

      <YStack backgroundColor={tokens.surface} borderColor={tokens.border}>
        <Text color={tokens.ink}>On a card</Text>
      </YStack>

      <YStack backgroundColor={good.bg}>
        <Text color={good.ink}>Correct!</Text>
      </YStack>

      <PrimaryButton>Continue</PrimaryButton>   {/* fills with accent */}
      <Text color={accent}>Start →</Text>       {/* accent-colored link */}

      <Lightbulb color={HINT.fg} />             {/* invariant hint yellow */}
    </Screen>
  );
}
```

Never:
- `color="#111827"` — use `tokens.ink`
- `backgroundColor={NEUTRAL[200]}` — use `tokens.subtle`
- `color={INK}` — use `tokens.ink`
- `color={BRAND}` — use `useAccent()`
- `borderColor={COLORS.border}` — use `tokens.border`
