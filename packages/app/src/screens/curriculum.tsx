/** 9-unit curriculum map with per-lesson mastery overlay (design doc §4.6). */
import { Link } from 'solito/link';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { AppCard, Badge, Feedback, Loading, Screen, Title, BRAND, COLORS } from '../components/ui';

export function CurriculumScreen() {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const cur = trpc.curriculum.map.useQuery({ locale }, { enabled: authed });

  return (
    <Screen maxWidth={980}>
      <Title>{t('curriculum')}</Title>
      <Link href="/examples">
        <XStack
          backgroundColor="#eef1fd"
          borderRadius={12}
          paddingVertical={10}
          paddingHorizontal={14}
          alignItems="center"
          gap={8}
          pressStyle={{ backgroundColor: '#dde3fb' }}
          hoverStyle={{ backgroundColor: '#e4e9fc' }}
        >
          <Text fontSize={16}>🎬</Text>
          <Text color={BRAND} fontWeight="700" fontSize={14.5}>
            {t('animatedExamples')} →
          </Text>
        </XStack>
      </Link>
      {cur.error && <Feedback kind="bad">{cur.error.message}</Feedback>}
      {cur.isLoading && <Loading />}
      <YStack gap={12}>
        {cur.data?.units.map((u) => (
          <AppCard key={u.id} gap={6}>
            <XStack gap={10} alignItems="center" marginBottom={4}>
              <XStack
                width={30}
                height={30}
                borderRadius={999}
                backgroundColor={BRAND}
                alignItems="center"
                justifyContent="center"
              >
                <Text color="white" fontWeight="800">
                  {u.number}
                </Text>
              </XStack>
              <Text fontSize={17} fontWeight="800">
                {u.title}
              </Text>
            </XStack>
            {u.lessons.map((l) => (
              <Link key={l.id} href={`/lesson/${l.id}`}>
                <XStack
                  justifyContent="space-between"
                  alignItems="center"
                  paddingVertical={9}
                  paddingHorizontal={8}
                  borderRadius={10}
                  hoverStyle={{ backgroundColor: '#f3f5fd' }}
                  pressStyle={{ backgroundColor: '#eef1fd' }}
                  gap={8}
                >
                  <Text flexShrink={1} fontSize={14.5}>
                    {l.title}
                  </Text>
                  {l.mastery.label !== 'not_started' && (
                    <Badge label={l.mastery.label} text={t(l.mastery.label as I18nKey)} />
                  )}
                </XStack>
              </Link>
            ))}
          </AppCard>
        ))}
      </YStack>
    </Screen>
  );
}
