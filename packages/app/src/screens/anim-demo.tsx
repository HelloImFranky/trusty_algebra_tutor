/** Prototype playground for the token-morphing step animator. */
import { useState } from 'react';
import { XStack } from 'tamagui';
import { useI18n } from '../lib/i18n';
import { AnimatedEquation } from '../components/stepanim/AnimatedEquation';
import { demoScripts } from '../components/stepanim/model';
import { BRAND, Muted, Screen, SecondaryButton, Title } from '../components/ui';

export function AnimDemoScreen() {
  const { locale } = useI18n();
  const [scriptId, setScriptId] = useState(demoScripts[0].id);
  const script = demoScripts.find((s) => s.id === scriptId) ?? demoScripts[0];

  return (
    <Screen maxWidth={720}>
      <Title>🎬 {locale === 'es' ? 'Pasos animados' : 'Animated steps'}</Title>
      <Muted>
        {locale === 'es'
          ? 'Prototipo: mira cómo se hace cada operación, paso a paso.'
          : 'Prototype: watch each operation happen, step by step.'}
      </Muted>
      <XStack gap={8} flexWrap="wrap">
        {demoScripts.map((s) => (
          <SecondaryButton
            key={s.id}
            onPress={() => setScriptId(s.id)}
            {...(s.id === script.id ? { backgroundColor: BRAND, color: 'white' } : {})}
          >
            {locale === 'es' ? s.titleEs : s.titleEn}
          </SecondaryButton>
        ))}
      </XStack>
      <AnimatedEquation key={script.id} script={script} />
    </Screen>
  );
}
