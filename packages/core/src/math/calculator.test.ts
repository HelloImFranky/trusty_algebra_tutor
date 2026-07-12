import { describe, expect, it } from 'vitest';
import {
  asFraction,
  compileGraphFunction,
  DEFAULT_WINDOW,
  evaluateCalculation,
  findIntersections,
  findRoots,
  formatNumber,
  niceTicks,
  parseCalculatorState,
  sampleGraph,
  tableValues,
} from './calculator.js';

describe('evaluateCalculation', () => {
  it('does arithmetic', () => {
    expect(evaluateCalculation('2 + 3').value).toBe(5);
    expect(evaluateCalculation('2^10').value).toBe(1024);
    expect(evaluateCalculation('sqrt(49)').value).toBe(7);
  });

  it('cleans float noise in the display', () => {
    expect(evaluateCalculation('0.1 + 0.2').display).toBe('0.3');
  });

  it('shows a fraction when a nice one exists', () => {
    expect(evaluateCalculation('1/3').fraction).toBe('1/3');
    expect(evaluateCalculation('3/4 + 1/2').fraction).toBe('5/4');
    expect(evaluateCalculation('2/2').fraction).toBeUndefined(); // integer
    expect(evaluateCalculation('pi').fraction).toBeUndefined();
  });

  it('respects angle mode', () => {
    expect(evaluateCalculation('sin(pi/2)', { angleMode: 'rad' }).value).toBeCloseTo(1);
    expect(evaluateCalculation('sin(90)', { angleMode: 'deg' }).value).toBeCloseTo(1);
    expect(evaluateCalculation('cos(60)', { angleMode: 'deg' }).value).toBeCloseTo(0.5);
    expect(evaluateCalculation('atan(1)', { angleMode: 'deg' }).value).toBeCloseTo(45);
  });

  it('threads ans through', () => {
    expect(evaluateCalculation('ans * 2', { ans: 21 }).value).toBe(42);
  });

  it('stores and reuses variables', () => {
    const r1 = evaluateCalculation('a = 5');
    expect(r1.ok).toBe(true);
    expect(r1.variables).toEqual({ a: 5 });
    const r2 = evaluateCalculation('3a + 1', { variables: r1.variables });
    expect(r2.value).toBe(16);
  });

  it('rejects equations and reserved assignments', () => {
    expect(evaluateCalculation('x^2 = 4').ok).toBe(false);
    expect(evaluateCalculation('pi = 3').ok).toBe(false);
  });

  it('reports friendly errors', () => {
    expect(evaluateCalculation('2 +').error).toBe('incomplete expression');
    expect(evaluateCalculation('foo(3)').error).toContain('foo');
    expect(evaluateCalculation('1/0').ok).toBe(false);
  });

  it('accepts the LaTeX-ish shortcuts the math input emits', () => {
    expect(evaluateCalculation('\\frac{1}{4} + \\frac{1}{4}').value).toBe(0.5);
    expect(evaluateCalculation('√16').value).toBe(4);
  });
});

describe('formatNumber / asFraction', () => {
  it('formats integers and decimals', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(0.30000000000000004)).toBe('0.3');
    expect(formatNumber(1e20)).toContain('e');
  });
  it('finds small-denominator fractions only', () => {
    expect(asFraction(0.25)).toBe('1/4');
    expect(asFraction(-1.5)).toBe('-3/2');
    expect(asFraction(Math.PI)).toBeUndefined();
    expect(asFraction(3)).toBeUndefined();
  });
});

describe('compileGraphFunction', () => {
  it('strips y= / f(x)= prefixes', () => {
    expect(compileGraphFunction('y = 2x + 1').at(3)).toBe(7);
    expect(compileGraphFunction('f(x) = x^2').at(4)).toBe(16);
    expect(compileGraphFunction('x^2 - 4').at(2)).toBe(0);
  });
  it('returns NaN outside the domain', () => {
    const f = compileGraphFunction('sqrt(x)');
    expect(f.at(4)).toBe(2);
    expect(Number.isNaN(f.at(-1))).toBe(true); // complex → not on the real graph
  });
  it('rejects unknown symbols and equations', () => {
    expect(compileGraphFunction('x + z').ok).toBe(false);
    expect(compileGraphFunction('y = x = 2').ok).toBe(false);
    expect(compileGraphFunction('2x +').ok).toBe(false);
  });
});

