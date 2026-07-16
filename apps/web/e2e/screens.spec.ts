/**
 * Visual snapshots of every top-level student screen, one per theme mode.
 *
 * The goal isn't pixel-perfect; it's "will a token regression flip an
 * entire card / body / text color and go unnoticed until a student
 * ships us a screenshot?". The maxDiffPixels + threshold in
 * playwright.config.ts absorbs anti-alias noise but a solid #ffffff card
 * showing up in dark-mode CI will still fail loudly.
 *
 * Skipped-on-purpose routes:
 *   /lesson/[id]  — needs a curriculum id; the deep-color-feedback spec
 *                   covers the specific tokens the lesson page renders
 *                   through the shared Feedback component.
 *   /admin        — admin-only; the snapshot student can't reach it.
 */
import { test, expect } from './support/fixtures';

const MODES = ['light', 'dark'] as const;

const SCREENS: Array<{ name: string; route: string }> = [
  { name: 'curriculum', route: '/' },
  { name: 'progress', route: '/progress' },
  { name: 'review', route: '/review' },
  { name: 'practice', route: '/practice' },
  { name: 'sprint', route: '/sprint' },
  { name: 'examples', route: '/examples' },
  { name: 'calculator', route: '/calculator' },
  { name: 'settings', route: '/settings' },
  { name: 'appearance', route: '/appearance' },
];

for (const mode of MODES) {
  for (const screen of SCREENS) {
    test(`${screen.name} @ ${mode}`, async ({ themedPage }) => {
      const page = await themedPage(mode, screen.route);
      // Give tRPC queries + hydration a beat to settle so the shot is stable.
      await page.waitForLoadState('networkidle');
      // Freeze animations (Tamagui + Reanimated) so no keyframe midpoint
      // sneaks into the shot on repeat runs.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(page).toHaveScreenshot(`${screen.name}-${mode}.png`, {
        fullPage: true,
      });
    });
  }
}
