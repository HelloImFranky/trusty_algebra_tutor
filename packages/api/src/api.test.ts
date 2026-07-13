/**
 * End-to-end API tests against a real Postgres test database:
 * register → curriculum → lesson → adaptive practice → per-step checks →
 * Regents review → progress/guardian scoping — through the tRPC router.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { appRouter } from './index.js';
import type { AuthUser } from './auth.js';

process.env.DATABASE_URL ??= 'postgres://tutor:tutor@localhost:5432/algebra_tutor_test';

const { prisma, migrate, seed, Prisma } = await import('@tutor/db');

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

  it('diagnoses a predicted misconception and returns targeted feedback', async () => {
    const prob = await prisma.problem.findFirst({
      where: { NOT: { misconceptionsJson: { equals: Prisma.DbNull } } },
    });
    expect(prob).toBeTruthy();
    const predicted = (prob!.misconceptionsJson as { id: string; answerLatex: string }[])[0];
    const res = await as(student).practice.attempt({
      problemId: Number(prob!.id),
      submittedLatex: predicted.answerLatex,
    });
    expect(res.correct).toBe(false);
    expect(res.misconceptionId).toBe(predicted.id);
    expect(res.message).toBeTruthy();
    const attempt = await prisma.attempt.findFirst({
      where: { problemId: prob!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(attempt?.misconceptionId).toBe(predicted.id);
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

describe('regents review', () => {
  it('serves the topic catalog with ten questions per topic and no progress yet', async () => {
    const res = await as(student).regents.catalog({});
    expect(res.topics.length).toBeGreaterThanOrEqual(10);
    for (const topic of res.topics) {
      expect(topic.total).toBe(10);
      expect(topic.answered).toBe(0);
    }
  });

  it('serves a topic without leaking answers, localized', async () => {
    const en = await as(student).regents.topic({ slug: 'linear-equations' });
    expect(en.questions.length).toBe(10);
    for (const q of en.questions) {
      expect(q.choices.length).toBe(4);
      expect(q.answered).toBeNull();
      expect(q).not.toHaveProperty('correctIndex');
      expect(q).not.toHaveProperty('explanation');
    }
    // Round 0 = the four handwritten questions topped up with generated ones.
    expect(en.questions.slice(0, 4).map((q) => q.id)).toEqual([
      'linear-equations-q1',
      'linear-equations-q2',
      'linear-equations-q3',
      'linear-equations-q4',
    ]);
    expect(en.questions.slice(4).map((q) => q.id)).toEqual([
      'linear-equations:r0:q5',
      'linear-equations:r0:q6',
      'linear-equations:r0:q7',
      'linear-equations:r0:q8',
      'linear-equations:r0:q9',
      'linear-equations:r0:q10',
    ]);
    const es = await as(student).regents.topic({ slug: 'linear-equations', locale: 'es' });
    expect(es.title).toBe('Resolver Ecuaciones Lineales');
  });

  it('rejects an unknown topic', async () => {
    await expect(as(student).regents.topic({ slug: 'nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('grades a correct choice with a green light and a wrong one with the explanation', async () => {
    // linear-equations q1: 3x + 7 = 22 -> x = 5 (index 1)
    const right = await as(student).regents.answer({
      questionId: 'linear-equations-q1',
      choiceIndex: 1,
    });
    expect(right.correct).toBe(true);
    expect(right.alreadyAnswered).toBe(false);

    const wrong = await as(student).regents.answer({
      questionId: 'linear-equations-q2',
      choiceIndex: 0,
    });
    expect(wrong.correct).toBe(false);
    expect(wrong.correctIndex).toBe(3);
    expect(wrong.explanation.length).toBeGreaterThan(10);
  });

  it('gives exactly one try per question', async () => {
    const retry = await as(student).regents.answer({
      questionId: 'linear-equations-q1',
      choiceIndex: 0, // different (wrong) choice on the retry
    });
    expect(retry.alreadyAnswered).toBe(true);
    expect(retry.correct).toBe(true); // the original result stands
    expect(retry.choiceIndex).toBe(1);
  });

  it('shows prior answers when revisiting a topic and tracks catalog progress', async () => {
    const topic = await as(student).regents.topic({ slug: 'linear-equations' });
    const q1 = topic.questions.find((q) => q.id === 'linear-equations-q1');
    expect(q1?.answered).toMatchObject({ choiceIndex: 1, correct: true, correctIndex: 1 });

    const cat = await as(student).regents.catalog({});
    const entry = cat.topics.find((t) => t.slug === 'linear-equations');
    expect(entry).toMatchObject({ answered: 2, correct: 1 });
  });

  // Round-0 correct total for linear-equations; the generated top-up answers
  // below add an amount only known at runtime.
  let round0Correct = 3;

  it('completing a topic earns the Review Rookie badge on the progress tab', async () => {
    await as(student).regents.answer({ questionId: 'linear-equations-q3', choiceIndex: 2 });
    await as(student).regents.answer({ questionId: 'linear-equations-q4', choiceIndex: 3 });

    // Finish the generated top-up questions (round 0 slots q5..q10) too.
    const topic = await as(student).regents.topic({ slug: 'linear-equations' });
    const open = topic.questions.filter((q) => !q.answered);
    expect(open).toHaveLength(6);
    for (const q of open) {
      const graded = await as(student).regents.answer({ questionId: q.id, choiceIndex: 1 });
      if (graded.correct) round0Correct++;
    }

    const res = await as(student).progress.me();
    expect(res.regents.topicsCompleted).toBe(1);
    expect(res.regents.questionsAnswered).toBe(10);
    expect(res.regents.questionsCorrect).toBe(round0Correct);
    const rookie = res.achievements.find((a) => a.id === 'regents-bronze');
    expect(rookie?.earned).toBe(true);
    const perTopic = res.regents.topics.find((t) => t.slug === 'linear-equations');
    expect(perTopic).toMatchObject({ answered: 10, correct: round0Correct, total: 10 });
  });

  it('lets a finished topic renew with a freshly generated set', async () => {
    // Round 0 of linear-equations was completed above, so round 1 opens.
    const t1 = await as(student).regents.topic({ slug: 'linear-equations', round: 1 });
    expect(t1.round).toBe(1);
    expect(t1.questions).toHaveLength(10);
    for (const q of t1.questions) {
      expect(q.answered).toBeNull();
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q).not.toHaveProperty('correctIndex');
      expect(q).not.toHaveProperty('explanation');
    }
    // Deterministic: asking again serves the identical set.
    const t2 = await as(student).regents.topic({ slug: 'linear-equations', round: 1 });
    expect(t2.questions.map((q) => q.prompt)).toEqual(t1.questions.map((q) => q.prompt));
    // Generated ids, not the handwritten bank's.
    expect(t1.questions.map((q) => q.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `linear-equations:r1:q${i + 1}`),
    );
  });

  it('grades a generated question once and replays the result after', async () => {
    const topic = await as(student).regents.topic({ slug: 'linear-equations', round: 1 });
    const q = topic.questions[0];
    const res = await as(student).regents.answer({ questionId: q.id, choiceIndex: 2 });
    expect(res.alreadyAnswered).toBe(false);
    expect(res.correct).toBe(res.correctIndex === 2);
    expect(res.explanation.length).toBeGreaterThan(10);

    const retry = await as(student).regents.answer({ questionId: q.id, choiceIndex: 0 });
    expect(retry.alreadyAnswered).toBe(true);
    expect(retry.choiceIndex).toBe(2);

    // A revisit shows the same graded state, and the topic resumes round 1.
    const revisit = await as(student).regents.topic({ slug: 'linear-equations' });
    expect(revisit.round).toBe(1);
    expect(revisit.maxRound).toBe(1);
    expect(revisit.questions[0].answered).toMatchObject({ choiceIndex: 2 });
  });

  it('refuses to skip ahead of an unfinished set', async () => {
    // Round 1 has a single answer so far, so round 2 stays locked...
    await expect(
      as(student).regents.topic({ slug: 'linear-equations', round: 2 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    // ...and untouched topics can't renew at all.
    await expect(as(student).regents.topic({ slug: 'systems', round: 1 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('keeps first-run badge stats separate from extra practice rounds', async () => {
    const res = await as(student).progress.me();
    const perTopic = res.regents.topics.find((t) => t.slug === 'linear-equations');
    // round 0 only
    expect(perTopic).toMatchObject({ answered: 10, correct: round0Correct, total: 10 });
    expect(res.regents.questionsAnswered).toBe(11); // ...but totals count the extra round
    expect(res.regents.topicsCompleted).toBe(1);

    const cat = await as(student).regents.catalog({});
    const entry = cat.topics.find((t) => t.slug === 'linear-equations');
    expect(entry).toMatchObject({ answered: 10, correct: round0Correct, extraRounds: 1 });
  });

  it('reports lifetime right/wrong tallies and completed rounds per topic', async () => {
    const res = await as(student).progress.me();
    const perTopic = res.regents.topics.find((t) => t.slug === 'linear-equations')!;
    // 10 round-0 answers + 1 round-1 answer, split between right and wrong.
    expect(perTopic.correctAll + perTopic.wrongAll).toBe(11);
    expect(perTopic.correctAll).toBeGreaterThanOrEqual(round0Correct);
    // Only round 0 is finished; the round-1 renewal has one answer so far.
    expect(perTopic.completions).toBe(1);

    const untouched = res.regents.topics.find((t) => t.slug === 'systems')!;
    expect(untouched).toMatchObject({ correctAll: 0, wrongAll: 0, completions: 0 });
  });
});

describe('progress & FERPA scoping', () => {
  it('returns the student dashboard with streak and struggle flags', async () => {
    const res = await as(student).progress.me();
    expect(res.streakDays).toBeGreaterThanOrEqual(1);
    expect(res.skills.length).toBeGreaterThan(0);
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
