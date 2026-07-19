# Sprint leaderboard & fixed-format redesign

> [!NOTE]
> **✅ SHIPPED — historical design record.** The work below landed in the same
> PR that introduced this doc (fixed 1-minute/10-question sprints, live
> class leaderboards, the teacher sprint-stats page, and the light-blue
> default accent). For current behavior read the code; see docs/README.md.

## Goals (from the product request)

1. **Sprints are always and only 1 minute long and 10 questions.** No more
   round-length picker (10/20/30). Topic multi-select stays.
2. **Live leaderboard on the student Sprint page** with exactly two stat
   columns: questions correct **during the sprint** and questions correct
   **this week**, ranked by the sprint column.
3. **The same leaderboard in the teacher's portal**, on its **own live page**,
   plus richer teacher-only statistics: multiple visualization types (a
   weekly **time series** over the school year, a **table** of per-student
   season totals) that students never see.
4. Side request: **default theme accent becomes light blue** (friendlier than
   the old red). Users who picked a custom accent are unaffected.

## Semantics

- **"During the sprint" column** — a sprint is only 60 s, so per-question
  push updates buy little; instead the round itself becomes observable:
  a round now has a server-side lifecycle (`sprintStart` opens a session row,
  `sprintComplete` closes it). While a student's round is **open** (started
  within the last 2 minutes, not yet completed) their live score is counted
  straight from `attempts` rows with `context='sprint'` created since the
  round opened — so the column ticks up mid-round. Otherwise the column
  shows their **best completed round today**.
- **"This week" column** — sum of `correct` over completed rounds since the
  start of the ISO week (Monday, server time). Weekly numbers (this column,
  the teacher tiles, and the weekly chart) deliberately exclude in-flight
  rounds — they update when a sprint completes, reading as settled totals
  next to the live sprint column.
- **Long classes** — ranked lists (leaderboard, school-year table) cap at 15
  visible rows and scroll inside their card past that, headers pinned.
- **Live** = short-interval polling (5 s) via TanStack Query
  `refetchInterval`, active only while a leaderboard screen is mounted. The
  app is a PWA on classroom Wi-Fi; polling a cheap aggregate is simpler and
  more robust than a socket layer, and matches the existing stack (no
  subscription transport exists in the tRPC setup).
- **Scope** — students see classmates: everyone sharing an *active*
  enrollment in any of the caller's active classes (plus themselves, always).
  Teachers see one owned class per page, same ownership gate as the roster
  (`ownedClass`). Students in no class see just their own row.
- **School year** (teacher time series) — starts Sep 1; before Sep 1 the
  current school year began the previous calendar year.

## Changes

### Data (`packages/db`)

- Migration `016_sprint_session_lifecycle.sql`: add `started_at`
  (backfilled from `created_at`, then `NOT NULL DEFAULT now()`) and nullable
  `ended_at` (backfilled to `created_at` so every pre-existing row counts as
  completed); relax the `total >= 1` check to `total >= 0` (an open round has
  no attempts yet); index `(started_at)`.
- Prisma model `SprintSession` gains `startedAt` / `endedAt`.
- Abandoned rounds (tab closed mid-sprint) simply stay open and fall out of
  the 2-minute live window; they never count as completions.

### API (`packages/api`)

- `practice.sprint` — `count` input removed; always serves a 10-question
  round (`SPRINT_COUNT = 10`).
- `practice.sprintStart` *(new)* — opens a session row, returns `sessionId`.
- `practice.sprintComplete` — accepts optional `sessionId` and closes that
  row (ownership-checked); without one it falls back to the legacy
  insert-a-finished-row behavior (old clients / offline replays).
- Badge ladder (`progress` router) counts only **completed** rounds
  (`ended_at IS NOT NULL`) so opening a round can't farm badges.
- `packages/api/src/sprintStats.ts` *(new)* — shared aggregate helpers:
  `sprintLeaderboard(studentIds)` (batched queries, never per-student) and
  the teacher extras (season totals per student, weekly time series).
- `practice.sprintLeaderboard` *(new, student)* — classmate-scoped rows:
  `{ id, displayName, you, inSprint, sprintCorrect, weekCorrect }`.
- `teacher.classes.sprintStats` *(new, teacher)* — ownership-gated:
  the same leaderboard rows **plus** per-student season table
  (rounds / attempted / correct / accuracy) and the weekly class time series
  `{ weekStart, rounds, attempted, correct }[]` since Sep 1.

### UI (`packages/app`, `apps/web`)

- **Sprint screen** — round-length picker deleted; header states the fixed
  format (10 questions · 1:00). A live leaderboard card sits under the
  start/results card (and stays mounted during a round), polling every 5 s.
  Ranked rows highlight "you"; a ⚡ pulse marks classmates mid-sprint.
- **Teacher stats page** — new screen `sprintStats.tsx` at
  `/classes/[classId]/sprint`, linked from the class roster. Shows: stat
  tiles (rounds/correct this week), the live leaderboard (same two columns
  students see), a **weekly time-series chart** of correct answers across
  the school year (pure-View bar chart — no charting dep, works on web and
  native), and the **season table** per student. Polls every 5 s.
- The teacher portal remains web-only (native app has no teacher routes),
  matching the existing classes/roster pages.

### Theme

- `DEFAULT_ACCENT` `#ec3013` → `#1e88e5` (light blue): the lightest blue
  that keeps white on-accent text near the old red's contrast (3.68:1 vs
  4.20:1) and accent text readable on both page backgrounds. The streak
  flame stays hard-pinned red by design (see docs/theme-tokens.md); the
  native splash background follows the new accent.

### Tests

- `api.test.ts`: fixed 10-question rounds; start/complete lifecycle
  (ownership, legacy fallback, badge count excludes open rounds);
  leaderboard classmate scoping; teacher stats ownership gate + shape.
- Theme-baseline counts are unchanged (a literal's value changed, not its
  count); docs/theme-tokens.md updated as the living reference.
