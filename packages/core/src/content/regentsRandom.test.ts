import { describe, expect, it } from 'vitest';
import { regentsTopics } from './regents.js';
import {
  REGENTS_BANK_SIZE,
  REGENTS_ROUND_SIZE,
  generateRegentsQuestion,
  parseRegentsGeneratedId,
  regentsGeneratedId,
  regentsQuestionSeed,
  regentsSlotGenerators,
} from './regentsRandom.js';

const slots = Array.from({ length: REGENTS_ROUND_SIZE }, (_, i) => i + 1);

describe('regents generated question ids', () => {
  it('round-trips through format and parse', () => {
    const id = regentsGeneratedId('linear-equations', 3, 2);
    expect(id).toBe('linear-equations:r3:q2');
    expect(parseRegentsGeneratedId(id)).toEqual({ slug: 'linear-equations', round: 3, slot: 2 });
    const topUp = regentsGeneratedId('linear-equations', 0, 10);
    expect(topUp).toBe('linear-equations:r0:q10');
    expect(parseRegentsGeneratedId(topUp)).toEqual({
      slug: 'linear-equations',
      round: 0,
      slot: 10,
    });
  });

  it('rejects static-bank ids, bank-owned round-0 slots, and malformed input', () => {
    expect(parseRegentsGeneratedId('linear-equations-q1')).toBeNull();
    // Round 0 slots 1..REGENTS_BANK_SIZE belong to the handwritten bank.
    for (let slot = 1; slot <= REGENTS_BANK_SIZE; slot++) {
      expect(parseRegentsGeneratedId(`linear-equations:r0:q${slot}`)).toBeNull();
    }
    expect(parseRegentsGeneratedId(`linear-equations:r1:q${REGENTS_ROUND_SIZE + 1}`)).toBeNull();
    expect(parseRegentsGeneratedId('nope:r1:')).toBeNull();
  });

  it('derives distinct, stable seeds per user/topic/round/slot', () => {
    const a = regentsQuestionSeed(7, 'systems', 1, 1);
    expect(regentsQuestionSeed(7, 'systems', 1, 1)).toBe(a);
    expect(regentsQuestionSeed(8, 'systems', 1, 1)).not.toBe(a);
    expect(regentsQuestionSeed(7, 'systems', 2, 1)).not.toBe(a);
    expect(regentsQuestionSeed(7, 'systems', 1, 2)).not.toBe(a);
  });
});

describe('regents slot generators', () => {
  it('covers every topic in the handwritten bank', () => {
    for (const topic of regentsTopics) {
      expect(regentsSlotGenerators[topic.slug], topic.slug).toBeDefined();
      expect(regentsSlotGenerators[topic.slug].length).toBeGreaterThanOrEqual(1);
    }
  });

  it('produces valid, bilingual questions with four distinct choices for many seeds', () => {
    for (const topic of regentsTopics) {
      for (const slot of slots) {
        for (let seed = 1; seed <= 25; seed++) {
          const q = generateRegentsQuestion(topic.slug, slot, seed * 2654435761);
          const label = `${topic.slug} q${slot} seed ${seed}`;
          expect(q.promptEn.length, label).toBeGreaterThan(10);
          expect(q.promptEs.length, label).toBeGreaterThan(10);
          expect(q.explanationEn.length, label).toBeGreaterThan(20);
          expect(q.explanationEs.length, label).toBeGreaterThan(20);
          expect(q.choicesEn, label).toHaveLength(4);
          expect(q.choicesEs, label).toHaveLength(4);
          expect(new Set(q.choicesEn).size, label).toBe(4);
          expect(new Set(q.choicesEs).size, label).toBe(4);
          expect(q.correctIndex, label).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex, label).toBeLessThan(4);
        }
      }
    }
  });

  it('is deterministic: the same seed always yields the identical question', () => {
    for (const topic of regentsTopics) {
      for (const slot of slots) {
        const a = generateRegentsQuestion(topic.slug, slot, 424242);
        const b = generateRegentsQuestion(topic.slug, slot, 424242);
        expect(b).toEqual(a);
      }
    }
  });

  it('varies across seeds so a renewed round feels fresh', () => {
    for (const topic of regentsTopics) {
      for (const slot of slots) {
        const seen = new Set<string>();
        for (let seed = 1; seed <= 25; seed++) {
          const q = generateRegentsQuestion(topic.slug, slot, seed * 97);
          seen.add(q.promptEn + '|' + q.choicesEn.join('|'));
        }
        expect(seen.size, `${topic.slug} q${slot}`).toBeGreaterThan(1);
      }
    }
  });

  it('throws on unknown topics or slots', () => {
    expect(() => generateRegentsQuestion('nope', 1, 1)).toThrow(/no regents generators/);
    expect(() => generateRegentsQuestion('systems', REGENTS_ROUND_SIZE + 1, 1)).toThrow(
      /bad regents slot/,
    );
    expect(() => generateRegentsQuestion('systems', 0, 1)).toThrow(/bad regents slot/);
  });
});
