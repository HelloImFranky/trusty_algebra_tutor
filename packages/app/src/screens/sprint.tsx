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
import { AppCard, GhostButton, Muted, PrimaryButton, Screen, SubTitle, Title, useTokens, COLORS } from '../components/ui';

interface SprintProblem {
  id: number;
  prompt: string;
  params?: unknown;
  skillSlug?: string | null;
}

const SPRINT_SECONDS = 90;

export function SprintScreen() {
  const { t, locale } = useI18n();
  const tokens = useTokens();
  useRequireAuth();
  const [problems, setProblems] = useState<SprintProblem[]>([]);
  const [index, setIndex] = useState(-1);
  const [answer, setAnswer] = useState('');
  const [seconds, setSeconds] = useState(SPRINT_SECONDS);
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [running, setRunning] = useState(false);
  // Missed problems, for the post-round review (with animated walkthroughs).
  const [misses, setMisses] = useState<SprintProblem[]>([]);
  const [animOpenId, setAnimOpenId] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const start = async () => {
    const r = await client.practice.sprint.query({ count: 20, locale });
    setProblems(r.problems);
    setIndex(0);
    setScore(0);
    setAttempted(0);
    setMisses([]);
    setAnimOpenId(null);
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
    else if (!res.queued) setMisses((m) => [...m, p]); // wrong → offer it in review
    setAnswer('');
    if (index + 1 < problems.length) setIndex((i) => i + 1);
    else setRunning(false);
  };

  return (
    <Screen maxWidth={560}>
      <Title>⚡ {t('sprint')}</Title>
      {!running && index === -1 && (
        <AppCard alignItems="center" gap={10}>
          <Text fontSize={16} color={tokens.ink}>90s · 20 ❓</Text>
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
        <>
          <AppCard alignItems="center" gap={8}>
            <SubTitle>{t('sprintDone')}</SubTitle>
            <Text fontSize={40} fontWeight="900" color={tokens.ink}>
              {score} / {attempted}
            </Text>
            <PrimaryButton onPress={start}>↻ {t('sprintGo')}</PrimaryButton>
          </AppCard>

          {/* Review the misses — the right slot for a walkthrough, not the
              timed round itself. Free reinforcement, no hint cost. */}
          {misses.length > 0 && (
            <AppCard gap={12}>
              <SubTitle>{t('sprintReview')}</SubTitle>
              {misses.map((p) => {
                const script = buildScriptForProblem(p.skillSlug, p.params);
                return (
                  <YStack key={p.id} gap={8} borderTopWidth={1} borderTopColor={tokens.border} paddingTop={10}>
                    <MathText text={p.prompt} size={16} />
                    {script ? (
                      <XStack>
                        <GhostButton onPress={() => setAnimOpenId(animOpenId === p.id ? null : p.id)}>
                          🎬 {t('animatedExample')}
                        </GhostButton>
                      </XStack>
                    ) : (
                      <Muted size={12}>{t('sprintReviewNoAnim')}</Muted>
                    )}
                    {animOpenId === p.id && script && <AnimatedEquation script={script} />}
                  </YStack>
                );
              })}
            </AppCard>
          )}
        </>
      )}
    </Screen>
  );
}
