/**
 * Regents Review: a review-by-topic catalog of Regents-style multiple-choice
 * questions. Each topic holds four questions with four choices; the student
 * gets exactly one try per question (enforced server-side). Right answers get
 * a green check, wrong ones a red X plus a worked explanation, and either way
 * a Next button moves the session along. Progress feeds the Progress tab's
 * badges.
 */
import { useMemo, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { MathText } from '../components/MathText';
import {
  AppCard, Feedback, GhostButton, Loading, Muted, PrimaryButton, ProgressBar, Screen,
  SubTitle, Title, BRAND, COLORS,
} from '../components/ui';

const LETTERS = ['A', 'B', 'C', 'D'];

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
  const catalog = trpc.regents.catalog.useQuery({ locale });

  return (
    <Screen maxWidth={980}>
      <Title>📚 {t('review')}</Title>
      <Muted size={14}>
        {t('reviewIntro')} {t('oneTryHint')}
      </Muted>
      {catalog.error && <Feedback kind="bad">{catalog.error.message}</Feedback>}
      {catalog.isLoading && <Loading />}
      <XStack flexWrap="wrap" gap={12}>
        {catalog.data?.topics.map((topic) => {
          const done = topic.answered >= topic.total;
          const perfect = done && topic.correct === topic.total;
          return (
            <AppCard
              key={topic.slug}
              flexBasis={300}
              flexGrow={1}
              gap={8}
              cursor="pointer"
              hoverStyle={{ borderColor: BRAND }}
              pressStyle={{ backgroundColor: '#f3f5fd' }}
              onPress={() => onOpen(topic.slug)}
            >
              <XStack gap={10} alignItems="center">
                <Text fontSize={30}>{topic.icon}</Text>
                <YStack flexShrink={1}>
                  <Text fontSize={16} fontWeight="800">
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
                    backgroundColor={perfect ? COLORS.goodBg : '#eef1fd'}
                    borderRadius={999}
                    paddingHorizontal={10}
                    paddingVertical={3}
                    gap={4}
                    alignItems="center"
                  >
                    <Text fontSize={12} fontWeight="800" color={perfect ? COLORS.good : BRAND}>
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
                <Text fontSize={13} fontWeight="800" color={BRAND}>
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
}

/** One topic's quiz: question-by-question, single try each. */
function TopicQuiz({ slug, onExit }: { slug: string; onExit: () => void }) {
  const { t, locale } = useI18n();
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
          <Text fontSize={30} fontWeight="900" color={perfect ? COLORS.good : BRAND}>
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
      },
    }));
  };

  const next = () => {
    setSelected(null);
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

      <AppCard gap={14}>
        <XStack justifyContent="space-between" alignItems="center">
          <Muted>
            {t('question')} {index + 1} {t('of')} {questions.length}
            {servedRound > 0 ? ` · 🔄 ${t('roundLabel')} ${servedRound + 1}` : ''}
          </Muted>
          {!answered && <Muted>{t('oneTryHint')}</Muted>}
        </XStack>
        <MathText text={q.prompt} size={17} />

        <YStack gap={8}>
          {q.choices.map((choice, i) => {
            const isPick = answered ? answered.choiceIndex === i : selected === i;
            const isRight = answered ? answered.correctIndex === i : false;
            const showWrongPick = answered && isPick && !isRight;
            const borderColor = isRight && answered ? COLORS.good : showWrongPick ? COLORS.bad : isPick ? BRAND : COLORS.border;
            const backgroundColor = isRight && answered ? COLORS.goodBg : showWrongPick ? COLORS.badBg : isPick ? '#eef1fd' : '#ffffff';
            return (
              <XStack
                key={i}
                gap={10}
                alignItems="center"
                padding={12}
                borderRadius={12}
                borderWidth={2}
                borderColor={borderColor}
                backgroundColor={backgroundColor}
                cursor={answered ? 'default' : 'pointer'}
                hoverStyle={answered ? undefined : { borderColor: BRAND }}
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
                  backgroundColor={isRight && answered ? COLORS.good : showWrongPick ? COLORS.bad : isPick ? BRAND : '#eef1f5'}
                >
                  <Text fontWeight="900" fontSize={14} color={isPick || (isRight && answered) ? 'white' : COLORS.muted}>
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
              <Text fontSize={17} fontWeight="800" color={answered.correct ? COLORS.good : COLORS.bad}>
                {answered.correct ? t('correct') : t('notQuite')}
              </Text>
            </XStack>
            {!answered.correct && (
              <YStack
                backgroundColor={COLORS.badBg}
                borderLeftWidth={4}
                borderLeftColor={COLORS.bad}
                borderRadius={10}
                padding={12}
                gap={6}
              >
                <Text fontSize={13} fontWeight="800" color={COLORS.bad}>
                  💡 {t('howToSolve')}
                </Text>
                <MathText text={answered.explanation} size={14.5} />
              </YStack>
            )}
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
