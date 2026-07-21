/**
 * Progress dashboard (design doc §4.6), gamified: streaks, a medal case of
 * stacking achievements (bronze → silver → gold → platinum → mathematician
 * → math wizard, drawn in-app with no external assets — one medal per
 * metric family that upgrades in place as the student clears each tier),
 * Regents Review topic progress, and a mastery map by unit.
 * Guardians/teachers land here via /progress/[studentId].
 */
import { useState } from 'react';
import { Brain, Check, Clock, Flame, Lock, Medal as MedalIcon, TrendingUp } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n, type I18nKey } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import { JoinClassCard } from '../components/JoinClassCard';
import { ReadinessPill } from '../components/Readiness';
import {
  AppCard, Badge, Feedback, Loading, Muted, NEUTRAL, ProgressBar, Screen, StatChip,
  SubTitle, Title, useAccent, useTokens, COLORS,
} from '../components/ui';

/** The stacking tier ladder. A family with `n` achievements uses the first
 * `n` names from this list — three-tier families (streaks, mastery, …) end
 * at gold; the six-tier solver family goes all the way to Math Wizard.
 * Colors are theme-invariant on purpose: the medallions are meant to look
 * like literal metal / regalia in both light and dark cards (see
 * docs/theme-tokens.md § "Intentional exceptions"). Light fill + dark
 * label + medium-tone ring keeps them legible on either surface. */
const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'mathematician', 'mathwizard'] as const;
type Tier = typeof TIERS[number];

const TIER_STYLE = {
  bronze:        { ring: '#b08d57', fill: '#f6ead9', label: '#8a6a3b' },
  silver:        { ring: '#97a2b0', fill: '#eef1f5', label: '#5f6b7a' },
  gold:          { ring: '#e6a817', fill: '#fff3cd', label: '#9a7000' },
  platinum:      { ring: '#8a99ad', fill: '#eaeff5', label: '#3a4a5f' },
  mathematician: { ring: '#7c3aed', fill: '#f0e9ff', label: '#4c1d95' },
  mathwizard:    { ring: '#c026d3', fill: '#fae8ff', label: '#701a75' },
} as const satisfies Record<Tier, { ring: string; fill: string; label: string }>;

const TIER_LABEL: Record<Tier, string> = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
  platinum: 'PLATINUM',
  mathematician: 'MATHEMATICIAN',
  mathwizard: 'MATH WIZARD',
};

interface AchievementView {
  id: string;
  icon: string;
  metric: string;
  target: number;
  value: number;
  earned: boolean;
  name: string;
  desc: string;
}

/** One "family" of tiered achievements collapsed into a single stacking
 * medal. `earnedCount` counts how many tiers the student has cleared —
 * that's also the index into TIERS for the current display tier (or -1
 * when nothing is earned yet, in which case we still show a placeholder
 * medal working toward bronze).
 *
 * `current` is the highest-earned achievement (or the first tier's when
 * nothing's earned — used for icon/name/desc in the pre-bronze state).
 * `next` is the achievement the progress bar tracks toward; null when
 * the top tier has been reached. */
interface FamilyView {
  metric: string;
  earnedCount: number;
  totalTiers: number;
  current: AchievementView;
  next: AchievementView | null;
  progress: number;
}

/** One stacked medallion per achievement family. Once bronze is cleared the
 * same medal upgrades to silver, then gold, then platinum, mathematician,
 * math wizard — the medallion, icon, and label all swap to the higher tier
 * rather than adding a second medal to the case. The progress bar under
 * the medal always tracks the CURRENT tier's progress (0 → 1 as the
 * student works from their last cleared threshold toward the next), so it
 * feels like a small level-up loop rather than a static goal.
 *
 * The pre-bronze state (nothing earned yet) shows a locked placeholder
 * that adopts the theme's subtle / border neutrals so it blends into a
 * dark card instead of glowing white. */
