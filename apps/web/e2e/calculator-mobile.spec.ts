/**
 * Mobile-width calculator sheet.
 *
 * The calculator is the one surface that's *deliberately* light-iOS-style
 * in both modes (see docs/theme-tokens.md § "Intentional exceptions").
 * This snapshot exists to catch the OPPOSITE mistake: someone
 * accidentally tokenizing the chassis and making it dark. It also
 * guards the mobile layout fix (Bug 17 — graph truly responsive to
 * container width) — a regression there shows up as a squashed / cut-off
 * SVG.
 *
 * Runs only under the `mobile-chromium` project (Pixel 7 viewport).
 */
import { test, expect } from './support/fixtures';

test.beforeEach(({}, testInfo) => {
  testInfo.skip(
    testInfo.project.name !== 'mobile-chromium',
    'mobile-only — see desktop-chromium project for the full grid',
  );
});

for (const mode of ['light', 'dark'] as const) {
  test(`calculator sheet @ ${mode} (mobile)`, async ({ themedPage }) => {
    const page = await themedPage(mode, '/calculator');
    await page.waitForLoadState('networkidle');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page).toHaveScreenshot(`calculator-sheet-${mode}.png`, {
      fullPage: true,
    });
  });
}
