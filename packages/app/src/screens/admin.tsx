/** Admin console: approve / reject / disable teacher accounts (governance),
 * plus a link-out to the Anthropic Console for AI-tutor usage & billing.
 * Deliberately a link-out (not an in-app render) so no Anthropic Admin API
 * key has to live in the app — the admin authenticates to Anthropic
 * directly. See docs/tutor-anthropic-haiku-plan.md § "Surfacing usage &
 * billing in the admin view". */
import { Linking } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import {
  AppCard,
  Badge,
  Feedback,
  GhostButton,
  Loading,
  Muted,
  PrimaryButton,
  Screen,
  SubTitle,
  Title,
  useAccent,
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
  const { t } = useI18n();
  const accent = useAccent();
  const authed = useRequireAuth();
  const role = useAuth((s) => s.auth?.user.role);
  const isAdmin = authed && role === 'admin';
  const utils = trpc.useUtils();

  const pending = trpc.admin.teachers.listPending.useQuery(undefined, { enabled: isAdmin });
  const all = trpc.admin.teachers.list.useQuery(undefined, { enabled: isAdmin });

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

      <AppCard gap={10}>
        <SubTitle>{t('pendingTeachers')}</SubTitle>
        {pending.isLoading && <Loading />}
        {pending.error && <Feedback kind="bad">{pending.error.message}</Feedback>}
        {pending.data?.teachers.length === 0 && <Muted>{t('noPending')}</Muted>}
        {pending.data?.teachers.map((tt) => (
          <XStack key={tt.id} justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
            <YStack>
              <Text fontWeight="800">{tt.displayName}</Text>
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
              <Text fontWeight="800">{tt.displayName}</Text>
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
        <SubTitle>📊 {t('usageBillingTitle')}</SubTitle>
        <Muted>{t('usageBillingNote')}</Muted>
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
