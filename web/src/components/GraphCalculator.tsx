/**
 * Built-in graphing calculator (design doc §4.1): the syllabus points
 * students to a graphing calculator app — this embeds one so they don't
 * context-switch. Plots y = f(x) via function-plot.
 */
import { useEffect, useRef, useState } from 'react';
import functionPlot from 'function-plot';

export function GraphCalculator({ initial = 'x^2' }: { initial?: string }) {
  const target = useRef<HTMLDivElement>(null);
  const [fns, setFns] = useState<string[]>([initial]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!target.current) return;
    try {
      target.current.innerHTML = '';
      functionPlot({
        target: target.current,
        width: Math.min(640, target.current.clientWidth || 640),
        height: 380,
        grid: true,
        xAxis: { domain: [-10, 10] },
        yAxis: { domain: [-10, 10] },
        data: fns
          .filter((f) => f.trim())
          .map((fn, i) => ({
            fn: fn.replace(/y\s*=/, '').trim(),
            color: ['#3b5bdb', '#e8590c', '#0ca678'][i % 3],
          })),
      });
      setError('');
    } catch {
      setError('Could not plot — check the expression (example: 2x+3, x^2-4)');
    }
  }, [fns]);

  return (
    <div className="card">
      {fns.map((fn, i) => (
        <label key={i} className="field">
          <span>y{i + 1} =</span>
          <input
            value={fn}
            onChange={(e) => setFns(fns.map((f, j) => (j === i ? e.target.value : f)))}
            placeholder="2x + 3"
          />
        </label>
      ))}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {fns.length < 3 && (
          <button className="btn secondary small" onClick={() => setFns([...fns, ''])}>
            + y{fns.length + 1}
          </button>
        )}
        {fns.length > 1 && (
          <button className="btn ghost small" onClick={() => setFns(fns.slice(0, -1))}>
            −
          </button>
        )}
      </div>
      {error && <div className="feedback warn">{error}</div>}
      <div ref={target} style={{ overflowX: 'auto' }} />
    </div>
  );
}
