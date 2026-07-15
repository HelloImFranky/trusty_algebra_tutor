/**
 * Placeholder mascot: no illustration asset exists yet, so this is drawn with
 * plain shapes (same philosophy as the medallions in screens/progress.tsx) —
 * a soft accent-tinted surface with a centered icon. Swap for real art later
 * without touching call sites.
 */
import { Sparkles } from '@tamagui/lucide-icons';
import { YStack } from 'tamagui';
import { useAccent } from '../lib/theme';

export function Mascot({ size = 44, radius }: { size?: number; radius?: number }) {
  const accent = useAccent();
  return (
    <YStack
      width={size}
      height={size}
      borderRadius={radius ?? size / 2}
      backgroundColor={accent}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Sparkles size={size * 0.5} color="#ffffff" />
    </YStack>
  );
}
