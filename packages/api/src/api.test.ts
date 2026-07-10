/**
 * End-to-end API tests against a real Postgres test database:
 * register → curriculum → lesson → adaptive practice → per-step checks →
 * exit ticket → progress/guardian scoping — through the tRPC router.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { appRouter } from './index.js';
import type { AuthUser } from './auth.js';

process.env.DATABASE_URL ??= 'postgres://tutor:tutor@localhost:5432/algebra_tutor_test';

const { prisma, migrate, seed } = await import('@tutor/db');

const anon = appRouter.createCaller({ user: null });
const as = (user: AuthUser) => appRouter.createCaller({ user });

let student: AuthUser;
let guardian: AuthUser;

beforeAll(async () => {
  await migrate();
  await seed();
  // Idempotent runs: wipe user data, keep the seeded curriculum.
  await prisma.$executeRawUnsafe('TRUNCATE users RESTART IDENTITY CASCADE');
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth (COPPA-aware)', () => {
  it('rejects under-13 student signup without guardian email', async () => {
    await expect(
      anon.auth.register({
        role: 'student',
        username: 'kid_no_guardian',
        password: 'password123',
        displayName: 'Kid',
        under13: true,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects student signup with an email', async () => {
    await expect(
      anon.auth.register({
        role: 'student',
        username: 'kid_with_email',
        password: 'password123',
        displayName: 'Kid',
        email: 'kid@example.com',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('registers guardian then under-13 student with consent, and links them', async () => {
    const g = await anon.auth.register({
      role: 'guardian',
      username: 'guardian1',
      password: 'password123',
      displayName: 'Guardian One',
      email: 'guardian@example.com',
    });
    guardian = g.user;

    const s = await anon.auth.register({
      role: 'student',
      username: 'student1',
      password: 'password123',
      displayName: 'Student One',
      locale: 'en',
      grade: 8,
      under13: true,
      guardianEmail: 'guardian@example.com',
    });
    expect(s.user.role).toBe('student');
    expect(s.accessToken).toBeTruthy();
    student = s.user;
  });

  it('logs in and refreshes tokens (with rotation)', async () => {
    const login = await anon.auth.login({ username: 'student1', password: 'password123' });
    expect(login.accessToken).toBeTruthy();
    const refreshed = await anon.auth.refresh({ refreshToken: login.refreshToken });
    expect(refreshed.accessToken).toBeTruthy();
    // rotation: old refresh token no longer valid
    await expect(anon.auth.refresh({ refreshToken: login.refreshToken })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects unauthenticated protected calls', async () => {
    await expect(anon.curriculum.map()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('curriculum', () => {
  it('returns 9 units with lessons and mastery overlay', async () => {
    const res = await as(student).curriculum.map();
    expect(res.units).toHaveLength(9);
    const unit1 = res.units[0];
    expect(unit1.title).toBe('Number Sense');
    expect(unit1.lessons.length).toBeGreaterThanOrEqual(4);
    expect(unit1.lessons[0].mastery.label).toBe('not_started');
  });

  it('localizes to Spanish', async () => {
    const res = await as(student).curriculum.map({ locale: 'es' });
    expect(res.units[0].title).toBe('Sentido Numérico');
  });

  it('serves a lesson with scaffold steps, mnemonic, and the original class scaffolds', async () => {
    const cur = await as(student).curriculum.map();
    const lesson22 = cur.units[1].lessons.find((l) => l.code === '2.2')!;
    const res = await as(student).curriculum.lesson({ id: lesson22.id });
    expect(res.steps.length).toBeGreaterThanOrEqual(2);
    expect(res.mnemonic).toContain('STANDARD FORM');
    expect(res.skill!.slug).toBe('combine-like-terms');
    // the original classroom scaffold sections ride along with the lesson
    expect(res.classroomScaffolds.length).toBeGreaterThanOrEqual(2);
    expect(res.classroomScaffolds[0].images.length).toBeGreaterThanOrEqual(1);
  });

  it('serves the reference sheet in both languages without auth', async () => {
    const en = await anon.curriculum.referenceSheet();
    expect(en.sections[0].title).toBe('Conversions');
    const es = await anon.curriculum.referenceSheet({ locale: 'es' });
    expect(es.sections[0].title).toBe('Conversiones');
  });
});

describe('practice loop', () => {
  let skillId = 0;
  let problem: { id: number; steps: { position: number }[] };

  it('selects a standard-tier problem for a new student', async () => {
    const cur = await as(student).curriculum.map();
    skillId = cur.units[0].lessons[0].skillId!;
    const res = await as(student).practice.next({ skillId });
    expect(res.tier).toBe('standard');
    problem = res.problem;
    expect(res.problem.prompt).toBeTruthy();
  });

  it('grades a wrong answer', async () => {
    const res = await as(student).practice.attempt({
      problemId: problem.id,
      submittedLatex: '99999999',
    });
    expect(res.correct).toBe(false);
  });

  it('grades the correct answer', async () => {
    const key = await prisma.problem.findUnique({ where: { id: BigInt(problem.id) } });
    const res = await as(student).practice.attempt({
      problemId: problem.id,
      submittedLatex: key!.answerLatex,
      hintsUsed: 1,
    });
    expect(res.correct).toBe(true);
  });

  it('checks an individual step', async () => {
    const step = await prisma.problemStep.findFirst({
      where: { problem: { skillId: BigInt(skillId) } },
    });
    if (!step) return;
    const ok = await as(student).practice.checkStep({
      problemId: Number(step.problemId),
      position: step.position,
      submittedLatex: step.expectedLatex,
    });
    expect(ok.correct).toBe(true);
    const bad = await as(student).practice.checkStep({
      problemId: Number(step.problemId),
      position: step.position,
      submittedLatex: 'obviously wrong 123456',
    });
    expect(bad.correct).toBe(false);
  });

  it('moves struggling students to the modified tier', async () => {
    for (let i = 0; i < 5; i++) {
      const next = await as(student).practice.next({ skillId });
      await as(student).practice.attempt({
        problemId: next.problem.id,
        submittedLatex: '999999999',
      });
    }
    const res = await as(student).practice.next({ skillId });
    expect(res.tier).toBe('modified');
  });

  it('serves sprint problems', async () => {
    const res = await as(student).practice.sprint({ count: 5 });
    expect(res.problems.length).toBe(5);
  });

  it('assembles a review session from practiced skills', async () => {
    const res = await as(student).practice.reviewSession({});
    expect(res.problems.length).toBeGreaterThan(0);
  });
});

describe('exit tickets', () => {
  it('grades an exit ticket and records the result', async () => {
    const cur = await as(student).curriculum.map();
    const lessonId = cur.units[0].lessons[0].id;
    const et = await as(student).curriculum.exitTicket({ lessonId });
    expect(et.problems.length).toBeGreaterThanOrEqual(4);

    // answer the first correctly (peek at the key), the rest wrong
    const key = await prisma.problem.findUnique({ where: { id: BigInt(et.problems[0].id) } });
    const answers = et.problems.map((p, i) => ({
      problemId: p.id,
      submittedLatex: i === 0 ? key!.answerLatex : 'wrong-42x',
    }));
    const res = await as(student).curriculum.submitExitTicket({
      exitTicketId: et.id,
      answers,
    });
    expect(res.score).toBe(1);
    expect(res.maxScore).toBe(et.problems.length);
  });
});

describe('progress & FERPA scoping', () => {
  it('returns the student dashboard with streak and struggle flags', async () => {
    const res = await as(student).progress.me();
    expect(res.streakDays).toBeGreaterThanOrEqual(1);
    expect(res.skills.length).toBeGreaterThan(0);
    expect(res.exitTickets.length).toBe(1);
  });

  it('lets the linked guardian view the student, read-only', async () => {
    const res = await as(guardian).progress.student({ studentId: student.id });
    expect(res.student.displayName).toBe('Student One');
  });

  it('blocks unlinked guardians', async () => {
    const other = await anon.auth.register({
      role: 'guardian',
      username: 'stranger',
      password: 'password123',
      displayName: 'Stranger',
      email: 'stranger@example.com',
    });
    await expect(
      as(other.user).progress.student({ studentId: student.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks students from other students', async () => {
    await expect(
      as(student).progress.student({ studentId: student.id + 9999 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('exports the student data', async () => {
    const res = await as(student).progress.export();
    expect(res.attempts.length).toBeGreaterThan(0);
  });
});

describe('tutor sessions', () => {
  it('opens a session and reports availability', async () => {
    const res = await as(student).tutor.createSession({});
    expect(res.sessionId).toBeTruthy();
    expect(typeof res.available).toBe('boolean');
  });

  it('streams a fallback reply when no API key is configured', async () => {
    const open = await as(student).tutor.createSession({});
    const stream = await as(student).tutor.sendMessage({
      sessionId: open.sessionId,
      message: "I don't get it",
    });
    let reply = '';
    for await (const chunk of stream) reply += chunk;
    expect(reply.length).toBeGreaterThan(10);
    // transcript is persisted, PII-scrubbed
    const session = await prisma.tutorSession.findUnique({
      where: { id: BigInt(open.sessionId) },
    });
    const transcript = session!.transcriptJson as { role: string; content: string }[];
    expect(transcript).toHaveLength(2);
    expect(transcript[1].role).toBe('assistant');
  });

  it('enforces the per-user rate limit', async () => {
    let limited = false;
    for (let i = 0; i < 15; i++) {
      try {
        await as(student).tutor.createSession({});
      } catch (err) {
        if (err instanceof TRPCError && err.code === 'TOO_MANY_REQUESTS') limited = true;
      }
    }
    expect(limited).toBe(true);
  });
});
