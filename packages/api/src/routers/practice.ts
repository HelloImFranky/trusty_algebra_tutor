import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tutor/db';
import { decayedScore, tierForScore, grade, diagnoseMisconception } from '@tutor/core';
import type { GradingMode, Misconception } from '@tutor/core';
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
  const [steps, extra] = await Promise.all([
    prisma.problemStep.findMany({
      where: { problemId: p.id },
      orderBy: { position: 'asc' },
    }),
    // generator params + skill slug let the client build an animated
    // walkthrough of this exact problem (stepanim builders)
    prisma.problem.findUnique({
      where: { id: p.id },
      select: { paramsJson: true, skill: { select: { slug: true } } },
    }),
  ]);
  return {
    id: Number(p.id),
    skillId: Number(p.skillId),
    tier: p.tier,
    prompt: locale === 'es' ? p.promptEs : p.promptEn,
    gradingMode: p.gradingMode,
    params: extra?.paramsJson ?? null,
    skillSlug: extra?.skill.slug ?? null,
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
  // animated-walkthrough opens for this problem (subset of hintsUsed during
  // guided practice; tracked separately to measure impact on mastery)
  animViews: z.number().int().min(0).max(20).default(0),
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
    // Wrong answers get a diagnosis: does the submission match a wrong answer
    // this problem's error patterns predict (added instead of subtracted,
    // forgot the inequality flip, ...)?
    const misconception = result.correct
      ? null
      : diagnoseMisconception(
          input.submittedLatex,
          prob.misconceptionsJson as unknown as Misconception[] | null,
        );

    await prisma.attempt.create({
      data: {
        userId: BigInt(ctx.user.id),
        problemId: prob.id,
        submittedLatex: input.submittedLatex,
        correct: result.correct,
        misconceptionId: misconception?.id ?? null,
        hintsUsed: input.hintsUsed,
        animViews: input.animViews,
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
      misconceptionId: misconception?.id ?? null,
      // Reveal the target answer only after the attempt has been graded and
      // recorded — so the sprint review can show "your answer vs correct".
      correctAnswer: result.correct ? null : prob.answerLatex,
      message: result.correct
        ? null
        : result.equivalentButNotCanonical
          ? locale === 'es'
            ? 'Tu valor es correcto, ¡pero aún no está en su forma final! Revisa la forma estándar o simplifica por completo.'
            : "Your value is right, but it's not in final form yet! Check standard form or simplify completely."
          : misconception
            ? locale === 'es'
              ? misconception.feedbackEs
              : misconception.feedbackEn
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

  /**
   * Sprints (§4.4): short timed fluency drills. Optional difficulty
   * (problem tier) and topic (skill slugs) filters power the start-screen
   * pickers — students can mix any number of topics into one randomized
   * round (empty/omitted = all topics).
   *
   * Problem preference per skill: dedicated sprint drills when the skill
   * has them at the requested tier, otherwise its regular practice problems
   * — so every curriculum topic is sprintable, not just the three with
   * drill generators. When a database predates the tiered sprint content
   * and the tier turns up nothing at all, the query falls back to ignoring
   * the tier rather than serving an empty round.
   */
  sprint: protectedProcedure
    .input(
      localeInput.extend({
        count: z.number().int().min(1).max(20).default(10),
        difficulty: z.enum(['modified', 'standard', 'challenge']).default('standard'),
        skillSlugs: z.array(z.string().max(100)).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const slugs = input.skillSlugs ?? [];
      const topicFilter = slugs.length
        ? Prisma.sql`AND s.slug IN (${Prisma.join(slugs)})`
        : Prisma.empty;
      // params + skill slug ride along so the post-round review can offer an
      // animated walkthrough of any miss a stepanim builder understands.
      const pick = (withTier: boolean) => prisma.$queryRaw<
        (ProblemRow & { paramsJson: unknown; skillSlug: string })[]
      >`
        SELECT p.id, p.skill_id AS "skillId", p.tier,
               p.prompt_en AS "promptEn", p.prompt_es AS "promptEs",
               p.grading_mode AS "gradingMode",
               p.params_json AS "paramsJson", s.slug AS "skillSlug"
        FROM problems p JOIN skills s ON s.id = p.skill_id
        WHERE (${!withTier} OR p.tier = ${input.difficulty})
          AND (p.is_sprint OR NOT EXISTS (
            SELECT 1 FROM problems d
            WHERE d.skill_id = p.skill_id AND d.is_sprint
              AND (${!withTier} OR d.tier = ${input.difficulty})))
          ${topicFilter}
        ORDER BY random() LIMIT ${input.count}`;
      let rows = await pick(true);
      if (!rows.length) rows = await pick(false);
      return {
        problems: rows.map((p) => ({
          id: Number(p.id),
          skillId: Number(p.skillId),
          prompt: locale === 'es' ? p.promptEs : p.promptEn,
          gradingMode: p.gradingMode,
          params: p.paramsJson ?? null,
          skillSlug: p.skillSlug ?? null,
        })),
      };
    }),

  /**
   * Topics for the focused-sprint picker: every curriculum skill that has
   * problems, in teaching order. Skills with dedicated sprint drills use
   * those; the rest sprint over their regular practice problems (see the
   * preference rule in the sprint query above).
   */
  sprintTopics: protectedProcedure.query(async () => {
    // Unit number + localized unit titles ride along so the picker can group
    // the (many) topics into collapsible per-unit sections.
    const rows = await prisma.$queryRaw<
      {
        slug: string;
        nameEn: string;
        nameEs: string;
        problems: number;
        unitNumber: number;
        unitTitleEn: string;
        unitTitleEs: string;
      }[]
    >`
      SELECT s.slug, s.name_en AS "nameEn", s.name_es AS "nameEs",
             count(*)::int AS problems,
             u.number AS "unitNumber",
             u.title_en AS "unitTitleEn", u.title_es AS "unitTitleEs"
      FROM problems p
      JOIN skills s ON s.id = p.skill_id
      JOIN lessons l ON l.id = s.lesson_id
      JOIN units u ON u.id = l.unit_id
      GROUP BY s.slug, s.name_en, s.name_es, u.number, u.title_en, u.title_es, l.position
      ORDER BY u.number, l.position`;
    return { topics: rows };
  }),

  /**
   * Record a finished sprint round (timer expired or all problems answered).
   * One row per completed round; the per-difficulty completion counts drive
   * the sprint badges on the Progress tab (5 / 15 / 30 at each difficulty).
   */
  sprintComplete: protectedProcedure
    .input(
      z.object({
        difficulty: z.enum(['modified', 'standard', 'challenge']),
        skillSlug: z.string().max(100).nullish(),
        total: z.number().int().min(1).max(50),
        correct: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.correct > input.total) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'correct exceeds total' });
      }
      await prisma.sprintSession.create({
        data: {
          userId: BigInt(ctx.user.id),
          difficulty: input.difficulty,
          skillSlug: input.skillSlug ?? null,
          total: input.total,
          correct: input.correct,
        },
      });
      const counts = await prisma.sprintSession.groupBy({
        by: ['difficulty'],
        where: { userId: BigInt(ctx.user.id) },
        _count: true,
      });
      const completions = { modified: 0, standard: 0, challenge: 0 };
      for (const c of counts) {
        if (c.difficulty in completions) {
          completions[c.difficulty as keyof typeof completions] = c._count;
        }
      }
      return { completions };
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
