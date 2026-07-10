/** Auto-graded exit ticket at the end of every lesson (design doc §4.3). */
import { useState } from 'react';
import { Link } from 'solito/link';
import { Text, XStack, YStack } from 'tamagui';
import { trpc, client } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/MathText';
import { Katex } from '../components/Katex';
import {
  AppCard, Feedback, Loading, PrimaryButton, ProgressBar, Screen, SecondaryButton,
  SubTitle, Title, BRAND,
} from '../components/ui';

interface Result {
  score: number;
  maxScore: number;
  results: { problemId: number; correct: boolean; correctAnswer: string }[];
}

export function ExitTicketScreen({ lessonId }: { lessonId: number }) {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const ticket = trpc.curriculum.exitTicket.useQuery(
    { lessonId, locale },
    { enabled: authed && !!lessonId },
  );
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [startedAt] = useState(Date.now());

  if (!ticket.data) return <Loading />;
  const tk = ticket.data;

  const submit = async () => {
    const res = await client.curriculum.submitExitTicket.mutate({
      exitTicketId: tk.id,
      answers: tk.problems.map((p) => ({
        problemId: p.id,
        submittedLatex: answers[p.id] ?? '',
      })),
      durationMs: Date.now() - startedAt,
    });
    setResult(res);
  };

  const resultFor = (pid: number) => result?.results.find((r) => r.problemId === pid);

  return (
    <Screen>
      <Link href={`/lesson/${tk.lessonId}`}>
        <Text color={BRAND} fontWeight="700">← {t('lesson')}</Text>
      </Link>
      <Title>🎟️ {t('exitTicket')}</Title>
      {tk.problems.map((p, i) => {
        const r = resultFor(p.id);
        return (
          <AppCard key={p.id} gap={8}>
            <XStack gap={6}>
              <Text fontWeight="800">{i + 1}.</Text>
              <MathText text={p.prompt} />
            </XStack>
            <MathInput
              value={answers[p.id] ?? ''}
              onChange={(v) => setAnswers((a) => ({ ...a, [p.id]: v }))}
              disabled={!!result}
            />
            {r && (
              <Feedback kind={r.correct ? 'good' : 'bad'}>
                {r.correct ? (
                  t('correct')
                ) : (
                  <>
                    {t('incorrect')} — <Katex tex={r.correctAnswer} />
                  </>
                )}
              </Feedback>
            )}
          </AppCard>
        );
      })}
      {!result ? (
        <PrimaryButton onPress={submit}>{t('submit')}</PrimaryButton>
      ) : (
        <AppCard gap={10}>
          <SubTitle>
            {t('score')}: {result.score} / {result.maxScore}
          </SubTitle>
          <XStack>
            <ProgressBar ratio={result.score / Math.max(1, result.maxScore)} />
          </XStack>
          <Link href="/">
            <SecondaryButton>{t('curriculum')}</SecondaryButton>
          </Link>
        </AppCard>
      )}
    </Screen>
  );
}
