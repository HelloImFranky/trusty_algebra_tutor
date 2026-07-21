import { describe, expect, it } from 'vitest';
import { keypadKindForAnswer, keypadKindForProblem, KEYPAD_FOR_TEMPLATE } from './keypad.js';
import { answerChoicesFor } from './choices.js';
import { generators, generateProblem, makeRng } from './generators.js';

describe('keypadKindForAnswer', () => {
  it('routes bare numbers to the numeric pad', () => {
    for (const a of ['5', '-12', '0', '348.05', '-4', '31680', '7.45']) {
      expect(keypadKindForAnswer(a)).toBe('numeric');
    }
  });

  it('routes expressions / equations / lists / radicals to the algebra pad', () => {
    for (const a of [
      'x^{6}',
      '-3x^2 + x - 1',
      'y = -3x - 2',
      '(-3, -1)',
      'x < -2',
      '3\\sqrt{5}',
      '(3)/(1)',
      '4, -4',
      '(x - 4)(x - 2)',
    ]) {
      expect(keypadKindForAnswer(a)).toBe('algebra');
    }
  });

  // Every free-response (non-choice) generator's answer must resolve to a
  // pad, and — crucially — a bare-number answer must never be sent to the
  // algebra pad's classifier as 'algebra' (that would show operators the
  // number never needs). This locks the classifier to the real answer bank.
  it('classifies every generated free-response answer sensibly', () => {
    for (const t of Object.keys(generators)) {
      for (let i = 0; i < 8; i++) {
        const p = generateProblem(t, makeRng(i + 1));
        if (answerChoicesFor(p.params)) continue; // choice question — no keypad
        const kind = keypadKindForAnswer(p.answerLatex);
        const isBareNumber = /^-?\d+(\.\d+)?$/.test(p.answerLatex.trim());
        expect(kind).toBe(isBareNumber ? 'numeric' : 'algebra');
      }
    }
  });
});

describe('keypadKindForProblem', () => {
  it('picks the per-lesson pad from the generator template', () => {
    const cases: [string, ReturnType<typeof keypadKindForProblem>][] = [
      ['simplify_radical', 'radical'],
      ['exponent_product_rule', 'exponent'],
      ['add_polynomials', 'polynomial'],
      ['foil', 'polynomial'],
      ['two_step_inequality', 'inequality'],
      ['slope_intercept_rewrite', 'linear'],
      ['system_substitution', 'points'],
      ['factor_trinomial', 'factor'],
      ['dimensional_analysis', 'numeric'],
    ];
    for (const [template, expected] of cases) {
      // answerLatex intentionally mismatched — the template must win over shape.
      expect(keypadKindForProblem({ template }, 'x^2 + 1')).toBe(expected);
    }
  });

  it('falls back to the answer shape when there is no template', () => {
    expect(keypadKindForProblem(null, '42')).toBe('numeric');
    expect(keypadKindForProblem({}, '-3x + 1')).toBe('algebra');
    // A template we deliberately leave unmapped (needs the general pad) also
    // falls through to the shape classifier.
    expect(keypadKindForProblem({ template: 'exponential_write' }, 'f(x) = 250(2)^x')).toBe(
      'algebra',
    );
  });

  it('only maps real generator templates (no typos)', () => {
    for (const template of Object.keys(KEYPAD_FOR_TEMPLATE)) {
      expect(generators[template], `unknown template "${template}"`).toBeDefined();
    }
  });

  // The numeric pad has no operators at all, so any template routed to it must
  // only ever produce bare-number answers — otherwise a student would be
  // unable to type part of the answer.
  it('never sends a non-numeric answer to the numeric pad', () => {
    const numericTemplates = Object.entries(KEYPAD_FOR_TEMPLATE)
      .filter(([, kind]) => kind === 'numeric')
      .map(([t]) => t);
    for (const t of numericTemplates) {
      for (let i = 0; i < 20; i++) {
        const p = generateProblem(t, makeRng(i + 1));
        expect(/^-?\d+(\.\d+)?$/.test(p.answerLatex.trim()), `${t} → ${p.answerLatex}`).toBe(true);
      }
    }
  });
});
