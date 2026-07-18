import { describe, expect, it } from 'vitest';
import { generators, generateProblem, makeRng, sprintTopicDefs } from './generators.js';
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

  const sprintTemplates = [
    'sprint_integer_ops',
    'sprint_perfect_squares',
    'sprint_one_step_equations',
    'sprint_fraction_ops',
    'sprint_decimal_ops',
    'sprint_percent_of',
    'sprint_order_of_ops',
    'sprint_proportions',
  ] as const;
  const tiers = ['modified', 'standard', 'challenge'] as const;

  it.each(sprintTemplates)('%s generates valid problems at every tier', (template) => {
    for (const tier of tiers) {
      const rng = makeRng(11);
      for (let i = 0; i < 25; i++) {
        const p = generateProblem(template, rng, tier);
        expect(grade(p.answerLatex, p.answerLatex, p.gradingMode, p.tolerance).correct).toBe(true);
      }
    }
  });

  it.each(sprintTemplates)(
    '%s standard tier matches the pre-tier rng stream (seed replay compatibility)',
    (template) => {
      // Already-seeded databases are synced by replaying the generator
      // streams — the standard tier must reproduce what an untiered call
      // produced, or the replay would stop matching existing rows.
      const untiered = generateProblem(template, makeRng(42));
      const standard = generateProblem(template, makeRng(42), 'standard');
      expect(standard).toEqual(untiered);
    },
  );

  it('sprint_one_step_equations challenge produces two-step equations', () => {
    const p = generateProblem('sprint_one_step_equations', makeRng(5), 'challenge');
    expect(p.params).toHaveProperty('b'); // ax + b = c shape
  });

  it('every sprint topic in the registry has a generator template', () => {
    for (const d of sprintTopicDefs) {
      expect(generators, `registry topic ${d.slug} has no generator`).toHaveProperty(d.slug);
    }
  });

  it('sprint_percent_of always produces whole-number answers', () => {
    for (const tier of tiers) {
      const rng = makeRng(3);
      for (let i = 0; i < 40; i++) {
        const p = generateProblem('sprint_percent_of', rng, tier);
        expect(Number.isInteger(Number(p.answerLatex))).toBe(true);
      }
    }
  });

  it('sprint_fraction_ops modified/standard results are never negative', () => {
    for (const tier of ['modified', 'standard'] as const) {
      const rng = makeRng(9);
      for (let i = 0; i < 40; i++) {
        const p = generateProblem('sprint_fraction_ops', rng, tier);
        expect(p.answerLatex.startsWith('(-')).toBe(false);
      }
    }
  });
});
