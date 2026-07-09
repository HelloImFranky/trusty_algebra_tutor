/**
 * Mastery model (design doc §4.3): "start simple: rolling accuracy with
 * recency weighting". Score in [0,1] per (user, skill).
 *
 * Each new attempt moves the score toward the attempt result with a step
 * that shrinks as evidence accumulates, and hint usage discounts the credit
 * for a correct answer. Time since last practice decays the score toward 0.5
 * (uncertainty), which is what re-surfaces stale skills in review mode.
 */

export interface MasteryState {
  score: number;
  attemptsCount: number;
  lastPracticedAt: Date | null;
}

const DECAY_HALF_LIFE_DAYS = 21;

export function decayedScore(state: MasteryState, now = new Date()): number {
  if (!state.lastPracticedAt || state.attemptsCount === 0) return state.score;
  const days =
    (now.getTime() - state.lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 0) return state.score;
  const decay = Math.pow(0.5, days / DECAY_HALF_LIFE_DAYS);
  return 0.5 + (state.score - 0.5) * decay;
}

export function updateMastery(
  state: MasteryState,
  correct: boolean,
  hintsUsed: number,
  now = new Date(),
): MasteryState {
  const prior = decayedScore(state, now);
  // Credit for a correct answer shrinks with hint-ladder depth.
  const outcome = correct ? Math.max(0.4, 1 - 0.15 * hintsUsed) : 0;
  // Larger steps early, settling to ~0.15 with experience.
  const step = Math.max(0.15, 1 / (1 + state.attemptsCount * 0.5));
  const score = Math.min(1, Math.max(0, prior + step * (outcome - prior)));
  return {
    score,
    attemptsCount: state.attemptsCount + 1,
    lastPracticedAt: now,
  };
}

export type Tier = 'modified' | 'standard' | 'challenge';

/**
 * Differentiation (§4.4): struggling students get the modified set and more
 * scaffold exposure; high performers get challenge problems.
 */
export function tierForScore(score: number, attemptsCount: number): Tier {
  if (attemptsCount === 0) return 'standard';
  if (score < 0.45) return 'modified';
  if (score >= 0.85) return 'challenge';
  return 'standard';
}

/** Soft mastery gate (§4.3): nudged, not blocked. */
export function masteryLabel(score: number, attemptsCount: number):
  | 'not_started'
  | 'struggling'
  | 'practicing'
  | 'proficient'
  | 'mastered' {
  if (attemptsCount === 0) return 'not_started';
  if (score < 0.45) return 'struggling';
  if (score < 0.7) return 'practicing';
  if (score < 0.9) return 'proficient';
  return 'mastered';
}
