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
import { Button, Sheet, XStack } from 'tamagui';
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
        snapPoints={[90]}
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
            paddingTop={14}
            paddingBottom={8}
            borderBottomWidth={1}
            borderBottomColor={tokens.chromeBorder}
          >
            <SubTitle>🧮 {t('calculator')}</SubTitle>
            <Button size="$2" chromeless onPress={() => setOpen(false)} aria-label="close" color={tokens.ink}>
              ✕
            </Button>
          </XStack>
          <Sheet.ScrollView flex={1}>
            <XStack padding={12} paddingBottom={40}>
              <XStack flex={1} maxWidth={720} marginHorizontal="auto">
                <Calculator />
              </XStack>
            </XStack>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}
