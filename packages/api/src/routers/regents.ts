/**
 * Regents Review: topic catalog of Regents-style multiple-choice questions.
 * The question bank lives in @tutor/core (regentsTopics); this router serves
 * it localized and grades answers server-side so the correct choice never
 * reaches the client before the student's one allowed attempt.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tutor/db';
import { regentsTopics, regentsQuestionIndex } from '@tutor/core';
import type { RegentsQuestion } from '@tutor/core';
import { loc, protectedProcedure, router } from '../trpc.js';

const localeInput = z.object({ locale: z.enum(['en', 'es']).optional() });

type Locale = 'en' | 'es';

/** The part of an answered question it is safe to reveal. */
function reveal(q: RegentsQuestion, locale: Locale) {
  return {
    correctIndex: q.correctIndex,
    explanation: locale === 'es' ? q.explanationEs : q.explanationEn,
  };
}

export const regentsRouter = router({
  /** Landing catalog: every topic with the student's progress overlaid. */
  catalog: protectedProcedure.input(localeInput).query(async ({ ctx, input }) => {
    const locale = loc(ctx, input.locale);
    const answers = await prisma.regentsAnswer.findMany({
      where: { userId: BigInt(ctx.user.id) },
      select: { topicSlug: true, correct: true },
    });
    const byTopic = new Map<string, { answered: number; correct: number }>();
    for (const a of answers) {
      const t = byTopic.get(a.topicSlug) ?? { answered: 0, correct: 0 };
      t.answered++;
      if (a.correct) t.correct++;
      byTopic.set(a.topicSlug, t);
    }
    return {
      topics: regentsTopics.map((t) => {
        const p = byTopic.get(t.slug) ?? { answered: 0, correct: 0 };
        return {
          slug: t.slug,
          icon: t.icon,
          title: locale === 'es' ? t.titleEs : t.titleEn,
          blurb: locale === 'es' ? t.blurbEs : t.blurbEn,
          total: t.questions.length,
          answered: p.answered,
          correct: p.correct,
        };
      }),
    };
  }),

  /**
   * One topic's questions. Unanswered questions come without the correct
   * index or explanation; already-answered ones carry the student's choice
   * and the full solution so a revisit shows the same graded state.
   */
  topic: protectedProcedure
    .input(localeInput.extend({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const topic = regentsTopics.find((t) => t.slug === input.slug);
      if (!topic) throw new TRPCError({ code: 'NOT_FOUND', message: 'topic not found' });
      const answers = await prisma.regentsAnswer.findMany({
        where: { userId: BigInt(ctx.user.id), topicSlug: topic.slug },
      });
      const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
      return {
        slug: topic.slug,
        icon: topic.icon,
        title: locale === 'es' ? topic.titleEs : topic.titleEn,
        questions: topic.questions.map((q) => {
          const a = byQuestion.get(q.id);
          return {
            id: q.id,
            prompt: locale === 'es' ? q.promptEs : q.promptEn,
            choices: locale === 'es' ? q.choicesEs : q.choicesEn,
            answered: a
              ? { choiceIndex: a.choiceIndex, correct: a.correct, ...reveal(q, locale) }
              : null,
          };
        }),
      };
    }),

  /**
   * Grade the student's single attempt. The unique (user, question)
   * constraint is the backstop: a second submission returns the original
   * result instead of inserting a new row.
   */
  answer: protectedProcedure
    .input(
      localeInput.extend({
        questionId: z.string(),
        choiceIndex: z.number().int().min(0).max(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const entry = regentsQuestionIndex.get(input.questionId);
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'question not found' });
      const { topic, question } = entry;
      const correct = input.choiceIndex === question.correctIndex;
      const prior = await prisma.regentsAnswer.findUnique({
        where: { userId_questionId: { userId: BigInt(ctx.user.id), questionId: question.id } },
      });
      if (prior) {
        return {
          choiceIndex: prior.choiceIndex,
          correct: prior.correct,
          ...reveal(question, locale),
          alreadyAnswered: true,
        };
      }
      try {
        await prisma.regentsAnswer.create({
          data: {
            userId: BigInt(ctx.user.id),
            topicSlug: topic.slug,
            questionId: question.id,
            choiceIndex: input.choiceIndex,
            correct,
          },
        });
        return { choiceIndex: input.choiceIndex, correct, ...reveal(question, locale), alreadyAnswered: false };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const prev = await prisma.regentsAnswer.findUnique({
            where: {
              userId_questionId: { userId: BigInt(ctx.user.id), questionId: question.id },
            },
          });
          if (prev) {
            return {
              choiceIndex: prev.choiceIndex,
              correct: prev.correct,
              ...reveal(question, locale),
              alreadyAnswered: true,
            };
          }
        }
        throw err;
      }
    }),
});
