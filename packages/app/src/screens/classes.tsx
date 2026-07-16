/** Teacher dashboard: list classes, create one, share its join code. */
import { useState } from 'react';
import { Link } from 'solito/link';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import { JoinClassCard } from '../components/JoinClassCard';
import {
  AppCard,
  AppInput,
  Feedback,
  Loading,
  Muted,
  PrimaryButton,
  Screen,
  SubTitle,
  Title,
  useAccent,
  useTokens,
} from '../components/ui';

export function ClassesScreen() {
  const { t } = useI18n();
  const authed = useRequireAuth();
  const role = useAuth((s) => s.auth?.user.role);
  const status = useAuth((s) => s.auth?.user.status);
  const utils = trpc.useUtils();
  const accent = useAccent();
  const tokens = useTokens();
  const [name, setName] = useState('');

  const list = trpc.teacher.classes.list.useQuery(undefined, {
    enabled: authed && role === 'teacher' && status === 'active',
  });
  const create = trpc.teacher.classes.create.useMutation({
    onSuccess: () => {
      setName('');
      void utils.teacher.classes.list.invalidate();
    },
  });

  // A non-teacher who navigates here gets the student join flow instead.
  if (authed && role && role !== 'teacher') {
    return (
      <Screen>
        <Title>{t('classes')}</Title>
        <JoinClassCard />
      </Screen>
    );
  }

  // A teacher who isn't approved yet (or was disabled) is fail-closed here.
  if (authed && role === 'teacher' && status !== 'active') {
    return (
      <Screen>
        <Title>🏫 {t('myClasses')}</Title>
        <AppCard gap={6}>
          <SubTitle>{status === 'disabled' ? t('statusDisabled') : t('awaitingApproval')}</SubTitle>
          <Muted>{status === 'disabled' ? t('accountDisabled') : t('awaitingApprovalBody')}</Muted>
        </AppCard>
      </Screen>
    );
  }

  return (
    <Screen maxWidth={860}>
      <Title>🏫 {t('myClasses')}</Title>

      <AppCard gap={8}>
        <SubTitle>{t('newClass')}</SubTitle>
        <XStack gap={8} flexWrap="wrap">
          <YStack flex={1} minWidth={200}>
            <AppInput
              value={name}
              onChangeText={setName}
              placeholder={t('className')}
              backgroundColor={tokens.surface}
              borderColor={tokens.border}
            />
          </YStack>
          <PrimaryButton
            disabled={create.isPending || !name.trim()}
            opacity={name.trim() ? 1 : 0.5}
            onPress={() => create.mutate({ name: name.trim() })}
          >
            {t('createClass')}
          </PrimaryButton>
        </XStack>
        {create.error && <Feedback kind="bad">{create.error.message}</Feedback>}
      </AppCard>

      {list.isLoading && <Loading />}
      {list.error && <Feedback kind="bad">{list.error.message}</Feedback>}
      {list.data?.classes.length === 0 && <Muted>{t('noClasses')}</Muted>}

      <YStack gap={10}>
        {list.data?.classes.map((c) => (
          <Link key={c.id} href={`/classes/${c.id}`}>
            <AppCard gap={6} hoverStyle={{ borderColor: accent }}>
              <XStack justifyContent="space-between" alignItems="center" gap={8}>
                <SubTitle>{c.name}</SubTitle>
                <Muted>
                  {c.studentCount} {t('studentsLabel')}
                </Muted>
              </XStack>
              <XStack gap={8} alignItems="center">
                <Muted>{t('joinCode')}:</Muted>
                <Text fontWeight="800" fontSize={16} letterSpacing={2} color={accent}>
                  {c.joinCode}
                </Text>
              </XStack>
            </AppCard>
          </Link>
        ))}
      </YStack>
    </Screen>
  );
}