function Medal({ f }: { f: FamilyView }) {
  const tokens = useTokens();
  const hasEarned = f.earnedCount > 0;
  const displayTier: Tier = hasEarned ? TIERS[f.earnedCount - 1] : 'bronze';
  const tier = TIER_STYLE[displayTier];
  const atMax = hasEarned && f.next === null;
  return (
    <YStack width={104} alignItems="center" gap={5} paddingVertical={6} opacity={hasEarned ? 1 : 0.85}>
      <YStack
        width={62}
        height={62}
        borderRadius={999}
        borderWidth={4}
        borderColor={hasEarned ? tier.ring : tokens.border}
        backgroundColor={hasEarned ? tier.fill : tokens.subtle}
        alignItems="center"
        justifyContent="center"
      >
        {hasEarned ? (
          <Text fontSize={26}>{f.current.icon}</Text>
        ) : (
          <Lock size={22} color={NEUTRAL[400]} />
        )}
      </YStack>
      {hasEarned && (
        <XStack backgroundColor={tier.fill} borderRadius={999} paddingHorizontal={8} paddingVertical={1}>
          <Text fontSize={displayTier === 'mathematician' ? 8.5 : 10} fontWeight="900" color={tier.label}>
            {TIER_LABEL[displayTier]}
          </Text>
        </XStack>
      )}
      {!atMax && (
        <XStack width={70} gap={0} alignItems="center">
          <ProgressBar ratio={f.progress} />
        </XStack>
      )}
      <Text fontSize={12} fontWeight="800" textAlign="center" color={tokens.ink}>
        {f.current.name}
      </Text>
      <Muted size={10.5}>
        {atMax
          ? f.current.desc
          : f.next
          ? `${f.next.desc} (${Math.min(f.next.value, f.next.target)}/${f.next.target})`
          : `${f.current.desc} (${Math.min(f.current.value, f.current.target)}/${f.current.target})`}
      </Muted>
    </YStack>
  );
}

/** Collapse the flat achievement list into one stacking medal per metric
 * family. Achievements inside each family are sorted by target ascending;
 * the index of the highest-earned achievement is also the index into
 * TIERS for the display tier (0 = bronze, 5 = math wizard). The progress
 * bar shows how far the student has come inside their CURRENT tier — i.e.
 * from the last cleared threshold toward the next — so the bar resets
 * with each level-up. */
function toFamilies(list: AchievementView[]): FamilyView[] {
  const groups = new Map<string, AchievementView[]>();
  for (const a of list) {
    const bucket = groups.get(a.metric) ?? [];
    bucket.push(a);
    groups.set(a.metric, bucket);
  }
  const families: FamilyView[] = [];
  for (const [metric, tiers] of groups) {
    tiers.sort((a, b) => a.target - b.target);
    const earnedCount = tiers.filter((a) => a.earned).length;
    const current = earnedCount > 0 ? tiers[earnedCount - 1] : tiers[0];
    const next = earnedCount < tiers.length ? tiers[earnedCount] : null;
    const value = tiers[0].value; // all tiers share the same metric value
    let progress = 0;
    if (next) {
      const floor = earnedCount > 0 ? tiers[earnedCount - 1].target : 0;
      const span = next.target - floor;
      progress = span > 0 ? Math.max(0, Math.min(1, (value - floor) / span)) : 0;
    } else {
      progress = 1;
    }
    families.push({ metric, earnedCount, totalTiers: tiers.length, current, next, progress });
  }
  // Highest-tier families first (already-legendary work sits at the front);
  // within the same tier, the ones closest to their next level-up first.
  families.sort((a, b) => {
    if (a.earnedCount !== b.earnedCount) return b.earnedCount - a.earnedCount;
    return b.progress - a.progress;
  });
  return families;
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
    metric: a.metric,
    target: a.target,
    value: a.value,
    earned: a.earned,
    name: locale === 'es' ? a.nameEs : a.nameEn,
    desc: locale === 'es' ? a.descEs : a.descEn,
  }));
  const earned = achievements.filter((a) => a.earned);
  const families = toFamilies(achievements);

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
        <StatChip icon={<Check size={20} color={accent} />} value={data.regents.questionsCorrect} label={t('regentsCorrectLabel')} />
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
          {families.map((f) => (
            <Medal key={f.metric} f={f} />
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

      {/* Regents readiness (docs/statistics-plan.md, Phase 2): the shared
          core traffic light — mastery of each topic's linked skills blended
          with Regents Review accuracy. */}
      <AppCard gap={8}>
        <SubTitle>🎯 {t('readinessTitle')}</SubTitle>
        {data.regentsReadiness.map((r, i) => (
          <XStack
            key={r.slug}
            justifyContent="space-between"
            alignItems="center"
            gap={8}
            paddingVertical={5}
            borderTopWidth={i === 0 ? 0 : 1}
            borderTopColor={tokens.border}
          >
            <Text fontSize={14} fontWeight="700" color={tokens.ink}>
              {r.icon} {locale === 'es' ? r.titleEs : r.titleEn}
            </Text>
            <ReadinessPill band={r.band} />
          </XStack>
        ))}
        <Muted size={11}>{t('readinessNote')}</Muted>
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
