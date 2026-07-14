import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@tutor/db';
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
});
