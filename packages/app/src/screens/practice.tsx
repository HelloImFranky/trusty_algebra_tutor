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
  X,
} from '@tamagui/lucide-icons';
import { Button, Text, XStack, YStack } from 'tamagui';
import { requiresJustificationFor } from '@tutor/core';
import { client } from '../lib/trpc';
import { attemptOrQueue } from '../lib/offline';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { Mascot } from '../components/Mascot';
import { MathInput } from '../components/MathInput';
import type { KeypadKind } from '../components/MathKeypad';
import { MathText } from '../components/MathText';
import { AnimatedEquation } from '../components/stepanim/AnimatedEquation';
import { buildScriptForProblem } from '../components/stepanim/builders';
import {
  AppCard, Badge, COLORS, Feedback, GhostButton, HINT, Loading, Muted, PrimaryButton, Screen,
  SecondaryButton, useAccent, useTokens,
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
  /** Fixed answer choices for word-answer questions (rational/irrational,
   * yes/no, up/down, …); null/absent for free-response questions. */
  choices?: string[] | null;
  /** Which dedicated per-lesson keypad this problem's answer needs (e.g.
   * 'numeric', 'polynomial', 'inequality', 'points'); null when it's a choice
   * question. See keypadKindForProblem in @tutor/core. */
  keypad?: KeypadKind | null;
  steps: ProblemStep[];
}

type Phase = 'answer' | 'steps' | 'done';

