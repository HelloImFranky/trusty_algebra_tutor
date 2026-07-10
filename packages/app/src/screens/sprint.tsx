/** Daily Sprints: short timed fluency drills (design doc §4.4, "Sprints" folder). */
import { useEffect, useRef, useState } from 'react';
import { Text, XStack } from 'tamagui';
import { client } from '../lib/trpc';
import { attemptOrQueue } from '../lib/offline';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/MathText';
import { AppCard, PrimaryButton, Screen, SubTitle, Title, COLORS } from '../components/ui';

interface SprintProblem {
  id: number;
  prompt: string;
}

const SPRINT_SECONDS = 90;

export function SprintScreen() {
  const { t, locale } = useI18n();
  useRequireAuth();
  const [problems, setProblems] = useState<SprintProblem[]>([]);
  const [index, setIndex] = useState(-1);
  const [answer, setAnswer] = useState('');
  const [seconds, setSeconds] = useState(SPRINT_SECONDS);
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const start = async () => {
    const r = await client.practice.sprint.query({ count: 20, locale });
    setProblems(r.problems);
    setIndex(0);
    setScore(0);
    setAttempted(0);
    setSeconds(SPRINT_SECONDS);
    setAnswer('');
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer.current);
  }, [running]);

  useEffect(() => {
    if (seconds <= 0 && running) {
      setRunning(false);
      clearInterval(timer.current);
    }
  }, [seconds, running]);

  const submit = async () => {
    if (!answer.trim() || !running) return;
    const p = problems[index];
    setAttempted((a) => a + 1);
    const res = await attemptOrQueue({
      problemId: p.id,
      submittedLatex: answer,
      context: 'sprint',
    });
    if (!res.queued && res.correct) setScore((s) => s + 1);
    setAnswer('');
    if (index + 1 < problems.length) setIndex((i) => i + 1);
    else setRunning(false);
  };

  return (
    <Screen maxWidth={560}>
      <Title>⚡ {t('sprint')}</Title>
      {!running && index === -1 && (
        <AppCard alignItems="center" gap={10}>
          <Text fontSize={16}>90s · 20 ❓</Text>
          <PrimaryButton onPress={start}>{t('sprintGo')}</PrimaryButton>
        </AppCard>
      )}
      {running && problems[index] && (
        <AppCard gap={10}>
          <Text fontWeight="900" fontSize={20} color={seconds <= 10 ? COLORS.bad : COLORS.warn}>
            ⏱ {seconds}s
          </Text>
          <XStack justifyContent="center">
            <MathText text={problems[index].prompt} size={19} />
          </XStack>
          <MathInput value={answer} onChange={setAnswer} onSubmit={submit} />
          <PrimaryButton onPress={submit}>{t('check')} ⏎</PrimaryButton>
        </AppCard>
      )}
      {!running && index >= 0 && (
        <AppCard alignItems="center" gap={8}>
          <SubTitle>{t('sprintDone')}</SubTitle>
          <Text fontSize={40} fontWeight="900">
            {score} / {attempted}
          </Text>
          <PrimaryButton onPress={start}>↻ {t('sprintGo')}</PrimaryButton>
        </AppCard>
      )}
    </Screen>
  );
}
