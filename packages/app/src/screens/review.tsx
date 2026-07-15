/**
 * Regents Review: a review-by-topic catalog of Regents-style multiple-choice
 * questions. Each topic serves rounds of ten questions with four choices; the student
 * gets exactly one try per question (enforced server-side). Right answers get
 * a green check, wrong ones a red X plus a worked explanation, and either way
 * a Next button moves the session along. Progress feeds the Progress tab's
 * badges.
 */
import { useMemo, useState } from 'react';
import { Library } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { MathText } from '../components/MathText';
import { AnimatedEquation } from '../components/stepanim/AnimatedEquation';
import { buildScriptForProblem } from '../components/stepanim/builders';
import {
  AppCard, Feedback, GhostButton, HeroCard, Loading, Muted, PrimaryButton, ProgressBar, Screen,
  SubTitle, Title, useAccent, useFeedbackColors, useTokens, COLORS,
} from '../components/ui';

const LETTERS = ['A', 'B', 'C', 'D'];

interface AnimRef {
  skillSlug: string;
  params: unknown;
}

export function ReviewScreen() {
  const authed = useRequireAuth();
  const [slug, setSlug] = useState<string | null>(null);
  if (!authed) return <Loading />;
  return slug ? (
    <TopicQuiz slug={slug} onExit={() => setSlug(null)} />
  ) : (
    <TopicCatalog onOpen={setSlug} />
  );
}

/** Landing page: the review-by-topic catalog. */
function TopicCatalog({ onOpen }: { onOpen: (slug: string) => void }) {
  const { t, locale } = useI18n();
  const accent = useAccent();
  const tokens = useTokens();
  const catalog = trpc.regents.catalog.useQuery({ locale });

  const topics = catalog.data?.topics ?? [];
  const answered = topics.reduce((sum, tp) => sum + tp.answered, 0);
  const correct = topics.reduce((sum, tp) => sum + tp.correct, 0);
  const readiness = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const weakest = [...topics]
    .filter((tp) => tp.answered > 0)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)[0];

  return (
    <Screen maxWidth={980}>
      <XStack alignItems="center" gap={8}>
        <Library size={20} color={tokens.ink} />
        <Title>{t('review')}</Title>
      </XStack>
      <Muted size={14}>
        {t('reviewIntro')} {t('oneTryHint')}
      </Muted>
      {catalog.error && <Feedback kind="bad">{catalog.error.message}</Feedback>}
      {catalog.isLoading && <Loading />}

      {answered > 0 && (
        <HeroCard>
          <Text color="#ff9783" fontSize={10} fontWeight="800" textTransform="uppercase" letterSpacing={0.8}>
            {t('examReadiness')}
          </Text>
          <XStack alignItems="baseline" gap={6}>
            <Text color={tokens.posterInk} fontSize={30} fontWeight="800">
              {readiness}%
            </Text>
            {/* Secondary caption uses a low-contrast neutral so it reads as
                a subtitle on the poster in either mode. */}
            <Text color={tokens.mode === 'dark' ? '#9b9797' : '#bab6b6'} fontSize={12}>
              {t('questionsAnsweredLabel')}
            </Text>
          </XStack>
          <XStack height={8} backgroundColor={tokens.mode === 'dark' ? '#4a4646' : '#444141'} borderRadius={999} overflow="hidden">
            <XStack width={`${readiness}%`} height="100%" backgroundColor={accent} borderRadius={999} />
          </XStack>
        </HeroCard>
      )}
      {weakest && (
        <PrimaryButton justifyContent="center" onPress={() => onOpen(weakest.slug)}>
          {t('startReviewSet')}
        </PrimaryButton>
      )}

      <XStack flexWrap="wrap" gap={12}>
        {topics.map((topic) => {
          const done = topic.answered >= topic.total;
          const perfect = done && topic.correct === topic.total;
          return (
            <AppCard
              key={topic.slug}
              flexBasis={300}
              flexGrow={1}
              gap={8}
              cursor="pointer"
              pressStyle={{ opacity: 0.85 }}
              onPress={() => onOpen(topic.slug)}
            >
              <XStack gap={10} alignItems="center">
                {/* topic.icon is the same emoji Progress uses for the
                    Regents-review stat row — keep the visual consistent
                    across surfaces so students recognise a topic at a
                    glance from either page. */}
                <Text fontSize={22}>{topic.icon}</Text>
                <YStack flexShrink={1}>
                  <Text fontSize={16} fontWeight="800" color={tokens.ink}>
                    {topic.title}
                  </Text>
                  <Muted>{topic.blurb}</Muted>
                </YStack>
              </XStack>
              <XStack gap={10} alignItems="center">
                <ProgressBar ratio={topic.answered / topic.total} />
                {topic.extraRounds > 0 && <Muted size={12}>🔄 ×{topic.extraRounds}</Muted>}
                {done ? (
                  <XStack
                    backgroundColor={perfect ? COLORS.goodBg : tokens.subtle}
                    borderRadius={999}
                    paddingHorizontal={10}
                    paddingVertical={3}
                    gap={4}
                    alignItems="center"
                  >
                    <Text fontSize={12} fontWeight="800" color={perfect ? COLORS.good : accent}>
                      {perfect ? '🌟' : '✓'} {topic.correct}/{topic.total}
                    </Text>
                  </XStack>
                ) : (
                  <Muted>
                    {topic.answered}/{topic.total}
                  </Muted>
                )}
              </XStack>
              <XStack>
                <Text fontSize={13} fontWeight="800" color={accent}>
                  {done ? t('completeLabel') : topic.answered > 0 ? `${t('resumeTopic')} →` : `${t('startTopic')} →`}
                </Text>
              </XStack>
            </AppCard>
          );
        })}
      </XStack>
    </Screen>
  );
}

