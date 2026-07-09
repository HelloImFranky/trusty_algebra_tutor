/** Regents review mode (design doc §4.5): mixed-unit problems from seen skills. */
import { useEffect, useState } from 'react';
import { api, postAttempt } from '../api';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/Katex';
import { useI18n } from '../i18n';

interface Problem {
  id: number;
  prompt: string;
  steps: { position: number; prompt: string; hint: string | null }[];
}

export function Review() {
  const { t, locale } = useI18n();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    api<{ problems: Problem[] }>(`/api/review/session?locale=${locale}`)
      .then((r) => {
        setProblems(r.problems);
        if (!r.problems.length) setEmpty(true);
      })
      .catch(() => setEmpty(true));
  }, [locale]);

  const submit = async () => {
    if (!answer.trim()) return;
    const p = problems[index];
    const res = await postAttempt<{ correct: boolean }>(`/api/problems/${p.id}/attempt`, {
      submittedLatex: answer,
      context: 'review',
    });
    const correct = !('queued' in res) && res.correct;
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
      <div className="container">
        <h1>📚 {t('review')}</h1>
        <div className="card">{t('reviewEmpty')}</div>
      </div>
    );
  }
  if (!problems.length) return <div className="container">…</div>;

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1>📚 {t('review')}</h1>
      {!done ? (
        <div className="card">
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            {index + 1} / {problems.length}
          </div>
          <h2>
            <MathText text={problems[index].prompt} />
          </h2>
          <MathInput value={answer} onChange={setAnswer} onSubmit={submit} />
          {feedback === 'good' && <div className="feedback good">{t('correct')}</div>}
          {feedback === 'bad' && <div className="feedback bad">{t('incorrect')}</div>}
          <button className="btn" style={{ marginTop: 10 }} onClick={submit}>
            {t('check')}
          </button>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>
            {t('score')}: {score} / {problems.length}
          </h2>
        </div>
      )}
    </div>
  );
}
