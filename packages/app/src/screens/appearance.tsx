/**
 * Color picker (Appearance): a free-form saturation/brightness + hue picker
 * (reanimated-color-picker — works natively on iOS/Android/Expo and on web)
 * with a short "recently used" history, persisted client-side (see
 * ../lib/theme.tsx). Swatch taps and native drag-release apply instantly;
 * on web, dragging the panel/slider previews live but commits via the Save
 * button (the library's onComplete callback isn't reliable on web drags —
 * https://alabsi91.github.io/reanimated-color-picker/api/color-picker-wrapper/).
 */
import { useState } from 'react';
import { ArrowLeft, Flame } from '@tamagui/lucide-icons';
import { useRouter } from 'solito/navigation';
import { Text, XStack, YStack } from 'tamagui';
import ColorPicker, { HueSlider, Panel1, Preview, Swatches, type ColorFormatsObject } from 'reanimated-color-picker';
import { useI18n } from '../lib/i18n';
import { useTheme, type Hex } from '../lib/theme';
import { useRequireAuth } from '../components/AppChrome';
import {
  Badge,
  INK,
  NEUTRAL,
  PrimaryButton,
  ProgressBar,
  Screen,
  StatChip,
  Title,
} from '../components/ui';

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

export function AppearanceScreen() {
  const { t } = useI18n();
  const authed = useRequireAuth();
  const router = useRouter();
  const { accent, recentColors, setAccent } = useTheme();
  const [liveColor, setLiveColor] = useState<Hex>(accent);
  if (!authed) return null;

  const commit = (hex: string) => {
    if (HEX_RE.test(hex)) setAccent(hex as Hex);
  };

  return (
    <Screen maxWidth={560}>
      <XStack alignItems="center" gap={8}>
        <XStack onPress={() => router.back()} cursor="pointer" pressStyle={{ opacity: 0.6 }}>
          <ArrowLeft size={20} color={INK} />
        </XStack>
        <Title>{t('appearance')}</Title>
      </XStack>

      <Text fontSize={12} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={NEUTRAL[700]}>
        {t('colorTheme')}
      </Text>

      <ColorPicker
        value={accent}
        onChangeJS={(colors: ColorFormatsObject) => setLiveColor(colors.hex as Hex)}
        onCompleteJS={(colors: ColorFormatsObject) => commit(colors.hex)}
      >
        <YStack gap={14}>
          <Panel1 style={{ height: 180, borderRadius: 14 }} thumbSize={26} />
          <HueSlider style={{ height: 18, borderRadius: 9 }} thumbSize={22} />
          <Preview style={{ height: 40, borderRadius: 12 }} hideInitialColor />

          {recentColors.length > 0 ? (
            <YStack gap={6}>
              <Text fontSize={12} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={NEUTRAL[700]}>
                {t('recentColors')}
              </Text>
              <Swatches colors={recentColors} swatchStyle={{ width: 34, height: 34, borderRadius: 10 }} />
            </YStack>
          ) : (
            <Text fontSize={12} color={NEUTRAL[600]}>
              {t('noRecentColors')}
            </Text>
          )}
        </YStack>
      </ColorPicker>

      <PrimaryButton justifyContent="center" onPress={() => commit(liveColor)}>
        {t('saveColor')}
      </PrimaryButton>

      <Text fontSize={12} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={NEUTRAL[700]} marginTop={6}>
        {t('previewLabel')}
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
    </Screen>
  );
}
