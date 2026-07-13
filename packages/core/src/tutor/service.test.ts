import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, parseAnimMarker, type TutorContext } from './service.js';

const baseCtx: TutorContext = { locale: 'en', lesson: null, problem: null };

describe('buildSystemPrompt animation block', () => {
  it('lists the animation steps and the marker instructions', () => {
    const prompt = buildSystemPrompt({
      ...baseCtx,
      problem: { prompt: 'Solve $2x + 3 = 11$', stepPrompts: [] },
      animSteps: ['2x + 3 = 11 — We want x alone.', 'x = 4 — Done!'],
    });
    expect(prompt).toContain('ANIMATED walkthrough');
    expect(prompt).toContain('Step 1: 2x + 3 = 11 — We want x alone.');
    expect(prompt).toContain('Step 2: x = 4 — Done!');
    expect(prompt).toContain('[[anim:N]]');
  });

  it('omits the block when no animation matches', () => {
    const prompt = buildSystemPrompt({
      ...baseCtx,
      problem: { prompt: 'Simplify $\\sqrt{18}$', stepPrompts: [] },
    });
    expect(prompt).not.toContain('[[anim:N]]');
  });
});

describe('parseAnimMarker', () => {
  it('strips the marker and returns the 0-based step', () => {
    const r = parseAnimMarker('Try subtracting 3 first. [[anim:2]]');
    expect(r.text).toBe('Try subtracting 3 first.');
    expect(r.animStep).toBe(1);
  });

  it('keeps only the first of several markers and strips them all', () => {
    const r = parseAnimMarker('Watch this. [[anim:3]] [[anim:5]]');
    expect(r.text).toBe('Watch this.');
    expect(r.animStep).toBe(2);
  });

  it('returns null for replies without a marker (or a zero step)', () => {
    expect(parseAnimMarker('Just a hint.')).toEqual({ text: 'Just a hint.', animStep: null });
    expect(parseAnimMarker('Bad [[anim:0]] marker.').animStep).toBeNull();
  });
});
