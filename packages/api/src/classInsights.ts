import { Prisma, prisma } from '@tutor/db';
import { decayedScore, masteryLabel } from '@tutor/core';

/**
 * Batched aggregates for the teacher class-insights page and the admin
 * school overview (docs/statistics-plan.md, Phase 1). Everything here is
 * built from data the app already records — mastery rows plus the attempt
 * columns (`misconception_id`, `hints_used`, `duration_ms`) that were
 * captured "for analytics" and never aggregated until now. Style rules
 * match sprintStats.ts: batched over a set of student ids, never one query
 * per student; de-identified (counts only) for the admin school scope.
 */

export type MasteryLabelName = ReturnType<typeof masteryLabel>;

export interface HeatmapCell {
  skillId: number;
  label: MasteryLabelName;
  attempts: number;
}

/**
 * Per-student mastery cells for the heatmap, decayed with the same model the
 * student's own progress page uses. Untouched skills are omitted — the
 * client renders them as not_started columns.
 */
export async function heatmapCells(studentIds: bigint[]): Promise<Map<string, HeatmapCell[]>> {
  const out = new Map<string, HeatmapCell[]>();
  if (studentIds.length === 0) return out;
  const rows = await prisma.mastery.findMany({
    where: { userId: { in: studentIds } },
    select: { userId: true, skillId: true, score: true, attemptsCount: true, lastPracticedAt: true },
  });
  for (const m of rows) {
    const key = String(m.userId);
    const score = decayedScore({
      score: m.score,
      attemptsCount: m.attemptsCount,
      lastPracticedAt: m.lastPracticedAt,
    });
    const cell: HeatmapCell = {
      skillId: Number(m.skillId),
      label: masteryLabel(score, m.attemptsCount),
      attempts: m.attemptsCount,
    };
    const list = out.get(key);
    if (list) list.push(cell);
    else out.set(key, [cell]);
  }
  return out;
}

/** Curriculum skill columns, in course order, for the heatmap header. */
export async function skillColumns() {
  const skills = await prisma.skill.findMany({
    include: { lesson: { include: { unit: true } } },
  });
  return skills
    .sort(
      (a, b) =>
        a.lesson.unit.number - b.lesson.unit.number ||
        a.lesson.position - b.lesson.position ||
        Number(a.id - b.id),
    )
    .map((s) => ({
      skillId: Number(s.id),
      nameEn: s.nameEn,
      nameEs: s.nameEs,
      lessonCode: s.lesson.code,
      unitNumber: s.lesson.unit.number,
    }));
}

export interface MisconceptionRow {
  /** Stable slug from the generators — labeled client-side via the core catalog. */
  misconceptionId: string;
  skillId: number;
  skillNameEn: string;
  skillNameEs: string;
  /** Matching wrong answers in the window. */
  hits: number;
  /** Distinct students who made this error. */
  students: number;
}

/** Diagnosed-error tallies over the last 30 days, most widespread first. */
export async function misconceptionReport(studentIds: bigint[]): Promise<MisconceptionRow[]> {
  if (studentIds.length === 0) return [];
  const rows = await prisma.$queryRaw<
    {
      misconceptionId: string;
      skillId: bigint;
      skillNameEn: string;
      skillNameEs: string;
      hits: bigint;
      students: bigint;
    }[]
  >`
    SELECT a.misconception_id AS "misconceptionId",
           s.id AS "skillId", s.name_en AS "skillNameEn", s.name_es AS "skillNameEs",
           count(*) AS hits, count(DISTINCT a.user_id) AS students
    FROM attempts a
    JOIN problems p ON p.id = a.problem_id
    JOIN skills s ON s.id = p.skill_id
    WHERE a.user_id IN (${Prisma.join(studentIds)})
      AND a.misconception_id IS NOT NULL
      AND a.created_at > now() - interval '30 days'
    GROUP BY 1, 2, 3, 4
    ORDER BY count(DISTINCT a.user_id) DESC, count(*) DESC`;
  return rows.map((r) => ({
    misconceptionId: r.misconceptionId,
    skillId: Number(r.skillId),
    skillNameEn: r.skillNameEn,
    skillNameEs: r.skillNameEs,
    hits: Number(r.hits),
    students: Number(r.students),
  }));
}

export interface RecentWork {
  attempts14d: number;
  correct14d: number;
  hints14d: number;
  minutes7d: number;
  minutes30d: number;
  lastActiveAt: Date | null;
}

