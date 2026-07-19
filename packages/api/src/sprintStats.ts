import { Prisma, prisma } from '@tutor/db';

/**
 * Shared sprint leaderboard / stats aggregates
 * (docs/sprint-leaderboard-plan.md). Everything here is batched over a set of
 * student ids — never one query per student — because the student sprint page
 * and the teacher stats page both poll these on a short interval.
 *
 * "During the sprint" semantics: a round OPENS a sprint_sessions row
 * (ended_at NULL) and closes it on completion. While a student's round is
 * open (started within LIVE_WINDOW), their live score is counted straight
 * from attempts with context='sprint' since the round opened — that's what
 * makes the leaderboard tick up mid-round. Otherwise the sprint column shows
 * their best completed round today. Abandoned rounds age out of the window
 * and never count anywhere else.
 */

export interface SprintLeaderboardRow {
  /** A round is currently running for this student. */
  inSprint: boolean;
  /** Correct so far in the open round (0 when none). */
  liveCorrect: number;
  /** Display column: live round if one is open, else best completed round today. */
  sprintCorrect: number;
  /** Correct across completed rounds since Monday (+ the open round's live count). */
  weekCorrect: number;
}

export async function sprintLeaderboard(
  studentIds: bigint[],
): Promise<Map<string, SprintLeaderboardRow>> {
  const out = new Map<string, SprintLeaderboardRow>();
  if (studentIds.length === 0) return out;
  const ids = Prisma.join(studentIds);

  // Live scores: newest open round per student, joined to the correct sprint
  // attempts recorded since it opened.
  const liveRows = await prisma.$queryRaw<{ userId: bigint; correct: bigint }[]>`
    SELECT s.user_id AS "userId",
           count(a.id) FILTER (WHERE a.correct) AS correct
    FROM (
      SELECT DISTINCT ON (user_id) user_id, started_at
      FROM sprint_sessions
      WHERE user_id IN (${ids}) AND ended_at IS NULL
        -- open rounds older than 2 minutes are abandoned (rounds last 60 s;
        -- the slack absorbs clock skew and a slow final grade)
        AND started_at > now() - interval '2 minutes'
      ORDER BY user_id, started_at DESC
    ) s
    LEFT JOIN attempts a
      ON a.user_id = s.user_id AND a.context = 'sprint' AND a.created_at >= s.started_at
    GROUP BY s.user_id`;
  const liveByUser = new Map(liveRows.map((r) => [String(r.userId), Number(r.correct)]));

  // Best completed round today + total correct across completed rounds this
  // ISO week (Monday start, server time).
  const doneRows = await prisma.$queryRaw<
    { userId: bigint; bestToday: number | null; weekCorrect: bigint | null }[]
  >`
    SELECT user_id AS "userId",
           max(correct) FILTER (WHERE started_at >= date_trunc('day', now())) AS "bestToday",
           sum(correct) FILTER (WHERE started_at >= date_trunc('week', now())) AS "weekCorrect"
    FROM sprint_sessions
    WHERE user_id IN (${ids}) AND ended_at IS NOT NULL
    GROUP BY user_id`;
  const doneByUser = new Map(doneRows.map((r) => [String(r.userId), r]));

  for (const id of studentIds) {
    const key = String(id);
    const live = liveByUser.get(key);
    const done = doneByUser.get(key);
    const liveCorrect = live ?? 0;
    out.set(key, {
      inSprint: live !== undefined,
      liveCorrect,
      sprintCorrect: live !== undefined ? liveCorrect : (done?.bestToday ?? 0),
      weekCorrect: Number(done?.weekCorrect ?? 0) + liveCorrect,
    });
  }
  return out;
}

/** Sep 1 of the current school year (before Sep 1 → the previous calendar year). */
export function schoolYearStart(now = new Date()): Date {
  const year = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 8, 1));
}

export interface SeasonTotals {
  rounds: number;
  attempted: number;
  correct: number;
}

/** Per-student completed-round totals since the school year started. */
export async function seasonTotals(studentIds: bigint[]): Promise<Map<string, SeasonTotals>> {
  const out = new Map<string, SeasonTotals>();
  if (studentIds.length === 0) return out;
  const rows = await prisma.$queryRaw<
    { userId: bigint; rounds: bigint; attempted: bigint | null; correct: bigint | null }[]
  >`
    SELECT user_id AS "userId", count(*) AS rounds,
           sum(total) AS attempted, sum(correct) AS correct
    FROM sprint_sessions
    WHERE user_id IN (${Prisma.join(studentIds)})
      AND ended_at IS NOT NULL AND started_at >= ${schoolYearStart()}
    GROUP BY user_id`;
  for (const r of rows) {
    out.set(String(r.userId), {
      rounds: Number(r.rounds),
      attempted: Number(r.attempted ?? 0),
      correct: Number(r.correct ?? 0),
    });
  }
  return out;
}

export interface WeekPoint {
  /** ISO date (YYYY-MM-DD) of the week's Monday. */
  weekStart: string;
  rounds: number;
  attempted: number;
  correct: number;
}

/** Class-wide weekly time series of completed rounds since the school year
 * started — the teacher chart's data. Weeks with no rounds are omitted (the
 * client fills gaps so the x-axis stays linear in time). */
export async function weeklySeries(studentIds: bigint[]): Promise<WeekPoint[]> {
  if (studentIds.length === 0) return [];
  const rows = await prisma.$queryRaw<
    { week: Date; rounds: bigint; attempted: bigint | null; correct: bigint | null }[]
  >`
    SELECT date_trunc('week', started_at) AS week, count(*) AS rounds,
           sum(total) AS attempted, sum(correct) AS correct
    FROM sprint_sessions
    WHERE user_id IN (${Prisma.join(studentIds)})
      AND ended_at IS NOT NULL AND started_at >= ${schoolYearStart()}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({
    weekStart: r.week.toISOString().slice(0, 10),
    rounds: Number(r.rounds),
    attempted: Number(r.attempted ?? 0),
    correct: Number(r.correct ?? 0),
  }));
}
