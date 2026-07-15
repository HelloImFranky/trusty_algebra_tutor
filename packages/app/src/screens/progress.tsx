/**
 * Progress dashboard (design doc §4.6), gamified: streaks, medal case of
 * achievements (bronze/silver/gold medallions drawn in-app — no external
 * assets), Regents Review topic progress, and a mastery map by unit.
 * Guardians/teachers land here via /progress/[studentId].
 */
import { useState } from 'react';
import { Brain, Clock, Flame, Lock, Medal as MedalIcon, TrendingUp } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import { JoinClassCard } from '../components/JoinClassCard';
import {
  AppCard, Badge, Feedback, Loading, Muted, NEUTRAL, ProgressBar, Screen, StatChip,
  SubTitle, Title, useAccent, useTokens, COLORS,
} from '../components/ui';

const TIER_STYLE = {
  bronze: { ring: '#b08d57', fill: '#f6ead9', label: '#8a6a3b' },
  silver: { ring: '#97a2b0', fill: '#eef1f5', label: '#5f6b7a' },
  gold: { ring: '#e6a817', fill: '#fff3cd', label: '#9a7000' },
} as const;

interface AchievementView {
  id: string;
  icon: string;
  tier: keyof typeof TIER_STYLE;
  target: number;
  value: number;
  earned: boolean;
  name: string;
  desc: string;
}

/** A medallion drawn with plain shapes so it renders identically everywhere.
 * Earned medals keep their tier-specific ring / fill / label colors (they're
 * meant to look like literal bronze/silver/gold metal in either mode);
 * unearned placeholders adopt the current theme's subtle/border neutrals so
 * they blend into a dark card instead of glowing white. */
function Medal({ a }: { a: AchievementView }) {
  const tier = TIER_STYLE[a.tier];
  const tokens = useTokens();
  return (
    <YStack width={104} alignItems="center" gap={5} paddingVertical={6} opacity={a.earned ? 1 : 0.85}>
      <YStack
        width={62}
        height={62}
        borderRadius={999}
        borderWidth={4}
        borderColor={a.earned ? tier.ring : tokens.border}
        backgroundColor={a.earned ? tier.fill : tokens.subtle}
        alignItems="center"
        justifyContent="center"
      >
        {a.earned ? (
          <Text fontSize={26}>{a.icon}</Text>
        ) : (
          <Lock size={22} color={NEUTRAL[400]} />
        )}
      </YStack>
      {a.earned ? (
        <XStack backgroundColor={tier.fill} borderRadius={999} paddingHorizontal={8} paddingVertical={1}>
          <Text fontSize={10} fontWeight="900" color={tier.label} textTransform="uppercase">
            {a.tier}
          </Text>
        </XStack>
      ) : (
        <XStack width={70} gap={0} alignItems="center">
          <ProgressBar ratio={a.target ? a.value / a.target : 0} />
        </XStack>
      )}
      <Text fontSize={12} fontWeight="800" textAlign="center" color={tokens.ink}>
        {a.name}
      </Text>
      <Muted size={10.5}>
        {a.earned ? a.desc : `${a.desc} (${Math.min(a.value, a.target)}/${a.target})`}
      </Muted>
    </YStack>
  );
}

