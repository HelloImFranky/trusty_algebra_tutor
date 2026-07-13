/** Always-accessible Regents Reference Sheet (design doc §1/§4.5), as a Tamagui Sheet. */
import { useState } from 'react';
import { Platform } from 'react-native';
import { Button, Separator, Sheet, Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { Katex } from './Katex';
import { BRAND, COLORS, SubTitle } from './ui';

/**
 * Top-bar pill that opens the reference sheet. Lives in the AppChrome top bar
 * so it never covers screen content; `compact` (phone widths) shows the icon
 * only.
 */
export function ReferenceSheetButton({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const sheet = trpc.curriculum.referenceSheet.useQuery({ locale }, { enabled: open });

  return (
    <>
      <Button
        id="ref-sheet-btn"
        size="$2"
        backgroundColor="rgba(255,255,255,0.18)"
        color="white"
        fontWeight="800"
        borderRadius={999}
        onPress={() => setOpen(true)}
        aria-label={t('referenceSheet')}
      >
        📖 {compact ? t('referenceSheetShort') : t('referenceSheet')}
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
        <Sheet.Overlay backgroundColor="rgba(0,0,0,0.3)" />
        <Sheet.Frame backgroundColor="#fff" borderTopLeftRadius={18} borderTopRightRadius={18}>
          <XStack
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal={18}
            paddingTop={14}
            paddingBottom={8}
            borderBottomWidth={1}
            borderBottomColor={COLORS.border}
          >
            <SubTitle>{t('referenceSheet')}</SubTitle>
            <Button size="$2" chromeless onPress={() => setOpen(false)} aria-label="close">
              ✕
            </Button>
          </XStack>
          <Sheet.ScrollView flex={1}>
            <YStack padding={18} paddingBottom={48} gap={10}>
              {sheet.data?.sections.map((s) => (
                <YStack key={s.title} gap={6}>
                  <Text fontWeight="800" fontSize={15} color={BRAND} marginTop={8}>
                    {s.title}
                  </Text>
                  <Separator borderColor={COLORS.border} />
                  {s.rows.map((r) => (
                    <XStack key={r.label} justifyContent="space-between" gap={12} paddingVertical={3}>
                      <Text fontSize={14} color="#374151" flexShrink={1}>
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
