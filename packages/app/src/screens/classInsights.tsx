/**
 * Teacher class-insights page (docs/statistics-plan.md, Phase 1a): the four
 * reports a teacher plans the week around — students to watch, the
 * students × skills mastery heatmap, diagnosed misconception patterns, and
 * time on task. All read-only aggregations of the class the teacher owns;
 * per-student depth stays behind the existing /progress/:id drill-down.
 */
import { ScrollView } from 'react-native';
import { Link } from 'solito/link';
import { Text, XStack, YStack } from 'tamagui';
import { misconceptionLabel } from '@tutor/core';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import {
  AppCard,
  Badge,
  Feedback,
  Loading,
  Muted,
  Screen,
  StatChip,
  SubTitle,
  Title,
  useAccent,
  useFeedbackColors,
  useTokens,
  type Hex,
} from '../components/ui';

const FLAG_KEY: Record<string, I18nKey> = {
  inactive: 'flagInactive',
  struggling: 'flagStruggling',
  hintReliant: 'flagHintReliant',
  lowAccuracy: 'flagLowAccuracy',
};

type MasteryLabelName = 'not_started' | 'struggling' | 'practicing' | 'proficient' | 'mastered';

const CELL = 16;

/** Accent-opacity ladder for progress, red for struggling, subtle for
 * untouched — mastery and alarm are different signals (same rule as Badge). */
function useCellStyle() {
  const accent = useAccent();
  const tokens = useTokens();
  const bad = useFeedbackColors('bad');
  return (label: MasteryLabelName): { color: Hex; opacity: number } => {
    switch (label) {
      case 'mastered':
        return { color: accent, opacity: 1 };
      case 'proficient':
        return { color: accent, opacity: 0.6 };
      case 'practicing':
        return { color: accent, opacity: 0.3 };
      case 'struggling':
        return { color: bad.ink, opacity: 0.9 };
      default:
        return { color: tokens.subtle, opacity: 1 };
    }
  };
}

function LegendSwatch({ label, text }: { label: MasteryLabelName; text: string }) {
  const cellStyle = useCellStyle();
  const s = cellStyle(label);
  return (
    <XStack gap={4} alignItems="center">
      <YStack width={10} height={10} borderRadius={3} backgroundColor={s.color} opacity={s.opacity} />
      <Muted size={11}>{text}</Muted>
    </XStack>
  );
}

