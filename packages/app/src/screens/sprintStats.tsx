/**
 * Teacher sprint-stats page (docs/sprint-leaderboard-plan.md): the SAME live
 * leaderboard students see on their Sprint page (correct during the sprint +
 * correct this week), plus teacher-only depth — stat tiles, a weekly
 * time-series chart of correct answers across the school year, and a
 * per-student season table. Polls while open so a classroom sprint session
 * plays out live on the projector.
 */
import { Link } from 'solito/link';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import {
  SprintLeaderboardCard,
  LiveTag,
  type SprintLeaderboardEntry,
} from '../components/SprintLeaderboard';
import {
  AppCard,
  Feedback,
  Loading,
  Muted,
  Screen,
  StatChip,
  SubTitle,
  Title,
  useAccent,
  useTokens,
} from '../components/ui';

const POLL_MS = 5000;

interface WeekPoint {
  weekStart: string;
  rounds: number;
  attempted: number;
  correct: number;
}

/** Monday (UTC) of the week containing `d` — matches the server's
 * date_trunc('week', …) bucketing. */
function mondayOf(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  out.setUTCDate(out.getUTCDate() - ((out.getUTCDay() + 6) % 7));
  return out;
}

/** Server weeks with no rounds are omitted; rebuild the full Monday-by-Monday
 * axis from the school-year start through this week so the chart reads as
 * linear time, not just "weeks with data". */
function fillWeeks(points: WeekPoint[], yearStart: string): WeekPoint[] {
  const byWeek = new Map(points.map((p) => [p.weekStart, p]));
  const start = mondayOf(new Date(`${points[0]?.weekStart ?? yearStart}T00:00:00Z`));
  const last = mondayOf(new Date());
  const out: WeekPoint[] = [];
  for (let d = start; d <= last; d = new Date(d.getTime() + 7 * 86_400_000)) {
    const key = d.toISOString().slice(0, 10);
    out.push(byWeek.get(key) ?? { weekStart: key, rounds: 0, attempted: 0, correct: 0 });
  }
  return out;
}

/**
 * Weekly time series as a pure-View bar chart (single series → the theme
 * accent; no legend needed — the title names it). Month labels mark the time
 * axis; only the peak bar carries a direct value label. The season table
 * below is the chart's table view.
 */
