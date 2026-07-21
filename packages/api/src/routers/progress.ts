import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
import {
  REGENTS_ROUND_SIZE,
  computeAchievements,
  decayedScore,
  masteryLabel,
  readinessBand,
  regentsTopics,
  regentsTopicSkillSlugs,
} from '@tutor/core';
import { protectedProcedure, router } from '../trpc.js';
import { teacherCanSeeStudent } from '../authz.js';
import { masteryGrowthSeries } from '../classInsights.js';
import { schoolYearStart } from '../sprintStats.js';

async function buildProgress(userId: number) {
  const mastery = await prisma.mastery.findMany({
    where: { userId: BigInt(userId) },
    include: { skill: { include: { lesson: { include: { unit: true } } } } },
  });
  const sorted = mastery.sort((a, b) =>
    a.skill.lesson.unit.number - b.skill.lesson.unit.number ||
    a.skill.lesson.code.localeCompare(b.skill.lesson.code),
  );

  const activity = await prisma.$queryRaw<
    { day: string; attempts: number; correct: number; minutes: number }[]
  >`
    SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day,
           count(*)::int AS attempts,
           count(*) FILTER (WHERE correct)::int AS correct,
           coalesce(round(sum(duration_ms)/60000.0, 1), 0)::float AS minutes
    FROM attempts WHERE user_id = ${BigInt(userId)} AND created_at > now() - interval '30 days'
    GROUP BY 1 ORDER BY 1`;

  // Streak: consecutive days (ending today or yesterday) with any attempt —
  // Regents Review answers count as activity too.
  const regentsDays = await prisma.$queryRaw<{ day: string }[]>`
    SELECT DISTINCT to_char(created_at::date, 'YYYY-MM-DD') AS day
    FROM regents_answers
    WHERE user_id = ${BigInt(userId)} AND created_at > now() - interval '30 days'`;
  const days = new Set([...activity.map((a) => a.day), ...regentsDays.map((d) => d.day)]);
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  // Regents Review: per-topic tallies from the one-try answer log. Topic
  // completion and perfect-score badges track the first run (round 0);
  // renewed "practice again" rounds add to the lifetime right/wrong totals
  // and to the count of completed rounds shown in the per-topic detail.
  const regentsAnswers = await prisma.regentsAnswer.findMany({
    where: { userId: BigInt(userId) },
    select: { topicSlug: true, correct: true, round: true, createdAt: true },
  });
  const emptyTally = () => ({
    answered: 0, // round 0
    correct: 0, // round 0
    correctAll: 0,
    wrongAll: 0,
    perRound: new Map<number, number>(),
  });
  const regentsByTopic = new Map<string, ReturnType<typeof emptyTally>>();
  for (const a of regentsAnswers) {
    const t = regentsByTopic.get(a.topicSlug) ?? emptyTally();
    if (a.round === 0) {
      t.answered++;
      if (a.correct) t.correct++;
    }
    if (a.correct) t.correctAll++;
    else t.wrongAll++;
    t.perRound.set(a.round, (t.perRound.get(a.round) ?? 0) + 1);
    regentsByTopic.set(a.topicSlug, t);
  }
  const regentsTopicStats = regentsTopics.map((t) => {
    const p = regentsByTopic.get(t.slug) ?? emptyTally();
    return {
      slug: t.slug,
      icon: t.icon,
      titleEn: t.titleEn,
      titleEs: t.titleEs,
      total: REGENTS_ROUND_SIZE,
      answered: p.answered,
      correct: p.correct,
      // Lifetime detail across every round, for the per-topic dropdown.
      correctAll: p.correctAll,
      wrongAll: p.wrongAll,
      completions: [...p.perRound.values()].filter((n) => n >= REGENTS_ROUND_SIZE).length,
    };
  });
  const regents = {
    topics: regentsTopicStats,
    questionsAnswered: regentsAnswers.length,
    questionsCorrect: regentsAnswers.filter((a) => a.correct).length,
    topicsCompleted: regentsTopicStats.filter((t) => t.answered >= t.total).length,
    perfectTopics: regentsTopicStats.filter((t) => t.correct === t.total).length,
  };

  // Regents readiness per topic (docs/statistics-plan.md, Phase 2): the
  // shared core blend of decayed mastery over the topic's linked skills and
  // lifetime Regents accuracy — same bands the teacher and admin views show.
  const scoreBySlug = new Map(
    mastery
      .filter((m) => m.attemptsCount > 0)
      .map((m) => [
        m.skill.slug,
        decayedScore({
          score: m.score,
          attemptsCount: m.attemptsCount,
          lastPracticedAt: m.lastPracticedAt,
        }),
      ]),
  );
  const regentsReadiness = regentsTopics.map((t) => {
    const linked = regentsTopicSkillSlugs[t.slug] ?? [];
    const scores = linked
      .map((slug) => scoreBySlug.get(slug))
      .filter((s): s is number => s !== undefined);
    const masteryAvg =
      scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null;
    const p = regentsByTopic.get(t.slug);
    const answered = p ? p.correctAll + p.wrongAll : 0;
    return {
      slug: t.slug,
      icon: t.icon,
      titleEn: t.titleEn,
      titleEs: t.titleEs,
      band: readinessBand({
        masteryAvg,
        regentsAnswered: answered,
        regentsCorrect: p?.correctAll ?? 0,
      }),
    };
  });

  const skills = sorted.map((m) => {
    const score = decayedScore({
      score: m.score,
      attemptsCount: m.attemptsCount,
      lastPracticedAt: m.lastPracticedAt,
    });
    return {
      skillId: Number(m.skillId),
      name: m.skill.nameEn,
      lessonCode: m.skill.lesson.code,
      unitNumber: m.skill.lesson.unit.number,
      score: Math.round(score * 100) / 100,
      attempts: m.attemptsCount,
      label: masteryLabel(score, m.attemptsCount),
    };
  });

  // Lifetime tallies for the badge case.
  const correctAnswers = await prisma.attempt.count({
    where: { userId: BigInt(userId), correct: true },
  });

  // Longest run of consecutive correct answers, across practice attempts and
  // Regents Review answers in the order they happened.
  const attemptResults = await prisma.attempt.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { createdAt: 'asc' },
    select: { correct: true, createdAt: true },
  });
  const timeline = [
    ...attemptResults,
    ...regentsAnswers.map((a) => ({ correct: a.correct, createdAt: a.createdAt })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let correctStreakBest = 0;
  let run = 0;
  for (const entry of timeline) {
    run = entry.correct ? run + 1 : 0;
    correctStreakBest = Math.max(correctStreakBest, run);
  }

  // Total completed sprint rounds for the sprint badge ladder. Counts every
  // FINISHED round (ended_at set — an opened-then-abandoned round is not a
  // completion) regardless of the (legacy) difficulty column, so rounds
  // finished before sprints became single-difficulty still count.
  const sprintsCompleted = await prisma.sprintSession.count({
    where: { userId: BigInt(userId), endedAt: { not: null } },
  });

  const achievements = computeAchievements({
    correctAnswers: correctAnswers + regents.questionsCorrect,
    correctStreakBest,
    streakDays: streak,
    skillsStrong: skills.filter((s) => s.label === 'mastered' || s.label === 'proficient').length,
    regentsCorrect: regents.questionsCorrect,
    regentsTopicsCompleted: regents.topicsCompleted,
    regentsPerfectTopics: regents.perfectTopics,
    sprintsCompleted,
  });

  // Phase 3 (docs/statistics-plan.md): weekly average-mastery trend from
  // the snapshot history — the "your mastery this month vs last month" line.
  const growth = await masteryGrowthSeries([BigInt(userId)], schoolYearStart());

  return {
    streakDays: streak,
    skills,
    struggleFlags: skills.filter((s) => s.label === 'struggling'),
    activity,
    regents,
    regentsReadiness,
    growth,
    achievements,
  };
}

export const progressRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => buildProgress(ctx.user.id)),

  /** Guardian/teacher view (§4.6): read-only, scoped to linked students (FERPA §9). */
  student: protectedProcedure
    .input(z.object({ studentId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === 'student') {
        if (ctx.user.id !== input.studentId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'forbidden' });
        }
      } else if (ctx.user.role === 'teacher') {
        // A teacher may view a student only through an active enrollment in a
        // class they own (FERPA §9). Fail closed — no shared class, no access.
        if (!(await teacherCanSeeStudent(ctx.user.id, input.studentId))) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'not linked to this student' });
        }
      } else {
        // Guardians may only view students who opted them in (guardian email
        // at signup). Fail closed.
        const link = await prisma.guardianLink.findUnique({
          where: {
            guardianUserId_studentUserId: {
              guardianUserId: BigInt(ctx.user.id),
              studentUserId: BigInt(input.studentId),
            },
          },
        });
        if (!link || link.status !== 'active') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'not linked to this student' });
        }
      }
      const student = await prisma.user.findFirst({
        where: { id: BigInt(input.studentId), role: 'student' },
        select: { displayName: true, grade: true },
      });
      if (!student) throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      return {
        student: { id: input.studentId, displayName: student.displayName, grade: student.grade },
        ...(await buildProgress(input.studentId)),
      };
    }),

  /** FERPA (§9): data export for the student's own records. */
  export: protectedProcedure.query(async ({ ctx }) => {
    const attempts = await prisma.attempt.findMany({
      where: { userId: BigInt(ctx.user.id) },
      orderBy: { createdAt: 'asc' },
      select: {
        problemId: true,
        submittedLatex: true,
        correct: true,
        hintsUsed: true,
        stepReached: true,
        durationMs: true,
        context: true,
        createdAt: true,
      },
    });
    return {
      exportedAt: new Date().toISOString(),
      user: ctx.user,
      progress: await buildProgress(ctx.user.id),
      attempts: attempts.map((a) => ({ ...a, problemId: Number(a.problemId) })),
    };
  }),
});
