/** Daily Sprints: short timed fluency rounds over easy 6th/7th-grade skills
 * the student already knows (design doc §4.4, "Sprints" folder). A sprint is
 * always and only 1 minute long and 10 questions — no length option. A live
 * classmate leaderboard (docs/sprint-leaderboard-plan.md) sits under the
 * round card and polls while the page is open. */
import { useEffect, useRef, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { client, trpc } from '../lib/trpc';
import { attemptOrQueue } from '../lib/offline';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/MathText';
import { AnimatedEquation } from '../components/stepanim/AnimatedEquation';
import { buildScriptForProblem } from '../components/stepanim/builders';
import { SprintLeaderboardCard } from '../components/SprintLeaderboard';
import {
  AppCard,
  COLORS,
  GhostButton,
  Muted,
  PrimaryButton,
  RADIUS,
  Screen,
  SecondaryButton,
  SubTitle,
  Title,
  useAccent,
  useFeedbackColors,
  useTokens,
} from '../components/ui';

interface SprintProblem {
  id: number;
  prompt: string;
  params?: unknown;
  skillSlug?: string | null;
}

interface SprintTopic {
  slug: string;
  icon: string;
  nameEn: string;
  nameEs: string;
}

/** One item in the post-round review: a problem the student got wrong or
 * never got to answer, paired with what they wrote and the correct target. */
interface MissRecord {
  problem: SprintProblem;
  submitted: string; // '' when skipped (time ran out before an answer)
  correct: string | null; // null when the attempt was queued offline
  skipped?: boolean;
}

// The one and only sprint format: 10 questions in 1 minute.
const SPRINT_SECONDS = 60;
// How often the live leaderboard refreshes while this page is open.
const LEADERBOARD_POLL_MS = 5000;

/** "60 → 1:00" — round time in m:ss for the header and timer. */
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Small selectable pill for the round-length / topic pickers. */
function PickChip({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const accent = useAccent();
  const tokens = useTokens();
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      backgroundColor={selected ? accent : tokens.subtle}
      borderRadius={RADIUS.pill}
      paddingHorizontal={12}
      paddingVertical={6}
      pressStyle={{ opacity: 0.8 }}
    >
      <Text color={selected ? tokens.onAccent : tokens.ink} fontSize={13} fontWeight="700">
        {children}
      </Text>
    </XStack>
  );
}

export function SprintScreen() {
  const { t, locale } = useI18n();
  const tokens = useTokens();
  const badColors = useFeedbackColors('bad');
  const goodColors = useFeedbackColors('good');
  const authed = useRequireAuth();
  const [problems, setProblems] = useState<SprintProblem[]>([]);
  const [index, setIndex] = useState(-1);
  const [answer, setAnswer] = useState('');
  const [seconds, setSeconds] = useState(SPRINT_SECONDS);
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [running, setRunning] = useState(false);
  const [misses, setMisses] = useState<MissRecord[]>([]);
  const [animOpenId, setAnimOpenId] = useState<number | null>(null);
  const [topics, setTopics] = useState<SprintTopic[]>([]);
  // Multi-select: the round draws from every chosen topic. Empty = all topics.
  const [topicSlugs, setTopicSlugs] = useState<string[]>([]);
  // Grades still in flight — the completion report waits for them so the
  // recorded score can't miss a submit that raced the timer.
  const [inFlight, setInFlight] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  // Highest index for which submit() started grading — protects against the
  // timer expiring mid-await and double-counting that problem as both
  // "skipped" (by the time-out effect) and graded (by the returning submit).
  const submittingIndex = useRef<number>(-1);
  const reportedRound = useRef(false);
  // Server-side round id from sprintStart — closing it (sprintComplete) is
  // what turns the live leaderboard entry into a completed round.
  const sessionId = useRef<number | null>(null);

  // Live classmate leaderboard — polls while the page is mounted so scores
  // (including classmates mid-round) tick without a refresh.
  const utils = trpc.useUtils();
  const leaderboard = trpc.practice.sprintLeaderboard.useQuery(undefined, {
    enabled: authed,
    refetchInterval: LEADERBOARD_POLL_MS,
  });

  useEffect(() => {
    client.practice.sprintTopics
      .query()
      .then((r) => setTopics(r.topics))
      .catch(() => {});
  }, []);

  const topicName = (s: SprintTopic) => (locale === 'es' ? s.nameEs : s.nameEn);

  const toggleTopic = (slug: string) =>
    setTopicSlugs((cur) =>
      cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug],
    );

  const start = async (slugsOverride?: string[]) => {
    const slugs = slugsOverride ?? topicSlugs;
    // Open the server-side round alongside fetching the questions — the open
    // round is what makes this student's live score visible to classmates.
    const [r, started] = await Promise.all([
      client.practice.sprint.query({
        locale,
        topics: slugs.length ? slugs : undefined,
      }),
      client.practice.sprintStart.mutate().catch(() => null),
    ]);
    sessionId.current = started?.sessionId ?? null;
    setProblems(r.problems);
    setIndex(0);
    setScore(0);
    setAttempted(0);
    setMisses([]);
    setAnimOpenId(null);
    setSeconds(SPRINT_SECONDS);
    setAnswer('');
    submittingIndex.current = -1;
    reportedRound.current = false;
    setRunning(true);
  };

  /** 🎲 pick a random topic, show it as selected, and launch right away. */
  const startRandom = () => {
    if (!topics.length) return void start([]);
    const pick = topics[Math.floor(Math.random() * topics.length)];
    setTopicSlugs([pick.slug]);
    void start([pick.slug]);
  };

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer.current);
  }, [running]);

  // When the timer expires, everything the student never got to becomes a
  // "skipped" review row — that way the review reflects the whole round, not
  // just problems that happened to fit in the time limit.
  useEffect(() => {
    if (seconds > 0 || !running) return;
    setRunning(false);
    clearInterval(timer.current);
    if (index >= 0 && index < problems.length) {
      // A submit already in flight owns the current index — don't push it
      // as skipped or the review row would duplicate when the answer lands.
      const startFrom = submittingIndex.current >= index ? index + 1 : index;
      if (startFrom < problems.length) {
        const remaining = problems.slice(startFrom).map((p) => ({
          problem: p,
          submitted: '',
          correct: null,
          skipped: true,
        }));
        setMisses((m) => [...m, ...remaining]);
      }
    }
  }, [seconds, running, index, problems]);

  // Round over (and no grade still in flight): record the completed sprint
  // so the badge ladder on Progress can count it. A round over several
  // topics is recorded as mixed (null slug), same as "all".
  useEffect(() => {
    if (running || index < 0 || inFlight > 0 || attempted === 0) return;
    if (reportedRound.current) return;
    reportedRound.current = true;
    client.practice.sprintComplete
      .mutate({
        sessionId: sessionId.current,
        skillSlug: topicSlugs.length === 1 ? topicSlugs[0] : null,
        total: attempted,
        correct: score,
      })
      .then(() => utils.practice.sprintLeaderboard.invalidate())
      .catch(() => {});
  }, [running, index, inFlight, attempted, score, topicSlugs, utils]);

  const submit = async () => {
    if (!answer.trim() || !running) return;
    const p = problems[index];
    const submitted = answer;
    submittingIndex.current = index;
    setAttempted((a) => a + 1);
    setInFlight((n) => n + 1);
    try {
      const res = await attemptOrQueue({
        problemId: p.id,
        submittedLatex: submitted,
        context: 'sprint',
      });
      if (!res.queued && res.correct) {
        setScore((s) => s + 1);
      } else if (!res.queued) {
        setMisses((m) => [
          ...m,
          { problem: p, submitted, correct: res.correctAnswer ?? null },
        ]);
      }
    } finally {
      setInFlight((n) => n - 1);
    }
    setAnswer('');
    if (index + 1 < problems.length) setIndex((i) => i + 1);
    else setRunning(false);
  };

  const selected = topics.filter((s) => topicSlugs.includes(s.slug));
  const roundLabel =
    selected.length === 0
      ? `⚡ ${t('sprintAllTopics')}`
      : selected.length === 1
        ? `${selected[0].icon} ${topicName(selected[0])}`
        : `⚡ ${selected.length} ${t('sprintTopicsSelected')}`;

  return (
    <Screen maxWidth={560}>
      <Title>⚡ {t('sprint')}</Title>
      {!running && index === -1 && (
        <AppCard gap={14}>
          <Text fontSize={16} fontWeight="800" color={tokens.ink} textAlign="center">
            ❓ {t('sprintFormat')} · ⏱ {fmtTime(SPRINT_SECONDS)}
          </Text>
          <Muted size={13}>{t('sprintTagline')}</Muted>
          {topics.length > 0 && (
            <YStack gap={6}>
              <Muted size={12}>{t('sprintTopicLabel')}</Muted>
              <XStack gap={8} flexWrap="wrap">
                <PickChip selected={topicSlugs.length === 0} onPress={() => setTopicSlugs([])}>
                  {t('sprintAllTopics')}
                </PickChip>
                {topics.map((s) => {
                  const on = topicSlugs.includes(s.slug);
                  return (
                    <PickChip key={s.slug} selected={on} onPress={() => toggleTopic(s.slug)}>
                      {s.icon} {topicName(s)}{on ? ' ✓' : ''}
                    </PickChip>
                  );
                })}
              </XStack>
            </YStack>
          )}
          <YStack gap={8}>
            <PrimaryButton onPress={() => void start()}>{t('sprintGo')}</PrimaryButton>
            {topics.length > 1 && (
              <SecondaryButton onPress={startRandom}>🎲 {t('sprintRandomTopic')}</SecondaryButton>
            )}
          </YStack>
        </AppCard>
      )}
      {running && problems[index] && (
        <AppCard gap={10}>
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontWeight="900" fontSize={20} color={seconds <= 10 ? COLORS.bad : COLORS.warn}>
              ⏱ {fmtTime(Math.max(0, seconds))}
            </Text>
            <Muted size={12}>{roundLabel}</Muted>
          </XStack>
          <XStack justifyContent="center">
            <MathText text={problems[index].prompt} size={19} />
          </XStack>
          <MathInput value={answer} onChange={setAnswer} onSubmit={submit} />
          <PrimaryButton onPress={submit}>{t('check')} ⏎</PrimaryButton>
        </AppCard>
      )}
      {!running && index >= 0 && (
        <>
          <AppCard alignItems="center" gap={8}>
            <SubTitle>{t('sprintDone')}</SubTitle>
            <Muted size={13}>{roundLabel}</Muted>
            <Text fontSize={40} fontWeight="900" color={tokens.ink}>
              {score} / {attempted}
            </Text>
            <XStack gap={8} flexWrap="wrap" justifyContent="center">
              <PrimaryButton onPress={() => void start()}>↻ {t('sprintGo')}</PrimaryButton>
              {topics.length > 1 && (
                <SecondaryButton onPress={startRandom}>🎲 {t('sprintRandomTopic')}</SecondaryButton>
              )}
            </XStack>
          </AppCard>

          {/* Post-round review: for every miss show what they wrote next to
              the correct answer, then offer the animated walkthrough as
              free reinforcement (no hint cost in the timed round). */}
          <AppCard gap={12}>
            <SubTitle>{t('sprintReview')}</SubTitle>
            {misses.length === 0 ? (
              <Muted size={13}>{t('sprintAllCorrect')}</Muted>
            ) : (
              misses.map((m) => {
                const script = buildScriptForProblem(m.problem.skillSlug, m.problem.params);
                return (
                  <YStack
                    key={m.problem.id}
                    gap={8}
                    borderTopWidth={1}
                    borderTopColor={tokens.border}
                    paddingTop={10}
                  >
                    <MathText text={m.problem.prompt} size={16} />
                    {m.skipped ? (
                      <Muted size={12}>{t('sprintSkippedNote')}</Muted>
                    ) : (
                      <YStack gap={4}>
                        <XStack
                          gap={8}
                          padding={8}
                          borderRadius={10}
                          backgroundColor={badColors.bg}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Text fontSize={12} fontWeight="800" color={badColors.ink}>
                            ✗ {t('sprintYourAnswerLabel')}:
                          </Text>
                          {m.submitted.trim() ? (
                            <MathText text={`$${m.submitted}$`} size={15} />
                          ) : (
                            <Muted size={13}>{t('sprintNoAnswer')}</Muted>
                          )}
                        </XStack>
                        {m.correct && (
                          <XStack
                            gap={8}
                            padding={8}
                            borderRadius={10}
                            backgroundColor={goodColors.bg}
                            alignItems="center"
                            flexWrap="wrap"
                          >
                            <Text fontSize={12} fontWeight="800" color={goodColors.ink}>
                              ✓ {t('sprintCorrectAnswerLabel')}:
                            </Text>
                            <MathText text={`$${m.correct}$`} size={15} />
                          </XStack>
                        )}
                      </YStack>
                    )}
                    {script ? (
                      <XStack>
                        <GhostButton
                          onPress={() => setAnimOpenId(animOpenId === m.problem.id ? null : m.problem.id)}
                        >
                          🎬 {t('animatedExample')}
                        </GhostButton>
                      </XStack>
                    ) : (
                      <Muted size={12}>{t('sprintReviewNoAnim')}</Muted>
                    )}
                    {animOpenId === m.problem.id && script && <AnimatedEquation script={script} />}
                  </YStack>
                );
              })
            )}
          </AppCard>
        </>
      )}

      {/* Live classmate leaderboard — always visible (start screen, mid-round,
          and results) so the race is on screen while everyone sprints. */}
      {leaderboard.data && (
        <SprintLeaderboardCard
          rows={leaderboard.data.rows}
          emptyHint={t('sprintLbJoinHint')}
        />
      )}
    </Screen>
  );
}
