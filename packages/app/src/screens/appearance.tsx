/** Color-theme picker (design doc mockup 3g): 4 hues x 4 shades, instant-apply + persisted. */
import { ArrowLeft, Check, Flame } from '@tamagui/lucide-icons';
import { useRouter } from 'solito/navigation';
import { Text, XStack, YStack } from 'tamagui';
import { useI18n, type I18nKey } from '../lib/i18n';
import { THEMES, useTheme, type ThemeHue } from '../lib/theme';
import { useRequireAuth } from '../components/AppChrome';
import {
  Badge,
  NEUTRAL,
  PrimaryButton,
  ProgressBar,
  Screen,
  StatChip,
  Title,
} from '../components/ui';

const HUE_LABEL_KEY: Record<ThemeHue, I18nKey> = {
  classicRed: 'themeClassicRed',
  oceanBlue: 'themeOceanBlue',
  forestGreen: 'themeForestGreen',
  grapePurple: 'themeGrapePurple',
};

function ShadeRow({ hueKey, selected, onPick }: { hueKey: ThemeHue; selected: number | null; onPick: (shade: number) => void }) {
  const { t } = useI18n();
  return (
    <YStack gap={6}>
      <Text fontSize={13} fontWeight="700">
        {t(HUE_LABEL_KEY[hueKey])}
      </Text>
      <XStack gap={8}>
        {THEMES[hueKey].shades.map((hex, i) => {
          const isSelected = selected === i;
          return (
            <XStack
              key={hex}
              width={40}
              height={40}
              borderRadius={10}
              backgroundColor={hex}
              alignItems="center"
              justifyContent="center"
              borderWidth={isSelected ? 2 : 0}
              borderColor="#201e1d"
              cursor="pointer"
              pressStyle={{ opacity: 0.85 }}
              onPress={() => onPick(i)}
              accessibilityRole="button"
              aria-label={`${hueKey} ${i + 1}`}
            >
              {isSelected && <Check size={16} color="#ffffff" />}
            </XStack>
          );
        })}
      </XStack>
    </YStack>
  );
}

export function AppearanceScreen() {
  const { t } = useI18n();
  const authed = useRequireAuth();
  const router = useRouter();
  const { accent, hue, shade, setTheme } = useTheme();
  if (!authed) return null;

  return (
    <Screen maxWidth={560}>
      <XStack alignItems="center" gap={8}>
        <XStack onPress={() => router.back()} cursor="pointer" pressStyle={{ opacity: 0.6 }}>
          <ArrowLeft size={20} color="#201e1d" />
        </XStack>
        <Title>{t('appearance')}</Title>
      </XStack>

      <Text fontSize={12} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={NEUTRAL[700]}>
        {t('colorTheme')}
      </Text>

      {(Object.keys(THEMES) as ThemeHue[]).map((hueKey) => (
        <ShadeRow
          key={hueKey}
          hueKey={hueKey}
          selected={hue === hueKey ? shade : null}
          onPick={(i) => setTheme(hueKey, i)}
        />
      ))}

      <Text fontSize={12} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={NEUTRAL[700]} marginTop={6}>
        {t('previewLabel')}
        {hue ? ` — ${t(HUE_LABEL_KEY[hue])}` : ''}
      </Text>
      <YStack backgroundColor="#ffffff" borderRadius={20} padding={16} gap={10}>
        <XStack gap={10} alignItems="center" flexWrap="wrap">
          <StatChip icon={<Flame size={20} color={accent} />} value={5} label="" flex={0} />
          <Badge label="mastered" text="Mastered" />
          <Badge label="practicing" text="Practicing" />
        </XStack>
        <ProgressBar ratio={0.7} />
        <PrimaryButton justifyContent="center">Continue →</PrimaryButton>
      </YStack>

      <PrimaryButton justifyContent="center" onPress={() => router.back()}>
        {t('applyTheme')}
      </PrimaryButton>
    </Screen>
  );
}
