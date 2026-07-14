/** Small shared building blocks so every screen reads the same. */
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { Button, Card, Input, Spinner, Text, XStack, YStack, styled } from 'tamagui';

export const BRAND = '#3b5bdb';
export const COLORS = {
  good: '#0ca678',
  goodBg: '#e6fcf5',
  bad: '#e03131',
  badBg: '#fff5f5',
  warn: '#e8590c',
  warnBg: '#fff4e6',
  muted: '#6b7280',
  border: '#e5e7eb',
} as const;

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
});

export const AppCard = styled(Card, {
  backgroundColor: '#ffffff',
  borderRadius: 14,
  padding: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
  elevation: 1,
});

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text fontSize={24} fontWeight="800" color="#111827" marginVertical={4}>
      {children}
    </Text>
  );
}

export function SubTitle({ children }: { children: ReactNode }) {
  return (
    <Text fontSize={18} fontWeight="700" color="#111827">
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
  return (
    <Button
      backgroundColor={BRAND}
      color="white"
      fontWeight="700"
      borderRadius={12}
      pressStyle={{ backgroundColor: '#2f4bc0' }}
      {...props}
    />
  );
}

export function SecondaryButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      backgroundColor="#eef1fd"
      color={BRAND}
      fontWeight="700"
      borderRadius={12}
      pressStyle={{ backgroundColor: '#dde3fb' }}
      {...props}
    />
  );
}

export function GhostButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      backgroundColor="transparent"
      color={COLORS.muted}
      fontWeight="700"
      borderRadius={12}
      borderWidth={1}
      borderColor={COLORS.border}
      pressStyle={{ backgroundColor: '#f3f4f6' }}
      {...props}
    />
  );
}

/** Inline result banner: correct / incorrect / warning / offline-queued. */
export function Feedback({
  kind,
  children,
}: {
  kind: 'good' | 'bad' | 'warn';
  children: ReactNode;
}) {
  const color = COLORS[kind];
  const bg = kind === 'good' ? COLORS.goodBg : kind === 'bad' ? COLORS.badBg : COLORS.warnBg;
  return (
    <XStack backgroundColor={bg} borderRadius={10} padding={10} marginTop={8}>
      <Text color={color} fontWeight="700" fontSize={14}>
        {children}
      </Text>
    </XStack>
  );
}

type Hex = `#${string}`;
const BADGE_COLORS: Record<string, { bg: Hex; fg: Hex }> = {
  mastered: { bg: '#e6fcf5', fg: '#0ca678' },
  proficient: { bg: '#e7f5ff', fg: '#1c7ed6' },
  practicing: { bg: '#fff9db', fg: '#997404' },
  struggling: { bg: '#fff5f5', fg: '#e03131' },
  not_started: { bg: '#f1f3f5', fg: '#6b7280' },
  standard: { bg: '#fff9db', fg: '#997404' },
  modified: { bg: '#fff5f5', fg: '#e03131' },
  challenge: { bg: '#e6fcf5', fg: '#0ca678' },
  active: { bg: '#e6fcf5', fg: '#0ca678' },
  pending: { bg: '#fff9db', fg: '#997404' },
  disabled: { bg: '#fff5f5', fg: '#e03131' },
};

export function Badge({ label, text }: { label: string; text?: string }) {
  const c = BADGE_COLORS[label] ?? BADGE_COLORS.not_started;
  return (
    <XStack backgroundColor={c.bg} borderRadius={999} paddingHorizontal={10} paddingVertical={3}>
      <Text color={c.fg} fontSize={12} fontWeight="700">
        {text ?? label}
      </Text>
    </XStack>
  );
}

/** Thin progress bar used for mastery and review scores. */
export function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <YStack flex={1} height={10} backgroundColor="#eef1f5" borderRadius={999} overflow="hidden">
      <YStack
        height="100%"
        width={`${Math.max(0, Math.min(1, ratio)) * 100}%`}
        backgroundColor={BRAND}
        borderRadius={999}
      />
    </YStack>
  );
}

export function Loading() {
  return (
    <YStack padding={40} alignItems="center">
      <Spinner size="large" color={BRAND} />
    </YStack>
  );
}
