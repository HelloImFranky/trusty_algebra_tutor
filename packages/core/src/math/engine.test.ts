import { describe, expect, it } from 'vitest';
import {
  areEquivalent,
  exactMatch,
  grade,
  isCanonicalPolynomial,
  isFactoredForm,
  normalizeInput,
  radicalsFullySimplified,
} from './engine.js';

describe('normalizeInput', () => {
  it('converts LaTeX fractions, roots and operators', () => {
    expect(normalizeInput('\\frac{1}{2}x')).toBe('((1)/(2))x');
    expect(normalizeInput('\\sqrt{50}')).toBe('sqrt(50)');
    expect(normalizeInput('x^{2}+3\\cdot x')).toBe('x^(2)+3* x');
    expect(normalizeInput('x\\le 5')).toBe('x<= 5');
  });
});

describe('areEquivalent', () => {
  it('accepts commutative rearrangement', () => {
    expect(areEquivalent('2x+3', '3+2x')).toBe(true);
  });
  it('rejects different expressions', () => {
    expect(areEquivalent('2x+3', '2x-3')).toBe(false);
    expect(areEquivalent('x^2', 'x^3')).toBe(false);
  });
  it('handles radicals', () => {
    expect(areEquivalent('sqrt(50)', '5sqrt(2)')).toBe(true);
    expect(areEquivalent('sqrt(50)', '5sqrt(3)')).toBe(false);
  });
  it('handles pure numbers', () => {
    expect(areEquivalent('1/2', '0.5')).toBe(true);
    expect(areEquivalent('-3', '3')).toBe(false);
  });
  it('treats equations up to scaling and rearrangement', () => {
    expect(areEquivalent('y=2x+5', 'y-2x=5')).toBe(true);
    expect(areEquivalent('y=2x+5', '2y=4x+10')).toBe(true);
    expect(areEquivalent('y=2x+5', 'y=2x-5')).toBe(false);
    expect(areEquivalent('x=3', '2x=6')).toBe(true);
    expect(areEquivalent('y=2x+5', '2x+5')).toBe(false);
  });
});

describe('canonical polynomial form (standard form, like terms combined)', () => {
  it('accepts standard form', () => {
    expect(isCanonicalPolynomial('-5x^2+x+105')).toBe(true);
    expect(isCanonicalPolynomial('x^2+2x-8')).toBe(true);
    expect(isCanonicalPolynomial('7')).toBe(true);
  });
  it('rejects uncombined like terms', () => {
    expect(isCanonicalPolynomial('2x+5-3x')).toBe(false);
  });
  it('rejects non-standard ordering', () => {
    expect(isCanonicalPolynomial('5+x^2')).toBe(false);
    expect(isCanonicalPolynomial('2x+x^2')).toBe(false);
  });
});

describe('radical simplification', () => {
  it('accepts fully simplified radicals', () => {
    expect(radicalsFullySimplified('5sqrt(2)')).toBe(true);
    expect(radicalsFullySimplified('sqrt(30)')).toBe(true);
  });
  it('rejects radicands with square factors', () => {
    expect(radicalsFullySimplified('sqrt(50)')).toBe(false);
    expect(radicalsFullySimplified('2sqrt(12)')).toBe(false);
  });
});

describe('factored form', () => {
  it('recognizes factored expressions', () => {
    expect(isFactoredForm('(x+2)(x+3)')).toBe(true);
    expect(isFactoredForm('3x^2(4x^2-2x+1)')).toBe(true);
    expect(isFactoredForm('(2x+3)(2x-3)')).toBe(true);
  });
  it('rejects expanded expressions', () => {
    expect(isFactoredForm('x^2+5x+6')).toBe(false);
    expect(isFactoredForm('x^2')).toBe(false);
  });
});

describe('exactMatch', () => {
  it('ignores whitespace and case', () => {
    expect(exactMatch('Rational', ' rational ')).toBe(true);
  });
  it('accepts comma lists in any order', () => {
    expect(exactMatch('3, -5', '-5,3')).toBe(true);
    expect(exactMatch('3, -5', '3,5')).toBe(false);
  });
  it('canonicalizes inequality orientation', () => {
    expect(exactMatch('5 > x', 'x < 5')).toBe(true);
    expect(exactMatch('x >= -2', '-2 <= x')).toBe(true);
    expect(exactMatch('x > 5', 'x < 5')).toBe(false);
  });
});

describe('grade()', () => {
  it('equivalent mode', () => {
    expect(grade('3+2x', '2x+3', 'equivalent').correct).toBe(true);
    expect(grade('2x-3', '2x+3', 'equivalent').correct).toBe(false);
  });
  it('canonical_form mode flags equivalent-but-unsimplified', () => {
    const r = grade('2x+5-3x', '-x+5', 'canonical_form');
    expect(r.correct).toBe(false);
    expect(r.equivalentButNotCanonical).toBe(true);
    expect(grade('-x+5', '-x+5', 'canonical_form').correct).toBe(true);
    expect(grade('5-x', '-x+5', 'canonical_form').correct).toBe(false);
  });
  it('canonical_form with radical keys', () => {
    expect(grade('5\\sqrt{2}', '5sqrt(2)', 'canonical_form').correct).toBe(true);
    const r = grade('\\sqrt{50}', '5sqrt(2)', 'canonical_form');
    expect(r.correct).toBe(false);
    expect(r.equivalentButNotCanonical).toBe(true);
  });
  it('canonical_form with factored keys', () => {
    expect(grade('(x+3)(x+2)', '(x+2)(x+3)', 'canonical_form').correct).toBe(true);
    const r = grade('x^2+5x+6', '(x+2)(x+3)', 'canonical_form');
    expect(r.correct).toBe(false);
    expect(r.equivalentButNotCanonical).toBe(true);
  });
  it('FOIL: expanded answer required, factored input rejected', () => {
    expect(grade('x^2-x-30', 'x^2-x-30', 'canonical_form').correct).toBe(true);
    expect(grade('(x+5)(x-6)', 'x^2-x-30', 'canonical_form').correct).toBe(false);
  });
  it('numeric tolerance', () => {
    expect(grade('80.7', '80.66', 'numeric_tolerance', 0.1).correct).toBe(true);
    expect(grade('81.7', '80.66', 'numeric_tolerance', 0.1).correct).toBe(false);
  });
  it('exact mode allows equivalent constants', () => {
    expect(grade('0.5', '1/2', 'exact').correct).toBe(true);
    expect(grade('x=4', 'x=4', 'exact').correct).toBe(true);
  });
  it('solution pairs', () => {
    expect(grade('(-3, 2)', '(-3,2)', 'exact').correct).toBe(true);
  });
});
