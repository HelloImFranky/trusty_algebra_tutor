/**
 * Shared building blocks so every screen reads the same. Palette/type/radii
 * follow the "Modernist / rounded & friendly" design (Claude Design project
 * 937947b2-2ad0-4187-ba61-c2e54cc33dd6, variant 3): warm neutral surfaces,
 * near-black ink, a themeable accent (see ../lib/theme.tsx), heavy rounding.
 */
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { ScrollView, type TextInput } from 'react-native';
import { Button, Card, Input, Spinner, Text, XStack, YStack, styled } from 'tamagui';
import { DEFAULT_ACCENT, useAccent, useResolvedMode, type Hex } from '../lib/theme';

export { useAccent, useResolvedMode, type Hex };

/** Static default accent — for the rare non-reactive context (e.g. native
 * splash/meta config). Prefer useAccent() inside components so the
 * Appearance picker actually changes them live. */
export const BRAND = DEFAULT_ACCENT;

export const INK = '#201e1d';
export const NEUTRAL = {
  100: '#f8f4f4',
  200: '#eae7e7',
  300: '#d7d3d3',
  400: '#bab6b6',
  500: '#9b9797',
  600: '#7d7979',
  700: '#605d5d',
  800: '#444141',
  900: '#2d2b2b',
} as const;
export const ACCENT_TINT = {
  100: '#fff2ef',
  700: '#ae1800',
  800: '#7c1405',
} as const;

/** Warm-neutral dark palette — mirrors the light NEUTRAL scale but inverted
 * around the same "warm gray" hue, so accent colors and the yellow HINT
 * still read correctly against it. Used by useTokens() when the resolved
 * theme mode is 'dark'. */
export const DARK_INK: Hex = '#f3f2f2';
export const DARK_NEUTRAL = {
  100: '#2d2b2b',
  200: '#3a3737',
  300: '#4a4646',
  400: '#605d5d',
  500: '#7d7979',
  600: '#9b9797',
  700: '#bab6b6',
  800: '#d7d3d3',
  900: '#eae7e7',
} as const;

/** Semantic surface tokens: the load-bearing colors for page background, card
 * surface, primary text, borders. Read via useTokens() — components that
 * consume these flip cleanly when the theme mode changes. Interior colors
 * (individual chip tints, per-icon colors, etc.) can migrate incrementally. */
export interface ThemeTokens {
  mode: 'light' | 'dark';
  bg: Hex;           // page background
  surface: Hex;      // card / raised surface
  ink: Hex;          // primary text
  muted: Hex;        // secondary text (StatChip subtitles, captions, muted rows)
  border: Hex;       // dividers, input outlines
  subtle: Hex;       // chip / input background, hover / press states on rows
  /** "Poster" surface — the CONTINUE hero card on Curriculum/Review and any
   * other feature panel that used `backgroundColor={INK}`. In light mode we
   * keep the near-black poster (dark on light bg = the intended contrast);
   * in dark mode we lift to a raised neutral so the panel doesn't collapse
   * into the page background. Text on this surface uses `posterInk`. */
  poster: Hex;
  posterInk: Hex;
  posterBorder: Hex; // subtle stroke to lift the poster off the bg in dark
  /** Top-bar / bottom-tab separator. 8-digit hex encodes ~12% alpha
   * (`1f` = 31/255) so the divider reads as a subtle line in either mode. */
  chromeBorder: Hex;
  /** Text / icon color sitting ON the live accent (PrimaryButton label,
   * selected chip). White in both modes — the accent stays saturated in
   * light and dark, so white reads on it either way. Named so components
   * route through the token system instead of hard-coding `#ffffff`. */
  onAccent: Hex;
}

/** White for text/icons on the accent — see ThemeTokens.onAccent. Defined
 * once so both mode token sets share the single source. */
const ON_ACCENT: Hex = '#ffffff';

const LIGHT_TOKENS: ThemeTokens = {
  mode: 'light',
  bg: '#f3f2f2',
  surface: '#ffffff',
  ink: INK,
  muted: NEUTRAL[700],
  border: NEUTRAL[300],
  subtle: NEUTRAL[200],
  poster: INK,
  posterInk: '#f3f2f2',
  posterBorder: INK, // same as bg — no visible stroke needed in light
  chromeBorder: '#201e1d1f',
  onAccent: ON_ACCENT,
};

