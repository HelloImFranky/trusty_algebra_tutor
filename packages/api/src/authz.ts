/**
 * Shared helpers that span routers (authorization + guardian-consent).
 */
import { TRPCError } from '@trpc/server';
import { prisma } from '@tutor/db';

/**
 * A teacher may act on a student only through an active enrollment in a
 * non-archived class the teacher owns (FERPA §9). Used by both the per-student
 * progress drill-down and guardian-consent attestation so the two can never
 * drift. Fail closed — no shared class, no access.
 */
export async function teacherCanSeeStudent(teacherId: number, studentId: number): Promise<boolean> {
  const enrolled = await prisma.classEnrollment.findFirst({
    where: {
      studentUserId: BigInt(studentId),
      status: 'active',
      class: { teacherUserId: BigInt(teacherId), archived: false },
    },
    select: { classId: true },
  });
  return enrolled !== null;
}

/**
 * Record guardian consent for a student (docs/guardian-consent-plan.md, Tier 0).
 * Writes an audit row and flips the derived `guardianConsent` cache in one
 * transaction, so they can never disagree. Callers are responsible for
 * authorization (teacher roster scope, or admin). Throws NOT_FOUND if the
 * target isn't a student. Idempotent: re-attesting appends a fresh audit row
 * and leaves the already-true boolean as-is.
 */
export async function recordGuardianConsent(params: {
  studentId: number;
  method: 'school' | 'admin_manual';
  grantedByUserId: number;
  note?: string | null;
}): Promise<void> {
  const student = await prisma.user.findFirst({
    where: { id: BigInt(params.studentId), role: 'student' },
    select: { id: true },
  });
  if (!student) throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  await prisma.$transaction([
    prisma.guardianConsent.create({
      data: {
        studentUserId: BigInt(params.studentId),
        method: params.method,
        grantedByUserId: BigInt(params.grantedByUserId),
        note: params.note ?? null,
      },
    }),
    prisma.user.update({
      where: { id: BigInt(params.studentId) },
      data: { guardianConsent: true },
    }),
  ]);
}
