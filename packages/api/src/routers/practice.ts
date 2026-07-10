import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
import { decayedScore, tierForScore, grade } from '@tutor/core';
import type { GradingMode } from '@tutor/core';
import { loc, protectedProcedure, router } from '../trpc.js';
import { applyMastery } from './curriculum.js';

const localeInput = z.object({ locale: z.enum(['en', 'es']).optional() });

type Locale = 'en' | 'es';

interface ProblemRow {
  id: bigint;
  skillId: bigint;
  tier: string;
  promptEn: string;
  promptEs: string;
  gradingMode: string;
}

async function problemPayload(p: ProblemRow, locale: Locale) {
  const steps = await prisma.problemStep.findMany({
    where: { problemId: p.id },
    orderBy: { position: 'asc' },
  });
  return {
    id: Number(p.id),
    skillId: Number(p.skillId),
    tier: p.tier,
    prompt: locale === 'es' ? p.promptEs : p.promptEn,
    gradingMode: p.gradingMode,
    steps: steps.map((s) => ({
      position: s.position,
      prompt: locale === 'es' ? s.promptEs : s.promptEn,
      hint: locale === 'es' ? s.hintEs : s.hintEn,
    })),
  };
}

const attemptInput = z.object({
  problemId: z.number().int(),
  submittedLatex: z.string().max(2000),
  hintsUsed: z.number().int().min(0).max(20).default(0),
  stepReached: z.number().int().min(0).default(0),
  durationMs: z.number().int().nonnegative().optional(),
  context: z.enum(['practice', 'sprint', 'review']).default('practice'),
  locale: z.enum(['en', 'es']).optional(),
});

