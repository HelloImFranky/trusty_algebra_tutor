/** Student-facing card to enroll in a class with a teacher's join code. */
import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { AppCard, AppInput, Feedback, Muted, PrimaryButton, SubTitle, useTokens } from './ui';

export function JoinClassCard() {
  const { t } = useI18n();
  const tokens = useTokens();
  const [code, setCode] = useState('');
  const utils = trpc.useUtils();
  const join = trpc.teacher.classes.join.useMutation({
    onSuccess: () => {
      setCode('');
      void utils.progress.me.invalidate();
    },
  });

  return (
    <AppCard gap={8}>
      <SubTitle>🏫 {t('joinClassTitle')}</SubTitle>
      <Muted>{t('joinClassIntro')}</Muted>
      <XStack gap={8} flexWrap="wrap">
        <YStack flex={1} minWidth={160}>
          <AppInput
            value={code}
            onChangeText={setCode}
            placeholder={t('enterCode')}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </YStack>
        <PrimaryButton
          disabled={join.isPending || !code.trim()}
          opacity={code.trim() ? 1 : 0.5}
          onPress={() => join.mutate({ code: code.trim() })}
        >
          {t('joinBtn')}
        </PrimaryButton>
      </XStack>
      {join.error && <Feedback kind="bad">{join.error.message}</Feedback>}
      {join.data && (
        <Feedback kind="good">
          {t('joinedClass')} {join.data.name} 🎉
        </Feedback>
      )}
    </AppCard>
  );
}
