import { describe, expect, it } from 'vitest';
import { diagnoseMisconception } from './misconceptions.js';
import { generateProblem, makeRng } from './generators.js';

describe('diagnoseMisconception', () => {
  it('recognizes the added-instead-of-subtracted error on two-step equations', () => {
    const rng = makeRng(11);
    const p = generateProblem('two_step_equation', rng);
    const { a, b } = p.params as { a: number; b: number };
    const c = Number(p.answerLatex) * a + b;
    const wrong = `(${c + b})/(${a})`;
    const hit = diagnoseMisconception(wrong, p.misconceptions);
    expect(hit?.id).toBe('inverse_operation_error');
    expect(hit?.feedbackEn).toContain('INVERSE');
  });

  it('recognizes a forgotten middle term on FOIL problems', () => {
    const rng = makeRng(5);
    const p = generateProblem('foil', rng);
    const { p: r1, q: r2 } = p.params as { p: number; q: number };
    const wrong = `x^2 + ${r1 * r2}`.replace('+ -', '- ');
    const hit = diagnoseMisconception(wrong, p.misconceptions);
    expect(hit?.id).toBe('foil_missed_middle_terms');
  });

  it('recognizes an unflipped inequality symbol', () => {
    // find an instance with a negative coefficient (flip required)
    const rng = makeRng(3);
    for (let i = 0; i < 50; i++) {
      const p = generateProblem('two_step_inequality', rng);
      const m = p.misconceptions?.find((m) => m.id === 'missed_inequality_flip');
      if (!m) continue;
      expect(diagnoseMisconception(m.answerLatex, p.misconceptions)?.id).toBe(
        'missed_inequality_flip',
      );
      return;
    }
    throw new Error('no negative-coefficient inequality generated in 50 tries');
  });

  it('matches equivalent forms of the predicted wrong answer, not just exact text', () => {
    const rng = makeRng(21);
    for (let i = 0; i < 50; i++) {
      const p = generateProblem('slope_two_points', rng);
      const m = p.misconceptions?.find((m) => m.id === 'slope_rise_run_inverted');
      if (!m) continue;
      // submit the inverted slope as a decimal instead of a fraction
      const [num, den] = m.answerLatex
        .split('/')
        .map((s) => Number(s.replace(/[()]/g, '')));
      if (!Number.isInteger(num / den)) continue;
      expect(diagnoseMisconception(String(num / den), p.misconceptions)?.id).toBe(
        'slope_rise_run_inverted',
      );
      return;
    }
    throw new Error('no integer inverted slope generated in 50 tries');
  });

  it('returns null for unrelated wrong answers and empty input', () => {
    const p = generateProblem('two_step_equation', makeRng(11));
    expect(diagnoseMisconception('123456', p.misconceptions)).toBeNull();
    expect(diagnoseMisconception('', p.misconceptions)).toBeNull();
    expect(diagnoseMisconception('5', undefined)).toBeNull();
  });
});