/**
 * Recent per-student work stats: the watch-list signals (14-day accuracy and
 * hint reliance) plus time-on-task minutes. Last-active spans attempts AND
 * Regents answers, matching the roster's definition of activity.
 */
export async function recentWork(studentIds: bigint[]): Promise<Map<string, RecentWork>> {
  const out = new Map<string, RecentWork>();
  if (studentIds.length === 0) return out;
  const ids = Prisma.join(studentIds);
  const rows = await prisma.$queryRaw<
    {
      userId: bigint;
      attempts14d: bigint;
      correct14d: bigint;
      hints14d: bigint | null;
      ms7d: bigint | null;
      ms30d: bigint | null;
    }[]
  >`
    SELECT user_id AS "userId",
           count(*) FILTER (WHERE created_at > now() - interval '14 days') AS "attempts14d",
           count(*) FILTER (WHERE correct AND created_at > now() - interval '14 days') AS "correct14d",
           sum(hints_used) FILTER (WHERE created_at > now() - interval '14 days') AS "hints14d",
           sum(duration_ms) FILTER (WHERE created_at > now() - interval '7 days') AS "ms7d",
           sum(duration_ms) FILTER (WHERE created_at > now() - interval '30 days') AS "ms30d"
    FROM attempts
    WHERE user_id IN (${ids})
    GROUP BY 1`;
  const lastRows = await prisma.$queryRaw<{ userId: bigint; lastActive: Date }[]>`
    SELECT user_id AS "userId", max(created_at) AS "lastActive" FROM (
      SELECT user_id, created_at FROM attempts WHERE user_id IN (${ids})
      UNION ALL
      SELECT user_id, created_at FROM regents_answers WHERE user_id IN (${ids})
    ) t GROUP BY 1`;
  const lastByUser = new Map(lastRows.map((r) => [String(r.userId), r.lastActive]));
  const byUser = new Map(rows.map((r) => [String(r.userId), r]));
  for (const id of studentIds) {
    const key = String(id);
    const r = byUser.get(key);
    out.set(key, {
      attempts14d: Number(r?.attempts14d ?? 0),
      correct14d: Number(r?.correct14d ?? 0),
      hints14d: Number(r?.hints14d ?? 0),
      minutes7d: Math.round(Number(r?.ms7d ?? 0) / 60000),
      minutes30d: Math.round(Number(r?.ms30d ?? 0) / 60000),
      lastActiveAt: lastByUser.get(key) ?? null,
    });
  }
  return out;
}

export interface MinutesWeekPoint {
  /** ISO date (YYYY-MM-DD) of the week's Monday. */
  weekStart: string;
  minutes: number;
  attempts: number;
  /** Distinct students active that week (attempts only — minutes come from attempts). */
  activeStudents: number;
}

/** Weekly practice-minutes series since a start date. Weeks with no work are
 * omitted (the client fills gaps, same as the sprint chart). */
