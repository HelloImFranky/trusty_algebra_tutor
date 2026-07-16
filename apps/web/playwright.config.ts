import { defineConfig, devices } from '@playwright/test';

/**
 * Visual-regression snapshot suite for the web app (Phase C of the dark-mode
 * audit — see docs/dark-mode-audit-plan.md). Captures each student-facing
 * screen in both `light` and `dark` mode so a future refactor that breaks
 * one mode fails the check with a pixel diff instead of a Slack ping from a
 * user.
 *
 * The suite talks to a real dev server + database (Prisma), so the harness
 * boots `next dev` on demand via `webServer` and lets a fixture (see
 * `e2e/support/`) register/log in a snapshot-only student before the tests
 * run.
 *
 * Baselines live next to the specs under `e2e/__screenshots__/`. Snapshots
 * are locked to `chromium` on Linux so cross-OS glyph differences don't
 * cause noise; if you regenerate on macOS the diff will complain — refresh
 * on Linux (or in CI) instead.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

// The pre-installed Chromium in the remote-execution environment lives
// outside node_modules; when it's present, use it and skip the browser
// download. Local runs fall back to Playwright's own binary.
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (process.env.PLAYWRIGHT_BROWSERS_PATH === '/opt/pw-browsers'
    ? '/opt/pw-browsers/chromium/chrome-linux/chrome'
    : undefined);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // theme fixture mutates localStorage; keep serial
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Prevent OS accent-color / motion prefs from leaking into snapshots.
    colorScheme: 'light',
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  expect: {
    // A little slack for anti-alias / subpixel drift; pure token changes
    // will still trip it.
    toHaveScreenshot: { maxDiffPixels: 200, threshold: 0.15 },
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        // Boot the app the same way `npm run dev` does. Reuses an already-
        // running server locally so `next dev` doesn't fight for port 3000.
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
