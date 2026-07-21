import { describe, expect, it } from 'vitest';
import {
  buildAddPolynomials,
  buildFactorGcf,
  buildFoil,
  buildGcfMonomials,
  buildMultiStepEquation,
  buildScriptForProblem,
  buildSlopeFromPoints,
  buildSlopeInterceptRewrite,
  buildTwoStepEquation,
  buildTwoStepInequality,
  buildVarBothSides,
} from './builders.js';
import { scriptsByLessonCode, stepToText, type EqScript } from './model.js';

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

describe('buildAddPolynomials', () => {
  it('stacks addition on two rows and combines columns', () => {
    // (3x² + 2x + 4) + (2x² + 5x + 1) = 5x² + 7x + 5
    const s = buildAddPolynomials(3, 2, 4, 2, 5, 1, false);
    const l = lines(s);
    expect(l[0]).toBe('(3x² + 2x + 4) + (2x² + 5x + 1)');
    // stacked step: top row then bottom row on its own line
    expect(l[1]).toBe('3x² + 2x + 4\n+ 2x² + 5x + 1');
    expect(l[l.length - 1]).toBe('5x² + 7x + 5');
    const secondRow = s.steps[1].tokens.filter((t) => t.row === 1);
    expect(secondRow.length).toBe(6);
  });

  it('subtraction distributes the minus sign before stacking', () => {
    // (3x² + 2x + 4) − (2x² + 5x + 1) = x² − 3x + 3
    const s = buildAddPolynomials(3, 2, 4, 2, 5, 1, true);
    const l = lines(s);
    expect(l[0]).toBe('(3x² + 2x + 4) − (2x² + 5x + 1)');
    expect(l[1]).toBe('3x² + 2x + 4 − 2x² − 5x − 1'); // flipped, single row
    expect(s.steps[1].tokens.filter((t) => t.emph === 'apply').length).toBe(6);
    expect(l[2]).toBe('3x² + 2x + 4\n− 2x² − 5x − 1');
    expect(l[l.length - 1]).toBe('x² − 3x + 3');
  });

  it('drops zeroed-out terms from the result', () => {
    // (2x² + 3x + 1) − (2x² + 3x + 1) = 0
    const zero = buildAddPolynomials(2, 3, 1, 2, 3, 1, true);
    expect(lines(zero).pop()).toBe('0');
    // (2x² + 3x + 1) + (−2x² + 2x + 2) = 5x + 3
    const partial = buildAddPolynomials(2, 3, 1, -2, 2, 2, false);
    expect(lines(partial).pop()).toBe('5x + 3');
  });

  it('handles negative middle coefficients', () => {
    // (x² − 4x + 2) + (3x² + x − 5) = 4x² − 3x − 3
    const s = buildAddPolynomials(1, -4, 2, 3, 1, -5, false);
    const l = lines(s);
    expect(l[0]).toBe('(x² − 4x + 2) + (3x² + x − 5)');
    expect(l[l.length - 1]).toBe('4x² − 3x − 3');
  });
});

describe('buildFoil', () => {
  it('walks First·Outer·Inner·Last, then combines the middle terms', () => {
    // (x + 5)(x − 6) = x² − 6x + 5x − 30 = x² − x − 30
    const s = buildFoil(5, -6);
    const l = lines(s);
    expect(l.length).toBe(8);
    expect(l[0]).toBe('(x + 5) (x − 6)');
    expect(l[5]).toBe('x² − 6x + 5x − 30'); // the four products, before combining
    expect(l[l.length - 1]).toBe('x² − x − 30');
  });

  it('renders positive results with all + signs', () => {
    // (x + 2)(x + 3) = x² + 5x + 6
    expect(lines(buildFoil(2, 3)).pop()).toBe('x² + 5x + 6');
  });

  it('handles coefficient-1 outer/inner terms', () => {
    // (x − 1)(x + 4) = x² + 4x − x − 4 = x² + 3x − 4
    const l = lines(buildFoil(-1, 4));
    expect(l[0]).toBe('(x − 1) (x + 4)');
    expect(l[5]).toBe('x² + 4x − x − 4');
    expect(l.pop()).toBe('x² + 3x − 4');
  });

  it('cancels the middle term when Outer + Inner sum to zero', () => {
    // (x + 6)(x − 6) = x² − 36 (difference of squares)
    const s = buildFoil(6, -6);
    expect(lines(s).pop()).toBe('x² − 36');
    expect(lastStep(s).tokens.some((tk) => tk.id === 'M')).toBe(false);
  });
});