interface AnsweredState {
  choiceIndex: number;
  correct: boolean;
  correctIndex: number;
  explanation: string;
  anim: AnimRef | null;
}

/** One topic's quiz: question-by-question, single try each. */
function TopicQuiz({ slug, onExit }: { slug: string; onExit: () => void }) {
  const { t, locale } = useI18n();
  const accent = useAccent();
  const tokens = useTokens();
  const goodBg = useFeedbackColors('good');
  const badBg = useFeedbackColors('bad');
  const utils = trpc.useUtils();
  // undefined = let the server pick the student's latest round; renewing a
  // finished round requests the next one, which is generated on the fly.
  const [round, setRound] = useState<number | undefined>(undefined);
  const topic = trpc.regents.topic.useQuery({ slug, locale, round });
  const answerMut = trpc.regents.answer.useMutation({
    onSuccess: () => {
      // Keep the catalog, the topic snapshot, and the badge case in sync.
      void utils.regents.catalog.invalidate();
      void utils.regents.topic.invalidate();
      void utils.progress.me.invalidate();
    },
  });

  const [selected, setSelected] = useState<number | null>(null);
  // Answers revealed during THIS visit (question id -> graded result); the
  // server fills in questions answered on earlier visits.
  const [session, setSession] = useState<Record<string, AnsweredState>>({});
  const [cursor, setCursor] = useState<number | null>(null);
  const [summary, setSummary] = useState(false);
  // Which answered question currently has its worked animation open.
  const [animOpen, setAnimOpen] = useState<string | null>(null);

  const questions = topic.data?.questions;
  const answerFor = (q: NonNullable<typeof questions>[number]): AnsweredState | null =>
    session[q.id] ?? q.answered;

  // Resume at the first unanswered question (or the summary when none left).
  const firstOpen = useMemo(() => {
    if (!questions) return null;
    const i = questions.findIndex((q) => !q.answered);
    return i === -1 ? questions.length : i;
  }, [questions]);

  if (topic.error) {
    return (
      <Screen maxWidth={720}>
        <Feedback kind="bad">{topic.error.message}</Feedback>
        <XStack>
          <GhostButton onPress={onExit}>{t('backToTopics')}</GhostButton>
        </XStack>
      </Screen>
    );
  }
  if (!topic.data || !questions || firstOpen === null) return <Loading />;

  const index = cursor ?? firstOpen;
  const servedRound = topic.data.round;

  // A fresh set of generated problems for this topic: reset the local quiz
  // state and ask the server for the next round.
  const renew = () => {
    setSession({});
    setCursor(null);
    setSelected(null);
    setSummary(false);
    setRound(servedRound + 1);
  };

  if (summary || index >= questions.length) {
    const score = questions.reduce((n, q) => n + (answerFor(q)?.correct ? 1 : 0), 0);
    const perfect = score === questions.length;
    return (
      <Screen maxWidth={720}>
        <Title>
          {topic.data.icon} {topic.data.title}
        </Title>
        <AppCard alignItems="center" gap={10} paddingVertical={30}>
          <Text fontSize={54}>{perfect ? '🏆' : score >= questions.length / 2 ? '🎉' : '💪'}</Text>
          <SubTitle>{perfect ? `${t('perfectTopic')} 🌟` : t('topicComplete')}</SubTitle>
          {servedRound > 0 && (
            <Muted>
              🔄 {t('roundLabel')} {servedRound + 1}
            </Muted>
          )}
          <Text fontSize={30} fontWeight="900" color={perfect ? COLORS.good : accent}>
            {score} / {questions.length}
          </Text>
          <XStack gap={8} marginTop={6}>
            {questions.map((q) => {
              const a = answerFor(q);
              return (
                <Text key={q.id} fontSize={22}>
                  {a?.correct ? '✅' : '❌'}
                </Text>
              );
            })}
          </XStack>
          <PrimaryButton marginTop={10} onPress={renew}>
            🔄 {t('practiceAgain')}
          </PrimaryButton>
          <Muted size={12}>{t('newProblemsHint')}</Muted>
          <GhostButton onPress={onExit}>{t('backToTopics')}</GhostButton>
        </AppCard>
      </Screen>
    );
  }

  const q = questions[index];
  const answered = answerFor(q);
  // A worked animation of this exact question, when a builder understands it
  // (params only arrive after the attempt, so this is null until answered).
  const animScript = answered?.anim
    ? buildScriptForProblem(answered.anim.skillSlug, answered.anim.params)
    : null;

  const submit = async () => {
    if (selected === null || answered || answerMut.isPending) return;
    // Pin the view on this question: the background refetch marks it
    // answered, which would otherwise advance `firstOpen` mid-feedback.
    setCursor(index);
    const res = await answerMut.mutateAsync({ questionId: q.id, choiceIndex: selected, locale });
    setSession((s) => ({
      ...s,
      [q.id]: {
        choiceIndex: res.choiceIndex,
        correct: res.correct,
        correctIndex: res.correctIndex,
        explanation: res.explanation,
        anim: res.anim ?? null,
      },
    }));
  };

  const next = () => {
    setSelected(null);
    setAnimOpen(null);
    if (index + 1 >= questions.length) setSummary(true);
    else setCursor(index + 1);
  };

  return (
    <Screen maxWidth={720}>
      <XStack justifyContent="space-between" alignItems="center">
        <Title>
          {topic.data.icon} {topic.data.title}
        </Title>
        <GhostButton size="$2" onPress={onExit}>
          ← {t('backToTopics')}
        </GhostButton>
      </XStack>

      {/* Question meta lives above the answer card so the card itself is
          just the prompt + choices + submit. Two aligned columns: left
          shows question number and round, right shows the "one try" tip
          (only while the question is unanswered). paddingHorizontal
          matches the card's padding so the columns line up with the
          card's inner edges. */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal={16}
      >
        <Muted>
          {t('question')} {index + 1} {t('of')} {questions.length}
          {servedRound > 0 ? ` · 🔄 ${t('roundLabel')} ${servedRound + 1}` : ''}
        </Muted>
        {!answered && <Muted>{t('oneTryHint')}</Muted>}
      </XStack>

      <AppCard gap={14} borderRadius={22}>
        <MathText text={q.prompt} size={17} />

        <YStack gap={8}>
          {q.choices.map((choice, i) => {
            const isPick = answered ? answered.choiceIndex === i : selected === i;
            const isRight = answered ? answered.correctIndex === i : false;
            const showWrongPick = answered && isPick && !isRight;
            // Border stays saturated (COLORS.good / COLORS.bad) in both
            // modes — a bright ring reads correctly on the deep-color bg in
            // dark mode. Only the bg shifts to the mode-correct deep tone
            // so the MathText inside (which follows tokens.ink) has real
            // contrast.
            const borderColor = isRight && answered ? COLORS.good : showWrongPick ? COLORS.bad : isPick ? accent : tokens.border;
            const backgroundColor = isRight && answered ? goodBg.bg : showWrongPick ? badBg.bg : isPick ? tokens.subtle : tokens.surface;
            return (
              <XStack
                key={i}
                gap={10}
                alignItems="center"
                padding={12}
                borderRadius={14}
                borderWidth={2}
                borderColor={borderColor}
                backgroundColor={backgroundColor}
                cursor={answered ? 'default' : 'pointer'}
                pressStyle={answered ? undefined : { opacity: 0.85 }}
                onPress={() => {
                  if (!answered && !answerMut.isPending) setSelected(i);
                }}
              >
                <XStack
                  width={28}
                  height={28}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={isRight && answered ? COLORS.good : showWrongPick ? COLORS.bad : isPick ? accent : tokens.subtle}
                >
                  <Text fontWeight="900" fontSize={14} color={isPick || (isRight && answered) ? 'white' : tokens.muted}>
                    {answered ? (isRight ? '✓' : showWrongPick ? '✗' : LETTERS[i]) : LETTERS[i]}
                  </Text>
                </XStack>
                <YStack flexShrink={1}>
                  <MathText text={choice} size={15} />
                </YStack>
              </XStack>
            );
          })}
        </YStack>

        {answered && (
          <YStack gap={10}>
            <XStack gap={10} alignItems="center">
              <XStack
                width={40}
                height={40}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                backgroundColor={answered.correct ? COLORS.good : COLORS.bad}
              >
                <Text color="white" fontSize={22} fontWeight="900">
                  {answered.correct ? '✓' : '✗'}
                </Text>
              </XStack>
              <Text fontSize={17} fontWeight="800" color={answered.correct ? goodBg.ink : badBg.ink}>
                {answered.correct ? t('correct') : t('notQuite')}
              </Text>
            </XStack>
            {!answered.correct && (
              <YStack
                backgroundColor={badBg.bg}
                borderLeftWidth={4}
                borderLeftColor={COLORS.bad}
                borderRadius={14}
                padding={12}
                gap={6}
              >
                <Text fontSize={13} fontWeight="800" color={badBg.ink}>
                  💡 {t('howToSolve')}
                </Text>
                <MathText text={answered.explanation} size={14.5} />
              </YStack>
            )}
            {animScript && (
              <XStack>
                <GhostButton onPress={() => setAnimOpen(animOpen === q.id ? null : q.id)}>
                  🎬 {t('animatedExample')}
                </GhostButton>
              </XStack>
            )}
            {animOpen === q.id && animScript && <AnimatedEquation script={animScript} />}
          </YStack>
        )}

        <XStack justifyContent="flex-end">
          {answered ? (
            <PrimaryButton onPress={next}>{t('next')} →</PrimaryButton>
          ) : (
            <PrimaryButton disabled={selected === null || answerMut.isPending} opacity={selected === null ? 0.5 : 1} onPress={submit}>
              {t('submit')}
            </PrimaryButton>
          )}
        </XStack>
      </AppCard>
    </Screen>
  );
}
