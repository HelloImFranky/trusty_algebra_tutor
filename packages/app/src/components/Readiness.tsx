/**
 * Regents-readiness band visuals (docs/statistics-plan.md, Phase 2), shared
 * by the student progress page, the teacher class grid, and the admin school
 * distribution so a band always looks the same everywhere. Bands ride the
 * fixed feedback palette (good/warn/bad), not the user-picked accent —
 * readiness is a traffic light, and green must stay green.
 */
import { Text, XStack, YStack } from 'tamagui';
import { useI18n, type I18nKey } from '../lib/i18n';
import { RADIUS, useFeedbackColors, useTokens, type Hex } from './ui';

export type Band = 'ready' | 'developing' | 'needsWork' | 'noData';

export const BAND_KEY: Record<Band, I18nKey> = {
  ready: 'readinessReady',
  developing: 'readinessDeveloping',
  needsWork: 'readinessNeedsWork',
  noData: 'readinessNoData',
};

export function useBandColors(): Record<Band, { bg: Hex; ink: Hex }> {
  const good = useFeedbackColors('good');
  const warn = useFeedbackColors('warn');
  const bad = useFeedbackColors('bad');
  const tokens = useTokens();
  return {
    ready: good,
    developing: warn,
    needsWork: bad,
    noData: { bg: tokens.subtle, ink: tokens.muted },
  };
}

export function ReadinessPill({ band }: { band: Band }) {
  const { t } = useI18n();
  const colors = useBandColors()[band];
  return (
    <XStack
      backgroundColor={colors.bg}
      borderRadius={RADIUS.pill}
      paddingHorizontal={10}
      paddingVertical={3}
    >
      <Text color={colors.ink} fontSize={12} fontWeight="700">
        {t(BAND_KEY[band])}
      </Text>
    </XStack>
  );
}

/** Compact square for dense grids (teacher students × topics). */
export function ReadinessDot({ band, size = 14 }: { band: Band; size?: number }) {
  const colors = useBandColors()[band];
  return (
    <YStack
      width={size}
      height={size}
      borderRadius={4}
      backgroundColor={band === 'noData' ? colors.bg : colors.ink}
      opacity={band === 'noData' ? 1 : 0.85}
    />
  );
}
