import { describe, expect, it } from 'vitest';
import { misconceptionCatalog, misconceptionLabel } from './misconceptionCatalog.js';
import { generateProblem, generators, makeRng, type GeneratorTier } from './generators.js';

const TIERS: GeneratorTier[] = ['modified', 'standard', 'challenge'];

describe('misconceptionCatalog', () => {
  it('labels every misconception id the generators can emit', () => {
    // Sample every generator × tier across many seeds; ids are parameter-
    // independent, so a healthy sample surfaces the full id set.
    const seen = new Set<string>();
    for (const template of Object.keys(generators)) {
      for (const tier of TIERS) {
        for (let seed = 1; seed <= 40; seed++) {
          const p = generateProblem(template, makeRng(seed), tier);
          for (const m of p.misconceptions ?? []) seen.add(m.id);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    const unlabeled = [...seen].filter((id) => !(id in misconceptionCatalog));
    expect(unlabeled).toEqual([]);
  });

  it('resolves labels per locale and falls back to a readable slug', () => {
    expect(misconceptionLabel('missed_inequality_flip', 'en')).toContain('inequality');
    expect(misconceptionLabel('missed_inequality_flip', 'es')).toContain('desigualdad');
    expect(misconceptionLabel('some_future_id', 'en')).toBe('some future id');
  });
});
