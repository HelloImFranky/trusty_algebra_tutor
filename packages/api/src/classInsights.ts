import { Prisma, prisma } from '@tutor/db';
import {
  decayedScore,
  masteryLabel,
  readinessBand,
  regentsTopics,
  regentsTopicSkillSlugs,
  type ReadinessBand,
} from '@tutor/core';

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
      slug: s.slug,
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

// ---------------------------------------------------------------------------
// Phase 2 (docs/statistics-plan.md): item analysis, tier mix, Regents
// readiness, tutor-usage counts.
// ---------------------------------------------------------------------------

export interface ProblemItemRow {
  problemId: number;
  promptEn: string;
  promptEs: string;
  tier: string;
  skillNameEn: string;
  skillNameEs: string;
  attempts: number;
  correct: number;
  students: number;
}

const ITEM_MIN_ATTEMPTS = 5;
const ITEM_ROWS = 15;

/**
 * Hardest practice problems for these students since the school year
 * started — lowest success rate first, only items with enough attempts to
 * mean something. Mirrors how NY teachers read NYSED's per-question Regents
 * item analyses, but for the practice bank.
 */
export async function problemItemAnalysis(
  studentIds: bigint[],
  since: Date,
): Promise<ProblemItemRow[]> {
  if (studentIds.length === 0) return [];
  const rows = await prisma.$queryRaw<
    {
      problemId: bigint;
      promptEn: string;
      promptEs: string;
      tier: string;
      skillNameEn: string;
      skillNameEs: string;
      attempts: bigint;
      correct: bigint;
      students: bigint;
    }[]
  >`
    SELECT p.id AS "problemId", p.prompt_en AS "promptEn", p.prompt_es AS "promptEs",
           p.tier, s.name_en AS "skillNameEn", s.name_es AS "skillNameEs",
           count(*) AS attempts,
           count(*) FILTER (WHERE a.correct) AS correct,
           count(DISTINCT a.user_id) AS students
    FROM attempts a
    JOIN problems p ON p.id = a.problem_id
    JOIN skills s ON s.id = p.skill_id
    WHERE a.user_id IN (${Prisma.join(studentIds)}) AND a.created_at >= ${since}
    GROUP BY 1, 2, 3, 4, 5, 6
    HAVING count(*) >= ${ITEM_MIN_ATTEMPTS}
    ORDER BY count(*) FILTER (WHERE a.correct)::float / count(*) ASC, count(*) DESC
    LIMIT ${ITEM_ROWS}`;
  return rows.map((r) => ({
    problemId: Number(r.problemId),
    promptEn: r.promptEn,
    promptEs: r.promptEs,
    tier: r.tier,
    skillNameEn: r.skillNameEn,
    skillNameEs: r.skillNameEs,
    attempts: Number(r.attempts),
    correct: Number(r.correct),
    students: Number(r.students),
  }));
}

export interface RegentsItemRow {
  /** Bank question id — the client resolves prompt text from core content. */
  questionId: string;
  topicSlug: string;
  answered: number;
  correct: number;
}

const REGENTS_ITEM_MIN_ANSWERS = 3;
const REGENTS_ITEM_ROWS = 10;

/** Hardest handwritten-bank Regents questions (round 0 only — generated
 * "practice again" ids don't map back to the bank). */
export async function regentsItemAnalysis(studentIds: bigint[]): Promise<RegentsItemRow[]> {
  if (studentIds.length === 0) return [];
  const rows = await prisma.$queryRaw<
    { questionId: string; topicSlug: string; answered: bigint; correct: bigint }[]
  >`
    SELECT question_id AS "questionId", topic_slug AS "topicSlug",
           count(*) AS answered, count(*) FILTER (WHERE correct) AS correct
    FROM regents_answers
    WHERE user_id IN (${Prisma.join(studentIds)}) AND round = 0
    GROUP BY 1, 2
    HAVING count(*) >= ${REGENTS_ITEM_MIN_ANSWERS}
    ORDER BY count(*) FILTER (WHERE correct)::float / count(*) ASC, count(*) DESC
    LIMIT ${REGENTS_ITEM_ROWS}`;
  return rows.map((r) => ({
    questionId: r.questionId,
    topicSlug: r.topicSlug,
    answered: Number(r.answered),
    correct: Number(r.correct),
  }));
}

