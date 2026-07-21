import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
import { adminUsageAvailable, fetchUsageSummary, type UsageSummary } from '@tutor/core/admin';
import { adminProcedure, router } from '../trpc.js';
import { recordGuardianConsent } from '../authz.js';
import {
  schoolAdoption,
  schoolEngagement,
  unitMasteryDistribution,
  weeklyMinutes,
} from '../classInsights.js';
import { schoolYearStart } from '../sprintStats.js';

/**
 * Admin console (docs/teacher-dashboard-plan.md, Stage 2). Least privilege:
 * endpoints operate on teacher accounts only (WHERE role = 'teacher'), so an
 * admin can approve/reject/disable teachers but cannot reach student records,
 * other admins, or guardians through here — with ONE deliberate, audited
 * exception: `verifyGuardianConsent` (break-glass guardian-consent attestation,
 * docs/guardian-consent-plan.md, Tier 0), which writes a student's consent flag
 * plus an audit row and requires a `note`.
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

  /**
   * Break-glass guardian-consent attestation (docs/guardian-consent-plan.md,
   * Tier 0). The teacher path is primary; this is the governance fallback for
   * students not on any roster, staff turnover, or corrections. This is the one
   * deliberate exception to the admin router's "never touch student records"
   * rule (see file header), so the `note` is REQUIRED — every break-glass use
   * is explained in the audit row.
   */
  verifyGuardianConsent: adminProcedure
    .input(z.object({ studentId: z.number().int(), note: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      await recordGuardianConsent({
        studentId: input.studentId,
        method: 'admin_manual',
        grantedByUserId: ctx.user.id,
        note: input.note,
      });
      return { ok: true };
    }),

  stats: router({
    /**
     * School overview (docs/statistics-plan.md, Phase 1b): engagement,
     * mastery distribution by unit, adoption, and consent coverage — for the
     * principal / department-head persona. Everything is a de-identified
     * aggregate (counts and series, no names, no per-student rows), which is
     * what keeps this compatible with the router's least-privilege rule
     * above: the admin still cannot reach any individual student's records.
     */
    overview: adminProcedure.query(async () => {
      const [engagement, weekly, masteryByUnit, adoption] = await Promise.all([
        schoolEngagement(),
        weeklyMinutes(null, schoolYearStart()),
        unitMasteryDistribution(),
        schoolAdoption(),
      ]);
      return {
        engagement,
        weekly,
        masteryByUnit,
        adoption,
        yearStart: schoolYearStart().toISOString().slice(0, 10),
      };
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