describe('sampleGraph', () => {
  it('samples a parabola as one continuous segment', () => {
    const segs = sampleGraph(compileGraphFunction('x^2'), DEFAULT_WINDOW, 100);
    expect(segs).toHaveLength(1);
    expect(segs[0][0].x).toBe(-10);
    expect(segs[0][segs[0].length - 1].x).toBeCloseTo(10);
  });
  it('splits at vertical asymptotes instead of connecting them', () => {
    const segs = sampleGraph(compileGraphFunction('1/x'), DEFAULT_WINDOW, 200);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    for (const seg of segs) {
      const signs = new Set(seg.map((p) => Math.sign(p.x) || 1));
      expect(signs.size).toBe(1); // no segment crosses x=0
    }
  });
  it('splits at domain gaps', () => {
    const segs = sampleGraph(compileGraphFunction('sqrt(x - 2)'), DEFAULT_WINDOW, 100);
    expect(segs).toHaveLength(1);
    expect(segs[0][0].x).toBeGreaterThanOrEqual(2 - 0.21);
  });
});

describe('niceTicks', () => {
  it('uses the 1-2-5 progression and includes 0', () => {
    const ticks = niceTicks(-10, 10, 10);
    expect(ticks).toContain(0);
    expect(ticks).toContain(2);
    const step = ticks[1] - ticks[0];
    expect([1, 2, 2.5, 5].some((m) => Math.abs(step - m) < 1e-9)).toBe(true);
  });
  it('handles tiny and huge spans', () => {
    expect(niceTicks(0, 0.001).length).toBeGreaterThan(3);
    expect(niceTicks(-1e6, 1e6).length).toBeGreaterThan(3);
    expect(niceTicks(5, 5)).toEqual([]);
  });
});

describe('findRoots / findIntersections', () => {
  it('finds quadratic roots', () => {
    const roots = findRoots(compileGraphFunction('x^2 - 4'), -10, 10);
    expect(roots).toHaveLength(2);
    expect(roots[0]).toBeCloseTo(-2, 6);
    expect(roots[1]).toBeCloseTo(2, 6);
  });
  it('does not report the 1/x asymptote as a root', () => {
    expect(findRoots(compileGraphFunction('1/x'), -5, 5)).toHaveLength(0);
  });
  it('finds intersections of two lines', () => {
    const pts = findIntersections(
      compileGraphFunction('2x + 1'),
      compileGraphFunction('-x + 4'),
      -10,
      10,
    );
    expect(pts).toHaveLength(1);
    expect(pts[0].x).toBeCloseTo(1, 6);
    expect(pts[0].y).toBeCloseTo(3, 6);
  });
});

describe('tableValues', () => {
  it('builds rows for several functions', () => {
    const rows = tableValues(
      [compileGraphFunction('x^2'), compileGraphFunction('sqrt(x)')],
      -1,
      1,
      4,
    );
    expect(rows.map((r) => r.x)).toEqual([-1, 0, 1, 2]);
    expect(rows[0].values).toEqual(['1', '—']); // sqrt(-1) undefined
    expect(rows[3].values[0]).toBe('4');
  });
});

describe('parseCalculatorState', () => {
  it('round-trips a valid state', () => {
    const s = parseCalculatorState({
      version: 1,
      angleMode: 'deg',
      expressions: ['x^2'],
      window: { xmin: -5, xmax: 5, ymin: -2, ymax: 8 },
      history: [{ input: '1+1', display: '2' }],
      variables: { a: 3 },
    });
    expect(s.angleMode).toBe('deg');
    expect(s.window.xmax).toBe(5);
    expect(s.history).toHaveLength(1);
    expect(s.variables.a).toBe(3);
  });
  it('falls back to defaults on garbage', () => {
    const s = parseCalculatorState({ window: { xmin: 9, xmax: 1 }, history: 'nope' });
    expect(s.window.xmin).toBe(-10);
    expect(s.history).toEqual([]);
    expect(parseCalculatorState(null).expressions.length).toBeGreaterThan(0);
    expect(parseCalculatorState(undefined).angleMode).toBe('rad');
  });
});
