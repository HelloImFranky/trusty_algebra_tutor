/**
 * Progress dashboard (design doc §4.6): streaks, mastery map by unit,
 * recent exit tickets. Guardians/teachers land here via /progress/:studentId.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useI18n } from '../i18n';

interface ProgressData {
  student?: { id: number; displayName: string; grade: number | null };
  streakDays: number;
  skills: {
    skillId: number;
    name: string;
    lessonCode: string;
    unitNumber: number;
    score: number;
    attempts: number;
    label: string;
  }[];
  struggleFlags: { name: string; lessonCode: string }[];
  exitTickets: { lessonCode: string; score: number; maxScore: number; at: string }[];
  activity: { day: string; attempts: number; correct: number; minutes: number }[];
}

export function Progress() {
  const { studentId } = useParams();
  const { t } = useI18n();
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ProgressData>(studentId ? `/api/progress/${studentId}` : '/api/progress/me')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [studentId]);

  if (error) return <div className="container"><div className="feedback bad">{error}</div></div>;
  if (!data) return <div className="container">…</div>;

  const units = [...new Set(data.skills.map((s) => s.unitNumber))].sort((a, b) => a - b);
  const totalMinutes = data.activity.reduce((sum, a) => sum + Number(a.minutes), 0);

  return (
    <div className="container">
      <h1>
        📈 {t('progress')}
        {data.student ? ` — ${data.student.displayName}` : ''}
      </h1>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>🔥</div>
          <strong style={{ fontSize: 26 }}>{data.streakDays}</strong>
          <div style={{ color: 'var(--muted)' }}>{t('streak')}</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>⏱</div>
          <strong style={{ fontSize: 26 }}>{Math.round(totalMinutes)}</strong>
          <div style={{ color: 'var(--muted)' }}>{t('minutes')} / 30d</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>🧠</div>
          <strong style={{ fontSize: 26 }}>
            {data.skills.filter((s) => s.label === 'mastered' || s.label === 'proficient').length}
          </strong>
          <div style={{ color: 'var(--muted)' }}>{t('mastered')}</div>
        </div>
      </div>

      {data.struggleFlags.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--bad)' }}>
          <h2 style={{ marginTop: 0 }}>🚩 {t('struggling')}</h2>
          {data.struggleFlags.map((s) => (
            <div key={s.lessonCode}>
              <strong>{s.lessonCode}</strong> {s.name}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t('masteryMap')}</h2>
        {units.map((u) => (
          <div key={u} style={{ marginBottom: 10 }}>
            <strong>Unit {u}</strong>
            {data.skills
              .filter((s) => s.unitNumber === u)
              .map((s) => (
                <div key={s.skillId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                  <span style={{ width: 42, color: 'var(--muted)', fontSize: 13 }}>{s.lessonCode}</span>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div style={{ width: `${s.score * 100}%` }} />
                  </div>
                  <span className={`badge ${s.label}`}>{t(s.label as 'mastered')}</span>
                </div>
              ))}
          </div>
        ))}
        {!data.skills.length && <p style={{ color: 'var(--muted)' }}>—</p>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>🎟️ {t('recentExitTickets')}</h2>
        <table className="table">
          <tbody>
            {data.exitTickets.map((et, i) => (
              <tr key={i}>
                <td>{et.lessonCode}</td>
                <td>
                  {et.score} / {et.maxScore}
                </td>
                <td style={{ color: 'var(--muted)' }}>{new Date(et.at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!data.exitTickets.length && (
              <tr><td style={{ color: 'var(--muted)' }}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