export interface TierMixRow {
  modified: number;
  standard: number;
  challenge: number;
  /** Mostly practicing in the modified tier — a differentiation signal. */
  stuckModified: boolean;
}

const TIER_WINDOW_DAYS = 30;
const STUCK_MIN_ATTEMPTS = 8;
const STUCK_SHARE = 0.6;

/** Per-student practice-tier mix over the last 30 days. */
export async function tierMix(studentIds: bigint[]): Promise<Map<string, TierMixRow>> {
  const out = new Map<string, TierMixRow>();
  if (studentIds.length === 0) return out;
  const rows = await prisma.$queryRaw<{ userId: bigint; tier: string; n: bigint }[]>`
    SELECT a.user_id AS "userId", p.tier, count(*) AS n
    FROM attempts a
    JOIN problems p ON p.id = a.problem_id
    WHERE a.user_id IN (${Prisma.join(studentIds)})
      AND a.created_at > now() - make_interval(days => ${TIER_WINDOW_DAYS}::int)
    GROUP BY 1, 2`;
  for (const id of studentIds) {
    out.set(String(id), { modified: 0, standard: 0, challenge: 0, stuckModified: false });
  }
  for (const r of rows) {
    const row = out.get(String(r.userId));
    if (!row) continue;
    if (r.tier === 'modified') row.modified = Number(r.n);
    else if (r.tier === 'challenge') row.challenge = Number(r.n);
    else row.standard = Number(r.n);
  }
  for (const row of out.values()) {
    const total = row.modified + row.standard + row.challenge;
    row.stuckModified = total >= STUCK_MIN_ATTEMPTS && row.modified / total >= STUCK_SHARE;
  }
  return out;
}

export interface TutorUsage {
  perStudent: Map<string, number>;
  /** Most tutor-visited skills (via the session's problem), re-teach signals. */
  topSkills: { nameEn: string; nameEs: string; sessions: number }[];
}

const TUTOR_WINDOW_DAYS = 30;
const TUTOR_TOP_ROWS = 5;

/** Tutor-chat session counts over 30 days — counts only, transcripts stay
 * private to the student. */
export async function tutorUsage(studentIds: bigint[]): Promise<TutorUsage> {
  if (studentIds.length === 0) return { perStudent: new Map(), topSkills: [] };
  const ids = Prisma.join(studentIds);
  const perRows = await prisma.$queryRaw<{ userId: bigint; sessions: bigint }[]>`
    SELECT user_id AS "userId", count(*) AS sessions
    FROM tutor_sessions
    WHERE user_id IN (${ids}) AND created_at > now() - make_interval(days => ${TUTOR_WINDOW_DAYS}::int)
    GROUP BY 1`;
  const skillRows = await prisma.$queryRaw<
    { nameEn: string; nameEs: string; sessions: bigint }[]
  >`
    SELECT s.name_en AS "nameEn", s.name_es AS "nameEs", count(*) AS sessions
    FROM tutor_sessions t
    JOIN problems p ON p.id = t.problem_id
    JOIN skills s ON s.id = p.skill_id
    WHERE t.user_id IN (${ids}) AND t.created_at > now() - make_interval(days => ${TUTOR_WINDOW_DAYS}::int)
    GROUP BY 1, 2
    ORDER BY count(*) DESC
    LIMIT ${TUTOR_TOP_ROWS}`;
  return {
    perStudent: new Map(perRows.map((r) => [String(r.userId), Number(r.sessions)])),
    topSkills: skillRows.map((r) => ({
      nameEn: r.nameEn,
      nameEs: r.nameEs,
      sessions: Number(r.sessions),
    })),
  };
}

/**
 * Per-student Regents readiness bands, one per topic (docs/statistics-plan.md
 * Phase 2). Blends decayed mastery over the topic's linked skills with
 * lifetime Regents accuracy via the shared core model, so the student,
 * teacher, and admin views always agree.
 */