function WeeklyChart({ points, yearStart }: { points: WeekPoint[]; yearStart: string }) {
  const { locale } = useI18n();
  const tokens = useTokens();
  const accent = useAccent();
  const weeks = fillWeeks(points, yearStart);
  const max = Math.max(1, ...weeks.map((w) => w.correct));
  const peakIndex = weeks.findIndex((w) => w.correct === max);
  const CHART_HEIGHT = 110;
  let lastMonth = -1;
  return (
    <YStack gap={4}>
      <XStack gap={2} height={CHART_HEIGHT + 16} alignItems="flex-end">
        {weeks.map((w, i) => {
          const h = Math.round((w.correct / max) * CHART_HEIGHT);
          return (
            <YStack key={w.weekStart} flex={1} alignItems="center" gap={2} justifyContent="flex-end">
              {i === peakIndex && w.correct > 0 && (
                <Text fontSize={10} fontWeight="800" color={tokens.ink}>
                  {w.correct}
                </Text>
              )}
              <YStack
                width="100%"
                maxWidth={18}
                height={Math.max(h, 2)}
                backgroundColor={w.correct > 0 ? accent : tokens.subtle}
                borderTopLeftRadius={4}
                borderTopRightRadius={4}
              />
            </YStack>
          );
        })}
      </XStack>
      <XStack gap={2}>
        {weeks.map((w) => {
          const d = new Date(`${w.weekStart}T00:00:00Z`);
          const month = d.getUTCMonth();
          const label = month !== lastMonth;
          lastMonth = month;
          return (
            <YStack key={w.weekStart} flex={1} alignItems="flex-start">
              {label && (
                <Text fontSize={9} color={tokens.muted}>
                  {d.toLocaleDateString(locale === 'es' ? 'es' : 'en', {
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </Text>
              )}
            </YStack>
          );
        })}
      </XStack>
    </YStack>
  );
}

const COL_WIDTH = 74;

function Cell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const tokens = useTokens();
  return (
    <YStack width={COL_WIDTH} alignItems="flex-end">
      <Text fontSize={13} fontWeight={muted ? '600' : '700'} color={muted ? tokens.muted : tokens.ink}>
        {children}
      </Text>
    </YStack>
  );
}

export function SprintStatsScreen({ classId }: { classId: number }) {
  const { t } = useI18n();
  const authed = useRequireAuth();
  const role = useAuth((s) => s.auth?.user.role);
  const tokens = useTokens();
  const accent = useAccent();

  const stats = trpc.teacher.classes.sprintStats.useQuery(
    { classId },
    { enabled: authed && role === 'teacher', refetchInterval: POLL_MS },
  );

  if (stats.isLoading) return <Loading />;
  if (stats.error) {
    return (
      <Screen>
        <Feedback kind="bad">{stats.error.message}</Feedback>
        <Link href="/classes">
          <Text color={accent} fontWeight="700">
            ← {t('myClasses')}
          </Text>
        </Link>
      </Screen>
    );
  }
  if (!stats.data) return <Loading />;

  const { class: cls, students, weekly, yearStart } = stats.data;
  const rows: SprintLeaderboardEntry[] = students;
  const weekCorrect = students.reduce((sum, s) => sum + s.weekCorrect, 0);
  // The series' last point is this week's bucket when anyone has sprinted.
  const thisMonday = mondayOf(new Date()).toISOString().slice(0, 10);
  const weekRounds = weekly.find((w) => w.weekStart === thisMonday)?.rounds ?? 0;
  const season = [...students].sort(
    (a, b) => b.yearCorrect - a.yearCorrect || a.displayName.localeCompare(b.displayName),
  );

  return (
    <Screen maxWidth={900}>
      <Link href={`/classes/${classId}`}>
        <Text color={accent} fontWeight="700">
          ← {cls.name}
        </Text>
      </Link>
      <Title>⚡ {t('sprintStats')}</Title>

      <XStack gap={10}>
        <StatChip icon={<Text fontSize={18}>🏁</Text>} value={weekRounds} label={t('sprintRoundsThisWeek')} />
        <StatChip icon={<Text fontSize={18}>✅</Text>} value={weekCorrect} label={t('sprintCorrectThisWeek')} />
      </XStack>

      <SprintLeaderboardCard rows={rows} emptyHint={t('sprintNoData')} />

      <AppCard gap={12}>
        <XStack justifyContent="space-between" alignItems="center">
          <SubTitle>📈 {t('sprintWeeklyChart')}</SubTitle>
          <LiveTag />
        </XStack>
        {weekly.length === 0 ? (
          <Muted size={12}>{t('sprintNoData')}</Muted>
        ) : (
          <WeeklyChart points={weekly} yearStart={yearStart} />
        )}
      </AppCard>

      <AppCard gap={10}>
        <SubTitle>📋 {t('sprintSeasonTable')}</SubTitle>
        {season.length === 0 && <Muted size={12}>{t('emptyRoster')}</Muted>}
        {season.length > 0 && (
          <YStack>
            <XStack gap={8} alignItems="center" paddingVertical={4}>
              <YStack flex={1}>
                <Muted size={11}>{t('sprintColStudent')}</Muted>
              </YStack>
              <YStack width={COL_WIDTH} alignItems="flex-end">
                <Muted size={11}>{t('sprintColRounds')}</Muted>
              </YStack>
              <YStack width={COL_WIDTH} alignItems="flex-end">
                <Muted size={11}>{t('sprintColAttempted')}</Muted>
              </YStack>
              <YStack width={COL_WIDTH} alignItems="flex-end">
                <Muted size={11}>{t('sprintColCorrect')}</Muted>
              </YStack>
              <YStack width={COL_WIDTH} alignItems="flex-end">
                <Muted size={11}>{t('sprintColAccuracy')}</Muted>
              </YStack>
            </XStack>
            {season.map((s, i) => (
              <XStack
                key={s.id}
                gap={8}
                alignItems="center"
                paddingVertical={7}
                borderTopWidth={i === 0 ? 0 : 1}
                borderTopColor={tokens.border}
              >
                <YStack flex={1}>
                  <Link href={`/progress/${s.id}`}>
                    <Text fontSize={14} fontWeight="700" color={accent}>
                      {s.displayName}
                    </Text>
                  </Link>
                </YStack>
                <Cell>{s.yearRounds}</Cell>
                <Cell muted>{s.yearAttempted}</Cell>
                <Cell>{s.yearCorrect}</Cell>
                <Cell muted>
                  {s.yearAttempted > 0
                    ? `${Math.round((s.yearCorrect / s.yearAttempted) * 100)}%`
                    : '—'}
                </Cell>
              </XStack>
            ))}
          </YStack>
        )}
      </AppCard>
    </Screen>
  );
}
