/**
 * Color picker (Appearance): A/B preview at the top (Current vs New), then
 * three separately-labelled H/S/L sliders under one shared ColorPicker root,
 * an optional hex text input, a "recently used" swatch row, and Save.
 * Splitting hue / saturation / brightness into their own labelled controls
 * makes the axes obvious (a saturation-and-brightness panel plus a hue
 * slider previously read as "click here and something changes"). Web drags
 * don't fire the library's onComplete reliably, so the Save button remains
 * the reliable commit path there —
 * https://alabsi91.github.io/reanimated-color-picker/api/color-picker-wrapper/
 */
import { useState } from 'react';
import { Platform } from 'react-native';
import { ArrowLeft, Flame } from '@tamagui/lucide-icons';
import { useRouter } from 'solito/navigation';
import { Input, Text, XStack, YStack } from 'tamagui';
import ColorPicker, {
  BrightnessSlider,
  HueSlider,
  SaturationSlider,
  Swatches,
  type ColorFormatsObject,
} from 'reanimated-color-picker';
import { useI18n } from '../lib/i18n';
import { useTheme, type Hex } from '../lib/theme';
import { useRequireAuth } from '../components/AppChrome';
import {
  Badge,
  PrimaryButton,
  ProgressBar,
  RADIUS,
  Screen,
  StatChip,
  Title,
  useTokens,
} from '../components/ui';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Section header — same "uppercase caption" treatment across all three
 * slider blocks so the eye picks up the H/S/L axes without re-reading. */
function SliderLabel({ text }: { text: string }) {
  const tokens = useTokens();
  return (
    <Text fontSize={12} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={tokens.muted}>
      {text}
    </Text>
  );
}

/** One of the A/B preview cards. Renders a mini "app in miniature" using the
 * supplied hex so students see exactly what will happen when they save. */
function ThemePreviewCard({
  label,
  color,
  align,
}: {
  label: string;
  color: Hex;
  align: 'flex-start' | 'flex-end';
}) {
  const tokens = useTokens();
  return (
    <YStack
      flex={1}
      backgroundColor={tokens.surface}
      borderRadius={RADIUS.card}
      padding={12}
      gap={8}
      alignItems={align}
    >
      <SliderLabel text={label} />
      <XStack
        width={44}
        height={44}
        borderRadius={22}
        backgroundColor={color}
        alignItems="center"
        justifyContent="center"
      >
        <Flame size={22} color="#ffffff" />
      </XStack>
      <YStack width="100%" gap={6}>
        <YStack height={8} backgroundColor={tokens.subtle} borderRadius={RADIUS.pill} overflow="hidden">
          <YStack height="100%" width="72%" backgroundColor={color} borderRadius={RADIUS.pill} />
        </YStack>
        <YStack
          height={30}
          backgroundColor={color}
          borderRadius={RADIUS.control}
          alignItems="center"
          justifyContent="center"
        >
          <Text color="#ffffff" fontWeight="800" fontSize={12}>
            Continue →
          </Text>
        </YStack>
      </YStack>
    </YStack>
  );
}

export function AppearanceScreen() {
  const { t } = useI18n();
  const authed = useRequireAuth();
  const router = useRouter();
  const tokens = useTokens();
  const { accent, recentColors, setAccent } = useTheme();
  const [liveColor, setLiveColor] = useState<Hex>(accent);
  const [hexDraft, setHexDraft] = useState<string>(accent);
  if (!authed) return null;

  const commit = (hex: string) => {
    if (HEX_RE.test(hex)) {
      setAccent(hex as Hex);
      setLiveColor(hex as Hex);
      setHexDraft(hex);
    }
  };

  return (
    <Screen maxWidth={560}>
      <XStack alignItems="center" gap={8}>
        <XStack onPress={() => router.back()} cursor="pointer" pressStyle={{ opacity: 0.6 }}>
          <ArrowLeft size={20} color={tokens.ink} />
        </XStack>
        <Title>{t('appearance')}</Title>
      </XStack>

      {/* A/B preview lives at the top so the effect of every drag is visible
          without scrolling. Current on the left, New on the right — matches
          left-to-right reading order. */}
      <XStack gap={10}>
        <ThemePreviewCard label={t('currentThemeLabel')} color={accent} align="flex-start" />
        <ThemePreviewCard label={t('newThemeLabel')} color={liveColor} align="flex-end" />
      </XStack>

      <ColorPicker
        value={accent}
        onChangeJS={(colors: ColorFormatsObject) => {
          setLiveColor(colors.hex as Hex);
          setHexDraft(colors.hex);
        }}
        onCompleteJS={(colors: ColorFormatsObject) => commit(colors.hex)}
      >
        <YStack gap={14}>
          <YStack gap={6}>
            <SliderLabel text={t('hueLabel')} />
            {/* HueSlider bundles a PNG rainbow that react-native-web doesn't
                reliably render into the DOM — layer a CSS linear-gradient
                under it on web so the rainbow track is visible either way. */}
            <HueSlider
              style={{
                height: 22,
                borderRadius: 11,
                ...(Platform.OS === 'web'
                  ? {
                      backgroundImage:
                        'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                    }
                  : null),
              }}
              thumbSize={26}
            />
          </YStack>
          <YStack gap={6}>
            <SliderLabel text={t('saturationLabel')} />
            <SaturationSlider style={{ height: 22, borderRadius: 11 }} thumbSize={26} />
          </YStack>
          <YStack gap={6}>
            <SliderLabel text={t('brightnessLabel')} />
            <BrightnessSlider style={{ height: 22, borderRadius: 11 }} thumbSize={26} />
          </YStack>

          {/* Optional hex input for power users pasting brand colors from a
              spec doc. Backed by a controlled draft so typing doesn't commit
              on every keystroke; a valid 6-digit hex commits on blur/submit. */}
          <YStack gap={6}>
            <SliderLabel text={t('hexInputPlaceholder')} />
            <Input
              value={hexDraft}
              onChangeText={setHexDraft}
              onBlur={() => commit(hexDraft)}
              onSubmitEditing={() => commit(hexDraft)}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              placeholder="#3366ff"
              backgroundColor={tokens.surface}
              borderColor={tokens.border}
              borderRadius={RADIUS.control}
              fontSize={16}
            />
          </YStack>

          {recentColors.length > 0 ? (
            <YStack gap={6}>
              <SliderLabel text={t('recentColors')} />
              <Swatches
                colors={recentColors}
                swatchStyle={{ width: 34, height: 34, borderRadius: 10 }}
              />
            </YStack>
          ) : (
            <Text fontSize={12} color={tokens.muted}>
              {t('noRecentColors')}
            </Text>
          )}
        </YStack>
      </ColorPicker>

      <PrimaryButton justifyContent="center" onPress={() => commit(liveColor)}>
        {t('saveColor')}
      </PrimaryButton>

      {/* Below-the-fold live component preview so users can also see the
          accent applied to real Badges + StatChip. Redundant with the A/B
          cards but useful for the "recently used" case where the swatch
          tap already committed and the A/B cards show identical colors. */}
      <YStack backgroundColor={tokens.surface} borderRadius={RADIUS.card} padding={16} gap={10}>
        <SliderLabel text={t('previewLabel')} />
        <XStack gap={10} alignItems="center" flexWrap="wrap">
          <StatChip icon={<Flame size={20} color={accent} />} value={5} label="" flex={0} />
          <Badge label="mastered" text="Mastered" />
          <Badge label="practicing" text="Practicing" />
        </XStack>
        <ProgressBar ratio={0.7} />
      </YStack>
    </Screen>
  );
}
