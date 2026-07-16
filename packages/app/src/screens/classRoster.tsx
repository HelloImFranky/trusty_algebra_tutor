/** Teacher class roster: per-student summary + join-code / class management. */
import { useState } from 'react';
import { Platform } from 'react-native';
import { Link } from 'solito/link';
import { useRouter } from 'solito/navigation';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import {
  AppCard,
  Feedback,
  GhostButton,
  Loading,
  Muted,
  SecondaryButton,
  Screen,
  Title,
  useAccent,
  useTokens,
} from '../components/ui';

function StatChip({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  const tokens = useTokens();
  return (
    <XStack gap={4} alignItems="center">
      <Text fontSize={14}>{icon}</Text>
      <Text fontSize={13} fontWeight="800" color={tokens.ink}>
        {value}
      </Text>
      <Muted size={12}>{label}</Muted>
    </XStack>
  );
}

export function ClassRosterScreen({ classId }: { classId: number }) {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const role = useAuth((s) => s.auth?.user.role);
  const router = useRouter();
  const utils = trpc.useUtils();
  const accent = useAccent();
  const [copied, setCopied] = useState(false);

  const roster = trpc.teacher.classes.roster.useQuery(
    { classId },
    { enabled: authed && role === 'teacher' },
  );
  const regen = trpc.teacher.classes.regenerateCode.useMutation({
    onSuccess: () => {
      setCopied(false);
      void utils.teacher.classes.roster.invalidate({ classId });
    },
  });
  const archive = trpc.teacher.classes.archive.useMutation({
    onSuccess: () => {
      void utils.teacher.classes.list.invalidate();
      router.replace('/classes');
    },
  });
  const remove = trpc.teacher.classes.removeStudent.useMutation({
    onSuccess: () => void utils.teacher.classes.roster.invalidate({ classId }),
  });

  if (roster.isLoading) return <Loading />;
  if (roster.error) {
    return (
      <Screen>
        <Feedback kind="bad">{roster.error.message}</Feedback>
        <Link href="/classes">
          <Text color={accent} fontWeight="700">
            ← {t('myClasses')}
          </Text>
        </Link>
      </Screen>
    );
  }
  if (!roster.data) return <Loading />;

  const { class: cls, students } = roster.data;
  const code = cls.joinCode;
  const copy = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(code);
      setCopied(true);
    }
  };
  const fmtActive = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'es' ? 'es' : 'en') : t('neverActive');

  return (
    <Screen maxWidth={900}>
      <Link href="/classes">
        <Text color={accent} fontWeight="700">
          ← {t('myClasses')}
        </Text>
      </Link>
      <Title>{cls.name}</Title>

      <AppCard gap={8}>
        <XStack gap={8} alignItems="center" flexWrap="wrap">
          <Muted>{t('joinCode')}:</Muted>
          <Text fontWeight="800" fontSize={20} letterSpacing={3} color={accent}>
            {code}
          </Text>
          {Platform.OS === 'web' && (
            <SecondaryButton size="$2" onPress={copy}>
              {copied ? t('copied') : t('copyCode')}
            </SecondaryButton>
          )}
          <GhostButton size="$2" disabled={regen.isPending} onPress={() => regen.mutate({ classId })}>
            {t('regenerateCode')}
          </GhostButton>
          <GhostButton
            size="$2"
            disabled={archive.isPending}
            onPress={() => archive.mutate({ classId })}
          >
            {t('archiveClass')}
          </GhostButton>
        </XStack>
      </AppCard>

      {students.length === 0 && <Muted>{t('emptyRoster')}</Muted>}

      <YStack gap={8}>
        {students.map((s) => (
          <AppCard key={s.id} gap={8}>
            <XStack justifyContent="space-between" alignItems="center" gap={8} flexWrap="wrap">
              <Link href={`/progress/${s.id}`}>
                <Text fontSize={16} fontWeight="800" color={accent}>
                  {s.displayName} →
                </Text>
              </Link>
              <GhostButton
                size="$1"
                disabled={remove.isPending}
                onPress={() => remove.mutate({ classId, studentId: s.id })}
              >
                {t('removeStudent')}
              </GhostButton>
            </XStack>
            <XStack gap={16} flexWrap="wrap" alignItems="center">
              <StatChip icon="🔥" value={s.streakDays} label={t('streak')} />
              <StatChip icon="🧠" value={s.mastered} label={t('mastered')} />
              {s.struggling > 0 && (
                <StatChip icon="🚩" value={s.struggling} label={t('struggling')} />
              )}
              <Muted size={12}>
                {t('lastActive')}: {fmtActive(s.lastActiveAt)}
              </Muted>
            </XStack>
          </AppCard>
        ))}
      </YStack>
    </Screen>
  );
}
