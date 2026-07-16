/**
 * Test fixtures for the visual-snapshot suite.
 *
 * The suite needs two things every spec expects:
 *   1. A signed-in student — most screens redirect to /login otherwise.
 *   2. A deterministic light/dark mode, primed BEFORE the app boots so the
 *      first paint already matches the target theme (no light-mode flash
 *      captured in the screenshot).
 *
 * `test` below extends the base Playwright test with two extras:
 *   - `authedContext`: a browser context whose storage state carries a
 *     freshly-registered snapshot student's cookies + tokens.
 *   - `themedPage(mode)`: opens a page under `authedContext` with
 *     `tutor.theme.mode` seeded in localStorage so the very first render
 *     is in the requested mode.
 *
 * The register call is idempotent-ish — a `CONFLICT` (username taken) is
 * treated as "the user already exists from a previous run, log in
 * instead". That lets `test:e2e:update` run repeatedly without racking up
 * fake users.
 */
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

export type Mode = 'light' | 'dark';

const SNAPSHOT_USER = {
  role: 'student' as const,
  username: 'snapshot_student',
  password: 'snapshot-pass-12345',
  displayName: 'Snapshot Student',
  locale: 'en' as const,
  grade: 8,
};

async function apiRegister(baseURL: string): Promise<void> {
  const res = await fetch(`${baseURL}/api/trpc/auth.register?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 0: { json: SNAPSHOT_USER } }),
  });
  if (res.status === 200 || res.status === 409) return;
  // 409 wraps a CONFLICT tRPC error (username already taken) — that's fine.
  const body = await res.text();
  if (body.includes('CONFLICT') || body.includes('username taken')) return;
  throw new Error(`register failed (${res.status}): ${body}`);
}

async function apiLogin(context: BrowserContext, baseURL: string): Promise<void> {
  // Use the browser context's fetch so Set-Cookie (httpOnly refresh cookie)
  // is stored where the page can pick it up on next reload.
  const res = await context.request.post(`${baseURL}/api/trpc/auth.login?batch=1`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      0: { json: { username: SNAPSHOT_USER.username, password: SNAPSHOT_USER.password } },
    },
  });
  expect(res.ok(), `login failed: ${await res.text()}`).toBe(true);
}

export const test = base.extend<{
  authedContext: BrowserContext;
  themedPage: (mode: Mode, route?: string) => Promise<Page>;
}>({
  authedContext: async ({ browser, baseURL }, use) => {
    if (!baseURL) throw new Error('baseURL missing — check playwright.config.ts');
    await apiRegister(baseURL);
    const context = await browser.newContext();
    await apiLogin(context, baseURL);
    await use(context);
    await context.close();
  },
  themedPage: async ({ authedContext, baseURL }, use) => {
    if (!baseURL) throw new Error('baseURL missing');
    await use(async (mode, route = '/') => {
      const page = await authedContext.newPage();
      // Prime the theme BEFORE anything the app renders so the first paint
      // is already in the target mode. Also stamp <html data-theme=…> the
      // way our setMode() does at runtime, so any CSS keyed off the
      // attribute (body bg, scrollbars) picks it up on this first paint.
      await page.addInitScript((m: Mode) => {
        window.localStorage.setItem('tutor.theme.mode', m);
        document.documentElement.setAttribute('data-theme', m);
      }, mode);
      await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
      return page;
    });
  },
});

export { expect };
