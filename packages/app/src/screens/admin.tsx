/** Admin console: approve / reject / disable teacher accounts (governance),
 * plus AI-tutor usage & billing. When the server has an Anthropic Admin
 * key configured (admin.usage.summary → available), the card renders the
 * numbers natively — spend, tokens, cache hit rate, daily trend, per-model
 * split; otherwise it falls back to a link-out to the Anthropic Console,
 * which needs no secret at all. Either way the browser only ever receives
 * aggregated numbers. See docs/tutor-usage-dashboard-plan.md. */
import { useState } from 'react';
import { Linking } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import { UsageDashboard, UsageWindowPicker } from '../components/UsageDashboard';
import {
  AppCard,
  Badge,
  Feedback,
  GhostButton,
  Loading,
  Muted,
  PrimaryButton,
  Screen,
  StatChip,
  SubTitle,
  Title,
  useAccent,
  useFeedbackColors,
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

export function AdminScreen() {
  const { t, locale } = useI18n();
  const accent = useAccent();
  const tokens = useTokens();
  const bad = useFeedbackColors('bad');
  const authed = useRequireAuth();
  const role = useAuth((s) => s.auth?.user.role);
  const isAdmin = authed && role === 'admin';
  const utils = trpc.useUtils();
  const [usageWindow, setUsageWindow] = useState<'7d' | '30d'>('30d');

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

  return (
    <Screen maxWidth={820}>
      <Title>🛡️ {t('admin')}</Title>

      {/* School overview (docs/statistics-plan.md, Phase 1b): de-identified
          aggregates only — engagement, mastery by unit, adoption, consent
          coverage. The admin role still can't reach any individual student. */}
      <AppCard gap={12}>
        <SubTitle>🏫 {t('schoolOverview')}</SubTitle>
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

            <SubTitle>📚 {t('masteryByUnitTitle')}</SubTitle>
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

            <SubTitle>🏫 {t('adoptionTitle')}</SubTitle>
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
          </>
        )}
      </AppCard>

      <AppCard gap={10}>
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

      <AppCard gap={10}>
        <SubTitle>{t('allTeachers')}</SubTitle>
        {all.isLoading && <Loading />}
        {all.error && <Feedback kind="bad">{all.error.message}</Feedback>}
        {all.data?.teachers.map((tt) => (
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
