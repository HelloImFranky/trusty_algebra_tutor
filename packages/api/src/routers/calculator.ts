/**
 * Saved calculator sessions (graphing-calculator architecture doc): the math
 * engine runs entirely client-side, so this router only syncs the session
 * snapshot — one upserted row per user, validated against the shared
 * CalculatorState shape so a bad client can't store junk.
 */
import { z } from 'zod';
import { prisma, Prisma } from '@tutor/db';
import { protectedProcedure, router } from '../trpc.js';

const stateSchema = z.object({
  version: z.literal(1),
  angleMode: z.enum(['rad', 'deg']),
  expressions: z.array(z.string().max(300)).max(6),
  window: z.object({
    xmin: z.number().finite(),
    xmax: z.number().finite(),
    ymin: z.number().finite(),
    ymax: z.number().finite(),
  }),
  history: z
    .array(
      z.object({
        input: z.string().max(300),
        display: z.string().max(300),
        fraction: z.string().max(64).optional(),
      }),
    )
    .max(50),
  variables: z.record(z.string().max(24), z.number().finite()),
});

export const calculatorRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const row = await prisma.calculatorSession.findUnique({
      where: { userId: BigInt(ctx.user.id) },
    });
    return row ? { state: row.state, updatedAt: row.updatedAt } : null;
  }),

  save: protectedProcedure
    .input(z.object({ state: stateSchema }))
    .mutation(async ({ ctx, input }) => {
      const state = input.state as Prisma.InputJsonValue;
      await prisma.calculatorSession.upsert({
        where: { userId: BigInt(ctx.user.id) },
        create: { userId: BigInt(ctx.user.id), state },
        update: { state, updatedAt: new Date() },
      });
      return { ok: true };
    }),
});
