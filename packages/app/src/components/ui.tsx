/**
 * Shared building blocks so every screen reads the same. Palette/type/radii
 * follow the "Modernist / rounded & friendly" design (Claude Design project
 * 937947b2-2ad0-4187-ba61-c2e54cc33dd6, variant 3): warm neutral surfaces,
 * near-black ink, a themeable accent (see ../lib/theme.tsx), heavy rounding.
 */
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { Button, Card, Input, Spinner, Text, XStack, YStack, styled } from 'tamagui';
import { DEFAULT_ACCENT, useAccent, type Hex } from '../lib/theme';

export { useAccent, type Hex };

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

export const COLORS = {
  good: '#0ca678',
  goodBg: '#e6fcf5',
  bad: '#ae1800',
  badBg: '#fff2ef',
  warn: '#c98a00',
  warnBg: '#fff9db',
  muted: NEUTRAL[700],
  border: NEUTRAL[300],
} as const;

/**
 * Hint tokens are deliberately theme-invariant — they never derive from the
 * live accent (see ../lib/theme.tsx) and must stay warm yellow through every
 * appearance change (dark mode included). Hints only work if students notice
 * them; letting the picked accent recolor them destroys that signal. Keep
 * these values pinned; only shift HINT.bg in a future dark theme to preserve
 * contrast, never HINT.fg.
 */
export const HINT = {
  fg: '#c98a00',
  bg: '#fff9db',
  border: '#f4dfa8',
} as const;

export const RADIUS = { card: 20, control: 14, pill: 999 } as const;

/** Scrollable page container, phone-first max width. */
export function Screen({ children, maxWidth = 760 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}>
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
 */
export const AppInput = styled(Input, {
  fontSize: 16,
  backgroundColor: NEUTRAL[200],
  borderColor: 'transparent',
  borderRadius: RADIUS.control,
});

export const AppCard = styled(Card, {
  backgroundColor: '#ffffff',
  borderRadius: RADIUS.card,
  padding: 16,
  gap: 8,
  shadowColor: '#2d2b2b',
  shadowOpacity: 0.16,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
});

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text fontSize={24} fontWeight="800" color={INK} marginVertical={4}>
      {children}
    </Text>
  );
}

export function SubTitle({ children }: { children: ReactNode }) {
  return (
    <Text fontSize={18} fontWeight="700" color={INK}>
      {children}
    </Text>
  );
}

export function Muted({ children, size = 13 }: { children: ReactNode; size?: number }) {
  return (
    <Text fontSize={size} color={COLORS.muted}>
      {children}
    </Text>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  const accent = useAccent();
  return (
    <Button
      backgroundColor={accent}
      color="#ffffff"
      fontWeight="800"
      borderRadius={RADIUS.control}
      pressStyle={{ opacity: 0.85 }}
      {...props}
    />
  );
}

export function SecondaryButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      backgroundColor={NEUTRAL[200]}
      color={INK}
      fontWeight="800"
      borderRadius={RADIUS.control}
      pressStyle={{ backgroundColor: NEUTRAL[300] }}
      {...props}
    />
  );
}

export function GhostButton(props: React.ComponentProps<typeof Button>) {
  const accent = useAccent();
  return (
    <Button
      backgroundColor="transparent"
      color={accent}
      fontWeight="800"
      borderRadius={RADIUS.control}
      borderWidth={1.5}
      borderColor={accent}
      pressStyle={{ backgroundColor: NEUTRAL[100] }}
      {...props}
    />
  );
}

/** Inline result banner. `hint` is the yellow, theme-invariant nudge (see
 * HINT). `warn` is for non-hint warnings (form validation, offline queue,
 * calculator input errors) — same color today, but a distinct token so
 * we can diverge later. */
export function Feedback({
  kind,
  icon,
  children,
}: {
  kind: 'good' | 'bad' | 'warn' | 'hint';
  icon?: ReactNode;
  children: ReactNode;
}) {
  const color = kind === 'hint' ? HINT.fg : COLORS[kind];
  const bg =
    kind === 'good' ? COLORS.goodBg
    : kind === 'bad' ? COLORS.badBg
    : kind === 'hint' ? HINT.bg
    : COLORS.warnBg;
  return (
    <XStack backgroundColor={bg} borderRadius={RADIUS.control} padding={12} marginTop={8} gap={6} alignItems="center">
      {icon}
      <Text color={color} fontWeight="700" fontSize={14} flexShrink={1}>
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
  return (
    <YStack
      flex={flex}
      minWidth={76}
      backgroundColor={NEUTRAL[200]}
      borderRadius={18}
      alignItems="center"
      gap={2}
      paddingVertical={10}
      paddingHorizontal={6}
    >
      {icon}
      <Text fontSize={20} fontWeight="800" color={INK}>
        {value}
      </Text>
      <Text fontSize={10} color={COLORS.muted} textAlign="center">
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
  const tier = TIER_BY_LABEL[label] ?? 'neutral';
  const styles: Record<MasteryTier, TierStyle> = {
    accent: { bg: NEUTRAL[100], fg: accent, border: 'transparent' },
    outline: { bg: 'transparent', fg: accent, border: accent },
    warn: { bg: HINT.bg, fg: HINT.fg, border: 'transparent' },
    bad: { bg: COLORS.badBg, fg: COLORS.bad, border: 'transparent' },
    neutral: { bg: NEUTRAL[100], fg: NEUTRAL[800], border: 'transparent' },
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
  return (
    <YStack flex={1} height={10} backgroundColor={NEUTRAL[200]} borderRadius={RADIUS.pill} overflow="hidden">
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