const DARK_TOKENS: ThemeTokens = {
  mode: 'dark',
  bg: '#141313',
  surface: '#232121',
  ink: DARK_INK,
  muted: DARK_NEUTRAL[700], // same 30/60 relationship to ink as in light
  border: DARK_NEUTRAL[300],
  subtle: DARK_NEUTRAL[200],
  poster: DARK_NEUTRAL[200],
  posterInk: DARK_INK,
  posterBorder: DARK_NEUTRAL[400],
  chromeBorder: '#f3f2f224',
  onAccent: ON_ACCENT,
};

export function useTokens(): ThemeTokens {
  return useResolvedMode() === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
}

export const COLORS = {
  good: '#0ca678',
  goodBg: '#e6fcf5',
  goodBgDark: '#0f3d2e',   // dark-mode deep green so white/tinted text pops
  goodInkDark: '#67e8b8',  // dark-mode "correct" label — soft, still green
  bad: '#ae1800',
  badBg: '#fff2ef',
  badBgDark: '#3d1414',    // dark-mode deep red for the "wrong" answer card
  badInkDark: '#ff9783',   // dark-mode "not quite" label — light salmon
  warn: '#c98a00',
  warnBg: '#fff9db',
  warnBgDark: '#3a2f10',   // matches HINT.bgDark so warn Feedback lines up
  muted: NEUTRAL[700],
  border: NEUTRAL[300],
} as const;

/**
 * Hint tokens are deliberately theme-invariant — they never derive from the
 * live accent (see ../lib/theme.tsx) and must stay warm yellow through every
 * appearance change. `HINT.fg` (the yellow) is identical in light and dark;
 * only `HINT.bg` shifts to a dark-yellow-tinted surface in dark mode so
 * contrast stays comfortable. The Feedback component reads HINT.fg directly
 * and picks the mode-correct bg via useHintBg().
 */
export const HINT: {
  fg: Hex;
  bg: Hex;
  bgDark: Hex;
  border: Hex;
} = {
  fg: '#c98a00',
  bg: '#fff9db',       // light mode
  bgDark: '#3a2f10',   // dark mode
  border: '#f4dfa8',
};

/** Mode-correct hint background. Kept a hook (not a plain lookup) so switching
 * theme mode re-renders every consumer. */
export function useHintBg(): Hex {
  return useResolvedMode() === 'dark' ? HINT.bgDark : HINT.bg;
}

/** Mode-correct feedback background + text — used by Feedback and by any
 * answer-card / explanation panel that overlays text on a good/bad/warn
 * surface. Light mode keeps the pale bg + saturated text; dark mode uses a
 * deep bg so white / lightly-tinted text has real contrast to stand on.
 * `hint` routes through HINT tokens (see useHintBg). */
export function useFeedbackColors(kind: 'good' | 'bad' | 'warn' | 'hint'): {
  bg: Hex;
  ink: Hex;
} {
  const dark = useResolvedMode() === 'dark';
  switch (kind) {
    case 'good':
      return dark
        ? { bg: COLORS.goodBgDark, ink: COLORS.goodInkDark }
        : { bg: COLORS.goodBg, ink: COLORS.good };
    case 'bad':
      return dark
        ? { bg: COLORS.badBgDark, ink: COLORS.badInkDark }
        : { bg: COLORS.badBg, ink: COLORS.bad };
    case 'warn':
      return dark
        ? { bg: COLORS.warnBgDark, ink: HINT.fg }
        : { bg: COLORS.warnBg, ink: COLORS.warn };
    case 'hint':
      return dark
        ? { bg: HINT.bgDark, ink: HINT.fg }
        : { bg: HINT.bg, ink: HINT.fg };
  }
}

export const RADIUS = { card: 20, control: 14, pill: 999 } as const;

/** Scrollable page container, phone-first max width. Background follows the
 * resolved theme mode so a full-screen scroll (past the sticky top bar) still
 * reads correctly in dark mode. */
export function Screen({ children, maxWidth = 760 }: { children: ReactNode; maxWidth?: number }) {
  const tokens = useTokens();
  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', backgroundColor: tokens.bg }}
    >
      <YStack width="100%" maxWidth={maxWidth} padding={14} paddingBottom={90} gap={12}>
        {children}
      </YStack>
    </ScrollView>
  );
}

/**
 * Text input with a 16px floor: mobile Safari auto-zooms the page when a
 * focused field's text is smaller than 16px, so every free-text input should
 * use this (or set fontSize >= 16 explicitly).
 *
 * Owns its theming — this is a hook-owning function wrapper rather than
 * `styled(Input, {...})` so it can call `useTokens()` at render time and
 * pick up the current light/dark mode. Every color prop routes through a
 * `?? tokens.*` fallback, so callers get correct light + dark styling with
 * zero prop plumbing (`<AppInput value=… onChangeText=… />` just works),
 * and can still override any individual color when they need to (e.g. a
 * feedback-colored input on the answer card). See docs/theme-tokens.md.
 *
 * Historical note: the previous `styled(Input, { backgroundColor: NEUTRAL[200] })`
 * baked a light-only bg into the type, so every callsite had to remember to
 * override backgroundColor + color + borderColor to be dark-mode-safe —
 * missing any one of the three (as the login `Field` helper did with `color`)
 * quietly broke a screen. The wrapper form makes the default the safe one.
 */
