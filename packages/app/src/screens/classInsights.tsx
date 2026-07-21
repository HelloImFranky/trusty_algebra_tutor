/**
 * Teacher class-insights page (docs/statistics-plan.md, Phase 1a): the four
 * reports a teacher plans the week around — students to watch, the
 * students × skills mastery heatmap, diagnosed misconception patterns, and
 * time on task. All read-only aggregations of the class the teacher owns;
 * per-student depth stays behind the existing /progress/:id drill-down.
 */
import { Platform, ScrollView } from 'react-native';
import { Link } from 'solito/link';
import { Text, XStack, YStack } from 'tamagui';
import { misconceptionLabel, regentsTopics } from '@tutor/core';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import { MathText } from '../components/MathText';
import { ReadinessDot, ReadinessPill, type Band } from '../components/Readiness';
import {
  AppCard,
  Badge,
  Feedback,
  Loading,
  Muted,
  Screen,
  SecondaryButton,
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

/** Browser-only CSV download — teachers live in grade books. */
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','),
    )
    .join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

  const {
    class: cls,
    skills,
    students,
    misconceptions,
    watchlist,
    timeOnTask,
    itemAnalysis,
    regentsItems,
    tiers,
    tutorUsage,
    readiness,
  } = insights.data;
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
  const regentsQuestion = (topicSlug: string, questionId: string) => {
    const q = regentsTopics
      .find((tp) => tp.slug === topicSlug)
      ?.questions.find((qq) => qq.id === questionId);
    return q ? (locale === 'es' ? q.promptEs : q.promptEn) : questionId;
  };
  const topicTitle = (slug: string) => {
    const tp = readiness.topics.find((x) => x.slug === slug);
    return tp ? (locale === 'es' ? tp.titleEs : tp.titleEn) : slug;
  };

  const exportHeatmap = () =>
    downloadCsv(`${cls.name.replace(/\s+/g, '_')}-mastery.csv`, [
      ['Student', ...skills.map((s) => (locale === 'es' ? s.nameEs : s.nameEn))],
      ...students.map((s) => {
        const bySkill = new Map(s.cells.map((c) => [c.skillId, c.label]));
        return [s.displayName, ...skills.map((sk) => bySkill.get(sk.skillId) ?? 'not_started')];
      }),
    ]);
  const exportWatchlist = () =>
    downloadCsv(`${cls.name.replace(/\s+/g, '_')}-watchlist.csv`, [
      ['Student', 'Flags', 'Last active', 'Attempts 14d', 'Hints/problem', 'Accuracy %', 'Struggling skills'],
      ...watchlist.map((w) => [
        w.displayName,
        w.flags.join('; '),
        w.lastActiveAt ?? '',
        String(w.attempts14d),
        String(w.hintRate),
        w.accuracyPct === null ? '' : String(w.accuracyPct),
        w.strugglingSkillIds.map(skillName).join('; '),
      ]),
    ]);

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
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
          <SubTitle>🚩 {t('watchlistTitle')}</SubTitle>
          {Platform.OS === 'web' && watchlist.length > 0 && (
            <SecondaryButton size="$2" onPress={exportWatchlist}>
              ⬇️ {t('exportWatchlistCsv')}
            </SecondaryButton>
          )}
        </XStack>
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

      {/* Regents readiness grid: students × topics, shared core traffic light. */}
      <AppCard gap={10}>
        <SubTitle>🎯 {t('readinessTitle')}</SubTitle>
        {students.length === 0 ? (
          <Muted size={12}>{t('emptyRoster')}</Muted>
        ) : (
          <>
            <XStack gap={8} flexWrap="wrap">
              {(['ready', 'developing', 'needsWork', 'noData'] as Band[]).map((b) => (
                <ReadinessPill key={b} band={b} />
              ))}
            </XStack>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <YStack gap={3}>
                <XStack gap={4} marginLeft={130}>
                  {readiness.topics.map((tp) => (
                    <YStack key={tp.slug} width={18} alignItems="center">
                      <Text fontSize={11}>{tp.icon}</Text>
                    </YStack>
                  ))}
                </XStack>
                {readiness.students.map((s) => (
                  <XStack key={s.id} gap={4} alignItems="center">
                    <YStack width={126} marginRight={4}>
                      <Link href={`/progress/${s.id}`}>
                        <Text fontSize={12} fontWeight="700" color={accent} numberOfLines={1}>
                          {s.displayName}
                        </Text>
                      </Link>
                    </YStack>
                    {readiness.topics.map((tp) => (
                      <YStack key={tp.slug} width={18} alignItems="center">
                        <ReadinessDot band={(s.bands[tp.slug] ?? 'noData') as Band} />
                      </YStack>
                    ))}
                  </XStack>
                ))}
              </YStack>
            </ScrollView>
            <XStack gap={10} flexWrap="wrap">
              {readiness.topics.map((tp) => (
                <Muted key={tp.slug} size={10.5}>
                  {tp.icon} {locale === 'es' ? tp.titleEs : tp.titleEn}
                </Muted>
              ))}
            </XStack>
            <Muted size={11}>{t('readinessNote')}</Muted>
          </>
        )}
      </AppCard>

      {/* Skill heatmap: students × curriculum skills, decayed mastery colors. */}
      <AppCard gap={10}>
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
          <SubTitle>🗺️ {t('heatmapTitle')}</SubTitle>
          {Platform.OS === 'web' && students.length > 0 && (
            <SecondaryButton size="$2" onPress={exportHeatmap}>
              ⬇️ {t('exportHeatmapCsv')}
            </SecondaryButton>
          )}
        </XStack>
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

      {/* Item analysis: hardest practice problems + hardest Regents bank
          questions, lowest class success rate first. */}
      <AppCard gap={10}>
        <SubTitle>🧩 {t('itemAnalysisTitle')}</SubTitle>
        {itemAnalysis.length === 0 && <Muted size={12}>{t('itemAnalysisEmpty')}</Muted>}
        {itemAnalysis.map((p, i) => (
          <YStack
            key={p.problemId}
            gap={3}
            paddingVertical={6}
            borderTopWidth={i === 0 ? 0 : 1}
            borderTopColor={tokens.border}
          >
            <MathText text={locale === 'es' ? p.promptEs : p.promptEn} size={13.5} />
            <XStack gap={10} flexWrap="wrap" alignItems="center">
              <Badge label={p.tier} text={t(`tier${p.tier[0]!.toUpperCase()}${p.tier.slice(1)}` as I18nKey)} />
              <Muted size={12}>{locale === 'es' ? p.skillNameEs : p.skillNameEn}</Muted>
              <Muted size={12}>
                {Math.round((p.correct / p.attempts) * 100)}% {t('itemCorrectCol')} ·{' '}
                {p.attempts} {t('itemTriesCol')} · {p.students} {t('misconStudents')}
              </Muted>
            </XStack>
          </YStack>
        ))}
        {regentsItems.length > 0 && (
          <>
            <SubTitle>📚 {t('regentsItemsTitle')}</SubTitle>
            {regentsItems.map((q) => (
              <YStack key={q.questionId} gap={3} paddingVertical={6} borderTopWidth={1} borderTopColor={tokens.border}>
                <MathText text={regentsQuestion(q.topicSlug, q.questionId)} size={13.5} />
                <Muted size={12}>
                  {topicTitle(q.topicSlug)} · {Math.round((q.correct / q.answered) * 100)}%{' '}
                  {t('itemCorrectCol')} · {q.answered} {t('itemTriesCol')}
                </Muted>
              </YStack>
            ))}
          </>
        )}
      </AppCard>

      {/* Practice-tier mix: differentiation signal, never a student label. */}
      <AppCard gap={10}>
        <SubTitle>🪜 {t('tiersTitle')}</SubTitle>
        {tiers.filter((s) => s.modified + s.standard + s.challenge > 0).length === 0 && (
          <Muted size={12}>{t('noDataYet')}</Muted>
        )}
        {tiers
          .filter((s) => s.modified + s.standard + s.challenge > 0)
          .sort((a, b) => Number(b.stuckModified) - Number(a.stuckModified))
          .map((s, i) => {
            const total = s.modified + s.standard + s.challenge;
            return (
              <XStack
                key={s.id}
                gap={10}
                alignItems="center"
                flexWrap="wrap"
                paddingVertical={5}
                borderTopWidth={i === 0 ? 0 : 1}
                borderTopColor={tokens.border}
              >
                <YStack width={126}>
                  <Link href={`/progress/${s.id}`}>
                    <Text fontSize={13} fontWeight="700" color={accent} numberOfLines={1}>
                      {s.displayName}
                    </Text>
                  </Link>
                </YStack>
                <Muted size={12}>
                  {t('tierModified')} {Math.round((s.modified / total) * 100)}% ·{' '}
                  {t('tierStandard')} {Math.round((s.standard / total) * 100)}% ·{' '}
                  {t('tierChallenge')} {Math.round((s.challenge / total) * 100)}%
                </Muted>
                {s.stuckModified && <Badge label="modified" text={t('stuckModifiedFlag')} />}
              </XStack>
            );
          })}
        <Muted size={11}>{t('tiersNote')}</Muted>
      </AppCard>

      {/* AI-tutor use: counts only, transcripts stay private to the student. */}
      <AppCard gap={10}>
        <SubTitle>🤖 {t('tutorUsageTitle')}</SubTitle>
        {tutorUsage.perStudent.length === 0 && <Muted size={12}>{t('tutorUsageEmpty')}</Muted>}
        {tutorUsage.perStudent.map((s) => (
          <XStack key={s.id} justifyContent="space-between" alignItems="center" gap={8}>
            <Link href={`/progress/${s.id}`}>
              <Text fontSize={13} fontWeight="700" color={accent}>
                {s.displayName}
              </Text>
            </Link>
            <Muted size={12}>
              {s.sessions} {t('tutorSessionsLabel')}
            </Muted>
          </XStack>
        ))}
        {tutorUsage.topSkills.length > 0 && (
          <>
            <Muted size={12}>{t('tutorTopSkills')}:</Muted>
            {tutorUsage.topSkills.map((sk) => (
              <XStack key={sk.nameEn} justifyContent="space-between" alignItems="center" gap={8}>
                <Text fontSize={13} color={tokens.ink}>
                  {locale === 'es' ? sk.nameEs : sk.nameEn}
                </Text>
                <Muted size={12}>
                  {sk.sessions} {t('tutorSessionsLabel')}
                </Muted>
              </XStack>
            ))}
          </>
        )}
        <Muted size={11}>{t('tutorUsageNote')}</Muted>
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
