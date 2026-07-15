/** 9-unit curriculum map with per-lesson mastery overlay (design doc §4.6). */
import { Brain, Clock, Flame } from '@tamagui/lucide-icons';
import { Link } from 'solito/link';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { Mascot } from '../components/Mascot';
import {
  AppCard, Badge, Feedback, IconCircle, Loading, Screen, StatChip,
  Title, useAccent, INK, NEUTRAL,
} from '../components/ui';

interface LessonView {
  id: number;
  code: string;
  title: string;
  mastery: { score: number; attempts: number; label: string };
}

/** First lesson still in progress, else the first not-yet-started lesson —
 * a simple "resume where you left off" pointer with no dedicated backend
 * field, derived from the mastery overlay curriculum.map already returns. */
function findContinueLesson(units: { lessons: LessonView[] }[]): LessonView | null {
  const lessons = units.flatMap((u) => u.lessons);
  return (
    lessons.find((l) => l.mastery.label === 'practicing') ??
    lessons.find((l) => l.mastery.label === 'not_started') ??
    null
  );
}

export function CurriculumScreen() {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const accent = useAccent();
  const cur = trpc.curriculum.map.useQuery({ locale }, { enabled: authed });
  const me = trpc.progress.me.useQuery(undefined, { enabled: authed });

  const continueLesson = cur.data ? findContinueLesson(cur.data.units) : null;
  const masteredCount = me.data?.skills.filter(
    (s) => s.label === 'mastered' || s.label === 'proficient',
  ).length;
  const totalMinutes = me.data
    ? Math.round(me.data.activity.reduce((sum, a) => sum + Number(a.minutes), 0))
    : 0;

  return (
    <Screen maxWidth={980}>
      <Title>{t('curriculum')}</Title>

      <Mascot size={130} radius={24} />

      <XStack gap={8}>
        <StatChip icon={<Flame size={22} color={accent} />} value={me.data?.streakDays ?? '—'} label={t('streak')} />
        <StatChip icon={<Clock size={22} color={INK} />} value={totalMinutes} label={`${t('minutes')} / 30d`} />
        <StatChip icon={<Brain size={22} color={INK} />} value={masteredCount ?? '—'} label={t('mastered')} />
      </XStack>

      {continueLesson && (
        <Link href={`/lesson/${continueLesson.id}`}>
          <YStack backgroundColor={INK} borderRadius={20} padding={16} gap={8}>
            <Text color="#ff9783" fontSize={10} fontWeight="800" textTransform="uppercase" letterSpacing={0.8}>
              {t('continueLesson').toUpperCase()}
            </Text>
            <Text color="#f3f2f2" fontSize={16} fontWeight="800">
              {continueLesson.code} · {continueLesson.title}
            </Text>
            <XStack height={8} backgroundColor="#444141" borderRadius={999} overflow="hidden">
              <XStack width={`${Math.round(continueLesson.mastery.score * 100)}%`} height="100%" backgroundColor={accent} borderRadius={999} />
            </XStack>
            <Text color="#f3f2f2" fontWeight="800" fontSize={14}>
              {t('continueLesson')} →
            </Text>
          </YStack>
        </Link>
      )}

      <Link href="/examples">
        <XStack
          backgroundColor={NEUTRAL[200]}
          borderRadius={999}
          paddingVertical={10}
          paddingHorizontal={14}
          alignItems="center"
          gap={8}
          pressStyle={{ opacity: 0.8 }}
        >
          <Text fontSize={16}>🎬</Text>
          <Text color={accent} fontWeight="800" fontSize={14.5}>
            {t('animatedExamples')} →
          </Text>
        </XStack>
      </Link>

      {cur.error && <Feedback kind="bad">{cur.error.message}</Feedback>}
      {cur.isLoading && <Loading />}

      <Text fontSize={12} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={NEUTRAL[700]}>
        {t('units')}
      </Text>
      <YStack gap={12}>
        {cur.data?.units.map((u) => (
          <AppCard key={u.id} gap={6}>
            <XStack gap={10} alignItems="center" marginBottom={4}>
              <IconCircle size={28} background={INK}>
                {u.number}
              </IconCircle>
              <Text fontSize={17} fontWeight="800" color={INK}>
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
                  borderRadius={12}
                  hoverStyle={{ backgroundColor: NEUTRAL[100] }}
                  pressStyle={{ backgroundColor: NEUTRAL[200] }}
                  gap={8}
                >
                  <Text flexShrink={1} fontSize={14.5} color={INK}>
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
