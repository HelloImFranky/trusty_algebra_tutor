import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma, prisma } from '@tutor/db';
import { decayedScore, masteryLabel } from '@tutor/core';
import { fixedWindowLimiter, router, studentProcedure, teacherProcedure } from '../trpc.js';
import { recordGuardianConsent, teacherCanSeeStudent } from '../authz.js';
import { schoolYearStart, seasonTotals, sprintLeaderboard, weeklySeries } from '../sprintStats.js';

/**
 * Teacher dashboard (docs/teacher-dashboard-plan.md, Stage 1). A teacher owns
 * classes; students opt in with a join code. Every teacher endpoint is
 * ownership-scoped — it only ever touches classes where teacher_user_id is the
 * caller, so one teacher can never read or mutate another's class.
 */

// Crockford base32 (no I/L/O/U → unambiguous when read aloud/typed). 8 chars
// = 40 bits of entropy, so codes aren't guessable; join is also rate-limited.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function generateJoinCode(): string {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i]! & 31];
  return code;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** Create a class, retrying if the random code happens to collide. */
async function createWithUniqueCode(teacherId: bigint, name: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.class.create({
        data: { teacherUserId: teacherId, name, joinCode: generateJoinCode() },
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'could not allocate a unique join code, please retry',
  });
}

/** Load a class the caller owns, or 404 (never leak other teachers' classes). */
async function ownedClass(teacherId: bigint, classId: number) {
  const cls = await prisma.class.findFirst({
    where: { id: BigInt(classId), teacherUserId: teacherId },
  });
  if (!cls) throw new TRPCError({ code: 'NOT_FOUND', message: 'class not found' });
  return cls;
}

