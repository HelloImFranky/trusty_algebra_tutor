# Statistics Expansion — Design & Implementation Plan

> [!NOTE]
> **Phase 1 in progress** on branch `claude/algebra-app-statistics-hf4c76`.
> Phases 2–3 are designed here but not yet started. Status index:
> [`README.md`](README.md).

## Why this exists

The app already **records** rich per-attempt signal — `hints_used`,
`anim_views`, `step_reached`, `duration_ms`, `misconception_id`, problem
`tier`, `context`, and full AI-tutor transcripts — but almost none of it is
ever **aggregated or surfaced**. `misconceptions.ts` even promises a "stable
slug for analytics", and no analytics consume it. Meanwhile:

- **Students** see streaks/mastery/Regents tallies but no growth trend and
  no insight into *why* they get things wrong.
- **Teachers** get a lightweight roster (streak / #mastered / #struggling /
  last-active) and sprint stats, but not the reports a NY math teacher plans
  lessons around: a class skill grid, item analysis, misconception patterns,
  and a short "who needs me this week" list.
- **Admins** (in a school: the principal or math department head) see
  *zero* instructional data — the admin console is deliberately
  governance-only (docs/teacher-dashboard-plan.md locked that decision), so
  anything added here must be **de-identified aggregates**, never per-student
  records.

The competitor baseline (IXL, DeltaMath, ALEKS, Khan Academy, i-Ready)
converges on five report families: skill-proficiency grid, standards/exam
alignment, growth, usage, and trouble-spot alerts. This plan covers all
five; the misconception report goes further than any of them because our
generator-based content can *predict* wrong answers, not just count them.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Admin data shape | **De-identified aggregates only** | Preserves the least-privilege admin posture (FERPA). A principal consumes school-level numbers; per-student detail stays behind the teacher's class-scoped view. |
| Teacher scope | **Ownership-scoped, batched** | Same rules as the roster: only classes where `teacher_user_id` = caller; batched queries over the roster's ids, never one query per student. |
| Phase 1 data source | **Existing tables only** | Every Phase 1 stat is an aggregation of data already captured. No schema changes, no new tracking, nothing to backfill. |
| Misconception labels | **Static catalog in `@tutor/core`** | `attempts.misconception_id` stores stable slugs; a small EN/ES catalog maps them to short human labels for reports. Per-instance feedback strings stay in the generators. |
| Mastery labels in reports | **Same `decayedScore` + `masteryLabel`** | Reports must agree with what the student sees on their own progress page. |
| History (growth) | **Deferred to Phase 3** | Needs a snapshot table + a write path; don't block Phase 1 wins on it. |

## Phase 1 — aggregate what we already record

### 1a. Teacher: `teacher.classes.insights` (query, `{ classId }`)

One endpoint, one screen (`/classes/[classId]/insights`, linked from the
roster next to the sprint leaderboard link). Four sections, each built from
a handful of batched queries:

- **Skill heatmap** — students × skills grid, colored by mastery label
  (`not_started / practicing / struggling / proficient / mastered`), grouped
  by unit. Data: `mastery` rows for roster ids + the full skill list from
  the curriculum (so untouched skills still render as columns). Answers "can
  I move on from factoring tomorrow?" at a glance.
- **Misconception report** — counts per `misconception_id` per skill over
  the last 30 days: total hits + distinct students affected, labeled via the
  core catalog. "11 of 24 students flip the inequality the wrong way."
- **Students to watch** — one ranked list, flags per student:
  - `inactive`: no attempt/Regents answer in 7+ days (or never active);
  - `struggling`: ≥1 skill labeled struggling (top skill names included);
  - `hintReliant`: hints-per-attempt over the last 14 days ≥ 1.5 with ≥5
    attempts (practicing without independence);
  - `lowAccuracy`: <50% correct over the last 14 days with ≥5 attempts.
  Ranked by flag count; students with no flags are omitted. Teachers want
  the five names that need attention, not 30 rows to scan.
- **Time on task** — per-student practice minutes (7d / 30d, from
  `duration_ms`) + a class weekly-minutes series since the school year
  started (`schoolYearStart()` shared with sprint stats).

### 1b. Admin: `admin.stats.overview` (query)

School-wide, de-identified. New `stats` sub-router in `admin.ts`; a new
"School overview" card section on the admin screen above usage/billing:

- **Engagement** — active students (7d / 30d: distinct students with an
  attempt or Regents answer), attempts + practice minutes (30d), and a
  weekly active-students/attempts/minutes series since the school year
  started. The "is this tool being used?" trend that decides renewal.
- **Mastery distribution by unit** — for each unit: how many
  (student, skill) pairs sit at each mastery label across the whole school.
  Shows the department head where the curriculum bogs down across all
  sections. No names anywhere.
- **Adoption** — active teacher accounts, non-archived classes, distinct
  actively-enrolled students.
- **Consent coverage** — students with `guardian_consent` false (all of
  whom are under-13 signups, since 13+ registration sets it true). The
  COPPA hygiene number an admin owns.

### 1c. Shared plumbing

- `packages/core/src/math/misconceptionCatalog.ts` — EN/ES short labels for
  every misconception id the generators emit, exported from `@tutor/core`;
  a unit test asserts the catalog covers every id used in `generators.ts`.
- `packages/api/src/classInsights.ts` — batched aggregate helpers (style of
  `sprintStats.ts`).
- EN/ES i18n keys for both screens (`i18n.tsx` dict).
- API tests in `api.test.ts`: authz (other teacher 404s, student/guardian
  forbidden, non-admin forbidden) + aggregation correctness (seeded attempts
  with misconceptions/hints/durations produce the expected sections).

## Phase 2 — item analysis, tiers, readiness, export

- **Item analysis (teacher)** — per-problem and per-Regents-question class
  success rates, hardest first (mirrors how NY teachers read NYSED's
  per-question Regents item analyses). Data: `attempts` grouped by
  `problem_id`; `regents_answers` grouped by `question_id`.
- **Tier progression (teacher)** — per student per skill, share of recent
  attempts by problem tier (modified/standard/challenge): who is stuck in
  modified tier. Framed as practice level, never as a student label.
- **Regents readiness (student + teacher + admin)** — per Regents topic,
  blend mastery of the topic's linked skills with Regents-round accuracy
  into a green/yellow/red readiness band (no fake scaled scores). Student
  sees their own; teacher sees the class grid; admin sees the school-wide
  band distribution.
- **AI-tutor usage (teacher)** — sessions per student and per
  problem/lesson over a window (`tutor_sessions` already links both): a
  spike on one lesson is a re-teach signal. Counts only — transcripts stay
  private to the student.
- **CSV export (teacher)** — download of heatmap and watch-list data;
  teachers live in grade books.

## Phase 3 — growth over time + slices (schema change)

- New `mastery_snapshots` table (user, skill, score, label, week) written by
  a weekly roll-up (on-login upsert or cron); powers:
  - **Student**: "your mastery this month vs last month" trend;
  - **Teacher**: class growth since September;
  - **Admin**: school growth by unit — the i-Ready-style growth headline.
- **Admin slices** — usage/outcome aggregates split by grade and by locale
  (EN/ES usage is the MLL/ELL story a NY school reports on), with a
  minimum-cell-size floor (suppress slices under ~5 students) so aggregates
  can't be re-identified.
- **Cost per active student** — divide the existing Anthropic spend summary
  by 30d active students on the admin screen.

## Verification

Each phase is cloud-session friendly: vitest (`packages/api` against the
test Postgres), `tsc` typecheck, and the web build via the `verify` skill.
UI is web-first (teacher/admin surfaces have no native routes today).
