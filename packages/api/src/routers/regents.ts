/**
 * Regents Review: topic catalog of Regents-style multiple-choice questions.
 * Every round serves REGENTS_ROUND_SIZE questions. Round 0 serves the
 * handwritten bank in @tutor/core (regentsTopics) topped up with generated
 * questions; once a round is finished the student can renew the topic, and
 * rounds >= 1 serve fully generated sets. Generated questions are
 * reconstructed deterministically from (user, topic, round, slot) — nothing
 * but the student's answers is ever stored, and grading happens server-side
 * so the correct choice never reaches the client before the student's one
 * allowed attempt.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tutor/db';
import {
  REGENTS_ROUND_SIZE,
  generateRegentsQuestion,
  parseRegentsGeneratedId,
  regentsGeneratedId,
  regentsQuestionIndex,
  regentsQuestionSeed,
  regentsTopics,
} from '@tutor/core';
import type { RegentsQuestionContent, RegentsTopic } from '@tutor/core';
import { loc, protectedProcedure, router } from '../trpc.js';

const localeInput = z.object({ locale: z.enum(['en', 'es']).optional() });

type Locale = 'en' | 'es';

/**
 * The part of an answered question it is safe to reveal. Only called after
 * the student's single attempt, so it may include the animation params
 * (which can encode the solution).
 */
function reveal(q: RegentsQuestionContent, locale: Locale) {
  return {
    correctIndex: q.correctIndex,
    explanation: locale === 'es' ? q.explanationEs : q.explanationEn,
    anim: q.anim ?? null,
  };
}

/**
 * Resolve an attempt key to its question: round 0 ids come from the
 * handwritten bank, generated ids ("slug:rN:qM") are regenerated from the
 * student's deterministic seed.
 */
function resolveQuestion(
  userId: number,
  questionId: string,
): { topic: RegentsTopic; question: RegentsQuestionContent; round: number } | null {
  const fromBank = regentsQuestionIndex.get(questionId);
  if (fromBank) return { topic: fromBank.topic, question: fromBank.question, round: 0 };
  const parsed = parseRegentsGeneratedId(questionId);
  if (!parsed) return null;
  const topic = regentsTopics.find((t) => t.slug === parsed.slug);
  if (!topic) return null;
  const seed = regentsQuestionSeed(userId, parsed.slug, parsed.round, parsed.slot);
  return {
    topic,
    question: generateRegentsQuestion(parsed.slug, parsed.slot, seed),
    round: parsed.round,
  };
}

/**
 * Questions served for one round. Round 0 starts with the handwritten bank
 * and is topped up to REGENTS_ROUND_SIZE with generated questions (slots
 * after the bank); later rounds are fully generated.
 */
function questionsForRound(userId: number, topic: RegentsTopic, round: number) {
  const generated = (slot: number) => {
    const seed = regentsQuestionSeed(userId, topic.slug, round, slot);
    return {
      id: regentsGeneratedId(topic.slug, round, slot),
      question: generateRegentsQuestion(topic.slug, slot, seed),
    };
  };
  const fromBank = round === 0 ? topic.questions.map((q) => ({ id: q.id, question: q })) : [];
  const generatedSlots = Array.from(
    { length: REGENTS_ROUND_SIZE - fromBank.length },
    (_, i) => generated(fromBank.length + i + 1),
  );
  return [...fromBank, ...generatedSlots];
}

export const regentsRouter = router({
  /**
   * Landing catalog: every topic with the student's progress overlaid.
   * Cards track the first run (round 0); renewed rounds are extra practice.
   */
  catalog: protectedProcedure.input(localeInput).query(async ({ ctx, input }) => {
    const locale = loc(ctx, input.locale);
    const answers = await prisma.regentsAnswer.findMany({
      where: { userId: BigInt(ctx.user.id) },
      select: { topicSlug: true, correct: true, round: true },
    });
    const byTopic = new Map<string, { answered: number; correct: number; maxRound: number }>();
    for (const a of answers) {
      const t = byTopic.get(a.topicSlug) ?? { answered: 0, correct: 0, maxRound: 0 };
      if (a.round === 0) {
        t.answered++;
        if (a.correct) t.correct++;
      }
      t.maxRound = Math.max(t.maxRound, a.round);
      byTopic.set(a.topicSlug, t);
    }
    return {
      topics: regentsTopics.map((t) => {
        const p = byTopic.get(t.slug) ?? { answered: 0, correct: 0, maxRound: 0 };
        return {
          slug: t.slug,
          icon: t.icon,
          title: locale === 'es' ? t.titleEs : t.titleEn,
          blurb: locale === 'es' ? t.blurbEs : t.blurbEn,
          total: REGENTS_ROUND_SIZE,
          answered: p.answered,
          correct: p.correct,
          extraRounds: p.maxRound,
        };
      }),
    };
  }),

  /**
   * One round of a topic's questions. Unanswered questions come without the
   * correct index or explanation; already-answered ones carry the student's
   * choice and the full solution so a revisit shows the same graded state.
   * Without an explicit round the student's latest round is served; the next
   * round can only be opened once the latest one is finished.
   */
  topic: protectedProcedure
    .input(localeInput.extend({ slug: z.string(), round: z.number().int().min(0).max(9999).optional() }))
    .query(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const topic = regentsTopics.find((t) => t.slug === input.slug);
      if (!topic) throw new TRPCError({ code: 'NOT_FOUND', message: 'topic not found' });
      const answers = await prisma.regentsAnswer.findMany({
        where: { userId: BigInt(ctx.user.id), topicSlug: topic.slug },
      });
      const perRound = new Map<number, number>();
      for (const a of answers) perRound.set(a.round, (perRound.get(a.round) ?? 0) + 1);
      const maxRound = Math.max(0, ...perRound.keys());
      const maxRoundDone = (perRound.get(maxRound) ?? 0) >= REGENTS_ROUND_SIZE;
      const round = input.round ?? maxRound;
      if (round > maxRound && !(round === maxRound + 1 && maxRoundDone)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'finish the current set before starting a new one',
        });
      }
      const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
      return {
        slug: topic.slug,
        icon: topic.icon,
        title: locale === 'es' ? topic.titleEs : topic.titleEn,
        round,
        maxRound,
        questions: questionsForRound(ctx.user.id, topic, round).map(({ id, question: q }) => {
          const a = byQuestion.get(id);
          return {
            id,
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
   * result instead of inserting a new row. Generated question ids embed
   * their round, so the constraint covers renewed sets too.
   */
  answer: protectedProcedure
    .input(
      localeInput.extend({
        questionId: z.string().max(100),
        choiceIndex: z.number().int().min(0).max(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const locale = loc(ctx, input.locale);
      const entry = resolveQuestion(ctx.user.id, input.questionId);
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'question not found' });
      const { topic, question, round } = entry;
      const correct = input.choiceIndex === question.correctIndex;
      const prior = await prisma.regentsAnswer.findUnique({
        where: {
          userId_questionId: { userId: BigInt(ctx.user.id), questionId: input.questionId },
        },
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
            questionId: input.questionId,
            choiceIndex: input.choiceIndex,
            correct,
            round,
          },
        });
        return { choiceIndex: input.choiceIndex, correct, ...reveal(question, locale), alreadyAnswered: false };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const prev = await prisma.regentsAnswer.findUnique({
            where: {
              userId_questionId: { userId: BigInt(ctx.user.id), questionId: input.questionId },
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