export const practiceRouter = router({
  /**
   * Adaptive problem selection (§4.4): pick the tier from current mastery,
   * prefer problems the student hasn't attempted recently.
   */
  next: protectedProcedure
    .input(localeInput.extend({ skillId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const m = await prisma.mastery.findUnique({
        where: { userId_skillId: { userId: BigInt(ctx.user.id), skillId: BigInt(input.skillId) } },
      });
      const score = m
        ? decayedScore({
            score: m.score,
            attemptsCount: m.attemptsCount,
            lastPracticedAt: m.lastPracticedAt,
          })
        : 0;
      const tier = tierForScore(score, m?.attemptsCount ?? 0);

      const pick = await prisma.$queryRaw<ProblemRow[]>`
        SELECT p.id, p.skill_id AS "skillId", p.tier,
               p.prompt_en AS "promptEn", p.prompt_es AS "promptEs",
               p.grading_mode AS "gradingMode"
        FROM problems p
        LEFT JOIN (
          SELECT problem_id, max(created_at) AS last_attempt, count(*) AS n
          FROM attempts WHERE user_id = ${BigInt(ctx.user.id)} GROUP BY problem_id
        ) a ON a.problem_id = p.id
        WHERE p.skill_id = ${BigInt(input.skillId)} AND p.tier = ${tier} AND NOT p.is_sprint
        ORDER BY a.n NULLS FIRST, a.last_attempt NULLS FIRST, random()
        LIMIT 1`;
      if (!pick.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'no problems for this skill' });
      return {
        tier,
        masteryScore: Math.round(score * 100) / 100,
        problem: await problemPayload(pick[0], locale),
      };
    }),

  /**
   * Full-answer check (§8). Wrong answers don't just say "incorrect": the
   * response carries the problem's scaffold steps so the client can walk the
   * student through STEP 1, STEP 2, ... (§4.2).
   */
  attempt: protectedProcedure.input(attemptInput).mutation(async ({ ctx, input }) => {
    const locale = loc(ctx, input.locale);
    const prob = await prisma.problem.findUnique({ where: { id: BigInt(input.problemId) } });
    if (!prob) throw new TRPCError({ code: 'NOT_FOUND', message: 'problem not found' });
    const result = grade(
      input.submittedLatex,
      prob.answerLatex,
      prob.gradingMode as GradingMode,
      prob.tolerance,
    );

    await prisma.attempt.create({
      data: {
        userId: BigInt(ctx.user.id),
        problemId: prob.id,
        submittedLatex: input.submittedLatex,
        correct: result.correct,
        hintsUsed: input.hintsUsed,
        stepReached: input.stepReached,
        durationMs: input.durationMs ?? null,
        context: input.context,
      },
    });
    await applyMastery(ctx.user.id, Number(prob.skillId), result.correct, input.hintsUsed);

    const steps = result.correct
      ? []
      : (
          await prisma.problemStep.findMany({
            where: { problemId: prob.id },
            orderBy: { position: 'asc' },
          })
        ).map((s) => ({
          position: s.position,
          prompt: locale === 'es' ? s.promptEs : s.promptEn,
          hint: locale === 'es' ? s.hintEs : s.hintEn,
        }));

    return {
      correct: result.correct,
      equivalentButNotCanonical: result.equivalentButNotCanonical ?? false,
      message: result.correct
        ? null
        : result.equivalentButNotCanonical
          ? locale === 'es'
            ? 'Tu valor es correcto, ¡pero aún no está en su forma final! Revisa la forma estándar o simplifica por completo.'
            : "Your value is right, but it's not in final form yet! Check standard form or simplify completely."
          : null,
      steps,
    };
  }),

  /** Single-step check for the guided tutor loop (§8). */
  checkStep: protectedProcedure
    .input(
      localeInput.extend({
        problemId: z.number().int(),
        position: z.number().int(),
        submittedLatex: z.string().max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const step = await prisma.problemStep.findFirst({
        where: { problemId: BigInt(input.problemId), position: input.position },
      });
      if (!step) throw new TRPCError({ code: 'NOT_FOUND', message: 'step not found' });
      const problem = await prisma.problem.findUnique({
        where: { id: BigInt(input.problemId) },
        select: { tolerance: true },
      });
      const result = grade(
        input.submittedLatex,
        step.expectedLatex,
        step.gradingMode as GradingMode,
        problem?.tolerance,
      );
      return {
        correct: result.correct,
        equivalentButNotCanonical: result.equivalentButNotCanonical ?? false,
        hint: result.correct ? null : locale === 'es' ? step.hintEs : step.hintEn,
      };
    }),

  /** Sprints (§4.4): short timed fluency drills from the Sprints folder. */
  sprint: protectedProcedure
    .input(localeInput.extend({ count: z.number().int().min(1).max(20).default(10) }))
    .query(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const rows = await prisma.$queryRaw<ProblemRow[]>`
        SELECT id, skill_id AS "skillId", tier,
               prompt_en AS "promptEn", prompt_es AS "promptEs",
               grading_mode AS "gradingMode"
        FROM problems WHERE is_sprint ORDER BY random() LIMIT ${input.count}`;
      return {
        problems: rows.map((p) => ({
          id: Number(p.id),
          skillId: Number(p.skillId),
          prompt: locale === 'es' ? p.promptEs : p.promptEn,
          gradingMode: p.gradingMode,
        })),
      };
    }),

  /**
   * Review mode (§4.5): mixed-unit session assembled from previously seen
   * skills, weighted toward stale/weak mastery (Regents prep).
   */
  reviewSession: protectedProcedure
    .input(localeInput.extend({ count: z.number().int().min(1).max(15).default(8) }))
    .query(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const mastered = await prisma.mastery.findMany({ where: { userId: BigInt(ctx.user.id) } });
      if (!mastered.length) {
        return { problems: [], message: 'practice some lessons first' };
      }
      // Weakest decayed mastery first — those need review most.
      const ranked = mastered
        .map((m) => ({
          skillId: m.skillId,
          score: decayedScore({
            score: m.score,
            attemptsCount: m.attemptsCount,
            lastPracticedAt: m.lastPracticedAt,
          }),
        }))
        .sort((a, b) => a.score - b.score);
      const problems: Awaited<ReturnType<typeof problemPayload>>[] = [];
      for (const r of ranked) {
        if (problems.length >= input.count) break;
        const tier = tierForScore(r.score, 1);
        const pick = await prisma.$queryRaw<ProblemRow[]>`
          SELECT id, skill_id AS "skillId", tier,
                 prompt_en AS "promptEn", prompt_es AS "promptEs",
                 grading_mode AS "gradingMode"
          FROM problems WHERE skill_id = ${r.skillId} AND tier = ${tier} AND NOT is_sprint
          ORDER BY random() LIMIT 2`;
        for (const p of pick) {
          if (problems.length >= input.count) break;
          problems.push(await problemPayload(p, locale));
        }
      }
      return { problems, message: null };
    }),
});
