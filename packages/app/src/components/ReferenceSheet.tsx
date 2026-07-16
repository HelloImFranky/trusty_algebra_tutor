/** Always-accessible Regents Reference Sheet (design doc §1/§4.5), as a Tamagui Sheet. */
import { useState } from 'react';
import { Platform } from 'react-native';
import { BookMarked } from '@tamagui/lucide-icons';
import { Button, Separator, Sheet, Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { Katex } from './Katex';
import { SubTitle, useAccent, useTokens } from './ui';

/**
 * Top-bar pill that opens the reference sheet. Lives in the AppChrome top bar
 * so it never covers screen content; `compact` (phone widths) shows the icon
 * only. All colors route through tokens so the pill + sheet flip cleanly in
 * dark mode — the previous hard-coded NEUTRAL[200] + INK made the pill read
 * as a bright white chip on the dark chrome (see docs/dark-mode-audit-plan).
 */
export function ReferenceSheetButton({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const accent = useAccent();
  const tokens = useTokens();
  const [open, setOpen] = useState(false);
  const sheet = trpc.curriculum.referenceSheet.useQuery({ locale }, { enabled: open });

  return (
    <>
      <Button
        id="ref-sheet-btn"
        size="$2"
        backgroundColor={tokens.subtle}
        color={tokens.ink}
        fontWeight="800"
        borderRadius={999}
        onPress={() => setOpen(true)}
        aria-label={t('referenceSheet')}
        icon={<BookMarked size={15} color={tokens.ink} />}
      >
        {compact ? null : t('referenceSheetShort')}
      </Button>
      <Sheet
        modal
        open={open}
        onOpenChange={setOpen}
        snapPointsMode="percent"
        snapPoints={[85]}
        dismissOnSnapToBottom
        // Sheet drag competes with the inner ScrollView for wheel/touch
        // gestures on web and can leave it stuck unscrollable; the overlay
        // and ✕ button dismiss there instead.
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
            <SubTitle>{t('referenceSheet')}</SubTitle>
            <Button size="$2" chromeless onPress={() => setOpen(false)} aria-label="close" color={tokens.ink}>
              ✕
            </Button>
          </XStack>
          <Sheet.ScrollView flex={1}>
            <YStack padding={18} paddingBottom={48} gap={10}>
              {sheet.data?.sections.map((s) => (
                <YStack key={s.title} gap={6}>
                  <Text fontWeight="800" fontSize={15} color={accent} marginTop={8}>
                    {s.title}
                  </Text>
                  <Separator borderColor={tokens.border} />
                  {s.rows.map((r) => (
                    <XStack key={r.label} justifyContent="space-between" gap={12} paddingVertical={3}>
                      <Text fontSize={14} color={tokens.ink} flexShrink={1}>
                        {r.label}
                      </Text>
                      <Katex tex={r.latex} />
                    </XStack>
                  ))}
                </YStack>
              ))}
            </YStack>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}
