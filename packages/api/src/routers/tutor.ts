import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
import {
  scrubPii,
  streamTutorReply,
  tutorAvailable,
  tutorConfig,
  type ChatMessage,
  type TutorContext,
} from '@tutor/core/tutor';
import { loc, rateLimited, router } from '../trpc.js';

// Design doc §8: rate-limit tutor endpoints per user; §6: LLM is the
// escalation path, so keep the budget tight.
const tutorProcedure = rateLimited(10);

async function loadTutorContext(
  locale: 'en' | 'es',
  lessonId?: number | null,
  problemId?: number | null,
): Promise<TutorContext> {
  const ctx: TutorContext = { locale, lesson: null, problem: null };
  if (problemId && !lessonId) {
    const p = await prisma.problem.findUnique({
      where: { id: BigInt(problemId) },
      select: { skill: { select: { lessonId: true } } },
    });
    if (p) lessonId = Number(p.skill.lessonId);
  }
  if (lessonId) {
    const l = await prisma.lesson.findUnique({
      where: { id: BigInt(lessonId) },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (l) {
      ctx.lesson = {
        code: l.code,
        title: locale === 'es' ? l.titleEs : l.titleEn,
        mnemonic: locale === 'es' ? l.mnemonicEs : l.mnemonicEn,
        steps: l.steps.map((s) => ({
          position: s.position,
          body: locale === 'es' ? s.bodyEs : s.bodyEn,
          workedExample: s.workedExampleLatex,
          hint: locale === 'es' ? s.hintEs : s.hintEn,
        })),
      };
    }
  }
  if (problemId) {
    const p = await prisma.problem.findUnique({
      where: { id: BigInt(problemId) },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (p) {
      ctx.problem = {
        prompt: locale === 'es' ? p.promptEs : p.promptEn,
        stepPrompts: p.steps.map((s) => (locale === 'es' ? s.promptEs : s.promptEn)),
      };
    }
  }
  return ctx;
}

export const tutorRouter = router({
  createSession: tutorProcedure
    .input(z.object({ lessonId: z.number().optional(), problemId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const row = await prisma.tutorSession.create({
        data: {
          userId: BigInt(ctx.user.id),
          problemId: input.problemId ? BigInt(input.problemId) : null,
          lessonId: input.lessonId ? BigInt(input.lessonId) : null,
        },
      });
      return { sessionId: Number(row.id), available: tutorAvailable() };
    }),

  /**
   * Student message → tutor reply, streamed as text chunks (an async
   * generator over httpBatchStreamLink; clients without stream support
   * simply receive the full reply when it completes).
   */
  sendMessage: tutorProcedure
    .input(
      z.object({
        sessionId: z.number().int(),
        message: z.string().min(1).max(2000),
        stepReached: z.number().int().optional(),
        locale: z.enum(['en', 'es']).optional(),
      }),
    )
    .mutation(async function* ({ ctx, input }) {
      const s = await prisma.tutorSession.findUnique({ where: { id: BigInt(input.sessionId) } });
      if (!s || Number(s.userId) !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'session not found' });
      }
      const transcript: ChatMessage[] = Array.isArray(s.transcriptJson)
        ? (s.transcriptJson as unknown as ChatMessage[])
        : [];
      if (transcript.filter((m) => m.role === 'user').length >= tutorConfig.tutorMaxTurns) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message:
            'This tutor chat has reached its limit — try the step-by-step hints, or start a fresh session.',
        });
      }

      // §9: strip PII before sending to the API and before storage.
      const cleaned = scrubPii(input.message, ctx.user.displayName);
      transcript.push({ role: 'user', content: cleaned });

      const tutorCtx = await loadTutorContext(
        loc(ctx, input.locale),
        s.lessonId ? Number(s.lessonId) : null,
        s.problemId ? Number(s.problemId) : null,
      );
      if (input.stepReached !== undefined) tutorCtx.studentStepReached = input.stepReached;

      let reply = '';
      try {
        for await (const chunk of streamTutorReply(tutorCtx, transcript)) {
          reply += chunk;
          yield chunk;
        }
      } finally {
        // Log transcripts for safety review (§5), PII-scrubbed.
        transcript.push({ role: 'assistant', content: reply });
        await prisma.tutorSession.update({
          where: { id: s.id },
          data: { transcriptJson: JSON.parse(JSON.stringify(transcript)) },
        });
      }
    }),
});
