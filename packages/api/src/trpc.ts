import { TRPCError, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { userFromAuthHeader, type AuthUser, type Locale } from './auth.js';

export interface Context {
  user: AuthUser | null;
}

/** Build the request context from the Authorization header (any adapter). */
export async function createContext(opts: { headers: Headers }): Promise<Context> {
  return { user: await userFromAuthHeader(opts.headers.get('authorization')) };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'missing or invalid token' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Simple fixed-window per-user rate limiter (design doc §8: tutor endpoints). */
export function rateLimited(maxPerMinute: number) {
  const windows = new Map<string, { count: number; reset: number }>();
  return protectedProcedure.use(({ ctx, next }) => {
    const key = String(ctx.user.id);
    const now = Date.now();
    const w = windows.get(key);
    if (!w || now > w.reset) {
      windows.set(key, { count: 1, reset: now + 60_000 });
    } else if (w.count >= maxPerMinute) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'rate limited, slow down' });
    } else {
      w.count++;
    }
    return next();
  });
}

/** Effective locale: explicit input beats the account setting. */
export function loc(ctx: Context, requested?: string): Locale {
  if (requested === 'es' || requested === 'en') return requested;
  return ctx.user?.locale ?? 'en';
}
