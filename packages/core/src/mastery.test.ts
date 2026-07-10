import { describe, expect, it } from 'vitest';
import { decayedScore, masteryLabel, tierForScore, updateMastery } from './mastery.js';

describe('mastery model', () => {
  it('rises with correct answers and falls with wrong ones', () => {
    let state = { score: 0, attemptsCount: 0, lastPracticedAt: null as Date | null };
    for (let i = 0; i < 6; i++) state = updateMastery(state, true, 0);
    expect(state.score).toBeGreaterThan(0.8);
    const afterMiss = updateMastery(state, false, 0);
    expect(afterMiss.score).toBeLessThan(state.score);
  });

  it('discounts hint-assisted correct answers', () => {
    const base = { score: 0.5, attemptsCount: 4, lastPracticedAt: new Date() };
    const clean = updateMastery(base, true, 0);
    const hinted = updateMastery(base, true, 3);
    expect(hinted.score).toBeLessThan(clean.score);
  });

  it('decays toward 0.5 with time (recency weighting)', () => {
    const fresh = { score: 0.95, attemptsCount: 10, lastPracticedAt: new Date() };
    const now = new Date();
    const monthLater = new Date(now.getTime() + 42 * 86400_000);
    expect(decayedScore(fresh, monthLater)).toBeLessThan(0.95);
    expect(decayedScore(fresh, monthLater)).toBeGreaterThan(0.5);
    const weak = { score: 0.1, attemptsCount: 10, lastPracticedAt: new Date() };
    expect(decayedScore(weak, monthLater)).toBeGreaterThan(0.1);
  });

  it('maps mastery to differentiation tiers', () => {
    expect(tierForScore(0, 0)).toBe('standard'); // first exposure
    expect(tierForScore(0.2, 3)).toBe('modified');
    expect(tierForScore(0.6, 3)).toBe('standard');
    expect(tierForScore(0.9, 3)).toBe('challenge');
  });

  it('labels progress for the dashboard', () => {
    expect(masteryLabel(0, 0)).toBe('not_started');
    expect(masteryLabel(0.3, 2)).toBe('struggling');
    expect(masteryLabel(0.6, 2)).toBe('practicing');
    expect(masteryLabel(0.8, 2)).toBe('proficient');
    expect(masteryLabel(0.95, 2)).toBe('mastered');
  });
});
