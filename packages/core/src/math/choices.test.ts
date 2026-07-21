import { describe, expect, it } from 'vitest';
import { answerChoicesFor } from './choices.js';
import { generators, generateProblem, makeRng } from './generators.js';
import { grade } from './engine.js';

describe('answerChoicesFor', () => {
  it('returns null for free-response / missing params', () => {
    expect(answerChoicesFor(null)).toBeNull();
    expect(answerChoicesFor({})).toBeNull();
    expect(answerChoicesFor({ template: 'slope_two_points' })).toBeNull();
  });

  it('maps the word-answer templates to their choice sets', () => {
    expect(answerChoicesFor({ template: 'rational_irrational' })).toEqual(['rational', 'irrational']);
    expect(answerChoicesFor({ template: 'is_function' })).toEqual(['yes', 'no']);
    expect(answerChoicesFor({ template: 'linear_vs_exponential' })).toEqual(['linear', 'exponential']);
    expect(answerChoicesFor({ template: 'classify_function_type' })).toEqual([
      'linear',
      'quadratic',
      'exponential',
    ]);
    expect(answerChoicesFor({ template: 'transformation_identify', kind: 0 })).toEqual(['up', 'down']);
    expect(answerChoicesFor({ template: 'transformation_identify', kind: 1 })).toEqual(['left', 'right']);
    expect(answerChoicesFor({ template: 'transformation_identify', kind: 2 })).toEqual(['up', 'down']);
  });

  // Every choice question's generated answer must be one of the offered
  // choices, and picking that choice must grade correct — otherwise the
  // buttons could never produce a right answer.
  const choiceTemplates = [
    'rational_irrational',
    'is_function',
    'linear_vs_exponential',
    'classify_function_type',
    'transformation_identify',
  ];
  it.each(choiceTemplates)('%s answer is always an offered, correctly-graded choice', (template) => {
    const rng = makeRng(7);
    for (let i = 0; i < 30; i++) {
      const p = generateProblem(template, rng);
      const choices = answerChoicesFor(p.params);
      expect(choices).not.toBeNull();
      expect(choices).toContain(p.answerLatex);
      expect(grade(p.answerLatex, p.answerLatex, p.gradingMode, p.tolerance).correct).toBe(true);
    }
  });

  it('covers exactly the choice-style generators (guard against new ones)', () => {
    // If a new word-answer generator is added, add it to answerChoicesFor
    // and to choiceTemplates above.
    const known = new Set(choiceTemplates);
    for (const t of Object.keys(generators)) {
      const sample = generateProblem(t, makeRng(1));
      const looksLikeChoice = /\(answer:|\(responde:/.test(sample.promptEn + sample.promptEs) ||
        /Classify the function/.test(sample.promptEn);
      if (looksLikeChoice) expect(known.has(t)).toBe(true);
    }
  });
});