/** Consecutive days (ending today or yesterday) present in a day-string set. */
function streakFromDays(days: Set<string>): number {
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

interface RosterSummary {
  streakDays: number;
  mastered: number;
  struggling: number;
  lastActiveAt: string | null;
}

/**
 * Lightweight per-student summary for a whole class in a handful of batched
 * queries (never one query per student) — full detail lives behind the
 * per-student drill-down (progress.student).
 */
async function rosterSummaries(studentIds: bigint[]): Promise<Map<string, RosterSummary>> {
  const out = new Map<string, RosterSummary>();
  if (studentIds.length === 0) return out;
  const ids = Prisma.join(studentIds);

  // Activity days (practice attempts + Regents answers) over a window wide
  // enough to measure the current streak.
  const dayRows = await prisma.$queryRaw<{ userId: bigint; day: string }[]>`
    SELECT user_id AS "userId", to_char(created_at::date, 'YYYY-MM-DD') AS day
    FROM attempts WHERE user_id IN (${ids}) AND created_at > now() - interval '40 days'
    GROUP BY 1, 2
    UNION
    SELECT user_id AS "userId", to_char(created_at::date, 'YYYY-MM-DD') AS day
    FROM regents_answers WHERE user_id IN (${ids}) AND created_at > now() - interval '40 days'
    GROUP BY 1, 2`;
  const daysByUser = new Map<string, Set<string>>();
  for (const r of dayRows) {
    const key = String(r.userId);
    (daysByUser.get(key) ?? daysByUser.set(key, new Set()).get(key)!).add(r.day);
  }

  // Most recent activity (any time), across attempts + Regents answers.
  const lastRows = await prisma.$queryRaw<{ userId: bigint; lastActive: Date }[]>`
    SELECT user_id AS "userId", max(created_at) AS "lastActive" FROM (
      SELECT user_id, created_at FROM attempts WHERE user_id IN (${ids})
      UNION ALL
      SELECT user_id, created_at FROM regents_answers WHERE user_id IN (${ids})
    ) t GROUP BY 1`;
  const lastByUser = new Map(lastRows.map((r) => [String(r.userId), r.lastActive]));

  // Mastery tallies (decayed, same as the student's own progress view).
  const mastery = await prisma.mastery.findMany({
    where: { userId: { in: studentIds } },
    select: { userId: true, score: true, attemptsCount: true, lastPracticedAt: true },
  });
  const tally = new Map<string, { mastered: number; struggling: number }>();
  for (const m of mastery) {
    const key = String(m.userId);
    const t = tally.get(key) ?? { mastered: 0, struggling: 0 };
    const label = masteryLabel(
      decayedScore({ score: m.score, attemptsCount: m.attemptsCount, lastPracticedAt: m.lastPracticedAt }),
      m.attemptsCount,
    );
    if (label === 'mastered' || label === 'proficient') t.mastered++;
    else if (label === 'struggling') t.struggling++;
    tally.set(key, t);
  }

  for (const id of studentIds) {
    const key = String(id);
    const t = tally.get(key) ?? { mastered: 0, struggling: 0 };
    out.set(key, {
      streakDays: streakFromDays(daysByUser.get(key) ?? new Set()),
      mastered: t.mastered,
      struggling: t.struggling,
      lastActiveAt: lastByUser.get(key)?.toISOString() ?? null,
    });
  }
  return out;
}

// Students are the only ones who join, and a join tries a bearer code — cap
// attempts per student so codes can't be brute-forced / used to mass-enroll.
const joinRate = fixedWindowLimiter(20);

export const teacherRouter = router({
  classes: router({
    /** The caller's own (non-archived) classes with active-enrollment counts. */
    list: teacherProcedure.query(async ({ ctx }) => {
      const classes = await prisma.class.findMany({
        where: { teacherUserId: BigInt(ctx.user.id), archived: false },
        orderBy: { createdAt: 'desc' },
      });
      const counts = await prisma.classEnrollment.groupBy({
        by: ['classId'],
        where: { classId: { in: classes.map((c) => c.id) }, status: 'active' },
        _count: true,
      });
      const countByClass = new Map(counts.map((c) => [String(c.classId), c._count]));
      return {
        classes: classes.map((c) => ({
          id: Number(c.id),
          name: c.name,
          joinCode: c.joinCode,
          studentCount: countByClass.get(String(c.id)) ?? 0,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    }),

    create: teacherProcedure
      .input(z.object({ name: z.string().trim().min(1).max(80) }))
      .mutation(async ({ ctx, input }) => {
        const cls = await createWithUniqueCode(BigInt(ctx.user.id), input.name);
        return { id: Number(cls.id), name: cls.name, joinCode: cls.joinCode, studentCount: 0 };
      }),

    /** Roster of a class the caller owns, each student with a light summary. */
    roster: teacherProcedure
      .input(z.object({ classId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const cls = await ownedClass(BigInt(ctx.user.id), input.classId);
        const enrollments = await prisma.classEnrollment.findMany({
          where: { classId: cls.id, status: 'active' },
          include: {
            student: { select: { id: true, displayName: true, grade: true, guardianConsent: true } },
          },
          orderBy: { joinedAt: 'asc' },
        });
        const summaries = await rosterSummaries(enrollments.map((e) => e.studentUserId));
        return {
          class: { id: Number(cls.id), name: cls.name, joinCode: cls.joinCode },
          students: enrollments.map((e) => ({
            id: Number(e.student.id),
            displayName: e.student.displayName,
            grade: e.student.grade,
            // Under-13 students start guardianConsent=false; surface it so the
            // roster can badge "needs consent" and offer the attest action.
            consentPending: !e.student.guardianConsent,
            joinedAt: e.joinedAt.toISOString(),
            ...(summaries.get(String(e.studentUserId)) ?? {
              streakDays: 0,
              mastered: 0,
              struggling: 0,
              lastActiveAt: null,
            }),
          })),
        };
      }),

    /** Rotate a leaked/compromised join code. */
    regenerateCode: teacherProcedure
      .input(z.object({ classId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await ownedClass(BigInt(ctx.user.id), input.classId);
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const updated = await prisma.class.update({
              where: { id: BigInt(input.classId) },
              data: { joinCode: generateJoinCode() },
            });
            return { joinCode: updated.joinCode };
          } catch (err) {
            if (isUniqueViolation(err)) continue;
            throw err;
          }
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'could not rotate code' });
      }),

    archive: teacherProcedure
      .input(z.object({ classId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await ownedClass(BigInt(ctx.user.id), input.classId);
        await prisma.class.update({ where: { id: BigInt(input.classId) }, data: { archived: true } });
        return { ok: true };
      }),

    removeStudent: teacherProcedure
      .input(z.object({ classId: z.number().int(), studentId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await ownedClass(BigInt(ctx.user.id), input.classId);
        await prisma.classEnrollment.updateMany({
          where: { classId: BigInt(input.classId), studentUserId: BigInt(input.studentId) },
          data: { status: 'removed' },
        });
        return { ok: true };
      }),

    /**
     * Live sprint stats for one owned class (docs/sprint-leaderboard-plan.md):
     * the same leaderboard students see (correct during the sprint + correct
     * this week), plus teacher-only depth — per-student season totals since
     * Sep 1 and a weekly class time series for the year chart. The stats
     * page polls this on a short interval.
     */
    sprintStats: teacherProcedure
      .input(z.object({ classId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const cls = await ownedClass(BigInt(ctx.user.id), input.classId);
        const enrollments = await prisma.classEnrollment.findMany({
          where: { classId: cls.id, status: 'active' },
          select: {
            studentUserId: true,
            student: { select: { displayName: true } },
          },
        });
        const ids = enrollments.map((e) => e.studentUserId);
        const [board, season, series] = await Promise.all([
          sprintLeaderboard(ids),
          seasonTotals(ids),
          weeklySeries(ids),
        ]);
        const students = enrollments
          .map((e) => {
            const key = String(e.studentUserId);
            const b = board.get(key)!;
            const y = season.get(key) ?? { rounds: 0, attempted: 0, correct: 0 };
            return {
              id: Number(e.studentUserId),
              displayName: e.student.displayName,
              inSprint: b.inSprint,
              sprintCorrect: b.sprintCorrect,
              weekCorrect: b.weekCorrect,
              yearRounds: y.rounds,
              yearAttempted: y.attempted,
              yearCorrect: y.correct,
            };
          })
          .sort(
            (a, b) =>
              b.sprintCorrect - a.sprintCorrect ||
              b.weekCorrect - a.weekCorrect ||
              a.displayName.localeCompare(b.displayName),
          );
        return {
          class: { id: Number(cls.id), name: cls.name },
          students,
          weekly: series,
          yearStart: schoolYearStart().toISOString().slice(0, 10),
        };
      }),

    /** Student action: enroll in a class by its join code. */
    join: studentProcedure
      .input(z.object({ code: z.string().trim().min(1).max(16) }))
      .mutation(async ({ ctx, input }) => {
        if (!joinRate(`${ctx.user.id}|${ctx.ip ?? 'unknown'}`)) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many attempts. Please wait a minute and try again.',
          });
        }
        const cls = await prisma.class.findFirst({
          where: { joinCode: input.code.toUpperCase(), archived: false },
          select: { id: true, name: true },
        });
        if (!cls) throw new TRPCError({ code: 'NOT_FOUND', message: 'No class matches that code.' });
        await prisma.classEnrollment.upsert({
          where: {
            classId_studentUserId: { classId: cls.id, studentUserId: BigInt(ctx.user.id) },
          },
          update: { status: 'active' }, // re-joining after removal reactivates
          create: { classId: cls.id, studentUserId: BigInt(ctx.user.id), status: 'active' },
        });
        return { classId: Number(cls.id), name: cls.name };
      }),
  }),

  /**
   * Record that the school obtained parental consent for a student
   * (docs/guardian-consent-plan.md, Tier 0). School-consent path: attests on
   * the parent's behalf, unblocking the student's tutor access. Scoped to the
   * caller's own roster — a teacher can only attest for a student actively
   * enrolled in a class they own. Does NOT activate any guardian *link* (that
   * requires the guardian's own verified account — Tier 1).
   */
  verifyGuardianConsent: teacherProcedure
    .input(z.object({ studentId: z.number().int(), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await teacherCanSeeStudent(ctx.user.id, input.studentId))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'not linked to this student' });
      }
      await recordGuardianConsent({
        studentId: input.studentId,
        method: 'school',
        grantedByUserId: ctx.user.id,
        note: input.note,
      });
      return { ok: true };
    }),
});
