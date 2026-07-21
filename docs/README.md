# docs/ — status index

> [!IMPORTANT]
> **Read this before trusting any plan in this directory.**
>
> The plan documents here are **point-in-time design records**. A plan's own
> "Current state", "Status", or "audit as of `<commit>`" section reflects the
> day it was written — **not today**. Treating one of those sections as
> ground truth is how a shipped feature gets mistaken for outstanding work.
>
> **For current state, read the code (or this index) — never a plan body.**
> This table is the authoritative status. Each plan also carries a status
> banner at the top repeating its entry.

## Living references (current, safe to trust)

| Doc | What it is |
|---|---|
| [`theme-tokens.md`](theme-tokens.md) | The light/dark token palette every `color=` prop reaches for. Enforced by `scripts/theme-baseline.sh`. Keep current. |
| [`visual-snapshots.md`](visual-snapshots.md) | Runbook for the Playwright visual-regression suite (`apps/web/e2e/`). Keep current. |

## Shipped — historical design records

The work these planned has landed. Kept because code comments cite them for
rationale (e.g. `docs/teacher-dashboard-plan.md, Stage 2`). Their bodies are
history; do not action them.

| Doc | Status |
|---|---|
| [`dark-mode-audit-plan.md`](dark-mode-audit-plan.md) | ✅ Phases A/B/C shipped. The "Current state (audit as of `1ebaff7`)" table is **stale** — ReferenceSheet/TutorChat/MathInput/classRoster migrated, `AnimatedEquation` already has its dark variant. For live literal counts run `scripts/theme-baseline.sh`. |
| [`teacher-dashboard-plan.md`](teacher-dashboard-plan.md) | ✅ Stages 1–2 shipped (classes / join-codes / roster + admin-approval provisioning). |
| [`tutor-usage-dashboard-plan.md`](tutor-usage-dashboard-plan.md) | ✅ Option 2 shipped (`UsageDashboard.tsx`, `core/admin/usage.ts`, Admin-API numbers in `/admin`). |
| [`ui-ux-refresh-plan.md`](ui-ux-refresh-plan.md) | ✅ The light/dark refresh landed. |
| [`stepanim-plan.md`](stepanim-plan.md) | ✅ Phases 1–5 shipped. Only Phase 6 (native-device pass) remains — needs a local simulator/device, cannot run in a cloud container. |
| [`sprint-leaderboard-plan.md`](sprint-leaderboard-plan.md) | ✅ Shipped with its PR: fixed 1-min/10-question sprints, live class leaderboards (student + teacher), teacher sprint-stats page, light-blue default accent. |
| [`stepanim-next-steps.md`](stepanim-next-steps.md) | ✅ Companion status doc; the tracked items shipped. See `stepanim-plan.md`. |

## Live / outstanding work

Partially built or awaiting a decision — verify against code before acting.

| Doc | Status |
|---|---|
| [`statistics-plan.md`](statistics-plan.md) | 🚧 Phase 1 in progress (teacher class insights + admin school overview). Phases 2–3 designed, not built. |
| [`guardian-consent-plan.md`](guardian-consent-plan.md) | 🚧 Tier 0 shipped (school/admin attestation — migration `013`, `authz.ts`, teacher/admin routers). Tiers 1–2 (email-plus, guardian accounts) scoped but **not built**. |
| [`tutor-anthropic-haiku-plan.md`](tutor-anthropic-haiku-plan.md) | 🚧 **Planning only — not built.** Gated on sign-off. (The separate link-out and usage-dashboard pieces shipped.) |
| [`security-review-2.md`](security-review-2.md) | 🚧 Mixed. Items marked ✅ in the doc are fixed; 📝 items may remain open. Treat as a record, verify before acting. |

---

*When a plan's work ships, move its row up to "Shipped", add/refresh its
top-of-file banner, and delete any now-false "next steps". Keeping this index
honest is what stops the next stale-plan mistake.*

*Enforced by `scripts/doc-banner-check.sh` (runs in `npm test`): every doc
here except this index must lead with a status banner — a `> [!NOTE]` /
`> [!IMPORTANT]` alert with a bold status line — within its first lines. A new
doc without one fails the build, so status is never optional.*
