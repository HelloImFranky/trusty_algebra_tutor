/**
 * Scaffolded lesson player (design doc §4.1): steps revealed one at a time,
 * worked examples in KaTeX, and the lesson mnemonic as a persistent chip.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { MathText, Katex } from '../components/Katex';
import { TutorChat } from '../components/TutorChat';
import { useI18n } from '../i18n';

interface LessonData {
  id: number;
  code: string;
  title: string;
  mnemonic: string | null;
  skill: { id: number; slug: string; name: string } | null;
  steps: { position: number; body: string; workedExampleLatex: string | null; hint: string | null }[];
  classroomScaffolds: { title: string; body: string; images: string[] }[];
}

export function Lesson() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [revealed, setRevealed] = useState(1);
  const [showTutor, setShowTutor] = useState(false);

  useEffect(() => {
    api<LessonData>(`/api/lessons/${id}?locale=${locale}`).then(setLesson).catch(() => {});
    setRevealed(1);
  }, [id, locale]);

  if (!lesson) return <div className="container">…</div>;

  const allShown = revealed >= lesson.steps.length;

  return (
    <div className="container">
      <p style={{ marginBottom: 4 }}>
        <Link to="/">← {t('curriculum')}</Link>
      </p>
      <h1>
        {lesson.code} · {lesson.title}
      </h1>
      {lesson.mnemonic && (
        <div className="mnemonic-chip">💡 <strong>{t('mnemonic')}:</strong> {lesson.mnemonic}</div>
      )}

      {lesson.steps.slice(0, revealed).map((s) => (
        <div key={s.position} className="card step-card">
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>
            {t('step')} {s.position} {t('of')} {lesson.steps.length}
          </div>
          <p style={{ fontSize: 16 }}>
            <MathText text={s.body} />
          </p>
          {s.workedExampleLatex && (
            <div className="worked">
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                {t('workedExample')}
              </div>
              <Katex tex={s.workedExampleLatex} block />
            </div>
          )}
          {s.hint && (
            <p style={{ fontSize: 14, color: 'var(--warn)' }}>💡 <MathText text={s.hint} /></p>
          )}
        </div>
      ))}

      {lesson.classroomScaffolds.length > 0 && (
        <div className="card scaffold-card">
          <h2 style={{ marginTop: 0 }}>📄 {t('classroomScaffold')}</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>{t('scaffoldNote')}</p>
          {lesson.classroomScaffolds.map((s) => (
            <details key={s.title} className="scaffold-section">
              <summary>{s.title}</summary>
              <div className="scaffold-body">
                {s.images.length > 0 ? (
                  // the scaffold exactly as it was made for class
                  <div className="scaffold-images">
                    {s.images.map((src) => (
                      <img key={src} src={src} alt={s.title} loading="lazy" />
                    ))}
                  </div>
                ) : (
                  s.body && <MathText text={s.body} />
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {!allShown && (
          <button className="btn" onClick={() => setRevealed((r) => r + 1)}>
            {t('continueBtn')} →
          </button>
        )}
        {allShown && lesson.skill && (
          <>
            <Link to={`/practice/${lesson.skill.id}?lesson=${lesson.id}`}>
              <button className="btn">✏️ {t('practice')}</button>
            </Link>
            <Link to={`/exit-ticket/${lesson.id}`}>
              <button className="btn secondary">🎟️ {t('exitTicket')}</button>
            </Link>
          </>
        )}
        <button className="btn ghost" onClick={() => setShowTutor((s) => !s)}>
          🤖 {t('askTutor')}
        </button>
      </div>

      {showTutor && <div style={{ marginTop: 14 }}><TutorChat lessonId={lesson.id} /></div>}
    </div>
  );
}