export async function readinessByStudent(
  studentIds: bigint[],
): Promise<Map<string, Record<string, ReadinessBand>>> {
  const out = new Map<string, Record<string, ReadinessBand>>();
  if (studentIds.length === 0) return out;
  const ids = Prisma.join(studentIds);
  const masteryRows = await prisma.$queryRaw<
    {
      userId: bigint;
      slug: string;
      score: number;
      attemptsCount: number;
      lastPracticedAt: Date | null;
    }[]
  >`
    SELECT m.user_id AS "userId", s.slug, m.score, m.attempts_count AS "attemptsCount",
           m.last_practiced_at AS "lastPracticedAt"
    FROM mastery m
    JOIN skills s ON s.id = m.skill_id
    WHERE m.user_id IN (${ids}) AND m.attempts_count > 0`;
  const regentsRows = await prisma.$queryRaw<
    { userId: bigint; topicSlug: string; answered: bigint; correct: bigint }[]
  >`
    SELECT user_id AS "userId", topic_slug AS "topicSlug",
           count(*) AS answered, count(*) FILTER (WHERE correct) AS correct
    FROM regents_answers
    WHERE user_id IN (${ids})
    GROUP BY 1, 2`;

  const scoreByUserSlug = new Map<string, Map<string, number>>();
  for (const r of masteryRows) {
    const key = String(r.userId);
    const bySlug = scoreByUserSlug.get(key) ?? new Map<string, number>();
    bySlug.set(
      r.slug,
      decayedScore({ score: r.score, attemptsCount: r.attemptsCount, lastPracticedAt: r.lastPracticedAt }),
    );
    scoreByUserSlug.set(key, bySlug);
  }
  const regentsByUserTopic = new Map<string, { answered: number; correct: number }>();
  for (const r of regentsRows) {
    regentsByUserTopic.set(`${r.userId}|${r.topicSlug}`, {
      answered: Number(r.answered),
      correct: Number(r.correct),
    });
  }

  for (const id of studentIds) {
    const key = String(id);
    const bySlug = scoreByUserSlug.get(key);
    const bands: Record<string, ReadinessBand> = {};
    for (const topic of regentsTopics) {
      const linked = regentsTopicSkillSlugs[topic.slug] ?? [];
      const scores = linked
        .map((slug) => bySlug?.get(slug))
        .filter((s): s is number => s !== undefined);
      const masteryAvg =
        scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null;
      const reg = regentsByUserTopic.get(`${key}|${topic.slug}`);
      bands[topic.slug] = readinessBand({
        masteryAvg,
        regentsAnswered: reg?.answered ?? 0,
        regentsCorrect: reg?.correct ?? 0,
      });
    }
    out.set(key, bands);
  }
  return out;
}

export interface TopicReadinessDistribution {
  topicSlug: string;
  ready: number;
  developing: number;
  needsWork: number;
  noData: number;
}

/** School-wide readiness distribution per Regents topic — counts of active
 * students per band, no identities (admin scope). */
