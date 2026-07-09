/** Always-accessible Regents Reference Sheet drawer (design doc §1/§4.5). */
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Katex } from './Katex';
import { useI18n } from '../i18n';

interface Sheet {
  sections: { title: string; rows: { label: string; latex: string }[] }[];
}

export function ReferenceSheetDrawer() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  useEffect(() => {
    if (open && (!sheet || true)) {
      api<Sheet>(`/api/reference-sheet?locale=${locale}`).then(setSheet).catch(() => {});
    }
  }, [open, locale]);

  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label={t('referenceSheet')}>
        📖 {t('referenceSheet')}
      </button>
      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} />
          <aside className="drawer" role="dialog" aria-label={t('referenceSheet')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{t('referenceSheet')}</h2>
              <button className="btn ghost small" onClick={() => setOpen(false)}>✕</button>
            </div>
            {sheet?.sections.map((s) => (
              <section key={s.title}>
                <h3>{s.title}</h3>
                <table>
                  <tbody>
                    {s.rows.map((r) => (
                      <tr key={r.label}>
                        <td>{r.label}</td>
                        <td><Katex tex={r.latex} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </aside>
        </>
      )}
    </>
  );
}
