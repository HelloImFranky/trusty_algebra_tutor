/**
 * Progress dashboard (design doc §4.6): streaks, mastery map by unit,
 * recent exit tickets. Guardians/teachers land here via /progress/[studentId].
 */
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import {
  AppCard, Badge, Feedback, Loading, Muted, ProgressBar, Screen, SubTitle, Title, COLORS,
} from '../components/ui';

function Stat({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return (
    <AppCard flex={1} minWidth={140} alignItems="center" gap={2}>
      <Text fontSize={34}>{icon}</Text>
      <Text fontSize={26} fontWeight="900">
        {value}
      </Text>
      <Muted>{label}</Muted>
    </AppCard>
  );
}

export function ProgressScreen({ studentId }: { studentId?: number }) {
  const { t } = useI18n();
  const authed = useRequireAuth();
  const me = trpc.progress.me.useQuery(undefined, { enabled: authed && !studentId });
  const other = trpc.progress.student.useQuery(
    { studentId: studentId ?? 0 },
    { enabled: authed && !!studentId },
  );
  const q = studentId ? other : me;

  if (q.error) {
    return (
      <Screen>
        <Feedback kind="bad">{q.error.message}</Feedback>
      </Screen>
    );
  }
  if (!q.data) return <Loading />;
  const data = q.data as typeof q.data & {
    student?: { id: number; displayName: string; grade: number | null };
  };

  const units = [...new Set(data.skills.map((s) => s.unitNumber))].sort((a, b) => a - b);
  const totalMinutes = data.activity.reduce((sum, a) => sum + Number(a.minutes), 0);

  return (
    <Screen>
      <Title>
        📈 {t('progress')}
        {data.student ? ` — ${data.student.displayName}` : ''}
      </Title>

      <XStack gap={12} flexWrap="wrap">
        <Stat icon="🔥" value={data.streakDays} label={t('streak')} />
        <Stat icon="⏱" value={Math.round(totalMinutes)} label={`${t('minutes')} / 30d`} />
        <Stat
          icon="🧠"
          value={data.skills.filter((s) => s.label === 'mastered' || s.label === 'proficient').length}
          label={t('mastered')}
        />
      </XStack>

      {data.struggleFlags.length > 0 && (
        <AppCard borderLeftWidth={4} borderLeftColor={COLORS.bad} gap={4}>
          <SubTitle>🚩 {t('struggling')}</SubTitle>
          {data.struggleFlags.map((s) => (
            <Text key={s.lessonCode} fontSize={14}>
              <Text fontWeight="800">{s.lessonCode}</Text> {s.name}
            </Text>
          ))}
        </AppCard>
      )}

      <AppCard gap={10}>
        <SubTitle>{t('masteryMap')}</SubTitle>
        {units.map((u) => (
          <YStack key={u} gap={4}>
            <Text fontWeight="800">Unit {u}</Text>
            {data.skills
              .filter((s) => s.unitNumber === u)
              .map((s) => (
                <XStack key={s.skillId} alignItems="center" gap={10} paddingVertical={2}>
                  <Muted>{s.lessonCode}</Muted>
                  <ProgressBar ratio={s.score} />
                  <Badge label={s.label} text={t(s.label as I18nKey)} />
                </XStack>
              ))}
          </YStack>
        ))}
        {!data.skills.length && <Muted>—</Muted>}
      </AppCard>

      <AppCard gap={6}>
        <SubTitle>🎟️ {t('recentExitTickets')}</SubTitle>
        {data.exitTickets.map((et, i) => (
          <XStack key={i} justifyContent="space-between" paddingVertical={3}>
            <Text fontWeight="700" width={50}>
              {et.lessonCode}
            </Text>
            <Text>
              {et.score} / {et.maxScore}
            </Text>
            <Muted>{new Date(et.at).toLocaleDateString()}</Muted>
          </XStack>
        ))}
        {!data.exitTickets.length && <Muted>—</Muted>}
      </AppCard>
    </Screen>
  );
}
