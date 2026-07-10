/**
 * Guided problem solving — the tutor loop (design doc §4.2).
 *
 * 1. Student attempts a structured-math answer.
 * 2. Wrong answer → the app walks the scaffold, one checkable step at a time.
 * 3. Hints escalate: nudge → mnemonic/step hint → show the step worked → LLM
 *    tutor chat as the final escalation (deterministic ladder first, §6).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'solito/link';
import { Text, XStack } from 'tamagui';
import { client } from '../lib/trpc';
import { attemptOrQueue } from '../lib/offline';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/MathText';
import { TutorChat } from '../components/TutorChat';
import {
  AppCard, Badge, Feedback, GhostButton, Loading, Muted, PrimaryButton, Screen,
  SecondaryButton, BRAND,
} from '../components/ui';

interface ProblemStep {
  position: number;
  prompt: string;
  hint: string | null;
}

interface Problem {
  id: number;
  skillId: number;
  tier: string;
  prompt: string;
  gradingMode: string;
  steps: ProblemStep[];
}

type Phase = 'answer' | 'steps' | 'done';

export function PracticeScreen({ skillId, lessonId }: { skillId: number; lessonId?: number }) {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [tier, setTier] = useState('standard');
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'' | 'good' | 'bad' | 'warn' | 'queued'>('');
  const [message, setMessage] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintText, setHintText] = useState('');
  const [phase, setPhase] = useState<Phase>('answer');
  const [stepIndex, setStepIndex] = useState(0);
  const [stepAnswer, setStepAnswer] = useState('');
  const [stepFeedback, setStepFeedback] = useState('');
  const [showTutor, setShowTutor] = useState(false);
  const [solved, setSolved] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());

  const loadNext = useCallback(async () => {
    setAnswer('');
    setFeedback('');
    setMessage('');
    setHintsUsed(0);
    setHintText('');
    setPhase('answer');
    setStepIndex(0);
    setStepAnswer('');
    setStepFeedback('');
    setShowTutor(false);
    setStartedAt(Date.now());
    try {
      const r = await client.practice.next.query({ skillId, locale });
      setProblem(r.problem);
      setTier(r.tier);
    } catch {
      setProblem(null);
    }
  }, [skillId, locale]);

  useEffect(() => {
    if (authed) void loadNext();
  }, [authed, loadNext]);

  if (!problem) return <Loading />;

  const submit = async () => {
    if (!answer.trim()) return;
    const res = await attemptOrQueue({
      problemId: problem.id,
      submittedLatex: answer,
      hintsUsed,
      stepReached: stepIndex,
      durationMs: Date.now() - startedAt,
      locale,
    });
    if (res.queued) {
      setFeedback('queued');
      return;
    }
    if (res.correct) {
      setFeedback('good');
      setPhase('done');
      setSolved((s) => s + 1);
    } else if (res.equivalentButNotCanonical) {
      setFeedback('warn');
      setMessage(res.message ?? '');
    } else {
      setFeedback('bad');
      setMessage('');
    }
  };

  /** Escalating hint ladder (§4.2): nudge → step hint → guided steps → tutor. */
  const nudge = () => {
    setHintsUsed((h) => h + 1);
    if (hintsUsed === 0) {
      setHintText(
        problem.steps[0]?.hint ??
          problem.steps[0]?.prompt ??
          (locale === 'es' ? 'Repasa los pasos de la lección.' : 'Look back at the lesson steps.'),
      );
    } else if (problem.steps.length > 0) {
      setPhase('steps');
      setHintText('');
    } else {
      setShowTutor(true);
    }
  };

  const checkStep = async () => {
    if (!stepAnswer.trim()) return;
    const step = problem.steps[stepIndex];
    const res = await client.practice.checkStep.mutate({
      problemId: problem.id,
      position: step.position,
      submittedLatex: stepAnswer,
      locale,
    });
    if (res.correct) {
      setStepFeedback('good');
      setTimeout(() => {
        setStepFeedback('');
        setStepAnswer('');
        if (stepIndex + 1 < problem.steps.length) {
          setStepIndex((i) => i + 1);
        } else {
          // walked every step — return to the final answer
          setPhase('answer');
          setFeedback('');
          setHintsUsed((h) => h + 1);
        }
      }, 700);
    } else {
      setStepFeedback(res.hint ?? 'bad');
      setHintsUsed((h) => h + 1);
    }
  };

  const step = problem.steps[stepIndex];

  return (
    <Screen>
      <XStack justifyContent="space-between" alignItems="center">
        <Link href={lessonId ? `/lesson/${lessonId}` : '/'}>
          <Text color={BRAND} fontWeight="700">
            ← {lessonId ? t('lesson') : t('curriculum')}
          </Text>
        </Link>
        <XStack gap={8} alignItems="center">
          <Muted>
            {solved} {t('problemsSolved')}
          </Muted>
          <Badge label={tier} />
        </XStack>
      </XStack>

      <AppCard gap={10}>
        <MathText text={problem.prompt} size={18} />

        {phase !== 'steps' && (
          <>
            <MathInput value={answer} onChange={setAnswer} onSubmit={submit} disabled={phase === 'done'} />
            {feedback === 'good' && <Feedback kind="good">{t('correct')}</Feedback>}
            {feedback === 'bad' && <Feedback kind="bad">{t('incorrect')}</Feedback>}
            {feedback === 'warn' && <Feedback kind="warn">{message || t('almostCanonical')}</Feedback>}
            {feedback === 'queued' && <Feedback kind="warn">{t('offlineQueued')}</Feedback>}
            {hintText ? (
              <Feedback kind="warn">
                💡 <MathText text={hintText} size={14} />
              </Feedback>
            ) : null}
            <XStack gap={8} flexWrap="wrap" marginTop={4}>
              {phase === 'answer' && (
                <>
                  <PrimaryButton onPress={submit}>{t('check')}</PrimaryButton>
                  <SecondaryButton onPress={nudge}>💡 {t('hint')}</SecondaryButton>
                  {problem.steps.length > 0 && (
                    <GhostButton
                      onPress={() => {
                        setPhase('steps');
                        setHintsUsed((h) => h + 1);
                      }}
                    >
                      🪜 {t('showStep')}
                    </GhostButton>
                  )}
                  <GhostButton onPress={() => setShowTutor((s) => !s)}>🤖 {t('askTutor')}</GhostButton>
                </>
              )}
              {phase === 'done' && <PrimaryButton onPress={loadNext}>{t('next')} →</PrimaryButton>}
            </XStack>
          </>
        )}

        {phase === 'steps' && step && (
          <>
            <Muted>
              {t('step')} {stepIndex + 1} {t('of')} {problem.steps.length}
            </Muted>
            <MathText text={step.prompt} />
            <MathInput value={stepAnswer} onChange={setStepAnswer} onSubmit={checkStep} />
            {stepFeedback === 'good' && <Feedback kind="good">{t('correct')}</Feedback>}
            {stepFeedback && stepFeedback !== 'good' && (
              <Feedback kind="warn">
                {stepFeedback === 'bad' ? t('incorrect') : <>💡 <MathText text={stepFeedback} size={14} /></>}
              </Feedback>
            )}
            <XStack gap={8} marginTop={4}>
              <PrimaryButton onPress={checkStep}>{t('check')}</PrimaryButton>
              <GhostButton onPress={() => setShowTutor((s) => !s)}>🤖 {t('askTutor')}</GhostButton>
            </XStack>
          </>
        )}
      </AppCard>

      {showTutor && (
        <TutorChat problemId={problem.id} stepReached={phase === 'steps' ? stepIndex : undefined} />
      )}
    </Screen>
  );
}