export async function weeklyMinutes(
  studentIds: bigint[] | null,
  since: Date,
): Promise<MinutesWeekPoint[]> {
  if (studentIds !== null && studentIds.length === 0) return [];
  const scope =
    studentIds === null
      ? Prisma.empty
      : Prisma.sql`AND user_id IN (${Prisma.join(studentIds)})`;
  const rows = await prisma.$queryRaw<
    { week: Date; minutes: number | null; attempts: bigint; activeStudents: bigint }[]
  >`
    SELECT date_trunc('week', created_at) AS week,
           round(coalesce(sum(duration_ms), 0)/60000.0)::float AS minutes,
           count(*) AS attempts,
           count(DISTINCT user_id) AS "activeStudents"
    FROM attempts
    WHERE created_at >= ${since} ${scope}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({
    weekStart: r.week.toISOString().slice(0, 10),
    minutes: Number(r.minutes ?? 0),
    attempts: Number(r.attempts),
    activeStudents: Number(r.activeStudents),
  }));
}

// ---------------------------------------------------------------------------
// Admin school overview — aggregates only, never per-student rows (the admin
// role must stay unable to reach individual student records; see admin.ts).
// ---------------------------------------------------------------------------

export interface SchoolEngagement {
  active7d: number;
  active30d: number;
  attempts30d: number;
  minutes30d: number;
}

/** Distinct-active-student counts and 30-day totals. Activity = a practice
 * attempt or a Regents answer, same definition as the roster/streaks. */
export async function schoolEngagement(): Promise<SchoolEngagement> {
  const [row] = await prisma.$queryRaw<
    {
      active7d: bigint;
      active30d: bigint;
      attempts30d: bigint;
      ms30d: bigint | null;
    }[]
  >`
    WITH activity AS (
      SELECT user_id, created_at, duration_ms, TRUE AS is_attempt
      FROM attempts WHERE created_at > now() - interval '30 days'
      UNION ALL
      SELECT user_id, created_at, NULL, FALSE
      FROM regents_answers WHERE created_at > now() - interval '30 days'
    )
    SELECT count(DISTINCT user_id) FILTER (WHERE created_at > now() - interval '7 days') AS "active7d",
           count(DISTINCT user_id) AS "active30d",
           count(*) FILTER (WHERE is_attempt) AS "attempts30d",
           sum(duration_ms) AS "ms30d"
    FROM activity`;
  return {
    active7d: Number(row?.active7d ?? 0),
    active30d: Number(row?.active30d ?? 0),
    attempts30d: Number(row?.attempts30d ?? 0),
    minutes30d: Math.round(Number(row?.ms30d ?? 0) / 60000),
  };
}

export interface UnitMasteryDistribution {
  unitNumber: number;
  titleEn: string;
  titleEs: string;
  /** Counts of (student, skill) pairs at each decayed mastery label. */
  struggling: number;
  practicing: number;
  proficient: number;
  mastered: number;
}

/**
 * School-wide mastery distribution by unit: where the curriculum bogs down
 * across all sections. Counts (student, skill) pairs — no identities. Rows
 * with zero attempts are skipped (they'd all be not_started noise).
 */
export async function unitMasteryDistribution(): Promise<UnitMasteryDistribution[]> {
  const [units, rows] = await Promise.all([
    prisma.unit.findMany({ orderBy: { number: 'asc' } }),
    prisma.$queryRaw<
      {
        unitNumber: number;
        score: number;
        attemptsCount: number;
        lastPracticedAt: Date | null;
      }[]
    >`
      SELECT u.number AS "unitNumber", m.score, m.attempts_count AS "attemptsCount",
             m.last_practiced_at AS "lastPracticedAt"
      FROM mastery m
      JOIN skills s ON s.id = m.skill_id
      JOIN lessons l ON l.id = s.lesson_id
      JOIN units u ON u.id = l.unit_id
      WHERE m.attempts_count > 0`,
  ]);
  const byUnit = new Map<number, UnitMasteryDistribution>(
    units.map((u) => [
      u.number,
      {
        unitNumber: u.number,
        titleEn: u.titleEn,
        titleEs: u.titleEs,
        struggling: 0,
        practicing: 0,
        proficient: 0,
        mastered: 0,
      },
    ]),
  );
  for (const r of rows) {
    const unit = byUnit.get(r.unitNumber);
    if (!unit) continue;
    const label = masteryLabel(
      decayedScore({
        score: r.score,
        attemptsCount: r.attemptsCount,
        lastPracticedAt: r.lastPracticedAt,
      }),
      r.attemptsCount,
    );
    if (label !== 'not_started') unit[label]++;
  }
  return [...byUnit.values()];
}

export interface SchoolAdoption {
  teachersActive: number;
  teachersPending: number;
  classes: number;
  studentsEnrolled: number;
  studentsTotal: number;
  /** Active students whose guardian consent is still pending (under-13 signups). */
  consentPending: number;
}

export async function schoolAdoption(): Promise<SchoolAdoption> {
  const [teachersActive, teachersPending, classes, enrolled, studentsTotal, consentPending] =
    await Promise.all([
      prisma.user.count({ where: { role: 'teacher', status: 'active' } }),
      prisma.user.count({ where: { role: 'teacher', status: 'pending' } }),
      prisma.class.count({ where: { archived: false } }),
      prisma.classEnrollment
        .findMany({ where: { status: 'active' }, distinct: ['studentUserId'], select: { studentUserId: true } })
        .then((rows) => rows.length),
      prisma.user.count({ where: { role: 'student', status: 'active' } }),
      prisma.user.count({ where: { role: 'student', status: 'active', guardianConsent: false } }),
    ]);
  return { teachersActive, teachersPending, classes, studentsEnrolled: enrolled, studentsTotal, consentPending };
}
