/**
 * Chrome-level Calculator entry point: opens the full Calculator inside a
 * bottom sheet so students never leave their current lesson / practice /
 * review page just to punch in a number. Mirrors ReferenceSheetButton — one
 * icon button in the top bar, one modal sheet, dismiss via ✕ or the overlay.
 * The dedicated /calculator route still exists (deep-link parity) but the
 * chrome button no longer navigates there.
 */
import { useState } from 'react';
import { Platform } from 'react-native';
import { Calculator as CalculatorIcon } from '@tamagui/lucide-icons';
import { Button, Sheet, XStack, YStack } from 'tamagui';
import { useI18n } from '../lib/i18n';
import { Calculator } from './calculator/Calculator';
import { SubTitle, useTokens } from './ui';

export function CalculatorButton() {
  const { t } = useI18n();
  const tokens = useTokens();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="$2"
        backgroundColor={tokens.subtle}
        color={tokens.ink}
        borderRadius={999}
        onPress={() => setOpen(true)}
        aria-label={t('calculator')}
      >
        <CalculatorIcon size={15} color={tokens.ink} />
      </Button>
      <Sheet
        modal
        open={open}
        onOpenChange={setOpen}
        snapPointsMode="percent"
        // 95% (up from 90) gives the calc + graph a bit more vertical
        // room; anything more than 95 loses the "peek the page behind"
        // signal that this is a modal-over-your-work.
        snapPoints={[95]}
        dismissOnSnapToBottom
        // Sheet drag competes with the inner ScrollViews/wheels on web
        // and can strand them unscrollable; overlay + ✕ dismiss there.
        disableDrag={Platform.OS === 'web'}
      >
        <Sheet.Overlay backgroundColor="rgba(0,0,0,0.4)" />
        <Sheet.Frame backgroundColor={tokens.bg} borderTopLeftRadius={18} borderTopRightRadius={18}>
          <XStack
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal={18}
            paddingTop={12}
            paddingBottom={6}
            borderBottomWidth={1}
            borderBottomColor={tokens.chromeBorder}
          >
            <SubTitle>🧮 {t('calculator')}</SubTitle>
            <Button size="$2" chromeless onPress={() => setOpen(false)} aria-label="close" color={tokens.ink}>
              ✕
            </Button>
          </XStack>
          <Sheet.ScrollView flex={1}>
            {/* Tighter horizontal padding and a narrower max-width so
                buttons stay a comfortable finger-size at the constrained
                sheet width — a full 720px would spread digit keys too far
                apart at desktop sheet widths. `compact` shortens sci /
                main button rows and shrinks the graph plot height so the
                whole calc fits without the ScrollView having to scroll on
                a typical laptop viewport.
                width='100%' + overflow='hidden' on the wrapper enforces
                the container width on mobile (400 CSS px). Without them
                Tamagui's flex-with-maxWidth lets intrinsic-width children
                (the 6-column sci pad) push past the sheet edge. */}
            <YStack width="100%" paddingHorizontal={8} paddingTop={8} paddingBottom={28} overflow="hidden">
              <YStack width="100%" maxWidth={560} marginHorizontal="auto" overflow="hidden">
                <Calculator compact />
              </YStack>
            </YStack>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}
