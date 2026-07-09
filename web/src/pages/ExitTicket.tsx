/** Auto-graded exit ticket at the end of every lesson (design doc §4.3). */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { MathInput } from '../components/MathInput';
import { MathText } from '../components/Katex';
import { useI18n } from '../i18n';

interface Ticket {
  id: number;
  lessonId: number;
  problems: { id: number; prompt: string; gradingMode: string }[];
}

export function ExitTicket() {
  const { lessonId } = useParams();
  const { t, locale } = useI18n();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    results: { problemId: number; correct: boolean; correctAnswer: string }[];
  } | null>(null);
  const [startedAt] = useState(Date.now());

  useEffect(() => {
    api<Ticket>(`/api/lessons/${lessonId}/exit-ticket?locale=${locale}`)
      .then(setTicket)
      .catch(() => {});
  }, [lessonId, locale]);

  if (!ticket) return <div className="container">…</div>;

  const submit = async () => {
    const res = await api<typeof result>(`/api/exit-tickets/${ticket.id}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        answers: ticket.problems.map((p) => ({
          problemId: p.id,
          submittedLatex: answers[p.id] ?? '',
        })),
        durationMs: Date.now() - startedAt,
      }),
    });
    setResult(res);
  };

  const resultFor = (pid: number) => result?.results.find((r) => r.problemId === pid);

  return (
    <div className="container">
      <p><Link to={`/lesson/${ticket.lessonId}`}>← {t('lesson')}</Link></p>
      <h1>🎟️ {t('exitTicket')}</h1>
      {ticket.problems.map((p, i) => {
        const r = resultFor(p.id);
        return (
          <div key={p.id} className="card">
            <p>
              <strong>{i + 1}.</strong> <MathText text={p.prompt} />
            </p>
            <MathInput
              value={answers[p.id] ?? ''}
              onChange={(v) => setAnswers((a) => ({ ...a, [p.id]: v }))}
              disabled={!!result}
            />
            {r && (
              <div className={`feedback ${r.correct ? 'good' : 'bad'}`}>
                {r.correct ? t('correct') : (
                  <>
                    {t('incorrect')} — <MathText text={`$${r.correctAnswer}$`} />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!result ? (
        <button className="btn" onClick={submit}>{t('submit')}</button>
      ) : (
        <div className="card">
          <h2>
            {t('score')}: {result.score} / {result.maxScore}
          </h2>
          <div className="progress-bar">
            <div style={{ width: `${(result.score / Math.max(1, result.maxScore)) * 100}%` }} />
          </div>
          <p style={{ marginTop: 12 }}>
            <Link to="/"><button className="btn secondary">{t('curriculum')}</button></Link>
          </p>
        </div>
      )}
    </div>
  );
}
