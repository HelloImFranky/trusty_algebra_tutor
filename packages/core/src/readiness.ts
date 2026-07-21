/**
 * Regents readiness (docs/statistics-plan.md, Phase 2). Per Regents Review
 * topic, blend two evidence streams into a coarse band:
 *
 *   - average decayed mastery over the topic's linked curriculum skills
 *     (only skills the student has actually attempted), and
 *   - lifetime Regents Review accuracy on the topic (all rounds), once
 *     there's enough of it to mean anything.
 *
 * Deliberately a traffic light, not a predicted score — the app has no
 * business faking a scaled Regents score from practice data. Shared by the
 * student progress page, the teacher class grid, and the admin school
 * distribution so all three always agree.
 */

export type ReadinessBand = 'ready' | 'developing' | 'needsWork' | 'noData';

/** Regents accuracy needs at least this many answers before it counts. */
export const READINESS_MIN_REGENTS_ANSWERS = 3;

const READY_AT = 0.75;
const DEVELOPING_AT = 0.5;

export interface ReadinessEvidence {
  /** Mean decayed mastery over linked skills with attempts; null = none attempted. */
  masteryAvg: number | null;
  /** Lifetime Regents answers on the topic (all rounds). */
  regentsAnswered: number;
  regentsCorrect: number;
}

export function readinessBand(e: ReadinessEvidence): ReadinessBand {
  const accuracy =
    e.regentsAnswered >= READINESS_MIN_REGENTS_ANSWERS ? e.regentsCorrect / e.regentsAnswered : null;
  const parts = [e.masteryAvg, accuracy].filter((p): p is number => p !== null);
  if (parts.length === 0) return 'noData';
  const blend = parts.reduce((sum, p) => sum + p, 0) / parts.length;
  if (blend >= READY_AT) return 'ready';
  if (blend >= DEVELOPING_AT) return 'developing';
  return 'needsWork';
}

/**
 * Regents topic → curriculum skill slugs. The alignment behind the mastery
 * half of the blend; a test asserts every slug here exists in the seeded
 * curriculum and every Regents topic has an entry. `statistics` has no
 * curriculum unit yet, so its readiness rests on Regents accuracy alone.
 */
export const regentsTopicSkillSlugs: Record<string, string[]> = {
  'exponents-radicals': [
    'exponents-perfect-squares',
    'simplify-radicals',
    'radical-operations',
    'rational-irrational',
  ],
  'linear-equations': [
    'evaluate-expressions',
    'combine-like-terms',
    'multi-step-equations',
    'var-both-sides',
  ],
  inequalities: ['inequalities'],
  'linear-functions': [
    'identify-linear',
    'slope-intercepts',
    'slope-intercept-form',
    'understanding-functions',
    'evaluate-functions',
  ],
  systems: ['systems-substitution', 'systems-elimination'],
  polynomials: ['polynomial-operations'],
  factoring: ['factor-gcf', 'factor-trinomials'],
  quadratics: [
    'quadratics-factoring',
    'quadratics-sqrt',
    'quadratics-graphing',
    'quadratics-realworld',
  ],
  'exponential-functions': ['exponential-functions', 'growth-decay'],
  statistics: [],
};
