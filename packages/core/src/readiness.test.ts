import { describe, expect, it } from 'vitest';
import { readinessBand, regentsTopicSkillSlugs } from './readiness.js';
import { curriculum, regentsTopics } from './content/index.js';

describe('readinessBand', () => {
  it('returns noData without any evidence', () => {
    expect(readinessBand({ masteryAvg: null, regentsAnswered: 0, regentsCorrect: 0 })).toBe('noData');
    // Too few Regents answers to count as evidence on their own.
    expect(readinessBand({ masteryAvg: null, regentsAnswered: 2, regentsCorrect: 2 })).toBe('noData');
  });

  it('bands on mastery alone when there are no Regents answers', () => {
    expect(readinessBand({ masteryAvg: 0.9, regentsAnswered: 0, regentsCorrect: 0 })).toBe('ready');
    expect(readinessBand({ masteryAvg: 0.6, regentsAnswered: 0, regentsCorrect: 0 })).toBe('developing');
    expect(readinessBand({ masteryAvg: 0.3, regentsAnswered: 0, regentsCorrect: 0 })).toBe('needsWork');
  });

  it('blends mastery and Regents accuracy with equal weight', () => {
    // 0.9 mastery but 3/10 Regents → blend 0.6 → developing, not ready.
    expect(readinessBand({ masteryAvg: 0.9, regentsAnswered: 10, regentsCorrect: 3 })).toBe(
      'developing',
    );
    // Weak mastery dragged up by strong Regents evidence.
    expect(readinessBand({ masteryAvg: 0.55, regentsAnswered: 10, regentsCorrect: 10 })).toBe(
      'ready',
    );
  });
});

describe('regentsTopicSkillSlugs', () => {
  it('covers every Regents topic', () => {
    for (const topic of regentsTopics) {
      expect(regentsTopicSkillSlugs, `missing topic ${topic.slug}`).toHaveProperty(topic.slug);
    }
    // …and names no topic that doesn't exist.
    const topicSlugs = new Set(regentsTopics.map((t) => t.slug));
    for (const slug of Object.keys(regentsTopicSkillSlugs)) {
      expect(topicSlugs.has(slug), `unknown topic ${slug}`).toBe(true);
    }
  });

  it('references only skills that exist in the seeded curriculum', () => {
    const skillSlugs = new Set(
      curriculum.flatMap((u) => u.lessons.map((l) => l.skill.slug)),
    );
    for (const [topic, slugs] of Object.entries(regentsTopicSkillSlugs)) {
      for (const slug of slugs) {
        expect(skillSlugs.has(slug), `${topic} → unknown skill ${slug}`).toBe(true);
      }
    }
  });
});
