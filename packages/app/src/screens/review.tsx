/** Regents review mode (design doc §4.5): mixed-unit problems from seen skills. */
import { useEffect, useState } from 'react';
import { XStack } from 'tamagui';
import { client } from '../lib/trpc';
import { attemptOrQueue } from '../lib/offline';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/MathText';
import { AppCard, Feedback, Loading, Muted, PrimaryButton, Screen, SubTitle, Title } from '../components/ui';

interface Problem {
  id: number;
  prompt: string;
}

export function ReviewScreen() {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (!authed) return;
    client.practice.reviewSession
      .query({ locale })
      .then((r) => {
        setProblems(r.problems);
        if (!r.problems.length) setEmpty(true);
      })
      .catch(() => setEmpty(true));
  }, [authed, locale]);

  const submit = async () => {
    if (!answer.trim()) return;
    const p = problems[index];
    const res = await attemptOrQueue({
      problemId: p.id,
      submittedLatex: answer,
      context: 'review',
    });
    const correct = !res.queued && res.correct;
    if (correct) setScore((s) => s + 1);
    setFeedback(correct ? 'good' : 'bad');
    setTimeout(() => {
      setFeedback('');
      setAnswer('');
      if (index + 1 < problems.length) setIndex((i) => i + 1);
      else setDone(true);
    }, 900);
  };

  if (empty) {
    return (
      <Screen>
        <Title>📚 {t('review')}</Title>
        <AppCard>
          <Muted size={15}>{t('reviewEmpty')}</Muted>
        </AppCard>
      </Screen>
    );
  }
  if (!problems.length) return <Loading />;

  return (
    <Screen maxWidth={640}>
      <Title>📚 {t('review')}</Title>
      {!done ? (
        <AppCard gap={10}>
          <Muted>
            {index + 1} / {problems.length}
          </Muted>
          <MathText text={problems[index].prompt} size={18} />
          <MathInput value={answer} onChange={setAnswer} onSubmit={submit} />
          {feedback === 'good' && <Feedback kind="good">{t('correct')}</Feedback>}
          {feedback === 'bad' && <Feedback kind="bad">{t('incorrect')}</Feedback>}
          <XStack>
            <PrimaryButton onPress={submit}>{t('check')}</PrimaryButton>
          </XStack>
        </AppCard>
      ) : (
        <AppCard alignItems="center">
          <SubTitle>
            {t('score')}: {score} / {problems.length}
          </SubTitle>
        </AppCard>
      )}
    </Screen>
  );
}
