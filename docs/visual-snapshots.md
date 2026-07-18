# Visual snapshot suite

> [!NOTE]
> **📗 Living reference — current.** Runbook for the Playwright
> visual-regression suite under `apps/web/e2e/`. Status index:
> [`README.md`](README.md).

Playwright-based visual-regression suite for the web app. Sibling to the
`theme-baseline.sh` grep guard (`docs/theme-tokens.md`) — the grep says
"did anyone write a new hex literal", these snapshots say "did the
rendered pixels for the surfaces our students actually see stop matching
what we shipped".

Every top-level student screen is captured in both light and dark mode
on both desktop and mobile viewports. If a refactor breaks one mode —
say, forgets a `useTokens()` migration and hard-codes `#ffffff` on a
card — the check fails with a side-by-side diff PNG in the report.

---

## What's covered

| File | What it captures |
|---|---|
| `apps/web/e2e/screens.spec.ts` | 9 top-level screens × 2 modes × 2 viewports (desktop 1280×900 + Pixel 7). Curriculum, Progress, Review, Practice, Sprint, Examples, Calculator, Settings, Appearance. |
| `apps/web/e2e/feedback-banners.spec.ts` | The four `useFeedbackColors` variants (good/bad/warn/hint) side-by-side per mode. Isolated demo page — not tied to a specific lesson / question state, so the baseline is stable across content edits. |
| `apps/web/e2e/calculator-mobile.spec.ts` | Mobile-width calculator sheet per mode. Guards Bug 17 (graph responsive to container width) and the deliberate light-iOS-chassis exception. |

Skipped on purpose:
- `/lesson/[id]` — needs a curriculum id fixture; the shared banner
  component is what tends to break, and `feedback-banners.spec.ts`
  covers it directly.
- `/admin` — admin-only; the snapshot student can't reach it.

---

## Running locally

```sh
# From the repo root:
npm --workspace @tutor/web run test:e2e            # check against baselines
npm --workspace @tutor/web run test:e2e:update     # refresh baselines
```

The Playwright config boots `next dev` on `http://127.0.0.1:3000`
automatically (or reuses an already-running one). A running Postgres +
Prisma instance is required — the fixture in `e2e/support/fixtures.ts`
registers a `snapshot_student` user against the real API on first run
and reuses that account on subsequent runs.

The first run creates baselines under
`apps/web/e2e/__screenshots__/<spec-file>/<name>-<mode>.png`. Commit
them. Subsequent runs diff against the committed baselines.

### First-time setup

```sh
# Only once per machine — this pulls the Chromium binary Playwright uses.
# In the remote-execution environment Chromium is already at
# /opt/pw-browsers/chromium and this is skipped.
cd apps/web && npx playwright install chromium
```

---

## When a snapshot fails

1. Open the Playwright HTML report:
   ```sh
   cd apps/web && npx playwright show-report
   ```
2. Look at the three PNGs side-by-side (expected / actual / diff). Ask:
   is this an intentional change (new token, deliberate redesign) or a
   regression (dark mode flashed white, banner lost color)?
3. Intentional → run `npm run test:e2e:update` and commit the new PNGs
   in the same PR. Mention it in the PR description.
4. Regression → the diff shows you the surface. Fix the token
   routing, don't `--update` around it.

---

## Rationale + tuning

- `fullyParallel: false` — the theme fixture writes `localStorage`
  before each `page.goto`; running specs concurrently would race the
  `data-theme` attribute.
- `maxDiffPixels: 200`, `threshold: 0.15` — absorbs anti-alias /
  subpixel drift on repeat runs while a token-level flip (thousands of
  pixels changing color) still fails loudly.
- Snapshots pinned to `chromium` on Linux. macOS glyph rendering is
  noticeably different — refresh baselines on Linux (or in CI) so
  everyone diffs against the same rasterizer.

See `docs/dark-mode-audit-plan.md` § Phase C for how this fits alongside
the token migration (Phase A) and the baseline grep (Phase B).