export const AppInput = forwardRef<TextInput, ComponentProps<typeof Input>>(
  function AppInput(
    { color, backgroundColor, borderColor, placeholderTextColor, fontSize, borderRadius, ...rest },
    ref,
  ) {
    const tokens = useTokens();
    return (
      <Input
        ref={ref as never}
        fontSize={fontSize ?? 16}
        borderRadius={borderRadius ?? RADIUS.control}
        color={color ?? tokens.ink}
        backgroundColor={backgroundColor ?? tokens.surface}
        borderColor={borderColor ?? tokens.border}
        placeholderTextColor={placeholderTextColor ?? tokens.muted}
        {...rest}
      />
    );
  },
);

/** Raised card surface. Background/shadow adapt to light/dark; the card
 * itself owns its shape and elevation but not its children's colors. */
export function AppCard({
  children,
  ...rest
}: React.ComponentProps<typeof Card>) {
  const tokens = useTokens();
  return (
    <Card
      backgroundColor={tokens.surface}
      borderRadius={RADIUS.card}
      padding={16}
      gap={8}
      shadowColor={tokens.mode === 'dark' ? '#000' : '#2d2b2b'}
      shadowOpacity={tokens.mode === 'dark' ? 0.5 : 0.16}
      shadowRadius={10}
      shadowOffset={{ width: 0, height: 3 }}
      elevation={2}
      {...rest}
    >
      {children}
    </Card>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const tokens = useTokens();
  return (
    <Text fontSize={24} fontWeight="800" color={tokens.ink} marginVertical={4}>
      {children}
    </Text>
  );
}

export function SubTitle({ children }: { children: ReactNode }) {
  const tokens = useTokens();
  return (
    <Text fontSize={18} fontWeight="700" color={tokens.ink}>
      {children}
    </Text>
  );
}

export function Muted({ children, size = 13 }: { children: ReactNode; size?: number }) {
  const tokens = useTokens();
  return (
    <Text fontSize={size} color={tokens.muted}>
      {children}
    </Text>
  );
}

/** "Poster" surface — used by the CONTINUE hero card on Curriculum/Review
 * and any other feature panel that used `backgroundColor={INK}` directly.
 * See tokens.poster/posterInk/posterBorder for the mode-aware color story.
 * Children read text off `tokens.posterInk`. */
export function HeroCard({
  children,
  ...rest
}: React.ComponentProps<typeof YStack>) {
  const tokens = useTokens();
  return (
    <YStack
      backgroundColor={tokens.poster}
      borderRadius={20}
      borderWidth={tokens.mode === 'dark' ? 1 : 0}
      borderColor={tokens.posterBorder}
      padding={16}
      gap={8}
      {...rest}
    >
      {children}
    </YStack>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  const accent = useAccent();
  const tokens = useTokens();
  return (
    <Button
      backgroundColor={accent}
      color={tokens.onAccent}
      fontWeight="800"
      borderRadius={RADIUS.control}
      pressStyle={{ opacity: 0.85 }}
      {...props}
    />
  );
}

export function SecondaryButton(props: React.ComponentProps<typeof Button>) {
  const tokens = useTokens();
  return (
    <Button
      backgroundColor={tokens.subtle}
      color={tokens.ink}
      fontWeight="800"
      borderRadius={RADIUS.control}
      pressStyle={{ backgroundColor: tokens.border }}
      {...props}
    />
  );
}

export function GhostButton(props: React.ComponentProps<typeof Button>) {
  const accent = useAccent();
  const tokens = useTokens();
  return (
    <Button
      backgroundColor="transparent"
      color={accent}
      fontWeight="800"
      borderRadius={RADIUS.control}
      borderWidth={1.5}
      borderColor={accent}
      pressStyle={{ backgroundColor: tokens.subtle }}
      {...props}
    />
  );
}

/** Inline result banner. `hint` is the yellow, theme-invariant nudge (see
 * HINT). `warn` is for non-hint warnings (form validation, offline queue,
 * calculator input errors) — same color today, but a distinct token so
 * we can diverge later. bg / text pair comes from useFeedbackColors, so
 * dark mode gets a deep-colored bg with white-ish text and light mode
 * keeps the pale bg with saturated colored text. */
export function Feedback({
  kind,
  icon,
  children,
}: {
  kind: 'good' | 'bad' | 'warn' | 'hint';
  icon?: ReactNode;
  children: ReactNode;
}) {
  const { bg, ink } = useFeedbackColors(kind);
  return (
    <XStack backgroundColor={bg} borderRadius={RADIUS.control} padding={12} marginTop={8} gap={6} alignItems="center">
      {icon}
      <Text color={ink} fontWeight="700" fontSize={14} flexShrink={1}>
        {children}
      </Text>
    </XStack>
  );
}

/** Small circular/rounded icon container — unit numbers, choice letters, medal dots. */
export function IconCircle({
  size = 28,
  background = INK,
  color = '#ffffff',
  radius = 999,
  children,
}: {
  size?: number;
  background?: Hex;
  color?: Hex;
  radius?: number;
  children: ReactNode;
}) {
  return (
    <XStack
      width={size}
      height={size}
      borderRadius={radius}
      backgroundColor={background}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Text color={color} fontWeight="800" fontSize={size * 0.46}>
        {children}
      </Text>
    </XStack>
  );
}

/** Icon + big number + label pill, used on Home and Progress stat rows. */
export function StatChip({
  icon,
  value,
  label,
  flex = 1,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
  flex?: number;
}) {
  const tokens = useTokens();
  return (
    <YStack
      flex={flex}
      minWidth={76}
      backgroundColor={tokens.subtle}
      borderRadius={18}
      alignItems="center"
      gap={2}
      paddingVertical={10}
      paddingHorizontal={6}
    >
      {icon}
      <Text fontSize={20} fontWeight="800" color={tokens.ink}>
        {value}
      </Text>
      <Text fontSize={10} color={tokens.muted} textAlign="center">
        {label}
      </Text>
    </YStack>
  );
}

type MasteryTier = 'accent' | 'outline' | 'warn' | 'bad' | 'neutral';
const TIER_BY_LABEL: Record<string, MasteryTier> = {
  mastered: 'accent',
  proficient: 'accent',
  active: 'accent',
  challenge: 'accent',
  practicing: 'outline',
  standard: 'outline',
  pending: 'warn',
  struggling: 'bad',
  disabled: 'bad',
  modified: 'bad',
  not_started: 'neutral',
};

/** Pill tag: accent tiers track the live theme, struggling/disabled always
 * read as alarming regardless of the chosen accent (mastery vs. warning are
 * different signals and shouldn't be conflated by a color pick). */
interface TierStyle {
  bg: Hex | 'transparent';
  fg: Hex;
  border: Hex | 'transparent';
}

export function Badge({ label, text }: { label: string; text?: string }) {
  const accent = useAccent();
  const tokens = useTokens();
  const hintBg = useHintBg();
  const bad = useFeedbackColors('bad');
  const tier = TIER_BY_LABEL[label] ?? 'neutral';
  const styles: Record<MasteryTier, TierStyle> = {
    accent: { bg: tokens.subtle, fg: accent, border: 'transparent' },
    outline: { bg: 'transparent', fg: accent, border: accent },
    warn: { bg: hintBg, fg: HINT.fg, border: 'transparent' },
    bad: { bg: bad.bg, fg: bad.ink, border: 'transparent' },
    neutral: { bg: tokens.subtle, fg: tokens.ink, border: 'transparent' },
  };
  const style = styles[tier];
  return (
    <XStack
      backgroundColor={style.bg}
      borderWidth={tier === 'outline' ? 1.5 : 0}
      borderColor={style.border}
      borderRadius={RADIUS.pill}
      paddingHorizontal={10}
      paddingVertical={3}
    >
      <Text color={style.fg} fontSize={12} fontWeight="700">
        {text ?? label}
      </Text>
    </XStack>
  );
}

/** Thin progress bar used for mastery and review scores. */
export function ProgressBar({ ratio }: { ratio: number }) {
  const accent = useAccent();
  const tokens = useTokens();
  return (
    <YStack flex={1} height={10} backgroundColor={tokens.subtle} borderRadius={RADIUS.pill} overflow="hidden">
      <YStack
        height="100%"
        width={`${Math.max(0, Math.min(1, ratio)) * 100}%`}
        backgroundColor={accent}
        borderRadius={RADIUS.pill}
      />
    </YStack>
  );
}

export function Loading() {
  const accent = useAccent();
  return (
    <YStack padding={40} alignItems="center">
      <Spinner size="large" color={accent} />
    </YStack>
  );
}
