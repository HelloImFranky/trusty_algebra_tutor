/**
 * Guided problem solving — the tutor loop (design doc §4.2).
 *
 * 1. Student attempts a structured-math answer.
 * 2. Wrong answer → the app walks the scaffold, one checkable step at a time.
 * 3. Hints escalate: nudge → mnemonic/step hint → show the step worked → LLM
 *    tutor chat as the final escalation (deterministic ladder first, §6).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, postAttempt } from '../api';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/Katex';
import { TutorChat } from '../components/TutorChat';
import { useI18n } from '../i18n';

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

export function Practice() {
  const { skillId } = useParams();
  const [params] = useSearchParams();
  const lessonId = params.get('lesson') ? Number(params.get('lesson')) : undefined;
  const { t, locale } = useI18n();

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
      const r = await api<{ tier: string; problem: Problem }>(
        `/api/practice/next?skill=${skillId}&locale=${locale}`,
      );
      setProblem(r.problem);
      setTier(r.tier);
    } catch {
      setProblem(null);
    }
  }, [skillId, locale]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  if (!problem) return <div className="container">…</div>;

  const submit = async () => {
    if (!answer.trim()) return;
    const res = await postAttempt<{
      correct: boolean;
      equivalentButNotCanonical: boolean;
      message: string | null;
      steps: ProblemStep[];
    }>(`/api/problems/${problem.id}/attempt?locale=${locale}`, {
      submittedLatex: answer,
      hintsUsed,
      stepReached: stepIndex,
      durationMs: Date.now() - startedAt,
    });
    if ('queued' in res) {
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
    const res = await api<{ correct: boolean; hint: string | null }>(
      `/api/problems/${problem.id}/steps/${step.position}/check?locale=${locale}`,
      { method: 'POST', body: JSON.stringify({ submittedLatex: stepAnswer }) },
    );
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
    <div className="container">
      <p style={{ marginBottom: 4 }}>
        {lessonId ? <Link to={`/lesson/${lessonId}`}>← {t('lesson')}</Link> : <Link to="/">← {t('curriculum')}</Link>}
        <span style={{ float: 'right', color: 'var(--muted)', fontSize: 13 }}>
          {solved} {t('problemsSolved')} · <span className={`badge ${tier === 'modified' ? 'struggling' : tier === 'challenge' ? 'mastered' : 'practicing'}`}>{tier}</span>
        </span>
      </p>
      <div className="card" data-problem-id={problem.id}>
        <h2 style={{ marginTop: 0 }}>
          <MathText text={problem.prompt} />
        </h2>

        {phase !== 'steps' && (
          <>
            <MathInput value={answer} onChange={setAnswer} onSubmit={submit} disabled={phase === 'done'} />
            {feedback === 'good' && <div className="feedback good">{t('correct')}</div>}
            {feedback === 'bad' && <div className="feedback bad">{t('incorrect')}</div>}
            {feedback === 'warn' && <div className="feedback warn">{message || t('almostCanonical')}</div>}
            {feedback === 'queued' && <div className="feedback warn">{t('offlineQueued')}</div>}
            {hintText && (
              <div className="feedback warn">💡 <MathText text={hintText} /></div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {phase === 'answer' && (
                <>
                  <button className="btn" onClick={submit}>{t('check')}</button>
                  <button className="btn secondary" onClick={nudge}>💡 {t('hint')}</button>
                  {problem.steps.length > 0 && (
                    <button
                      className="btn ghost"
                      onClick={() => {
                        setPhase('steps');
                        setHintsUsed((h) => h + 1);
                      }}
                    >
                      🪜 {t('showStep')}
                    </button>
                  )}
                  <button className="btn ghost" onClick={() => setShowTutor((s) => !s)}>
                    🤖 {t('askTutor')}
                  </button>
                </>
              )}
              {phase === 'done' && (
                <button className="btn" onClick={loadNext}>{t('next')} →</button>
              )}
            </div>
          </>
        )}

        {phase === 'steps' && step && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
              {t('step')} {stepIndex + 1} {t('of')} {problem.steps.length}
            </div>
            <p><MathText text={step.prompt} /></p>
            <MathInput value={stepAnswer} onChange={setStepAnswer} onSubmit={checkStep} />
            {stepFeedback === 'good' && <div className="feedback good">{t('correct')}</div>}
            {stepFeedback && stepFeedback !== 'good' && (
              <div className="feedback warn">
                {stepFeedback === 'bad' ? t('incorrect') : <>💡 <MathText text={stepFeedback} /></>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={checkStep}>{t('check')}</button>
              <button className="btn ghost" onClick={() => setShowTutor((s) => !s)}>
                🤖 {t('askTutor')}
              </button>
            </div>
          </div>
        )}
      </div>

      {showTutor && (
        <TutorChat problemId={problem.id} stepReached={phase === 'steps' ? stepIndex : undefined} />
      )}
    </div>
  );
}
