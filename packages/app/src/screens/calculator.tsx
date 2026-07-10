import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { GraphCalculator } from '../components/GraphCalculator';
import { Screen, Title } from '../components/ui';

export function CalculatorScreen() {
  const { t } = useI18n();
  useRequireAuth();
  return (
    <Screen maxWidth={720}>
      <Title>🧮 {t('calculator')}</Title>
      <GraphCalculator />
    </Screen>
  );
}