export function ProgressScreen({ studentId }: { studentId?: number }) {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const accent = useAccent();
  const tokens = useTokens();
  const role = useAuth((s) => s.auth?.user.role);
  // Which Regents topic's detail dropdown is open (one at a time keeps the
  // scoreboard tidy).
  const [openTopic, setOpenTopic] = useState<string | null>(null);
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

  const achievements: AchievementView[] = data.achievements.map((a) => ({
    id: a.id,
    icon: a.icon,
    tier: a.tier,
    target: a.target,
    value: a.value,
    earned: a.earned,
    name: locale === 'es' ? a.nameEs : a.nameEn,
    desc: locale === 'es' ? a.descEs : a.descEn,
  }));
  const earned = achievements.filter((a) => a.earned);
  // Earned medals first (gold → bronze), then the nearest locked goals.
  const tierRank = { gold: 0, silver: 1, bronze: 2 } as const;
  const medalCase = [
    ...earned.sort((a, b) => tierRank[a.tier] - tierRank[b.tier]),
    ...achievements
      .filter((a) => !a.earned)
      .sort((a, b) => b.value / b.target - a.value / a.target),
  ];

  return (
    <Screen maxWidth={980}>
      <XStack alignItems="center" gap={8}>
        <TrendingUp size={20} color={tokens.ink} />
        <Title>
          {t('progress')}
          {data.student ? ` — ${data.student.displayName}` : ''}
        </Title>
      </XStack>

      {!studentId && role === 'student' && <JoinClassCard />}

      <XStack gap={8} flexWrap="wrap">
        {/* Streak flame is a fixed brand red — see curriculum.tsx for the
            rationale; the fire signal is stronger when it doesn't shift
            with the picked accent. Clock and Brain adopt the accent. */}
        <StatChip icon={<Flame size={20} color="#ec3013" />} value={data.streakDays} label={t('streak')} />
        <StatChip icon={<Clock size={20} color={accent} />} value={Math.round(totalMinutes)} label={`${t('minutes')} / 30d`} />
        <StatChip
          icon={<Brain size={20} color={accent} />}
          value={data.skills.filter((s) => s.label === 'mastered' || s.label === 'proficient').length}
          label={t('mastered')}
        />
        <StatChip icon={<MedalIcon size={20} color={accent} />} value={`${earned.length}/${achievements.length}`} label={t('badgesEarned')} />
        <StatChip icon={<Text fontSize={18}>🎯</Text>} value={data.regents.questionsCorrect} label={t('regentsCorrectLabel')} />
      </XStack>

      <AppCard gap={4}>
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" gap={6}>
            <MedalIcon size={17} color={accent} />
            <SubTitle>{t('achievements')}</SubTitle>
          </XStack>
          <Muted>
            {earned.length} / {achievements.length}
          </Muted>
        </XStack>
        <XStack flexWrap="wrap" justifyContent="space-evenly">
          {medalCase.map((a) => (
            <Medal key={a.id} a={a} />
          ))}
        </XStack>
      </AppCard>

      <AppCard gap={10}>
        <XStack justifyContent="space-between" alignItems="center">
          <SubTitle>📚 {t('review')}</SubTitle>
          <Muted>
            {data.regents.topicsCompleted} / {data.regents.topics.length} {t('completeLabel').toLowerCase()}
          </Muted>
        </XStack>
        <Muted>
          {data.regents.questionsAnswered} {t('questionsAnsweredLabel')} · ✅{' '}
          {data.regents.questionsCorrect} {t('rightLabel')} · ❌{' '}
          {data.regents.questionsAnswered - data.regents.questionsCorrect} {t('wrongLabel')}
        </Muted>
        {data.regents.topics.map((topic) => {
          const done = topic.answered >= topic.total;
          const perfect = done && topic.correct === topic.total;
          const open = openTopic === topic.slug;
          return (
            <YStack key={topic.slug}>
              <XStack
                alignItems="center"
                gap={10}
                paddingVertical={2}
                cursor="pointer"
                hoverStyle={{ opacity: 0.8 }}
                onPress={() => setOpenTopic(open ? null : topic.slug)}
              >
                <Text fontSize={16} width={26}>
                  {topic.icon}
                </Text>
                <Text fontSize={13.5} fontWeight="700" width={170} numberOfLines={1} color={tokens.ink}>
                  {locale === 'es' ? topic.titleEs : topic.titleEn}
                </Text>
                <ProgressBar ratio={topic.answered / topic.total} />
                <Text
                  fontSize={12.5}
                  fontWeight="800"
                  width={54}
                  textAlign="right"
                  color={perfect ? COLORS.good : done ? accent : COLORS.muted}
                >
                  {perfect ? '🌟 ' : done ? '✓ ' : ''}
                  {topic.correct}/{topic.total}
                </Text>
                <Text fontSize={11} width={14} color={tokens.muted}>
                  {open ? '▾' : '▸'}
                </Text>
              </XStack>
              {open && (
                <XStack
                  gap={14}
                  flexWrap="wrap"
                  marginLeft={36}
                  marginVertical={4}
                  paddingHorizontal={12}
                  paddingVertical={8}
                  borderRadius={14}
                  backgroundColor={tokens.subtle}
                >
                  <Muted size={12.5}>
                    ✅ {topic.correctAll} {t('rightLabel')}
                  </Muted>
                  <Muted size={12.5}>
                    ❌ {topic.wrongAll} {t('wrongLabel')}
                  </Muted>
                  <Muted size={12.5}>
                    🔁 {topic.completions} {t('completedTimesLabel')}
                  </Muted>
                </XStack>
              )}
            </YStack>
          );
        })}
      </AppCard>

      {data.struggleFlags.length > 0 && (
        <AppCard borderLeftWidth={4} borderLeftColor={COLORS.bad} gap={4}>
          <SubTitle>🚩 {t('struggling')}</SubTitle>
          {data.struggleFlags.map((s) => (
            <Text key={s.lessonCode} fontSize={14} color={tokens.ink}>
              <Text fontWeight="800">{s.lessonCode}</Text> {s.name}
            </Text>
          ))}
        </AppCard>
      )}

      <AppCard gap={10}>
        <SubTitle>{t('masteryMap')}</SubTitle>
        {units.map((u) => (
          <YStack key={u} gap={4}>
            <Text fontWeight="800" color={tokens.ink}>Unit {u}</Text>
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
    </Screen>
  );
}
