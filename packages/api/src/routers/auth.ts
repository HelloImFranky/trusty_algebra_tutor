import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
import {
  hashPassword,
  issueRefreshToken,
  loadUser,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
  type AuthUser,
} from '../auth.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

const registerSchema = z.object({
  // Public self-signup may only create students and guardians. Teacher
  // accounts grant read access to linked students and are provisioned by an
  // administrator/seed — never self-assigned, or anyone could claim the role.
  role: z.enum(['student', 'guardian']).default('student'),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64),
  locale: z.enum(['en', 'es']).default('en'),
  grade: z.number().int().min(5).max(12).optional(),
  // COPPA (§9): students don't provide an email. Under-13 self-signup needs a
  // guardian email that we use to create/link a guardian consent record.
  email: z.string().email().optional(),
  guardianEmail: z.string().email().optional(),
  under13: z.boolean().default(false),
});

async function tokensFor(user: AuthUser) {
  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id),
  };
}

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ input }) => {
    if (input.role === 'student' && input.email) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'students must not register an email (COPPA)',
      });
    }
    if (input.role === 'student' && input.under13 && !input.guardianEmail) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Students under 13 need a parent or guardian email to sign up.',
      });
    }
    const exists = await prisma.user.findUnique({ where: { username: input.username } });
    if (exists) throw new TRPCError({ code: 'CONFLICT', message: 'username taken' });

    const created = await prisma.user.create({
      data: {
        role: input.role,
        username: input.username,
        passwordHash: await hashPassword(input.password),
        displayName: input.displayName,
        locale: input.locale,
        grade: input.grade ?? null,
        email: input.role === 'student' ? null : input.email ?? null,
        // COPPA (§9): consent is NEVER granted from an unverified email at
        // signup. Guardians and 13+ students don't require it; an under-13
        // student starts with consent PENDING (false) until a guardian
        // actually verifies out-of-band. Supplying a guardianEmail only
        // initiates that flow (link below) — it does not certify consent.
        guardianConsent: input.role !== 'student' || !input.under13,
      },
    });
    if (input.role === 'student' && input.guardianEmail) {
      const guardian = await prisma.user.findFirst({
        where: { role: 'guardian', email: input.guardianEmail },
        select: { id: true },
      });
      if (guardian) {
        await prisma.guardianLink.upsert({
          where: {
            guardianUserId_studentUserId: {
              guardianUserId: guardian.id,
              studentUserId: created.id,
            },
          },
          update: {},
          create: { guardianUserId: guardian.id, studentUserId: created.id, status: 'active' },
        });
      }
    }
    const user = (await loadUser(Number(created.id))) as AuthUser;
    return tokensFor(user);
  }),

  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      const row = await prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true, passwordHash: true },
      });
      if (!row || !(await verifyPassword(input.password, row.passwordHash))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'invalid credentials' });
      }
      const user = (await loadUser(Number(row.id))) as AuthUser;
      return tokensFor(user);
    }),

  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }) => {
      const user = await rotateRefreshToken(input.refreshToken);
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'invalid refresh token' });
      return tokensFor(user);
    }),

  me: protectedProcedure.query(({ ctx }) => ({ user: ctx.user })),

  setLocale: protectedProcedure
    .input(z.object({ locale: z.enum(['en', 'es']) }))
    .mutation(async ({ ctx, input }) => {
      await prisma.user.update({
        where: { id: BigInt(ctx.user.id) },
        data: { locale: input.locale },
      });
      return { ok: true, locale: input.locale };
    }),

  /** FERPA (§9): account + data deletion. */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.user.delete({ where: { id: BigInt(ctx.user.id) } });
    return { deleted: true };
  }),
});