describe('buildGcfMonomials', () => {
  it('finds the GCF of two monomials, using the smaller exponent', () => {
    // GCF(6x², 9x³) = 3x²
    const s = buildGcfMonomials(6, 9, 2, 3);
    const l = lines(s);
    expect(l[0]).toBe('6x², 9x³');
    expect(l[l.length - 1]).toBe('3x²');
    const final = lastStep(s).tokens.filter((t) => t.emph === 'result');
    expect(final.map((t) => t.text).join('')).toBe('3x²');
  });

  it('reduces the coefficient GCF and keeps the lowest power (up to x⁶)', () => {
    // GCF(12x⁴, 8x⁶) = 4x⁴
    expect(lines(buildGcfMonomials(12, 8, 4, 6)).pop()).toBe('4x⁴');
  });
});

describe('buildFactorGcf', () => {
  it('factors (g·a)x² + (g·b)x as g·x(a·x + b)', () => {
    // 12x² + 6x = 6x(2x + 1)  (g=6, a=2, b=1)
    const s = buildFactorGcf(6, 2, 1);
    const l = lines(s);
    expect(l[0]).toBe('12x² + 6x');
    expect(l[l.length - 1]).toBe('6x(2x + 1)');
  });

  it('handles a negative second coefficient', () => {
    // 12x² − 15x = 3x(4x − 5)  (g=3, a=4, b=-5)
    const s = buildFactorGcf(3, 4, -5);
    const l = lines(s);
    expect(l[0]).toBe('12x² − 15x');
    expect(l[l.length - 1]).toBe('3x(4x − 5)');
  });
});

describe('buildSlopeFromPoints', () => {
  it('substitutes, computes, and simplifies the fraction', () => {
    // (1, 2) → (5, 8): rise 6, run 4 → 3/2
    expect(lines(buildSlopeFromPoints(1, 2, 5, 8))).toEqual([
      'm = (y₂ − y₁)/(x₂ − x₁)',
      'm = (8 − (2))/(5 − (1))',
      'm = 6/4',
      'm = 3/2',
    ]);
  });

  it('collapses to an integer slope when the run divides the rise', () => {
    // (0, 0) → (2, 6): 6/2 → 3
    const s = buildSlopeFromPoints(0, 0, 2, 6)!;
    expect(lines(s)[lines(s).length - 1]).toBe('m = 3');
    const final = lastStep(s).tokens.find((t) => t.id === 'fr');
    expect(final?.kind).toBe('num');
    expect(final?.emph).toBe('result');
  });

  it('moves a negative run sign to the numerator', () => {
    // (3, 1) → (0, 2): rise 1, run −3 → −1/3
    const l = lines(buildSlopeFromPoints(3, 1, 0, 2));
    expect(l[l.length - 1]).toBe('m = −1/3');
  });

  it('keeps an already-simplest fraction and marks it the result', () => {
    // (0, 0) → (3, 2): 2/3 already reduced
    const s = buildSlopeFromPoints(0, 0, 3, 2)!;
    const l = lines(s);
    expect(l[l.length - 1]).toBe('m = 2/3');
    expect(lastStep(s).holdMs).toBeGreaterThan(2200);
  });

  it('handles a zero rise (horizontal line)', () => {
    const l = lines(buildSlopeFromPoints(1, 4, 5, 4));
    expect(l[l.length - 1]).toBe('m = 0');
  });

  it('returns null for a vertical line', () => {
    expect(buildSlopeFromPoints(2, 1, 2, 5)).toBeNull();
  });
});

