import { TRPCError, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { userFromAuthHeader, type AuthUser, type Locale } from './auth.js';
import { REFRESH_COOKIE, readCookie } from './cookies.js';

export interface Context {
  user: AuthUser | null;
  /** Best-effort client IP, used to rate-limit unauthenticated endpoints. */
  ip?: string | null;
  /**
   * Web transport: the client asks for the refresh token to live in an
   * httpOnly cookie rather than the response body (security review item #3).
   * Native leaves this unset and keeps using the body token. Optional so
   * `createCaller` unit tests can pass a bare `{ user }` context.
   */
  cookieTransport?: boolean;
  /** Refresh token read from the httpOnly cookie, when the web client sent one. */
  refreshCookie?: string | null;
  /** Whether the request arrived over https, so the cookie can carry `Secure`. */
  secure?: boolean;
  /**
   * `Set-Cookie` strings the auth mutations push here; the fetch adapter's
   * `responseMeta` emits them as response headers.
   */
  cookies?: string[];
}

/** First hop of X-Forwarded-For (set by Vercel/most proxies), else X-Real-IP. */
function clientIp(headers: Headers): string | null {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim() || null;
  return headers.get('x-real-ip');
}

/** https behind a proxy sets X-Forwarded-Proto; plain localhost dev doesn't. */
function isSecure(headers: Headers): boolean {
  const proto = headers.get('x-forwarded-proto');
  return proto ? proto.split(',')[0]!.trim() === 'https' : false;
}

/** Build the request context from the Authorization header (any adapter). */
export async function createContext(opts: { headers: Headers }): Promise<Context> {
  const { headers } = opts;
  return {
    user: await userFromAuthHeader(headers.get('authorization')),
    ip: clientIp(headers),
    cookieTransport: headers.get('x-auth-transport') === 'cookie',
    refreshCookie: readCookie(headers.get('cookie'), REFRESH_COOKIE),
    secure: isSecure(headers),
    cookies: [],
  };
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

/**
 * Only approved teachers. A self-registered teacher stays 'pending' — able to
 * sign in and see the "awaiting approval" screen, but fail-closed everywhere
 * else until an admin activates them. loadUser reads status fresh on every
 * request, so a disable takes effect immediately.
 */
export const teacherProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'teacher' || ctx.user.status !== 'active') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'teachers only' });
  }
  return next();
});

/** Only active admins (governance only — no student-data access). */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' || ctx.user.status !== 'active') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'admins only' });
  }
  return next();
});

/** Only signed-in students (e.g. joining a class is a student action). */
export const studentProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'student') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'students only' });
  }
  return next();
});

/**
 * Fixed-window counter. `consume(key)` returns false once a key exceeds
 * `maxPerMinute` within the current window. In-memory, so the budget is
 * per-instance — good enough to blunt brute-force/abuse; a shared store
 * (Redis) would be needed for a hard global cap across serverless instances.
 */
export function fixedWindowLimiter(maxPerMinute: number, windowMs = 60_000) {
  const windows = new Map<string, { count: number; reset: number }>();
  return function consume(key: string): boolean {
    const now = Date.now();
    const w = windows.get(key);
    if (!w || now > w.reset) {
      windows.set(key, { count: 1, reset: now + windowMs });
      // Opportunistically drop expired buckets so the map can't grow forever.
      if (windows.size > 10_000) {
        for (const [k, v] of windows) if (now > v.reset) windows.delete(k);
      }
      return true;
    }
    if (w.count >= maxPerMinute) return false;
    w.count++;
    return true;
  };
}

/** Simple fixed-window per-user rate limiter (design doc §8: tutor endpoints). */
export function rateLimited(maxPerMinute: number) {
  const consume = fixedWindowLimiter(maxPerMinute);
  return protectedProcedure.use(({ ctx, next }) => {
    if (!consume(String(ctx.user.id))) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'rate limited, slow down' });
    }
    return next();
  });
}

/** Effective locale: explicit input beats the account setting. */
export function loc(ctx: Context, requested?: string): Locale {
  if (requested === 'es' || requested === 'en') return requested;
  return ctx.user?.locale ?? 'en';
}
