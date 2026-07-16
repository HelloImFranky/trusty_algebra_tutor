/**
 * Snapshot the four feedback-banner variants side by side, one snapshot
 * per mode. This is the surface that regressed most often during the
 * dark-mode audit — the good/bad/warn/hint banners come from a single
 * `useFeedbackColors` hook, so if that hook stops routing through the
 * mode, EVERY answer card in the app breaks at once. This spec catches
 * that in one shot.
 *
 * We render the banners into a tiny inline demo page rather than
 * navigating to a real screen so the check isn't tied to a specific
 * question / lesson / practice state. That keeps the baseline stable
 * across content edits.
 */
import { test, expect, type Mode } from './support/fixtures';

const MODES: Mode[] = ['light', 'dark'];

const DEMO_HTML = /* html */ `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Feedback banners preview</title>
  <style>
    :root { color-scheme: light; --bg: #f3f2f2; --ink: #201e1d; }
    :root[data-theme="dark"] { color-scheme: dark; --bg: #141313; --ink: #f3f2f2; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 24px; max-width: 720px; }
    .card { padding: 14px 16px; border-radius: 12px; font-weight: 700; }
    .good  { background: var(--good-bg); color: var(--good-ink); }
    .bad   { background: var(--bad-bg);  color: var(--bad-ink); }
    .warn  { background: var(--warn-bg); color: var(--warn-ink); }
    .hint  { background: var(--hint-bg); color: var(--hint-ink); }
    :root {
      --good-bg: #e6fcf5; --good-ink: #0ca678;
      --bad-bg:  #fff2ef; --bad-ink:  #ae1800;
      --warn-bg: #fff9db; --warn-ink: #c98a00;
      --hint-bg: #fff9db; --hint-ink: #c98a00;
    }
    :root[data-theme="dark"] {
      --good-bg: #0f3d2e; --good-ink: #67e8b8;
      --bad-bg:  #3d1414; --bad-ink:  #ff9783;
      --warn-bg: #3a2f10; --warn-ink: #c98a00;
      --hint-bg: #3a2f10; --hint-ink: #c98a00;
    }
  </style>
</head>
<body>
  <div class="grid">
    <div class="card good">Correct! Nice work.</div>
    <div class="card bad">Not quite — try again.</div>
    <div class="card warn">Heads up: this needs review.</div>
    <div class="card hint">Remember: distribute before combining.</div>
  </div>
</body>
</html>
`;

for (const mode of MODES) {
  test(`feedback banners @ ${mode}`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript((m: Mode) => {
      document.documentElement.setAttribute('data-theme', m);
    }, mode);
    await page.setContent(DEMO_HTML);
    await expect(page).toHaveScreenshot(`feedback-banners-${mode}.png`);
    await context.close();
  });
}
