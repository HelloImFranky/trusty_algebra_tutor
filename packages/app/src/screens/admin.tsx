/** Admin console: approve / reject / disable teacher accounts (governance),
 * plus AI-tutor usage & billing. When the server has an Anthropic Admin
 * key configured (admin.usage.summary → available), the card renders the
 * numbers natively — spend, tokens, cache hit rate, daily trend, per-model
 * split; otherwise it falls back to a link-out to the Anthropic Console,
 * which needs no secret at all. Either way the browser only ever receives
 * aggregated numbers. See docs/tutor-usage-dashboard-plan.md. */
import { useState, type ReactNode } from 'react';
import { Linking } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { regentsTopics, REPORT_COLORS, type Report } from '@tutor/core';
import { ReportButtons } from '../components/ReportButtons';
import { WeeklyBars } from '../components/WeeklyBars';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import { UsageDashboard, UsageWindowPicker } from '../components/UsageDashboard';
import {
  AppCard,
  Badge,
  COLORS,
  Feedback,
  GhostButton,
  HINT,
  Loading,
  Muted,
  PrimaryButton,
  Screen,
  StatChip,
  SubTitle,
  Title,
  useAccent,
  useFeedbackColors,
  useHintBg,
  useTokens,
} from '../components/ui';

// Console root — lands on the dashboard where usage, billing, and per-model
// token stats live. Kept to the root (not a deep settings path) so it can't
// rot into a 404 if Anthropic reorganizes its settings routes.
const ANTHROPIC_CONSOLE_URL = 'https://platform.claude.com/';

const STATUS_KEY: Record<string, I18nKey> = {
  active: 'statusActive',
  pending: 'statusPending',
  disabled: 'statusDisabled',
};

/** Collapsible statistics topic (▸/▾, same affordance as the progress
 * page's Regents-topic dropdowns). Collapsed by default so the school
 * overview reads as a tidy index; each topic opens on demand. */
function StatSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const tokens = useTokens();
  const accent = useAccent();
  return (
    <YStack gap={10} borderTopWidth={1} borderTopColor={tokens.border} paddingTop={10}>
      <XStack
        justifyContent="space-between"
        alignItems="center"
        gap={8}
        cursor="pointer"
        onPress={onToggle}
        hoverStyle={{ opacity: 0.8 }}
        pressStyle={{ opacity: 0.6 }}
      >
        <SubTitle>{title}</SubTitle>
        <Text fontSize={16} fontWeight="800" color={accent}>
          {open ? '▾' : '▸'}
        </Text>
      </XStack>
      {open && children}
    </YStack>
  );
}