export function ClassInsightsScreen({ classId }: { classId: number }) {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const role = useAuth((s) => s.auth?.user.role);
  const tokens = useTokens();
  const accent = useAccent();
  const cellStyle = useCellStyle();

  const insights = trpc.teacher.classes.insights.useQuery(
    { classId },
    { enabled: authed && role === 'teacher' },
  );

  if (insights.isLoading) return <Loading />;
  if (insights.error) {
    return (
      <Screen>
        <Feedback kind="bad">{insights.error.message}</Feedback>
        <Link href="/classes">
          <Text color={accent} fontWeight="700">
            ← {t('myClasses')}
          </Text>
        </Link>
      </Screen>
    );
  }
  if (!insights.data) return <Loading />;

  const { class: cls, skills, students, misconceptions, watchlist, timeOnTask } = insights.data;
  const skillName = (id: number) => {
    const s = skills.find((sk) => sk.skillId === id);
    return s ? (locale === 'es' ? s.nameEs : s.nameEn) : `#${id}`;
  };
  const cellByStudent = new Map(
    students.map((s) => [s.id, new Map(s.cells.map((c) => [c.skillId, c.label]))]),
  );
  const fmtActive = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'es' ? 'es' : 'en') : t('neverActive');
  const totalMinutes7d = timeOnTask.reduce((sum, s) => sum + s.minutes7d, 0);
  const totalMinutes30d = timeOnTask.reduce((sum, s) => sum + s.minutes30d, 0);

  return (
    <Screen maxWidth={980}>
      <Link href={`/classes/${classId}`}>
        <Text color={accent} fontWeight="700">
          ← {cls.name}
        </Text>
      </Link>
      <Title>📊 {t('classInsights')}</Title>

      {/* Students to watch — the short list first: it's what the page is for. */}
      <AppCard gap={10}>
        <SubTitle>🚩 {t('watchlistTitle')}</SubTitle>
        {watchlist.length === 0 && <Muted size={12}>{t('watchlistEmpty')}</Muted>}
        {watchlist.map((w) => (
          <YStack key={w.id} gap={6} paddingVertical={4} borderTopWidth={1} borderTopColor={tokens.border}>
            <XStack gap={8} alignItems="center" flexWrap="wrap">
              <Link href={`/progress/${w.id}`}>
                <Text fontSize={15} fontWeight="800" color={accent}>
                  {w.displayName} →
                </Text>
              </Link>
              {w.flags.map((f) => (
                <Badge key={f} label={f === 'inactive' ? 'pending' : 'struggling'} text={t(FLAG_KEY[f] ?? 'flagStruggling')} />
              ))}
            </XStack>
            <XStack gap={14} flexWrap="wrap">
              <Muted size={12}>
                {t('lastActive')}: {fmtActive(w.lastActiveAt)}
              </Muted>
              {w.attempts14d > 0 && (
                <>
                  <Muted size={12}>
                    {w.hintRate} {t('insightsHintRate')}
                  </Muted>
                  {w.accuracyPct !== null && (
                    <Muted size={12}>
                      {w.accuracyPct}% {t('insightsAccuracy')}
                    </Muted>
                  )}
                </>
              )}
            </XStack>
            {w.strugglingSkillIds.length > 0 && (
              <Muted size={12}>
                {t('flagStruggling')}: {w.strugglingSkillIds.slice(0, 3).map(skillName).join(' · ')}
              </Muted>
            )}
          </YStack>
        ))}
      </AppCard>

      {/* Skill heatmap: students × curriculum skills, decayed mastery colors. */}
      <AppCard gap={10}>
        <SubTitle>🗺️ {t('heatmapTitle')}</SubTitle>
        {students.length === 0 ? (
          <Muted size={12}>{t('emptyRoster')}</Muted>
        ) : (
          <>
            <XStack gap={12} flexWrap="wrap">
              <LegendSwatch label="mastered" text={t('mastered')} />
              <LegendSwatch label="proficient" text={t('proficient')} />
              <LegendSwatch label="practicing" text={t('practicing')} />
              <LegendSwatch label="struggling" text={t('struggling')} />
              <LegendSwatch label="not_started" text={t('not_started')} />
            </XStack>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <YStack gap={3}>
                {/* Unit band above the columns. */}
                <XStack gap={2} marginLeft={130}>
                  {skills.map((s, i) => {
                    const newUnit = i === 0 || skills[i - 1]!.unitNumber !== s.unitNumber;
                    return (
                      <YStack key={s.skillId} width={CELL} alignItems="flex-start">
                        {newUnit && (
                          <Text fontSize={9} fontWeight="800" color={tokens.muted}>
                            U{s.unitNumber}
                          </Text>
                        )}
                      </YStack>
                    );
                  })}
                </XStack>
                {students.map((s) => (
                  <XStack key={s.id} gap={2} alignItems="center">
                    <YStack width={126} marginRight={4}>
                      <Link href={`/progress/${s.id}`}>
                        <Text fontSize={12} fontWeight="700" color={accent} numberOfLines={1}>
                          {s.displayName}
                        </Text>
                      </Link>
                    </YStack>
                    {skills.map((sk) => {
                      const label =
                        (cellByStudent.get(s.id)?.get(sk.skillId) as MasteryLabelName | undefined) ??
                        'not_started';
                      const style = cellStyle(label);
                      return (
                        <YStack
                          key={sk.skillId}
                          width={CELL}
                          height={CELL}
                          borderRadius={4}
                          backgroundColor={style.color}
                          opacity={style.opacity}
                        />
                      );
                    })}
                  </XStack>
                ))}
              </YStack>
            </ScrollView>
            <Muted size={11}>{t('heatmapHint')}</Muted>
          </>
        )}
      </AppCard>

      {/* Misconception patterns: generator-diagnosed wrong answers, 30 days. */}
      <AppCard gap={10}>
        <SubTitle>🔍 {t('misconceptionsTitle')}</SubTitle>
        {misconceptions.length === 0 && <Muted size={12}>{t('misconceptionsEmpty')}</Muted>}
        {misconceptions.map((m) => (
          <YStack
            key={`${m.misconceptionId}-${m.skillId}`}
            gap={2}
            paddingVertical={6}
            borderTopWidth={1}
            borderTopColor={tokens.border}
          >
            <Text fontSize={14} fontWeight="700" color={tokens.ink}>
              {misconceptionLabel(m.misconceptionId, locale === 'es' ? 'es' : 'en')}
            </Text>
            <XStack gap={12} flexWrap="wrap">
              <Muted size={12}>{locale === 'es' ? m.skillNameEs : m.skillNameEn}</Muted>
              <Muted size={12}>
                {m.students} {t('misconStudents')} · {m.hits} {t('misconHits')}
              </Muted>
            </XStack>
          </YStack>
        ))}
      </AppCard>

      {/* Time on task. */}
      <AppCard gap={10}>
        <SubTitle>⏱️ {t('timeOnTaskTitle')}</SubTitle>
        <XStack gap={10}>
          <StatChip icon={<Text fontSize={18}>📅</Text>} value={totalMinutes7d} label={t('classMinutes7d')} />
          <StatChip icon={<Text fontSize={18}>🗓️</Text>} value={totalMinutes30d} label={t('classMinutes30d')} />
        </XStack>
        {timeOnTask.length > 0 && (
          <YStack>
            <XStack gap={8} paddingVertical={4}>
              <YStack flex={1}>
                <Muted size={11}>{t('sprintColStudent')}</Muted>
              </YStack>
              <YStack width={86} alignItems="flex-end">
                <Muted size={11}>{t('minutes7dCol')}</Muted>
              </YStack>
              <YStack width={86} alignItems="flex-end">
                <Muted size={11}>{t('minutes30dCol')}</Muted>
              </YStack>
            </XStack>
            {[...timeOnTask]
              .sort((a, b) => b.minutes7d - a.minutes7d || b.minutes30d - a.minutes30d)
              .map((s, i) => (
                <XStack
                  key={s.id}
                  gap={8}
                  alignItems="center"
                  paddingVertical={6}
                  borderTopWidth={i === 0 ? 0 : 1}
                  borderTopColor={tokens.border}
                >
                  <YStack flex={1}>
                    <Link href={`/progress/${s.id}`}>
                      <Text fontSize={13} fontWeight="700" color={accent}>
                        {s.displayName}
                      </Text>
                    </Link>
                  </YStack>
                  <YStack width={86} alignItems="flex-end">
                    <Text fontSize={13} fontWeight="700" color={tokens.ink}>
                      {s.minutes7d}
                    </Text>
                  </YStack>
                  <YStack width={86} alignItems="flex-end">
                    <Text fontSize={13} fontWeight="600" color={tokens.muted}>
                      {s.minutes30d}
                    </Text>
                  </YStack>
                </XStack>
              ))}
          </YStack>
        )}
      </AppCard>
    </Screen>
  );
}
