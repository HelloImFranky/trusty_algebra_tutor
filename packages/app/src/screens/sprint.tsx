/** Daily Sprints: short timed fluency drills (design doc §4.4, "Sprints" folder). */
import { useEffect, useRef, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { client } from '../lib/trpc';
import { attemptOrQueue } from '../lib/offline';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/MathText';
import { AnimatedEquation } from '../components/stepanim/AnimatedEquation';
import { buildScriptForProblem } from '../components/stepanim/builders';
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
  nameEn: string;
  nameEs: string;
  problems: number;
}

/** One item in the post-round review: a problem the student got wrong or
 * never got to answer, paired with what they wrote and the correct target. */
interface MissRecord {
  problem: SprintProblem;
  submitted: string; // '' when skipped (time ran out before an answer)
  correct: string | null; // null when the attempt was queued offline
  skipped?: boolean;
}

type Difficulty = 'modified' | 'standard' | 'challenge';

const SPRINT_SECONDS = 90;

const DIFFICULTIES: { key: Difficulty; icon: string; label: 'sprintWarmup' | 'sprintStandard' | 'sprintChallenge' }[] = [
  { key: 'modified', icon: '🌱', label: 'sprintWarmup' },
  { key: 'standard', icon: '⚡', label: 'sprintStandard' },
  { key: 'challenge', icon: '🚀', label: 'sprintChallenge' },
];

/** Small selectable pill for the difficulty / topic pickers. */
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
      <Text color={selected ? '#ffffff' : tokens.ink} fontSize={13} fontWeight="700">
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
  useRequireAuth();
  const [problems, setProblems] = useState<SprintProblem[]>([]);
  const [index, setIndex] = useState(-1);
  const [answer, setAnswer] = useState('');
  const [seconds, setSeconds] = useState(SPRINT_SECONDS);
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [running, setRunning] = useState(false);
  const [misses, setMisses] = useState<MissRecord[]>([]);
  const [animOpenId, setAnimOpenId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [topics, setTopics] = useState<SprintTopic[]>([]);
  const [topicSlug, setTopicSlug] = useState<string | null>(null); // null = all topics
  // Grades still in flight — the completion report waits for them so the
  // recorded score can't miss a submit that raced the timer.
  const [inFlight, setInFlight] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  // Highest index for which submit() started grading — protects against the
  // timer expiring mid-await and double-counting that problem as both
  // "skipped" (by the time-out effect) and graded (by the returning submit).
  const submittingIndex = useRef<number>(-1);
  const reportedRound = useRef(false);

  useEffect(() => {
    client.practice.sprintTopics
      .query()
      .then((r) => setTopics(r.topics))
      .catch(() => {});
  }, []);

  const topicName = (s: SprintTopic) => (locale === 'es' ? s.nameEs : s.nameEn);

  const start = async (slugOverride?: string | null) => {
    const slug = slugOverride === undefined ? topicSlug : slugOverride;
    const r = await client.practice.sprint.query({
      count: 20,
      locale,
      difficulty,
      skillSlug: slug ?? undefined,
    });
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
    if (!topics.length) return void start(null);
    const pick = topics[Math.floor(Math.random() * topics.length)];
    setTopicSlug(pick.slug);
    void start(pick.slug);
  };

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer.current);
  }, [running]);

  // When the timer expires, everything the student never got to becomes a
  // "skipped" review row — that way the review reflects the whole round, not
  // just problems that happened to fit in the 90 seconds.
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
  // so the per-difficulty badge ladders on Progress can count it.
  useEffect(() => {
    if (running || index < 0 || inFlight > 0 || attempted === 0) return;
    if (reportedRound.current) return;
    reportedRound.current = true;
    client.practice.sprintComplete
      .mutate({ difficulty, skillSlug: topicSlug, total: attempted, correct: score })
      .catch(() => {});
  }, [running, index, inFlight, attempted, score, difficulty, topicSlug]);

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

  const selectedTopic = topics.find((s) => s.slug === topicSlug) ?? null;
  const difficultyDef = DIFFICULTIES.find((d) => d.key === difficulty)!;
  const roundLabel = `${difficultyDef.icon} ${t(difficultyDef.label)} · ${
    selectedTopic ? topicName(selectedTopic) : t('sprintAllTopics')
  }`;

  return (
    <Screen maxWidth={560}>
      <Title>⚡ {t('sprint')}</Title>
      {!running && index === -1 && (
        <AppCard gap={14}>
          <Text fontSize={16} color={tokens.ink} textAlign="center">90s · 20 ❓</Text>
          <YStack gap={6}>
            <Muted size={12}>{t('sprintDifficulty')}</Muted>
            <XStack gap={8} flexWrap="wrap">
              {DIFFICULTIES.map((d) => (
                <PickChip key={d.key} selected={difficulty === d.key} onPress={() => setDifficulty(d.key)}>
                  {d.icon} {t(d.label)}
                </PickChip>
              ))}
            </XStack>
          </YStack>
          {topics.length > 0 && (
            <YStack gap={6}>
              <Muted size={12}>{t('sprintTopicLabel')}</Muted>
              <XStack gap={8} flexWrap="wrap">
                <PickChip selected={topicSlug === null} onPress={() => setTopicSlug(null)}>
                  {t('sprintAllTopics')}
                </PickChip>
                {topics.map((s) => (
                  <PickChip key={s.slug} selected={topicSlug === s.slug} onPress={() => setTopicSlug(s.slug)}>
                    {topicName(s)}
                  </PickChip>
                ))}
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
              ⏱ {seconds}s
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
    </Screen>
  );
}
