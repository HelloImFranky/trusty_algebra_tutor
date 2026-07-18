import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tutor/db';
import {
  decayedScore,
  tierForScore,
  grade,
  diagnoseMisconception,
  generateProblem,
  makeRng,
  sprintTopicDefs,
} from '@tutor/core';
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

/**
 * On-demand sprint generation: before a round is sampled, grow each chosen
 * drill topic's pool with freshly generated variants. Sprints have a single
 * difficulty — every pool lives at the standard tier, and the generators
 * only produce easy 6th/7th-grade problems.
 * Variants are validated through the math engine (generateProblem) and
 * find-or-created by (skill, tier, prompt, answer), so the bank converges
 * toward each template's full variant space instead of growing without
 * bound — and every problem stays a real row, which keeps attempts,
 * mastery, and the post-round walkthroughs working unchanged.
 *
 * Topics come from the sprintTopicDefs registry (template + host skill), so
 * a database that predates a drill topic grows its pool from nothing on the
 * first round that requests it. A racing find-or-create between two students
 * can insert the same variant twice — harmless (both rows are valid), so no
 * unique constraint is required.
 */
const SPRINT_TIER = 'standard';

async function topUpSprintDrills(topics: string[], perTopic: number): Promise<void> {
  const defs = topics.length
    ? sprintTopicDefs.filter((d) => topics.includes(d.slug))
    : sprintTopicDefs;
  for (const d of defs) {
    const skill = await prisma.skill.findUnique({ where: { slug: d.skillSlug } });
    if (!skill) continue;
    const rng = makeRng((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
    const seen = new Set<string>();
    let made = 0;
    for (let i = 0; made < perTopic && i < perTopic * 6; i++) {
      const gp = generateProblem(d.slug, rng);
      const key = gp.promptEn + gp.answerLatex;
      if (seen.has(key)) continue;
      seen.add(key);
      made++;
      const exists = await prisma.problem.findFirst({
        where: {
          skillId: skill.id,
          tier: SPRINT_TIER,
          promptEn: gp.promptEn,
          answerLatex: gp.answerLatex,
          isSprint: true,
        },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.problem.create({
        data: {
          skillId: skill.id,
          tier: SPRINT_TIER,
          promptEn: gp.promptEn,
          promptEs: gp.promptEs,
          answerLatex: gp.answerLatex,
          gradingMode: gp.gradingMode,
          tolerance: gp.tolerance ?? null,
          paramsJson: JSON.parse(JSON.stringify(gp.params)),
          isSprint: true,
        },
      });
    }
  }
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
   * Sprints (§4.4): short timed fluency rounds over 6th/7th-grade skills an
   * 8th grader already knows (the sprintTopicDefs drill registry) — never
   * the Algebra 1 curriculum itself. There is no difficulty option: every
   * sprint problem is easy by design (the drill generators only produce
   * grade 6/7 fluency questions). The client times rounds at 1 minute per
   * 10 questions. The optional topic filter (drill template slugs) powers
   * the start-screen picker — students can mix any number of topics into
   * one randomized round (empty/omitted = all topics).
   *
   * Freshness: drill pools are topped up with newly generated variants at
   * round start (topUpSprintDrills), and sampling prefers problems this
   * student has never attempted (then least-recently attempted), so
   * back-to-back rounds don't repeat questions until a template's whole
   * variant space is exhausted.
   */
  sprint: protectedProcedure
    .input(
      localeInput.extend({
        count: z.number().int().min(1).max(30).default(10),
        topics: z.array(z.string().max(100)).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      // Unknown topic slugs are dropped rather than erroring — a stale
      // client picker should still get a valid round.
      const topics = (input.topics ?? []).filter((t) =>
        sprintTopicDefs.some((d) => d.slug === t),
      );
      const templates = topics.length ? topics : sprintTopicDefs.map((d) => d.slug);
      // Freshly generated drill variants land in the bank before sampling.
      // Per-topic amount covers the round even when a single topic must fill
      // it, but shrinks when an "all topics" round spreads across the registry.
      const perTopic = Math.max(4, Math.ceil(input.count / templates.length));
      await topUpSprintDrills(topics, perTopic);
      // params + skill slug ride along so the post-round review can offer an
      // animated walkthrough of any miss a stepanim builder understands.
      // Sampling prefers never-attempted problems for THIS student, then the
      // least-recently attempted, then random — combined with the top-up,
      // repeat rounds serve new questions while the variant space lasts.
      // Tier pins to the sprint tier so harder rows from databases that
      // predate single-difficulty sprints can never be served.
      const rows = await prisma.$queryRaw<
        (ProblemRow & { paramsJson: unknown; skillSlug: string })[]
      >`
        SELECT p.id, p.skill_id AS "skillId", p.tier,
               p.prompt_en AS "promptEn", p.prompt_es AS "promptEs",
               p.grading_mode AS "gradingMode",
               p.params_json AS "paramsJson", s.slug AS "skillSlug"
        FROM problems p JOIN skills s ON s.id = p.skill_id
        LEFT JOIN (
          SELECT problem_id, count(*) AS n, max(created_at) AS last_attempt
          FROM attempts WHERE user_id = ${BigInt(ctx.user.id)} GROUP BY problem_id
        ) a ON a.problem_id = p.id
        WHERE p.is_sprint
          AND p.tier = ${SPRINT_TIER}
          AND p.params_json->>'template' IN (${Prisma.join(templates)})
        ORDER BY a.n NULLS FIRST, a.last_attempt NULLS FIRST, random()
        LIMIT ${input.count}`;
      // The unattempted-first ordering clusters; the round itself should
      // still feel shuffled.
      rows.sort(() => Math.random() - 0.5);
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
   * Topics for the sprint picker: the 6th/7th-grade drill registry, in a
   * fixed friendly order. Pools for every topic are grown on demand at
   * round start, so the whole registry is always offered.
   */
  sprintTopics: protectedProcedure.query(async () => {
    return {
      topics: sprintTopicDefs.map((d) => ({
        slug: d.slug,
        icon: d.icon,
        nameEn: d.nameEn,
        nameEs: d.nameEs,
      })),
    };
  }),

  /**
   * Record a finished sprint round (timer expired or all problems answered).
   * One row per completed round; the total completion count drives the
   * sprint badge ladder on the Progress tab (5 / 15 / 30 rounds). The
   * difficulty column predates single-difficulty sprints and is pinned to
   * the sprint tier for new rows.
   */
  sprintComplete: protectedProcedure
    .input(
      z.object({
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
          difficulty: SPRINT_TIER,
          skillSlug: input.skillSlug ?? null,
          total: input.total,
          correct: input.correct,
        },
      });
      const completions = await prisma.sprintSession.count({
        where: { userId: BigInt(ctx.user.id) },
      });
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
