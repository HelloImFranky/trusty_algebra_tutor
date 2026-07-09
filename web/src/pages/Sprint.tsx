/** Daily Sprints: short timed fluency drills (design doc §4.4, "Sprints" folder). */
import { useEffect, useRef, useState } from 'react';
import { api, postAttempt } from '../api';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/Katex';
import { useI18n } from '../i18n';

interface SprintProblem {
  id: number;
  prompt: string;
}

const SPRINT_SECONDS = 90;

export function Sprint() {
  const { t, locale } = useI18n();
  const [problems, setProblems] = useState<SprintProblem[]>([]);
  const [index, setIndex] = useState(-1);
  const [answer, setAnswer] = useState('');
  const [seconds, setSeconds] = useState(SPRINT_SECONDS);
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const start = async () => {
    const r = await api<{ problems: SprintProblem[] }>(`/api/sprints/next?count=20&locale=${locale}`);
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
    const res = await postAttempt<{ correct: boolean }>(`/api/problems/${p.id}/attempt`, {
      submittedLatex: answer,
      context: 'sprint',
    });
    if (!('queued' in res) && res.correct) setScore((s) => s + 1);
    setAnswer('');
    if (index + 1 < problems.length) setIndex((i) => i + 1);
    else setRunning(false);
  };

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <h1>⚡ {t('sprint')}</h1>
      {!running && index === -1 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>90s · 20 ❓</p>
          <button className="btn" onClick={start}>{t('sprintGo')}</button>
        </div>
      )}
      {running && problems[index] && (
        <div className="card">
          <div className="sprint-timer">⏱ {seconds}s</div>
          <h2 style={{ textAlign: 'center' }}>
            <MathText text={problems[index].prompt} />
          </h2>
          <MathInput value={answer} onChange={setAnswer} onSubmit={submit} />
          <button className="btn" style={{ marginTop: 10, width: '100%' }} onClick={submit}>
            {t('check')} ⏎
          </button>
        </div>
      )}
      {!running && index >= 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>{t('sprintDone')}</h2>
          <p style={{ fontSize: 40, margin: 8 }}>
            {score} / {attempted}
          </p>
          <button className="btn" onClick={start}>↻ {t('sprintGo')}</button>
        </div>
      )}
    </div>
  );
}
