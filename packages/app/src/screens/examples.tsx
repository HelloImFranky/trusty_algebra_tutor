/**
 * Animated examples library: every worked-example animation in one place,
 * organized by topic. Individual lessons and practice problems embed the
 * same player contextually; this screen is the browsable index.
 */
import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { AnimatedEquation } from '../components/stepanim/AnimatedEquation';
import { demoScripts } from '../components/stepanim/model';
import { ScriptPicker } from '../components/stepanim/ScriptPicker';
import { Muted, Screen, Title } from '../components/ui';

export function ExamplesScreen() {
  const { t } = useI18n();
  useRequireAuth();
  const [scriptId, setScriptId] = useState(demoScripts[0].id);
  const script = demoScripts.find((s) => s.id === scriptId) ?? demoScripts[0];

  return (
    <Screen maxWidth={720}>
      <Title>🎬 {t('animatedExamples')}</Title>
      <Muted>{t('animatedExamplesIntro')}</Muted>
      <ScriptPicker scripts={demoScripts} selectedId={script.id} onSelect={setScriptId} />
      <AnimatedEquation key={script.id} script={script} />
    </Screen>
  );
}
