/**
 * "Watch it step by step" card for the lesson player: shows the animated
 * worked examples registered for a lesson code (registry in model.ts),
 * with a picker when a lesson has more than one script.
 */
import { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { useI18n } from '../../lib/i18n';
import { BRAND, SecondaryButton, SubTitle } from '../ui';
import { AnimatedEquation } from './AnimatedEquation';
import { scriptsByLessonCode } from './model';

export function LessonAnimations({ code }: { code: string }) {
  const { t, locale } = useI18n();
  const scripts = scriptsByLessonCode[code];
  const [scriptId, setScriptId] = useState<string | null>(null);
  if (!scripts || scripts.length === 0) return null;
  const script = scripts.find((s) => s.id === scriptId) ?? scripts[0];

  return (
    <YStack gap={8}>
      <SubTitle>🎬 {t('animatedExample')}</SubTitle>
      {scripts.length > 1 && (
        <XStack gap={8} flexWrap="wrap">
          {scripts.map((s) => (
            <SecondaryButton
              key={s.id}
              size="$3"
              onPress={() => setScriptId(s.id)}
              {...(s.id === script.id ? { backgroundColor: BRAND, color: 'white' } : {})}
            >
              {locale === 'es' ? s.titleEs : s.titleEn}
            </SecondaryButton>
          ))}
        </XStack>
      )}
      {scripts.length === 1 && (
        <Text fontSize={14} color="#6b7280">
          {locale === 'es' ? script.titleEs : script.titleEn}
        </Text>
      )}
      <AnimatedEquation key={script.id} script={script} />
    </YStack>
  );
}
