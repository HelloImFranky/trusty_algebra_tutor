/** 9-unit curriculum map with per-lesson mastery overlay (design doc §4.6). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useI18n } from '../i18n';

export interface CurriculumUnit {
  id: number;
  number: number;
  title: string;
  lessons: {
    id: number;
    code: string;
    title: string;
    skillId: number | null;
    mastery: { score: number; attempts: number; label: string };
  }[];
}

export function CurriculumMap() {
  const { t, locale } = useI18n();
  const [units, setUnits] = useState<CurriculumUnit[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ units: CurriculumUnit[] }>(`/api/curriculum?locale=${locale}`)
      .then((r) => setUnits(r.units))
      .catch((e) => setError((e as Error).message));
  }, [locale]);

  return (
    <div className="container">
      <h1>{t('curriculum')}</h1>
      {error && <div className="feedback bad">{error}</div>}
      <div className="unit-grid">
        {units.map((u) => (
          <div key={u.id} className="card unit-card">
            <h3>
              <span className="unit-num">{u.number}</span>
              {u.title}
            </h3>
            {u.lessons.map((l) => (
              <Link key={l.id} to={`/lesson/${l.id}`} style={{ color: 'inherit' }}>
                <div className="lesson-row">
                  <span>
                    <strong>{l.code}</strong> {l.title}
                  </span>
                  <span className={`badge ${l.mastery.label}`}>
                    {t(l.mastery.label as 'mastered')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
