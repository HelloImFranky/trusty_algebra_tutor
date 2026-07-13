import { describe, expect, it } from 'vitest';
import {
  buildMultiStepEquation,
  buildScriptForProblem,
  buildTwoStepEquation,
  buildTwoStepInequality,
  buildVarBothSides,
} from './builders.js';
import { stepToText, type EqScript } from './model.js';

const lines = (s: EqScript | null) => (s ? s.steps.map(stepToText) : []);
const lastStep = (s: EqScript) => s.steps[s.steps.length - 1];

describe('buildTwoStepEquation', () => {
  it('solves a·x + b = c with positive a and b', () => {
    expect(lines(buildTwoStepEquation(2, 3, 4))).toEqual([
      '2x + 3 = 11',
      '2x + 3 − 3 = 11 − 3',
      '2x = 8',
      '2x ÷ 2 = 8 ÷ 2',
      'x = 4',
    ]);
  });

  it('handles negative a and negative b (adds, divides by a negative)', () => {
    expect(lines(buildTwoStepEquation(-3, -5, 2))).toEqual([
      '−3x − 5 = −11',
      '−3x − 5 + 5 = −11 + 5',
      '−3x = −6',
      '−3x ÷ (−3) = −6 ÷ (−3)',
      'x = 2',
    ]);
  });

  it('renders coefficient 1 as bare x and finishes without a division step', () => {
    const s = buildTwoStepEquation(1, 5, 3);
    expect(lines(s)).toEqual(['x + 5 = 8', 'x + 5 − 5 = 8 − 5', 'x = 3']);
    const final = lastStep(s).tokens.find((t) => t.id === 'c1');
    expect(final?.emph).toBe('result');
  });

  it('renders coefficient −1 as −x', () => {
    expect(lines(buildTwoStepEquation(-1, 2, 7))[0]).toBe('−x + 2 = −5');
  });
});

describe('buildTwoStepInequality', () => {
  it('flips the symbol when dividing by a negative coefficient', () => {
    const s = buildTwoStepInequality(-4, -4, 4, '>');
    expect(lines(s)).toEqual([
      '−4x − 4 > −20',
      '−4x − 4 + 4 > −20 + 4',
      '−4x > −16',
      '−4x ÷ (−4) > −16 ÷ (−4)',
      'x < 4',
    ]);
    const rel = lastStep(s).tokens.find((t) => t.kind === 'rel');
    expect(rel?.text).toBe('<');
    expect(rel?.emph).toBe('flip');
    expect(lastStep(s).holdMs).toBeGreaterThan(2200);
  });

  it('flips < to > as well', () => {
    const s = buildTwoStepInequality(-2, 6, 1, '<');
    const rel = lastStep(s).tokens.find((t) => t.kind === 'rel');
    expect(rel?.text).toBe('>');
    expect(rel?.emph).toBe('flip');
  });

  it('does not flip for a positive coefficient', () => {
    const s = buildTwoStepInequality(3, 2, 5, '<');
    const rel = lastStep(s).tokens.find((t) => t.kind === 'rel');
    expect(rel?.text).toBe('<');
    expect(rel?.emph).toBeUndefined();
    expect(stepToText(lastStep(s))).toBe('x < 5');
  });
});

describe('buildVarBothSides', () => {
  it('gathers the n-terms then solves (c > 0 → subtract)', () => {
    // −n − 12 = −66 + 8n has solution n = 6
    const s = buildVarBothSides(-1, -12, 8, 6);
    const l = lines(s);
    expect(l[0]).toBe('−n − 12 = −66 + 8n');
    expect(l).toContain('−n − 12 − 8n = −66 + 8n − 8n');
    expect(l).toContain('−9n − 12 = −66');
    expect(l[l.length - 1]).toBe('n = 6');
  });

  it('adds when the right-side coefficient is negative', () => {
    // 2n + 4 = 9 − 3n has solution n = 1
    const s = buildVarBothSides(2, 4, -3, 1);
    const l = lines(s);
    expect(l[0]).toBe('2n + 4 = 9 − 3n');
    expect(l).toContain('2n + 4 + 3n = 9 − 3n + 3n');
    expect(l).toContain('5n + 4 = 9');
    expect(l[l.length - 1]).toBe('n = 1');
  });
});

describe('buildMultiStepEquation', () => {
  it('distributes, combines like terms, then solves', () => {
    // 2(3x + 1) + 4x = 12 has solution x = 1
    const s = buildMultiStepEquation(2, 3, 1, 4, 1);
    const l = lines(s!);
    expect(l[0]).toBe('2(3x + 1) + 4x = 12');
    expect(l).toContain('6x + 2 + 4x = 12');
    expect(l).toContain('10x + 2 = 12');
    expect(l[l.length - 1]).toBe('x = 1');
  });

  it('handles negative k, b, and c', () => {
    // −2(x − 3) − x = 0 → −2x + 6 − x = 0 → −3x + 6 = 0 → x = 2
    const s = buildMultiStepEquation(-2, 1, -3, -1, 2);
    const l = lines(s!);
    expect(l[0]).toBe('−2(x − 3) − x = 0');
    expect(l).toContain('−2x + 6 − x = 0');
    expect(l).toContain('−3x + 6 = 0');
    expect(l[l.length - 1]).toBe('x = 2');
  });

  it('returns null when the combined coefficient is zero', () => {
    expect(buildMultiStepEquation(2, 1, 1, -2, 3)).toBeNull();
  });
});

describe('buildScriptForProblem dispatch', () => {
  it('routes inequalities params to the inequality builder', () => {
    const s = buildScriptForProblem('inequalities', { a: -4, b: -4, x: 4, baseOp: '>' });
    expect(stepToText(lastStep(s!))).toBe('x < 4');
  });

  it('routes multi-step params (with k) to the multi-step builder', () => {
    const s = buildScriptForProblem('multi-step-equations', { k: 2, a: 3, b: 1, c: 4, x: 1 });
    expect(lines(s)[0]).toBe('2(3x + 1) + 4x = 12');
  });

  it('routes plain {a,b,x} under multi-step-equations to the two-step builder', () => {
    const s = buildScriptForProblem('multi-step-equations', { a: 2, b: 3, x: 4 });
    expect(lines(s)[0]).toBe('2x + 3 = 11');
  });

  it('routes var-both-sides params to the both-sides builder', () => {
    const s = buildScriptForProblem('var-both-sides', { a: -1, b: -12, c: 8, x: 6 });
    expect(lines(s)[0]).toBe('−n − 12 = −66 + 8n');
  });

  it('returns null for shapes it cannot animate', () => {
    expect(buildScriptForProblem('inequalities', { a: 2, b: 3, x: 1 })).toBeNull(); // no baseOp
    expect(buildScriptForProblem('var-both-sides', { a: 3, b: 1, c: 3, x: 2 })).toBeNull(); // a === c
    expect(buildScriptForProblem('multi-step-equations', { a: 0, b: 1, x: 2 })).toBeNull();
    expect(buildScriptForProblem('simplify-radicals', { a: 2, b: 3, x: 4 })).toBeNull();
    expect(buildScriptForProblem(null, { a: 2, b: 3, x: 4 })).toBeNull();
    expect(buildScriptForProblem('inequalities', null)).toBeNull();
  });
});
