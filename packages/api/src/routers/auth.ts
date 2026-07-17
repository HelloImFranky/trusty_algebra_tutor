import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
import {
  equalizeLoginTiming,
  hashPassword,
  issueRefreshToken,
  loadUser,
  revokeAllUserTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
  type AuthUser,
} from '../auth.js';
import { clearRefreshCookie, setRefreshCookie } from '../cookies.js';
import {
  fixedWindowLimiter,
  protectedProcedure,
  publicProcedure,
  rateLimited,
  router,
  type Context,
} from '../trpc.js';

// Per-IP throttles for the unauthenticated endpoints (design doc §8). These
// are the only routes reachable without a token, so they're the brute-force /
// abuse surface. Limits are lenient enough for a whole classroom behind one
// school NAT while still bounding automated attacks.
//   - login keys on IP+username, so guessing one account is capped without
//     penalising the 30 other students signing in from the same IP.
//   - register/refresh key on IP alone.
const loginRate = fixedWindowLimiter(10);
const registerRate = fixedWindowLimiter(20);
const refreshRate = fixedWindowLimiter(60);
const logoutRate = fixedWindowLimiter(30);

// Refresh tokens are 64 hex chars; cap well above that so a huge body can't be
// pushed through the public refresh/logout endpoints.
const refreshTokenSchema = z.string().max(256);

const TOO_MANY = 'Too many attempts. Please wait a minute and try again.';

function throttle(consume: (key: string) => boolean, key: string) {
  if (!consume(key)) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: TOO_MANY });
  }
}

const ipKey = (ctx: Context) => ctx.ip ?? 'unknown';

const registerSchema = z.object({
  // Public self-signup may create students, guardians, and teachers — but a
  // self-registered teacher is created 'pending' and stays fail-closed until
  // an admin approves them (see below). Admins are never self-registerable.
  role: z.enum(['student', 'guardian', 'teacher']).default('student'),
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

/**
 * Issue an access + refresh token for a freshly authenticated user, choosing
 * the transport by `ctx.cookieTransport`:
 *   - web (cookie): push the refresh token as an httpOnly `Set-Cookie` and omit
 *     it from the body, so page script can never read it.
 *   - native (default): return the refresh token in the body as before.
 */
async function issueSession(ctx: Context, user: AuthUser) {
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  if (ctx.cookieTransport) {
    (ctx.cookies ??= []).push(setRefreshCookie(refreshToken, ctx.secure ?? false));
    return { user, accessToken };
  }
  return { user, accessToken, refreshToken };
}

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ ctx, input }) => {
    throttle(registerRate, ipKey(ctx));
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
        // Teachers must be approved by an admin before they can do anything;
        // students and guardians are active immediately.
        status: input.role === 'teacher' ? 'pending' : 'active',
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
    return issueSession(ctx, user);
  }),

  login: publicProcedure
    .input(z.object({ username: z.string().max(32), password: z.string().max(128) }))
    .mutation(async ({ ctx, input }) => {
      throttle(loginRate, `${ipKey(ctx)}|${input.username.toLowerCase()}`);
      const row = await prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true, passwordHash: true },
      });
      if (!row) {
        // Spend the same time as a real bcrypt compare (no user enumeration).
        await equalizeLoginTiming(input.password);
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'invalid credentials' });
      }
      if (!(await verifyPassword(input.password, row.passwordHash))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'invalid credentials' });
      }
      const user = (await loadUser(Number(row.id))) as AuthUser;
      return issueSession(ctx, user);
    }),

  refresh: publicProcedure
    // Native sends the refresh token in the body; web omits it and the server
    // reads it from the httpOnly cookie instead (hence optional).
    .input(z.object({ refreshToken: refreshTokenSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      throttle(refreshRate, ipKey(ctx));
      const token = ctx.cookieTransport ? ctx.refreshCookie : input.refreshToken;
      const user = token ? await rotateRefreshToken(token) : null;
      if (!user) {
        // Clear a stale/invalid web cookie so boot doesn't keep re-sending it.
        if (ctx.cookieTransport) (ctx.cookies ??= []).push(clearRefreshCookie(ctx.secure ?? false));
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'invalid refresh token' });
      }
      return issueSession(ctx, user);
    }),

  /**
   * Revoke the current refresh token server-side and (web) clear the cookie.
   * Public: possession of the refresh token/cookie is the credential, and the
   * access token may already be expired at logout time.
   */
  logout: publicProcedure
    .input(z.object({ refreshToken: refreshTokenSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      throttle(logoutRate, ipKey(ctx));
      const token = ctx.cookieTransport ? ctx.refreshCookie : input.refreshToken;
      if (token) await revokeRefreshToken(token);
      if (ctx.cookieTransport) (ctx.cookies ??= []).push(clearRefreshCookie(ctx.secure ?? false));
      return { ok: true };
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

  /**
   * Self-service profile edit (display name and/or username). Protected +
   * rate-limited. A username change re-checks the same rule and unique
   * constraint as signup; the access token embeds the username, so we re-issue
   * it (and return the fresh user) for the client to store.
   */
  updateProfile: rateLimited(20)
    .input(
      z.object({
        displayName: z.string().min(1).max(64).optional(),
        username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.displayName === undefined && input.username === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'nothing to update' });
      }
      if (input.username && input.username !== ctx.user.username) {
        const taken = await prisma.user.findUnique({
          where: { username: input.username },
          select: { id: true },
        });
        if (taken) throw new TRPCError({ code: 'CONFLICT', message: 'username taken' });
      }
      await prisma.user.update({
        where: { id: BigInt(ctx.user.id) },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.username !== undefined ? { username: input.username } : {}),
        },
      });
      const user = (await loadUser(ctx.user.id)) as AuthUser;
      return { user, accessToken: signAccessToken(user) };
    }),

  /**
   * Change password: verify the current one, store the new hash, then revoke
   * every refresh token so other sessions must re-authenticate — and issue a
   * fresh session for THIS device (cookie on web, body on native) so the caller
   * stays signed in.
   */
  changePassword: rateLimited(10)
    .input(
      z.object({
        currentPassword: z.string().max(128),
        newPassword: z.string().min(8).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await prisma.user.findUnique({
        where: { id: BigInt(ctx.user.id) },
        select: { passwordHash: true },
      });
      if (!row || !(await verifyPassword(input.currentPassword, row.passwordHash))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'current password is incorrect' });
      }
      await prisma.user.update({
        where: { id: BigInt(ctx.user.id) },
        data: { passwordHash: await hashPassword(input.newPassword) },
      });
      await revokeAllUserTokens(ctx.user.id);
      return issueSession(ctx, ctx.user);
    }),

  /**
   * FERPA (§9): account + data deletion. Irreversible, and for a teacher it
   * cascades to every class they own and every enrollment in it, so it must
   * not be reachable from a stolen access token alone: re-verify the current
   * password and rate-limit it.
   */
  deleteAccount: rateLimited(5)
    .input(z.object({ password: z.string().max(128) }))
    .mutation(async ({ ctx, input }) => {
      const row = await prisma.user.findUnique({
        where: { id: BigInt(ctx.user.id) },
        select: { passwordHash: true },
      });
      if (!row || !(await verifyPassword(input.password, row.passwordHash))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'password is incorrect' });
      }
      await prisma.user.delete({ where: { id: BigInt(ctx.user.id) } });
      return { deleted: true };
    }),
});