export function PracticeScreen({ skillId, lessonId }: { skillId: number; lessonId?: number }) {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const accent = useAccent();
  const tokens = useTokens();

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
  const [showAnim, setShowAnim] = useState(false);
  const [animStart, setAnimStart] = useState(0);
  // True while a correctly-answered yes/no problem is collecting the required
  // justification step (e.g. "understanding functions"): verdict → prove why.
  const [justifying, setJustifying] = useState(false);
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
    setShowAnim(false);
    setAnimStart(0);
    setAnimViews(0);
    setJustifying(false);
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
    // Justification-required questions (e.g. "is this a function?") grade the
    // verdict AND the evidence as a single attempt. Collect the evidence first,
    // then submit both together — so a right verdict with a wrong "why" counts
    // as incorrect toward mastery.
    if (requiresJustificationFor(problem.params) && problem.steps.length > 0 && !justifying) {
      setJustifying(true);
      setStepIndex(0);
      setStepAnswer('');
      setStepFeedback('');
      setFeedback('');
      setPhase('steps');
      return;
    }
    await gradeAttempt();
  };

  /** Record the graded attempt (optionally with the justification evidence)
   * and react to the result. Shared by the plain answer flow and the two-part
   * justify flow. */
  const gradeAttempt = async (justificationLatex?: string) => {
    const res = await attemptOrQueue({
      problemId: problem.id,
      submittedLatex: answer,
      justificationLatex,
      hintsUsed,
      animViews,
      stepReached: stepIndex,
      durationMs: Date.now() - startedAt,
      locale,
    });
    if (res.queued) {
      setJustifying(false);
      setPhase('answer');
      setFeedback('queued');
      return;
    }
    if (res.correct) {
      setJustifying(false);
      setFeedback('good');
      setPhase('done');
      setSolved((s) => s + 1);
      return;
    }
    // Wrong. If the verdict was right but the evidence was wrong, keep the
    // student on the evidence step to fix it; otherwise the verdict itself is
    // wrong, so surface it on the main question.
    if (justifying && res.verdictCorrect && !res.justificationCorrect) {
      setStepFeedback(res.steps?.[0]?.hint ?? 'bad');
      setHintsUsed((h) => h + 1);
      return;
    }
    setJustifying(false);
    setPhase('answer');
    if (res.equivalentButNotCanonical) {
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

  /** Evidence "Check" in the justify sub-phase: submit verdict + evidence. */
  const submitJustified = async () => {
    if (!stepAnswer.trim()) return;
    await gradeAttempt(stepAnswer);
  };

  /** The Hint button is a simple on/off toggle: first tap shows the nudge,
   * a second tap clears it. The deeper escalations have their own buttons
   * ("Walk me through it" for the guided/animated walkthrough, "Ask the
   * tutor" for the LLM chat), so the hint button never advances the phase
   * or opens the tutor on its own. */
  const nudge = () => {
    if (hintText) {
      setHintText('');
      return;
    }
    setHintsUsed((h) => h + 1);
    setHintText(
      problem.steps[0]?.hint ??
        problem.steps[0]?.prompt ??
        (locale === 'es' ? 'Repasa los pasos de la lección.' : 'Look back at the lesson steps.'),
    );
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
            <ArrowLeft size={17} color={tokens.ink} />
            <Text color={tokens.ink} fontWeight="800" fontSize={14}>
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
              backgroundColor={i < stepIndex ? tokens.ink : i === stepIndex ? accent : tokens.border}
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
          {problem.choices && problem.choices.length > 0 ? (
            <XStack gap={10} flexWrap="wrap">
              {problem.choices.map((choice) => {
                const selected = answer === choice;
                return (
                  <Button
                    key={choice}
                    flex={1}
                    flexBasis={130}
                    minWidth={110}
                    height={52}
                    borderRadius={14}
                    borderWidth={2}
                    borderColor={selected ? accent : tokens.border}
                    backgroundColor={selected ? tokens.subtle : tokens.surface}
                    disabled={phase === 'done'}
                    pressStyle={{ opacity: 0.85 }}
                    onPress={() => setAnswer(choice)}
                    aria-label={choice}
                  >
                    <Text
                      fontSize={17}
                      fontWeight="800"
                      color={selected ? accent : tokens.ink}
                      textTransform="capitalize"
                    >
                      {choice}
                    </Text>
                  </Button>
                );
              })}
            </XStack>
          ) : (
            <MathInput
              value={answer}
              onChange={setAnswer}
              onSubmit={submit}
              disabled={phase === 'done'}
              keypad={problem.keypad ?? 'algebra'}
            />
          )}
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
                {(animScript || problem.steps.length > 0) && (
                  <GhostButton
                    icon={<Footprints size={15} />}
                    onPress={() => {
                      // "Walk me through it" IS the animated worked example.
                      // Toggle the animation when a builder understands this
                      // problem; only fall back to the per-step guided mode
                      // when there's no animation to play.
                      if (animScript) {
                        if (showAnim) setShowAnim(false);
                        else openAnim(0);
                      } else {
                        setPhase('steps');
                        setHintsUsed((h) => h + 1);
                      }
                    }}
                  >
                    {t('showStep')}
                  </GhostButton>
                )}
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
          <Text fontSize={13} fontWeight="600" color={tokens.ink} flexShrink={1}>
            {t('practiceEncourage')}
          </Text>
        </AppCard>
      )}

      {phase === 'steps' && (
        <YStack gap={10}>
          {justifying && (
            <AppCard flexDirection="row" alignItems="center" gap={10}>
              <Lightbulb size={18} color={accent} />
              <Text fontSize={13} fontWeight="700" color={tokens.ink} flexShrink={1}>
                {t('justifyLead')}
              </Text>
            </AppCard>
          )}
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
              <Text fontSize={13} color={tokens.ink} textDecorationLine="line-through" flexShrink={1}>
                <MathText text={s.prompt} size={13} />
              </Text>
            </AppCard>
          ))}

          {step && (
            <AppCard gap={10} borderRadius={22}>
              <Text fontSize={11} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={accent}>
                {justifying
                  ? t('evidenceLabel')
                  : `${t('step')} ${stepIndex + 1} ${t('of')} ${problem.steps.length}`}
              </Text>
              <MathText text={step.prompt} />
              <MathInput
                value={stepAnswer}
                onChange={setStepAnswer}
                onSubmit={justifying ? submitJustified : checkStep}
                // Steps are intermediate and often algebraic even when the
                // final answer is a bare number, so use the full algebra pad
                // (choice questions type their word answer instead).
                keypad={problem.choices && problem.choices.length > 0 ? false : 'algebra'}
              />
              {stepFeedback === 'good' && <Feedback kind="good">{t('correct')}</Feedback>}
              {stepFeedback === 'bad' && <Feedback kind="bad">{t('incorrect')}</Feedback>}
              {stepFeedback && stepFeedback !== 'good' && stepFeedback !== 'bad' && (
                <Feedback kind="hint">
                  <>💡 <MathText text={stepFeedback} size={14} /></>
                </Feedback>
              )}
              <XStack gap={8} marginTop={4} flexWrap="wrap">
                <PrimaryButton onPress={justifying ? submitJustified : checkStep}>
                  {t('check')}
                </PrimaryButton>
                {animScript && (
                  <GhostButton
                    icon={<Film size={15} />}
                    onPress={() => (showAnim ? setShowAnim(false) : openAnim(0))}
                  >
                    {t('animatedExample')}
                  </GhostButton>
                )}
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
              <Lock size={16} color={tokens.muted} />
              <Text fontSize={13} color={tokens.ink} flexShrink={1}>
                <MathText text={s.prompt} size={13} />
              </Text>
            </AppCard>
          ))}

          <XStack
            alignSelf="flex-start"
            backgroundColor={tokens.poster}
            borderWidth={tokens.mode === 'dark' ? 1 : 0}
            borderColor={tokens.posterBorder}
            borderRadius={16}
            borderBottomLeftRadius={4}
            paddingHorizontal={12}
            paddingVertical={8}
          >
            <Text color={tokens.posterInk} fontWeight="600" fontSize={12}>
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
    </Screen>
  );
}
