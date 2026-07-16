import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
import { adminUsageAvailable, fetchUsageSummary, type UsageSummary } from '@tutor/core/admin';
import { adminProcedure, router } from '../trpc.js';

/**
 * Admin console (docs/teacher-dashboard-plan.md, Stage 2). Least privilege:
 * every endpoint operates on teacher accounts only (WHERE role = 'teacher'),
 * so an admin can approve/reject/disable teachers but cannot reach student
 * records, other admins, or guardians through here.
 */

function teacherView(u: {
  id: bigint;
  username: string;
  displayName: string;
  email: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: Number(u.id),
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  };
}

const select = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  status: true,
  createdAt: true,
} as const;

/** Load a teacher row (never any other role), or 404. */
async function teacherOr404(userId: number) {
  const u = await prisma.user.findFirst({ where: { id: BigInt(userId), role: 'teacher' }, select });
  if (!u) throw new TRPCError({ code: 'NOT_FOUND', message: 'teacher not found' });
  return u;
}

export const adminRouter = router({
  teachers: router({
    /** Teachers awaiting approval, oldest first. */
    listPending: adminProcedure.query(async () => {
      const rows = await prisma.user.findMany({
        where: { role: 'teacher', status: 'pending' },
        orderBy: { createdAt: 'asc' },
        select,
      });
      return { teachers: rows.map(teacherView) };
    }),

    /** All teacher accounts (any status). */
    list: adminProcedure.query(async () => {
      const rows = await prisma.user.findMany({
        where: { role: 'teacher' },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        select,
      });
      return { teachers: rows.map(teacherView) };
    }),

    approve: adminProcedure
      .input(z.object({ userId: z.number().int() }))
      .mutation(async ({ input }) => {
        await teacherOr404(input.userId);
        await prisma.user.update({ where: { id: BigInt(input.userId) }, data: { status: 'active' } });
        return { ok: true };
      }),

    /** Reject a never-approved teacher: remove the pending account entirely. */
    reject: adminProcedure
      .input(z.object({ userId: z.number().int() }))
      .mutation(async ({ input }) => {
        const t = await teacherOr404(input.userId);
        if (t.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'only pending teachers can be rejected' });
        }
        await prisma.user.delete({ where: { id: BigInt(input.userId) } });
        return { ok: true };
      }),

    /** Revoke an already-active teacher's access without deleting their data. */
    disable: adminProcedure
      .input(z.object({ userId: z.number().int() }))
      .mutation(async ({ input }) => {
        await teacherOr404(input.userId);
        await prisma.user.update({
          where: { id: BigInt(input.userId) },
          data: { status: 'disabled' },
        });
        return { ok: true };
      }),
  }),

  usage: router({
    /**
     * AI-tutor token usage + spend for the admin dashboard, pulled from
     * Anthropic's Admin API (docs/tutor-usage-dashboard-plan.md). The
     * ANTHROPIC_ADMIN_KEY is read only inside @tutor/core/admin — this
     * endpoint returns aggregated numbers, never credentials. Behind
     * adminProcedure, so a student/teacher token is rejected before any
     * Admin API call can happen. Fails SAFE: no key, an upstream error,
     * or a rate limit all come back as { available: false } (the UI then
     * shows the Console link-out card) — never a hard error.
     */
    summary: adminProcedure
      .input(z.object({ window: z.enum(['7d', '30d']).default('30d') }).default({ window: '30d' }))
      .query(async ({ input }): Promise<{ available: boolean; summary: UsageSummary | null }> => {
        if (!adminUsageAvailable()) return { available: false, summary: null };
        const days = input.window === '7d' ? 7 : 30;
        try {
          return { available: true, summary: await cachedSummary(days) };
        } catch (err) {
          // Log server-side for the operator; the client only learns "unavailable".
          console.error('admin usage summary failed:', err instanceof Error ? err.message : err);
          return { available: false, summary: null };
        }
      }),
  }),
});

/**
 * The reports are laggy (~5 min settlement) and Anthropic recommends
 * caching for dashboards, so memoize per window for 10 minutes. In-flight
 * de-dup included: concurrent admin loads share one upstream call.
 * Per-instance (module scope) — fine for a dashboard; a cold serverless
 * instance just refetches.
 */
const USAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const usageCache = new Map<number, { at: number; value: Promise<UsageSummary> }>();

function cachedSummary(days: 7 | 30): Promise<UsageSummary> {
  const hit = usageCache.get(days);
  if (hit && Date.now() - hit.at < USAGE_CACHE_TTL_MS) return hit.value;
  const value = fetchUsageSummary({ days });
  // Drop failed fetches from the cache so the next load retries instead of
  // pinning "unavailable" for the full TTL.
  value.catch(() => usageCache.delete(days));
  usageCache.set(days, { at: Date.now(), value });
  return value;
}