export async function schoolReadinessDistribution(): Promise<TopicReadinessDistribution[]> {
  const students = await prisma.user.findMany({
    where: { role: 'student', status: 'active' },
    select: { id: true },
  });
  const byStudent = await readinessByStudent(students.map((s) => s.id));
  const out = regentsTopics.map((t) => ({
    topicSlug: t.slug,
    ready: 0,
    developing: 0,
    needsWork: 0,
    noData: 0,
  }));
  const byTopic = new Map(out.map((o) => [o.topicSlug, o]));
  for (const bands of byStudent.values()) {
    for (const [slug, band] of Object.entries(bands)) {
      const row = byTopic.get(slug);
      if (row) row[band]++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Phase 3 (docs/statistics-plan.md): mastery growth over time + admin cohort
// slices. Growth reads mastery_snapshots (written weekly by applyMastery),
// so it accrues from the migration forward — there is no history to backfill.
// ---------------------------------------------------------------------------

export interface GrowthWeekPoint {
  /** ISO date (YYYY-MM-DD) of the week's Monday. */
  weekStart: string;
  /** Mean snapshot score across (student, skill) pairs that week, 0..1. */
  avgScore: number;
  /** Distinct students with any snapshot that week. */
  students: number;
}

/** Weekly average-mastery series. null studentIds = every student (admin). */
export async function masteryGrowthSeries(
  studentIds: bigint[] | null,
  since: Date,
): Promise<GrowthWeekPoint[]> {
  if (studentIds !== null && studentIds.length === 0) return [];
  const scope =
    studentIds === null
      ? Prisma.empty
      : Prisma.sql`AND user_id IN (${Prisma.join(studentIds)})`;
  const rows = await prisma.$queryRaw<
    { week: Date; avgScore: number; students: bigint }[]
  >`
    SELECT week_start AS week, avg(score)::float AS "avgScore",
           count(DISTINCT user_id) AS students
    FROM mastery_snapshots
    WHERE week_start >= ${since} ${scope}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({
    weekStart: r.week.toISOString().slice(0, 10),
    avgScore: Math.round(r.avgScore * 1000) / 1000,
    students: Number(r.students),
  }));
}

export interface CohortSlice {
  /** Cohort key: a grade number as string, a locale code, or 'unspecified'. */
  key: string;
  students: number;
  /** True when the cohort is smaller than MIN_COHORT — stats are withheld so
   * small groups can't be re-identified from "aggregates". */
  suppressed: boolean;
  active30d: number | null;
  minutes30d: number | null;
  /** Mean decayed mastery over the cohort's mastery rows, 0..1. */
  avgMastery: number | null;
}

/** Below this many students a slice reports no stats (re-identification floor). */
export const MIN_COHORT = 5;

/**
 * School slices by grade or locale (docs/statistics-plan.md, Phase 3) — the
 * usage/outcome splits a NY school reports on (locale = the MLL/ELL story).
 * Aggregates only, and small cohorts are suppressed outright.
 */
export async function cohortSlices(dimension: 'grade' | 'locale'): Promise<CohortSlice[]> {
  const students = await prisma.user.findMany({
    where: { role: 'student', status: 'active' },
    select: { id: true, grade: true, locale: true },
  });
  const keyOf = (s: { grade: number | null; locale: string }) =>
    dimension === 'grade' ? (s.grade === null ? 'unspecified' : String(s.grade)) : s.locale;
  const cohorts = new Map<string, bigint[]>();
  for (const s of students) {
    const key = keyOf(s);
    (cohorts.get(key) ?? cohorts.set(key, []).get(key)!).push(s.id);
  }
  if (cohorts.size === 0) return [];

  const allIds = students.map((s) => s.id);
  const ids = Prisma.join(allIds);
  const activityRows = await prisma.$queryRaw<
    { userId: bigint; ms30d: bigint | null; active: boolean }[]
  >`
    SELECT user_id AS "userId", sum(duration_ms) AS "ms30d", TRUE AS active
    FROM attempts
    WHERE user_id IN (${ids}) AND created_at > now() - interval '30 days'
    GROUP BY 1`;
  const activityByUser = new Map(activityRows.map((r) => [String(r.userId), r]));
  const masteryRows = await prisma.mastery.findMany({
    where: { userId: { in: allIds }, attemptsCount: { gt: 0 } },
    select: { userId: true, score: true, attemptsCount: true, lastPracticedAt: true },
  });
  const masteryByUser = new Map<string, number[]>();
  for (const m of masteryRows) {
    const key = String(m.userId);
    const score = decayedScore({
      score: m.score,
      attemptsCount: m.attemptsCount,
      lastPracticedAt: m.lastPracticedAt,
    });
    (masteryByUser.get(key) ?? masteryByUser.set(key, []).get(key)!).push(score);
  }

  const out: CohortSlice[] = [];
  for (const [key, cohortIds] of cohorts) {
    const suppressed = cohortIds.length < MIN_COHORT;
    if (suppressed) {
      out.push({
        key,
        students: cohortIds.length,
        suppressed,
        active30d: null,
        minutes30d: null,
        avgMastery: null,
      });
      continue;
    }
    let active = 0;
    let ms = 0;
    const scores: number[] = [];
    for (const id of cohortIds) {
      const a = activityByUser.get(String(id));
      if (a) {
        active++;
        ms += Number(a.ms30d ?? 0);
      }
      scores.push(...(masteryByUser.get(String(id)) ?? []));
    }
    out.push({
      key,
      students: cohortIds.length,
      suppressed,
      active30d: active,
      minutes30d: Math.round(ms / 60000),
      avgMastery:
        scores.length > 0
          ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 1000) / 1000
          : null,
    });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}
