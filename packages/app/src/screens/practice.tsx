/**
 * Guided problem solving — the tutor loop (design doc §4.2).
 *
 * 1. Student attempts a structured-math answer.
 * 2. Wrong answer → the app walks the scaffold, one checkable step at a time.
 * 3. Hints escalate: nudge → mnemonic/step hint → show the step worked → LLM
 *    tutor chat as the final escalation (deterministic ladder first, §6).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'solito/link';
import {
  ArrowLeft,
  Check,
  Film,
  Footprints,
  Lightbulb,
  Lock,
  MessageCircle,
  X,
} from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { client } from '../lib/trpc';
import { attemptOrQueue } from '../lib/offline';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { Mascot } from '../components/Mascot';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/MathText';
import { AnimatedEquation } from '../components/stepanim/AnimatedEquation';
import { buildScriptForProblem } from '../components/stepanim/builders';
import { TutorChat } from '../components/TutorChat';
import {
  AppCard, Badge, COLORS, Feedback, GhostButton, HINT, INK, Loading, Muted, NEUTRAL, PrimaryButton, Screen,
  SecondaryButton, useAccent,
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
  params?: unknown;
  skillSlug?: string | null;
  steps: ProblemStep[];
}

type Phase = 'answer' | 'steps' | 'done';

export function PracticeScreen({ skillId, lessonId }: { skillId: number; lessonId?: number }) {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const accent = useAccent();

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
  const [showAnim, setShowAnim] = useState(false);
  const [animStart, setAnimStart] = useState(0);
  const [animViews, setAnimViews] = useState(0);
  const [solved, setSolved] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());

  // Animated walkthrough of this exact problem, when a builder understands it.
  const animScript = useMemo(
    () => (problem ? buildScriptForProblem(problem.skillSlug, problem.params) : null),
    [problem],
  );

  const openAnim = (atStep = 0) => {
    setAnimStart(atStep);
    setShowAnim(true);
    setHintsUsed((h) => h + 1); // watching the solve counts as a hint
    setAnimViews((v) => v + 1); // tracked separately for the analytics column
  };

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
    setShowAnim(false);
    setAnimStart(0);
    setAnimViews(0);
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
      animViews,
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
      // targeted misconception feedback when the server recognized the error
      setMessage(res.message ?? '');
      // flip mistakes get the animation opened right on the flip step —
      // the moment the error happened
      if (animScript && res.misconceptionId?.includes('flip')) {
        const flipStep = animScript.steps.findIndex((s) =>
          s.tokens.some((tk) => tk.emph === 'flip'),
        );
        openAnim(Math.max(0, flipStep));
      }
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
          <XStack alignItems="center" gap={6}>
            <ArrowLeft size={17} color={INK} />
            <Text color={INK} fontWeight="800" fontSize={14}>
              {lessonId ? t('lesson') : t('curriculum')}
            </Text>
          </XStack>
        </Link>
        <XStack gap={8} alignItems="center">
          <Muted>
            {solved} {t('problemsSolved')}
          </Muted>
          <Badge label={tier} />
        </XStack>
      </XStack>

      {phase === 'steps' && (
        <XStack gap={5}>
          {problem.steps.map((s, i) => (
            <XStack
              key={s.position}
              flex={1}
              height={6}
              borderRadius={999}
              backgroundColor={i < stepIndex ? INK : i === stepIndex ? accent : NEUTRAL[300]}
            />
          ))}
        </XStack>
      )}

      {phase !== 'steps' && (
        <AppCard gap={10} borderRadius={22}>
          <Text fontSize={10} fontWeight="800" textTransform="uppercase" letterSpacing={0.8} color={accent}>
            {t('yourAnswer')}
          </Text>
          <MathText text={problem.prompt} size={18} />
          <MathInput value={answer} onChange={setAnswer} onSubmit={submit} disabled={phase === 'done'} />
          {feedback === 'good' && <Feedback kind="good">{t('correct')}</Feedback>}
          {feedback === 'bad' && (
            <Feedback kind="bad" icon={<X size={15} color={COLORS.bad} />}>
              {message ? <MathText text={message} size={14} /> : t('incorrect')}
            </Feedback>
          )}
          {feedback === 'warn' && <Feedback kind="warn">{message || t('almostCanonical')}</Feedback>}
          {feedback === 'queued' && <Feedback kind="warn">{t('offlineQueued')}</Feedback>}
          {hintText ? (
            <Feedback kind="hint" icon={<Lightbulb size={14} color={HINT.fg} />}>
              <MathText text={hintText} size={14} />
            </Feedback>
          ) : null}
          <XStack gap={8} flexWrap="wrap" marginTop={4}>
            {phase === 'answer' && (
              <>
                <PrimaryButton onPress={submit}>{t('check')}</PrimaryButton>
                <SecondaryButton icon={<Lightbulb size={15} />} onPress={nudge}>
                  {t('hint')}
                </SecondaryButton>
                {feedback === 'bad' && animScript && !showAnim && (
                  <GhostButton icon={<Film size={15} />} onPress={() => openAnim(0)}>
                    {t('animatedExample')}
                  </GhostButton>
                )}
                {problem.steps.length > 0 && (
                  <GhostButton
                    icon={<Footprints size={15} />}
                    onPress={() => {
                      setPhase('steps');
                      setHintsUsed((h) => h + 1);
                    }}
                  >
                    {t('showStep')}
                  </GhostButton>
                )}
                <GhostButton icon={<MessageCircle size={15} />} onPress={() => setShowTutor((s) => !s)}>
                  {t('askTutor')}
                </GhostButton>
              </>
            )}
            {phase === 'done' && (
              <>
                <PrimaryButton onPress={loadNext}>{t('next')} →</PrimaryButton>
                {animScript && (
                  <GhostButton
                    icon={<Film size={15} />}
                    onPress={() => {
                      // reinforcement after a correct answer — not a hint
                      setAnimStart(0);
                      setShowAnim((s) => !s);
                    }}
                  >
                    {t('animatedExample')}
                  </GhostButton>
                )}
              </>
            )}
          </XStack>
        </AppCard>
      )}

      {phase === 'answer' && feedback !== 'good' && (
        <AppCard flexDirection="row" alignItems="center" gap={10}>
          <Mascot size={44} />
          <Text fontSize={13} fontWeight="600" color={INK} flexShrink={1}>
            {t('practiceEncourage')}
          </Text>
        </AppCard>
      )}

      {phase === 'steps' && (
        <YStack gap={10}>
          {problem.steps.slice(0, stepIndex).map((s) => (
            <AppCard
              key={s.position}
              flexDirection="row"
              alignItems="center"
              gap={8}
              opacity={0.6}
              borderRadius={20}
            >
              <Check size={16} color={accent} />
              <Text fontSize={13} color={INK} textDecorationLine="line-through" flexShrink={1}>
                <MathText text={s.prompt} size={13} />
              </Text>
            </AppCard>
          ))}

          {step && (
            <AppCard gap={10} borderRadius={22}>
              <Text fontSize={11} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={accent}>
                {t('step')} {stepIndex + 1} {t('of')} {problem.steps.length}
              </Text>
              <MathText text={step.prompt} />
              <MathInput value={stepAnswer} onChange={setStepAnswer} onSubmit={checkStep} />
              {stepFeedback === 'good' && <Feedback kind="good">{t('correct')}</Feedback>}
              {stepFeedback === 'bad' && <Feedback kind="bad">{t('incorrect')}</Feedback>}
              {stepFeedback && stepFeedback !== 'good' && stepFeedback !== 'bad' && (
                <Feedback kind="hint">
                  <>💡 <MathText text={stepFeedback} size={14} /></>
                </Feedback>
              )}
              <XStack gap={8} marginTop={4} flexWrap="wrap">
                <PrimaryButton onPress={checkStep}>{t('check')}</PrimaryButton>
                {animScript && (
                  <GhostButton
                    icon={<Film size={15} />}
                    onPress={() => (showAnim ? setShowAnim(false) : openAnim(0))}
                  >
                    {t('animatedExample')}
                  </GhostButton>
                )}
                <GhostButton icon={<MessageCircle size={15} />} onPress={() => setShowTutor((s) => !s)}>
                  {t('askTutor')}
                </GhostButton>
              </XStack>
            </AppCard>
          )}

          {problem.steps.slice(stepIndex + 1).map((s) => (
            <AppCard
              key={s.position}
              flexDirection="row"
              alignItems="center"
              gap={8}
              opacity={0.4}
              borderRadius={20}
            >
              <Lock size={16} color={NEUTRAL[600]} />
              <Text fontSize={13} color={INK} flexShrink={1}>
                <MathText text={s.prompt} size={13} />
              </Text>
            </AppCard>
          ))}

          <XStack
            alignSelf="flex-start"
            backgroundColor={INK}
            borderRadius={16}
            borderBottomLeftRadius={4}
            paddingHorizontal={12}
            paddingVertical={8}
          >
            <Text color="#f3f2f2" fontWeight="600" fontSize={12}>
              {t('practiceEncourage')}
            </Text>
          </XStack>
        </YStack>
      )}

      {showAnim && animScript && (
        <AnimatedEquation
          key={`${problem.id}-${animStart}`}
          script={animScript}
          startAtStep={animStart}
        />
      )}

      {showTutor && (
        <TutorChat
          problemId={problem.id}
          stepReached={phase === 'steps' ? stepIndex : undefined}
          onOpenAnim={
            animScript
              ? (step) => openAnim(Math.min(Math.max(0, step), animScript.steps.length - 1))
              : undefined
          }
        />
      )}
    </Screen>
  );
}