describe('buildSlopeInterceptRewrite', () => {
  it('rewrites −mx + y = b as y = mx + b', () => {
    expect(lines(buildSlopeInterceptRewrite(2, 5))).toEqual([
      '−2x + y = 5',
      '−2x + y + 2x = 5 + 2x',
      '−2x + y + 2x = 5 + 2x', // emphasis-only cancel beat
      'y = 2x + 5',
    ]);
  });

  it('handles negative m and b', () => {
    const l = lines(buildSlopeInterceptRewrite(-3, -7));
    expect(l[0]).toBe('3x + y = −7');
    expect(l[1]).toBe('3x + y − 3x = −7 − 3x');
    expect(l[l.length - 1]).toBe('y = −3x − 7');
  });
});

describe('lesson script registry', () => {
  it('registers the slope scripts for lessons 5.2 and 5.3', () => {
    expect(scriptsByLessonCode['5.2']?.[0]?.id).toBe('slope-two-points');
    expect(scriptsByLessonCode['5.3']?.[0]?.id).toBe('slope-intercept');
  });

  it('registers the add-polynomials and FOIL scripts for lesson 2.3', () => {
    expect(scriptsByLessonCode['2.3']?.map((s) => s.id)).toEqual(['poly-add', 'foil']);
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

  it('routes add_polynomials params to the polynomial builder', () => {
    const s = buildScriptForProblem('polynomial-operations', {
      a1: 3, b1: 2, c1: 4, a2: 2, b2: 5, c2: 1, sub: false,
    });
    expect(lines(s)[0]).toBe('(3x² + 2x + 4) + (2x² + 5x + 1)');
  });

  it('routes foil {p, q} params under the same skill to the FOIL builder', () => {
    const s = buildScriptForProblem('polynomial-operations', { p: 5, q: -6 });
    expect(lines(s)[0]).toBe('(x + 5) (x − 6)');
    expect(lines(s).pop()).toBe('x² − x − 30');
    // mono_times_poly ({m, a, b}) shares the skill but stays unanimated
    expect(buildScriptForProblem('polynomial-operations', { m: 2, a: 3, b: 4 })).toBeNull();
  });

  it('routes factor-gcf gcf_monomials params to the GCF-of-monomials builder', () => {
    const s = buildScriptForProblem('factor-gcf', { m1: 6, m2: 9, e1: 2, e2: 3 });
    expect(lines(s)[0]).toBe('6x², 9x³');
    expect(lines(s).pop()).toBe('3x²');
  });

  it('routes factor-gcf factor_gcf params to the factoring builder', () => {
    const s = buildScriptForProblem('factor-gcf', { g: 6, a: 2, b: 1 });
    expect(lines(s)[0]).toBe('12x² + 6x');
    expect(lines(s).pop()).toBe('6x(2x + 1)');
  });

  it('routes slope-intercepts point params to the slope builder', () => {
    const s = buildScriptForProblem('slope-intercepts', { x1: 1, y1: 2, x2: 5, y2: 8 });
    expect(lines(s)[0]).toBe('m = (y₂ − y₁)/(x₂ − x₁)');
  });

  it('routes slope-intercept-form {m, b} params to the rewrite builder', () => {
    const s = buildScriptForProblem('slope-intercept-form', { m: 2, b: 5 });
    expect(lines(s)[0]).toBe('−2x + y = 5');
  });

  it('does not animate identify_slope_yint read-off questions', () => {
    expect(buildScriptForProblem('slope-intercepts', { m: 2, b: 5, which: true })).toBeNull();
    expect(buildScriptForProblem('slope-intercept-form', { m: 2, b: 5, which: false })).toBeNull();
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
