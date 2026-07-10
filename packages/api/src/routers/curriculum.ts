import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
import { referenceSheet, decayedScore, masteryLabel, updateMastery, grade } from '@tutor/core';
import type { GradingMode } from '@tutor/core';
import { loc, protectedProcedure, publicProcedure, router } from '../trpc.js';

const localeInput = z.object({ locale: z.enum(['en', 'es']).optional() });

export const curriculumRouter = router({
  /** Units + lessons + the student's mastery overlay (§8). */
  map: protectedProcedure.input(localeInput.optional()).query(async ({ ctx, input }) => {
    const locale = loc(ctx, input?.locale);
    const units = await prisma.unit.findMany({
      orderBy: { position: 'asc' },
      include: {
        lessons: {
          orderBy: { position: 'asc' },
          include: { skills: { select: { id: true } } },
        },
      },
    });
    const mastery = await prisma.mastery.findMany({ where: { userId: BigInt(ctx.user.id) } });
    const masteryBySkill = new Map(mastery.map((m) => [Number(m.skillId), m]));

    return {
      units: units.map((u) => ({
        id: Number(u.id),
        number: u.number,
        title: locale === 'es' ? u.titleEs : u.titleEn,
        lessons: u.lessons.map((l) => {
          const skillId = l.skills[0] ? Number(l.skills[0].id) : null;
          const m = skillId ? masteryBySkill.get(skillId) : undefined;
          const score = m
            ? decayedScore({
                score: m.score,
                attemptsCount: m.attemptsCount,
                lastPracticedAt: m.lastPracticedAt,
              })
            : 0;
          return {
            id: Number(l.id),
            code: l.code,
            title: locale === 'es' ? l.titleEs : l.titleEn,
            skillId,
            mastery: {
              score: Math.round(score * 100) / 100,
              attempts: m?.attemptsCount ?? 0,
              label: masteryLabel(score, m?.attemptsCount ?? 0),
            },
          };
        }),
      })),
    };
  }),

  /** Lesson player payload: scaffold steps, worked examples, mnemonic (localized). */
  lesson: protectedProcedure
    .input(localeInput.extend({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const l = await prisma.lesson.findUnique({
        where: { id: BigInt(input.id) },
        include: {
          steps: { orderBy: { position: 'asc' } },
          skills: true,
          // The original classroom scaffold sections for this lesson's topics
          // (authentic source material — English, as written by the teacher).
          scaffolds: { orderBy: { position: 'asc' } },
        },
      });
      if (!l) throw new TRPCError({ code: 'NOT_FOUND', message: 'lesson not found' });
      const skill = l.skills[0];
      return {
        id: Number(l.id),
        code: l.code,
        contentVersion: l.contentVersion,
        title: locale === 'es' ? l.titleEs : l.titleEn,
        mnemonic: locale === 'es' ? l.mnemonicEs : l.mnemonicEn,
        skill: skill
          ? {
              id: Number(skill.id),
              slug: skill.slug,
              name: locale === 'es' ? skill.nameEs : skill.nameEn,
            }
          : null,
        steps: l.steps.map((s) => ({
          position: s.position,
          body: locale === 'es' ? s.bodyEs : s.bodyEn,
          workedExampleLatex: s.workedExampleLatex,
          hint: locale === 'es' ? s.hintEs : s.hintEn,
        })),
        classroomScaffolds: l.scaffolds.map((s) => ({
          title: s.title,
          body: s.bodyMd,
          images: s.images ?? [],
        })),
      };
    }),

  /** Exit ticket for a lesson (problems only — no answers). */
  exitTicket: protectedProcedure
    .input(localeInput.extend({ lessonId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const et = await prisma.exitTicket.findUnique({ where: { lessonId: BigInt(input.lessonId) } });
      if (!et) throw new TRPCError({ code: 'NOT_FOUND', message: 'no exit ticket for this lesson' });
      const problems = await prisma.problem.findMany({ where: { id: { in: et.problemIds } } });
      const byId = new Map(problems.map((p) => [Number(p.id), p]));
      return {
        id: Number(et.id),
        lessonId: input.lessonId,
        problems: et.problemIds
          .map((pid) => byId.get(Number(pid)))
          .filter((p) => p !== undefined)
          .map((p) => ({
            id: Number(p.id),
            prompt: locale === 'es' ? p.promptEs : p.promptEn,
            gradingMode: p.gradingMode,
          })),
      };
    }),

  /** Submit a whole exit ticket; auto-grade, store result, update mastery (§4.3). */
  submitExitTicket: protectedProcedure
    .input(
      z.object({
        exitTicketId: z.number().int(),
        answers: z.array(z.object({ problemId: z.number(), submittedLatex: z.string() })),
        durationMs: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const et = await prisma.exitTicket.findUnique({ where: { id: BigInt(input.exitTicketId) } });
      if (!et) throw new TRPCError({ code: 'NOT_FOUND', message: 'exit ticket not found' });
      const problems = await prisma.problem.findMany({ where: { id: { in: et.problemIds } } });
      const byId = new Map(problems.map((p) => [Number(p.id), p]));

      let score = 0;
      const results: { problemId: number; correct: boolean; correctAnswer: string }[] = [];
      for (const ans of input.answers) {
        const p = byId.get(ans.problemId);
        if (!p) continue;
        const result = grade(ans.submittedLatex, p.answerLatex, p.gradingMode as GradingMode, p.tolerance);
        if (result.correct) score++;
        results.push({ problemId: Number(p.id), correct: result.correct, correctAnswer: p.answerLatex });
        await prisma.attempt.create({
          data: {
            userId: BigInt(ctx.user.id),
            problemId: p.id,
            submittedLatex: ans.submittedLatex,
            correct: result.correct,
            context: 'exit_ticket',
          },
        });
        await applyMastery(ctx.user.id, Number(p.skillId), result.correct, 0);
      }
      const maxScore = et.problemIds.length;
      await prisma.exitTicketResult.create({
        data: { userId: BigInt(ctx.user.id), exitTicketId: et.id, score, maxScore },
      });
      return { score, maxScore, results };
    }),

  /** Always-available Regents reference sheet, localized (§4.5). */
  referenceSheet: publicProcedure.input(localeInput.optional()).query(({ input }) => {
    const locale = input?.locale === 'es' ? 'es' : 'en';
    return {
      locale,
      sections: referenceSheet.map((s) => ({
        title: locale === 'es' ? s.titleEs : s.titleEn,
        rows: s.rows.map((r) => ({
          label: locale === 'es' ? r.labelEs : r.labelEn,
          latex: r.latex,
        })),
      })),
    };
  }),
});

export async function applyMastery(
  userId: number,
  skillId: number,
  correct: boolean,
  hintsUsed: number,
): Promise<void> {
  const existing = await prisma.mastery.findUnique({
    where: { userId_skillId: { userId: BigInt(userId), skillId: BigInt(skillId) } },
  });
  const prior = existing
    ? {
        score: existing.score,
        attemptsCount: existing.attemptsCount,
        lastPracticedAt: existing.lastPracticedAt,
      }
    : { score: 0, attemptsCount: 0, lastPracticedAt: null };
  const updated = updateMastery(prior, correct, hintsUsed);
  await prisma.mastery.upsert({
    where: { userId_skillId: { userId: BigInt(userId), skillId: BigInt(skillId) } },
    update: {
      score: updated.score,
      attemptsCount: updated.attemptsCount,
      lastPracticedAt: updated.lastPracticedAt,
    },
    create: {
      userId: BigInt(userId),
      skillId: BigInt(skillId),
      score: updated.score,
      attemptsCount: updated.attemptsCount,
      lastPracticedAt: updated.lastPracticedAt,
    },
  });
}
