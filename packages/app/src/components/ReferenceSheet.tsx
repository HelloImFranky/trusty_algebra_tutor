/** Always-accessible Regents Reference Sheet (design doc §1/§4.5), as a Tamagui Sheet. */
import { useState } from 'react';
import { Button, Separator, Sheet, Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { Katex } from './Katex';
import { BRAND, COLORS, SubTitle } from './ui';

export function ReferenceSheetButton() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const sheet = trpc.curriculum.referenceSheet.useQuery({ locale }, { enabled: open });

  return (
    <>
      <Button
        position="absolute"
        bottom={74}
        right={16}
        zIndex={50}
        backgroundColor={BRAND}
        color="white"
        fontWeight="800"
        borderRadius={999}
        size="$3"
        elevation={4}
        onPress={() => setOpen(true)}
        aria-label={t('referenceSheet')}
      >
        📖 {t('referenceSheet')}
      </Button>
      <Sheet
        modal
        open={open}
        onOpenChange={setOpen}
        snapPointsMode="percent"
        snapPoints={[85]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay backgroundColor="rgba(0,0,0,0.3)" />
        <Sheet.Frame backgroundColor="#fff" borderTopLeftRadius={18} borderTopRightRadius={18}>
          <Sheet.ScrollView>
            <YStack padding={18} gap={10}>
              <XStack justifyContent="space-between" alignItems="center">
                <SubTitle>{t('referenceSheet')}</SubTitle>
                <Button size="$2" chromeless onPress={() => setOpen(false)}>
                  ✕
                </Button>
              </XStack>
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
