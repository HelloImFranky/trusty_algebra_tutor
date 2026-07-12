import { describe, expect, it } from 'vitest';
import { generators, generateProblem, makeRng } from './generators.js';
import { grade } from './engine.js';

describe('problem generators', () => {
  const templates = Object.keys(generators);

  it.each(templates)('%s generates self-consistent problems', (template) => {
    const rng = makeRng(7);
    for (let i = 0; i < 25; i++) {
      const p = generateProblem(template, rng);
      expect(p.promptEn.length).toBeGreaterThan(0);
      expect(p.promptEs.length).toBeGreaterThan(0);
      // The answer key must pass its own grading mode.
      expect(
        grade(p.answerLatex, p.answerLatex, p.gradingMode, p.tolerance).correct,
        `${template}: key "${p.answerLatex}" failed self-grade`,
      ).toBe(true);
      for (const s of p.steps ?? []) {
        expect(
          grade(s.expectedLatex, s.expectedLatex, s.gradingMode, p.tolerance).correct,
          `${template}: step key "${s.expectedLatex}" failed self-grade`,
        ).toBe(true);
      }
      // Predicted wrong answers must actually be wrong.
      for (const m of p.misconceptions ?? []) {
        expect(
          grade(m.answerLatex, p.answerLatex, p.gradingMode, p.tolerance).correct,
          `${template}: misconception "${m.id}" (${m.answerLatex}) grades correct against key "${p.answerLatex}"`,
        ).toBe(false);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateProblem('foil', makeRng(123));
    const b = generateProblem('foil', makeRng(123));
    expect(a).toEqual(b);
  });
});
