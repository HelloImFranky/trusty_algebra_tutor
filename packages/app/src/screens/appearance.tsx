/**
 * Color picker (Appearance): at the top, two color-only swatches (Current vs
 * New) plus a live full-component preview that reflects the New color as the
 * H/S/L sliders drag. Below the top strip: three separately-labelled sliders,
 * an optional hex input, a "recently used" row, and Save. Everything above
 * the sliders is redundant on first look, but that's the point — dragging a
 * slider should show its result without scrolling. Web drags don't fire the
 * library's onComplete reliably, so the Save button remains the reliable
 * commit path there —
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
  RADIUS,
  Screen,
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

/** One of the two color-only swatches at the top. Literally just a colored
 * square with a label — the "actual" theme preview is the LivePreview
 * component next to it. */
function ColorSwatch({ label, color }: { label: string; color: Hex }) {
  return (
    <YStack flex={1} gap={6}>
      <SliderLabel text={label} />
      <YStack height={72} borderRadius={RADIUS.card} backgroundColor={color} />
    </YStack>
  );
}

/** Live theme preview — a mini card that mirrors the real Badge / StatChip /
 * ProgressBar / PrimaryButton visuals but reads its accent from a prop, so
 * it can reflect the New color while the user drags a slider (the app's
 * real components pull from useAccent() and only see the committed value). */
function LivePreview({ color }: { color: Hex }) {
  const tokens = useTokens();
  return (
    <YStack backgroundColor={tokens.surface} borderRadius={RADIUS.card} padding={12} gap={10}>
      <SliderLabel text="Preview" />
      <XStack gap={8} alignItems="center" flexWrap="wrap">
        {/* Stat chip with a fire-red streak: streak icon is hard-coded red
            everywhere else in the app; keep the invariant here too so this
            preview matches what the real dashboard will show. */}
        <YStack
          minWidth={76}
          backgroundColor={tokens.subtle}
          borderRadius={18}
          alignItems="center"
          gap={2}
          paddingVertical={8}
          paddingHorizontal={6}
        >
          <Flame size={20} color="#ec3013" />
          <Text fontSize={18} fontWeight="800" color={tokens.ink}>5</Text>
          <Text fontSize={10} color={tokens.muted}>streak</Text>
        </YStack>
        {/* "Mastered" badge — accent-filled tint, matches Badge tier="accent" */}
        <XStack backgroundColor={tokens.subtle} borderRadius={RADIUS.pill} paddingHorizontal={10} paddingVertical={3}>
          <Text color={color} fontSize={12} fontWeight="700">Mastered</Text>
        </XStack>
        {/* "Practicing" outline badge — matches Badge tier="outline" */}
        <XStack borderWidth={1.5} borderColor={color} borderRadius={RADIUS.pill} paddingHorizontal={10} paddingVertical={3}>
          <Text color={color} fontSize={12} fontWeight="700">Practicing</Text>
        </XStack>
      </XStack>
      {/* Progress bar mirror */}
      <YStack height={10} backgroundColor={tokens.subtle} borderRadius={RADIUS.pill} overflow="hidden">
        <YStack height="100%" width="72%" backgroundColor={color} borderRadius={RADIUS.pill} />
      </YStack>
      {/* Primary button mirror */}
      <YStack
        height={38}
        backgroundColor={color}
        borderRadius={RADIUS.control}
        alignItems="center"
        justifyContent="center"
      >
        <Text color="#ffffff" fontWeight="800" fontSize={14}>Continue →</Text>
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

      {/* Top strip: two color-only swatches (Current vs New) so the raw
          picked hue reads at a glance, and — under them — the live
          full-component preview that updates in sync with the New swatch
          as the sliders drag. The New swatch and the preview share the
          same liveColor state, so they're always in agreement. */}
      <XStack gap={10}>
        <ColorSwatch label={t('currentThemeLabel')} color={accent} />
        <ColorSwatch label={t('newThemeLabel')} color={liveColor} />
      </XStack>
      <LivePreview color={liveColor} />

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

      {/* Save is the reliable commit on web (see file header). Filled with
          the LIVE color so the button previews the new theme too. */}
      <YStack
        height={44}
        backgroundColor={liveColor}
        borderRadius={RADIUS.control}
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        pressStyle={{ opacity: 0.85 }}
        onPress={() => commit(liveColor)}
      >
        <Text color="#ffffff" fontWeight="800" fontSize={15}>
          {t('saveColor')}
        </Text>
      </YStack>
    </Screen>
  );
}
