import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
import { referenceSheet, decayedScore, masteryLabel, updateMastery } from '@tutor/core';
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