export function AdminScreen() {
  const { t, locale } = useI18n();
  const accent = useAccent();
  const tokens = useTokens();
  const bad = useFeedbackColors('bad');
  const hintBg = useHintBg();
  const authed = useRequireAuth();
  const role = useAuth((s) => s.auth?.user.role);
  const isAdmin = authed && role === 'admin';
  const utils = trpc.useUtils();
  const [usageWindow, setUsageWindow] = useState<'7d' | '30d'>('30d');
  // Which overview topics are expanded (all collapsed on load).
  const [openStats, setOpenStats] = useState<Record<string, boolean>>({});
  const toggleStat = (key: string) => setOpenStats((s) => ({ ...s, [key]: !s[key] }));

  const pending = trpc.admin.teachers.listPending.useQuery(undefined, { enabled: isAdmin });
  const all = trpc.admin.teachers.list.useQuery(undefined, { enabled: isAdmin });
  const usage = trpc.admin.usage.summary.useQuery({ window: usageWindow }, { enabled: isAdmin });
  const overview = trpc.admin.stats.overview.useQuery(undefined, { enabled: isAdmin });

  const refresh = () => {
    void utils.admin.teachers.listPending.invalidate();
    void utils.admin.teachers.list.invalidate();
  };
  const approve = trpc.admin.teachers.approve.useMutation({ onSuccess: refresh });
  const reject = trpc.admin.teachers.reject.useMutation({ onSuccess: refresh });
  const disable = trpc.admin.teachers.disable.useMutation({ onSuccess: refresh });
  const busy = approve.isPending || reject.isPending || disable.isPending;

  if (authed && role && role !== 'admin') {
    return (
      <Screen>
        <Title>🛡️ {t('admin')}</Title>
        <Muted>{t('adminsOnly')}</Muted>
      </Screen>
    );
  }

  /** Full school-overview report for PDF/Word/CSV export (Phase 3). */
  const buildAdminReport = (): Report => {
    const d = overview.data!;
    const topicTitle = (slug: string) => {
      const tp = regentsTopics.find((x) => x.slug === slug);
      return tp ? (locale === 'es' ? tp.titleEs : tp.titleEn) : slug;
    };
    const sliceRows = (slices: typeof d.slices.byGrade, dim: 'grade' | 'locale') =>
      slices.map((s) => [
        s.key === 'unspecified'
          ? t('sliceUnspecified')
          : dim === 'grade'
            ? `${t('grade')} ${s.key}`
            : s.key === 'es'
              ? 'Español'
              : 'English',
        String(s.students),
        s.suppressed ? t('sliceSuppressed') : String(s.active30d),
        s.suppressed ? '' : String(s.minutes30d),
        s.suppressed || s.avgMastery === null ? '' : `${Math.round(s.avgMastery * 100)}%`,
      ]);
    const sliceColumns = [
      '',
      t('studentsLabel'),
      t('activeStudents30d'),
      t('schoolMinutes30d'),
      t('avgMasteryLabel'),
    ];
    return {
      meta: {
        title: `${t('schoolOverview')} — ${t('appName')}`,
        stamp: `${t('reportGenerated')} ${new Date().toISOString().slice(0, 10)} · ${t('appName')}`,
      },
      blocks: [
        {
          kind: 'stats',
          items: [
            { label: t('activeStudents7d'), value: String(d.engagement.active7d) },
            { label: t('activeStudents30d'), value: String(d.engagement.active30d) },
            { label: t('schoolAttempts30d'), value: String(d.engagement.attempts30d) },
            { label: t('schoolMinutes30d'), value: String(d.engagement.minutes30d) },
          ],
        },
        {
          kind: 'stacked',
          title: t('masteryByUnitTitle'),
          legend: [
            { label: t('struggling'), color: REPORT_COLORS.struggling },
            { label: t('practicing'), color: REPORT_COLORS.practicing },
            { label: t('proficient'), color: REPORT_COLORS.proficient },
            { label: t('mastered'), color: REPORT_COLORS.mastered },
          ],
          rows: d.masteryByUnit
            .filter((u) => u.struggling + u.practicing + u.proficient + u.mastered > 0)
            .map((u) => ({
              label: `${u.unitNumber}. ${locale === 'es' ? u.titleEs : u.titleEn}`,
              segments: [u.struggling, u.practicing, u.proficient, u.mastered],
            })),
        },
        { kind: 'note', text: t('masteryByUnitNote') },
        {
          kind: 'bars',
          title: t('growthTitle'),
          max: 100,
          items: d.growth.map((g) => ({
            label: g.weekStart,
            value: Math.round(g.avgScore * 100),
            display: `${Math.round(g.avgScore * 100)}%`,
          })),
        },
        { kind: 'note', text: t('growthNote') },
        {
          kind: 'stacked',
          title: t('readinessTitle'),
          legend: [
            { label: t('readinessNeedsWork'), color: REPORT_COLORS.needsWork },
            { label: t('readinessDeveloping'), color: REPORT_COLORS.developing },
            { label: t('readinessReady'), color: REPORT_COLORS.ready },
            { label: t('readinessNoData'), color: REPORT_COLORS.noData },
          ],
          rows: d.readiness.map((r) => ({
            label: topicTitle(r.topicSlug),
            segments: [r.needsWork, r.developing, r.ready, r.noData],
          })),
        },
        { kind: 'note', text: t('readinessNote') },
        {
          kind: 'stats',
          items: [
            { label: t('adoptionTeachers'), value: String(d.adoption.teachersActive) },
            { label: t('adoptionClasses'), value: String(d.adoption.classes) },
            { label: t('adoptionEnrolled'), value: String(d.adoption.studentsEnrolled) },
            { label: t('adoptionAccounts'), value: String(d.adoption.studentsTotal) },
            { label: t('consentPendingStat'), value: String(d.adoption.consentPending) },
          ],
        },
        {
          kind: 'table',
          title: t('slicesGradeTitle'),
          columns: sliceColumns,
          rows: sliceRows(d.slices.byGrade, 'grade'),
        },
        {
          kind: 'table',
          title: t('slicesLocaleTitle'),
          columns: sliceColumns,
          rows: sliceRows(d.slices.byLocale, 'locale'),
        },
        {
          kind: 'bars',
          title: t('weeklyMinutesChart'),
          items: d.weekly.map((w) => ({
            label: w.weekStart,
            value: w.minutes,
            display: `${w.minutes} ${t('minutes')}`,
          })),
        },
      ],
    };
  };

  return (
    <Screen maxWidth={820}>
      <Title>🛡️ {t('admin')}</Title>

      {/* Teacher management first — approving and auditing accounts is the
          admin's primary job; statistics follow below. All teachers is a
          collapsible list (it can grow long); the header carries the count
          so the roster size is visible without expanding. */}
      <AppCard gap={10}>
        <XStack
          justifyContent="space-between"
          alignItems="center"
          gap={8}
          cursor="pointer"
          onPress={() => toggleStat('allTeachers')}
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
        >
          <XStack gap={8} alignItems="center">
            <SubTitle>{t('allTeachers')}</SubTitle>
            {all.data && <Muted>{all.data.teachers.length}</Muted>}
          </XStack>
          <Text fontSize={16} fontWeight="800" color={accent}>
            {openStats.allTeachers ? '▾' : '▸'}
          </Text>
        </XStack>
        {all.isLoading && <Loading />}
        {all.error && <Feedback kind="bad">{all.error.message}</Feedback>}
        {openStats.allTeachers &&
          all.data?.teachers.map((tt) => (
            <XStack key={tt.id} justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
              <YStack>
                <Text fontWeight="800" color={tokens.ink}>{tt.displayName}</Text>
                <Muted size={12}>@{tt.username}</Muted>
              </YStack>
              <XStack gap={8} alignItems="center">
                <Badge label={tt.status} text={t(STATUS_KEY[tt.status] ?? 'statusActive')} />
                {tt.status === 'active' && (
                  <GhostButton size="$2" disabled={busy} onPress={() => disable.mutate({ userId: tt.id })}>
                    {t('disable')}
                  </GhostButton>
                )}
              </XStack>
            </XStack>
          ))}
      </AppCard>

      {/* Mustard/yellow surface so a pending approval — the one time-sensitive
          action on this page — stands out from the neutral cards around it.
          Theme-aware via the hint tokens (warm yellow light, deep amber dark);
          the left border matches the "pending" status badge. */}
      <AppCard
        gap={10}
        backgroundColor={hintBg}
        borderLeftWidth={4}
        borderLeftColor={HINT.fg}
      >
        <SubTitle>{t('pendingTeachers')}</SubTitle>
        {pending.isLoading && <Loading />}
        {pending.error && <Feedback kind="bad">{pending.error.message}</Feedback>}
        {pending.data?.teachers.length === 0 && <Muted>{t('noPending')}</Muted>}
        {pending.data?.teachers.map((tt) => (
          <XStack key={tt.id} justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
            <YStack>
              <Text fontWeight="800" color={tokens.ink}>{tt.displayName}</Text>
              <Muted size={12}>
                @{tt.username}
                {tt.email ? ` · ${tt.email}` : ''}
              </Muted>
            </YStack>
            <XStack gap={8}>
              <PrimaryButton size="$2" disabled={busy} onPress={() => approve.mutate({ userId: tt.id })}>
                {t('approve')}
              </PrimaryButton>
              <GhostButton size="$2" disabled={busy} onPress={() => reject.mutate({ userId: tt.id })}>
                {t('reject')}
              </GhostButton>
            </XStack>
          </XStack>
        ))}
      </AppCard>

      {/* School overview (docs/statistics-plan.md, Phase 1b): de-identified
          aggregates only — engagement, mastery by unit, adoption, consent
          coverage. The admin role still can't reach any individual student.
          Engagement chips stay visible as the top line; every deeper topic
          is a collapsible dropdown so the page reads as an index. */}
      <AppCard gap={12}>
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
          <SubTitle>🏫 {t('schoolOverview')}</SubTitle>
          {overview.data && (
            <ReportButtons filenameBase="school-overview" buildReport={buildAdminReport} />
          )}
        </XStack>
        {overview.isLoading && <Loading />}
        {overview.error && <Feedback kind="bad">{overview.error.message}</Feedback>}
        {overview.data && (
          <>
            <XStack gap={10} flexWrap="wrap">
              <StatChip
                icon={<Text fontSize={18}>🧑‍🎓</Text>}
                value={overview.data.engagement.active7d}
                label={t('activeStudents7d')}
              />
              <StatChip
                icon={<Text fontSize={18}>📆</Text>}
                value={overview.data.engagement.active30d}
                label={t('activeStudents30d')}
              />
              <StatChip
                icon={<Text fontSize={18}>✏️</Text>}
                value={overview.data.engagement.attempts30d}
                label={t('schoolAttempts30d')}
              />
              <StatChip
                icon={<Text fontSize={18}>⏱️</Text>}
                value={overview.data.engagement.minutes30d}
                label={t('schoolMinutes30d')}
              />
            </XStack>

            <StatSection
              title={`📚 ${t('masteryByUnitTitle')}`}
              open={!!openStats.masteryByUnit}
              onToggle={() => toggleStat('masteryByUnit')}
            >
            {overview.data.masteryByUnit
              .filter((u) => u.struggling + u.practicing + u.proficient + u.mastered > 0)
              .map((u) => {
                const total = u.struggling + u.practicing + u.proficient + u.mastered;
                return (
                  <YStack key={u.unitNumber} gap={4}>
                    <XStack justifyContent="space-between" gap={8} flexWrap="wrap">
                      <Text fontSize={13} fontWeight="700" color={tokens.ink}>
                        {u.unitNumber}. {locale === 'es' ? u.titleEs : u.titleEn}
                      </Text>
                      <Muted size={12}>{total}</Muted>
                    </XStack>
                    {/* Stacked distribution bar: struggling → mastered. */}
                    <XStack height={10} borderRadius={999} overflow="hidden" backgroundColor={tokens.subtle}>
                      <YStack flexGrow={u.struggling} backgroundColor={bad.ink} />
                      <YStack flexGrow={u.practicing} backgroundColor={accent} opacity={0.3} />
                      <YStack flexGrow={u.proficient} backgroundColor={accent} opacity={0.6} />
                      <YStack flexGrow={u.mastered} backgroundColor={accent} />
                    </XStack>
                    <XStack gap={12} flexWrap="wrap">
                      <Muted size={11}>🔴 {u.struggling} {t('struggling')}</Muted>
                      <Muted size={11}>{u.practicing} {t('practicing')}</Muted>
                      <Muted size={11}>{u.proficient} {t('proficient')}</Muted>
                      <Muted size={11}>{u.mastered} {t('mastered')}</Muted>
                    </XStack>
                  </YStack>
                );
              })}
            {overview.data.masteryByUnit.every(
              (u) => u.struggling + u.practicing + u.proficient + u.mastered === 0,
            ) && <Muted size={12}>{t('noDataYet')}</Muted>}
            <Muted size={11}>{t('masteryByUnitNote')}</Muted>
            </StatSection>

            <StatSection
              title={`📈 ${t('growthTitle')}`}
              open={!!openStats.growth}
              onToggle={() => toggleStat('growth')}
            >
            {overview.data.growth.length === 0 ? (
              <Muted size={12}>{t('noDataYet')}</Muted>
            ) : (
              <WeeklyBars
                yearStart={overview.data.yearStart}
                points={overview.data.growth.map((g) => ({
                  weekStart: g.weekStart,
                  value: Math.round(g.avgScore * 100),
                  display: `${Math.round(g.avgScore * 100)}%`,
                }))}
              />
            )}
            <Muted size={11}>{t('growthNote')}</Muted>
            </StatSection>

            <StatSection
              title={`🎯 ${t('readinessTitle')}`}
              open={!!openStats.readiness}
              onToggle={() => toggleStat('readiness')}
            >
            {overview.data.readiness.map((r) => {
              const topic = regentsTopics.find((tp) => tp.slug === r.topicSlug);
              const total = r.ready + r.developing + r.needsWork + r.noData;
              const withData = total - r.noData;
              return (
                <YStack key={r.topicSlug} gap={4}>
                  <XStack justifyContent="space-between" gap={8} flexWrap="wrap">
                    <Text fontSize={13} fontWeight="700" color={tokens.ink}>
                      {topic?.icon} {locale === 'es' ? topic?.titleEs : topic?.titleEn}
                    </Text>
                    <Muted size={12}>{withData}</Muted>
                  </XStack>
                  <XStack height={10} borderRadius={999} overflow="hidden" backgroundColor={tokens.subtle}>
                    <YStack flexGrow={r.needsWork} backgroundColor={bad.ink} />
                    <YStack flexGrow={r.developing} backgroundColor={HINT.fg} />
                    <YStack flexGrow={r.ready} backgroundColor={COLORS.good} />
                    <YStack flexGrow={r.noData} backgroundColor={tokens.subtle} />
                  </XStack>
                  <XStack gap={12} flexWrap="wrap">
                    <Muted size={11}>{r.ready} {t('readinessReady')}</Muted>
                    <Muted size={11}>{r.developing} {t('readinessDeveloping')}</Muted>
                    <Muted size={11}>{r.needsWork} {t('readinessNeedsWork')}</Muted>
                    <Muted size={11}>{r.noData} {t('readinessNoData')}</Muted>
                  </XStack>
                </YStack>
              );
            })}
            <Muted size={11}>{t('readinessNote')}</Muted>
            </StatSection>

            <StatSection
              title={`🏫 ${t('adoptionTitle')}`}
              open={!!openStats.adoption}
              onToggle={() => toggleStat('adoption')}
            >
            <XStack gap={10} flexWrap="wrap">
              <StatChip
                icon={<Text fontSize={18}>🧑‍🏫</Text>}
                value={overview.data.adoption.teachersActive}
                label={t('adoptionTeachers')}
              />
              <StatChip
                icon={<Text fontSize={18}>🏷️</Text>}
                value={overview.data.adoption.classes}
                label={t('adoptionClasses')}
              />
              <StatChip
                icon={<Text fontSize={18}>🎒</Text>}
                value={overview.data.adoption.studentsEnrolled}
                label={t('adoptionEnrolled')}
              />
              <StatChip
                icon={<Text fontSize={18}>👥</Text>}
                value={overview.data.adoption.studentsTotal}
                label={t('adoptionAccounts')}
              />
              <StatChip
                icon={<Text fontSize={18}>🛡️</Text>}
                value={overview.data.adoption.consentPending}
                label={t('consentPendingStat')}
              />
            </XStack>
            </StatSection>

            {/* Equity slices (Phase 3): usage/outcomes by grade and by
                language. Cohorts under MIN_COHORT arrive suppressed from the
                server — the row says so instead of showing numbers. */}
            {(
              [
                ['slicesGradeTitle', overview.data.slices.byGrade],
                ['slicesLocaleTitle', overview.data.slices.byLocale],
              ] as const
            ).map(([titleKey, slices]) => (
              <StatSection
                key={titleKey}
                title={`🧭 ${t(titleKey)}`}
                open={!!openStats[titleKey]}
                onToggle={() => toggleStat(titleKey)}
              >
                {slices.map((s) => (
                  <XStack
                    key={s.key}
                    gap={12}
                    alignItems="center"
                    flexWrap="wrap"
                    paddingVertical={3}
                    borderTopWidth={1}
                    borderTopColor={tokens.border}
                  >
                    <Text fontSize={13} fontWeight="800" color={tokens.ink} width={90}>
                      {s.key === 'unspecified'
                        ? t('sliceUnspecified')
                        : titleKey === 'slicesGradeTitle'
                          ? `${t('grade')} ${s.key}`
                          : s.key === 'es'
                            ? 'Español'
                            : 'English'}
                    </Text>
                    {s.suppressed ? (
                      <Muted size={12}>{t('sliceSuppressed')}</Muted>
                    ) : (
                      <>
                        <Muted size={12}>
                          {s.students} {t('studentsLabel')}
                        </Muted>
                        <Muted size={12}>
                          {s.active30d} {t('activeStudents30d')}
                        </Muted>
                        <Muted size={12}>
                          {s.minutes30d} {t('schoolMinutes30d')}
                        </Muted>
                        <Muted size={12}>
                          {s.avgMastery === null ? '—' : `${Math.round(s.avgMastery * 100)}%`}{' '}
                          {t('avgMasteryLabel')}
                        </Muted>
                      </>
                    )}
                  </XStack>
                ))}
              </StatSection>
            ))}
          </>
        )}
      </AppCard>

      <AppCard gap={8}>
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
          <SubTitle>📊 {t('usageBillingTitle')}</SubTitle>
          {usage.data?.available && (
            <UsageWindowPicker value={usageWindow} onChange={setUsageWindow} />
          )}
        </XStack>
        {usage.isLoading && <Loading />}
        {usage.data?.available && usage.data.summary ? (
          <>
            <UsageDashboard summary={usage.data.summary} />
            {/* Cost per active student (Phase 3): spend over the picked
                window divided by matching active-student count — the number
                a principal defends in a budget meeting. */}
            {overview.data &&
              (() => {
                const active =
                  usageWindow === '7d'
                    ? overview.data.engagement.active7d
                    : overview.data.engagement.active30d;
                if (active === 0) return null;
                const per = usage.data!.summary!.totals.costUsd / active;
                return (
                  <Muted size={12}>
                    💲 ${per.toFixed(2)} {t('costPerStudent')} ({usageWindow})
                  </Muted>
                );
              })()}
            <Muted size={10.5}>{t('usageFreshnessNote')}</Muted>
          </>
        ) : (
          // No admin key configured (or the report errored) — fall back to
          // the zero-secret link-out. Never a hard error.
          !usage.isLoading && <Muted>{t('usageBillingNote')}</Muted>
        )}
        <Text
          fontWeight="800"
          fontSize={15}
          color={accent}
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
          onPress={() => {
            void Linking.openURL(ANTHROPIC_CONSOLE_URL);
          }}
        >
          {t('openAnthropicConsole')}
        </Text>
      </AppCard>
    </Screen>
  );
}
