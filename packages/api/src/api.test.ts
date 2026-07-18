/**
 * End-to-end API tests against a real Postgres test database:
 * register → curriculum → lesson → adaptive practice → per-step checks →
 * Regents review → progress/guardian scoping — through the tRPC router.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { sprintTopicDefs } from '@tutor/core';
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

    // COPPA: an unverified guardian email must NOT grant consent — the
    // under-13 account is created with consent pending until verified.
    const row = await prisma.user.findUnique({
      where: { id: BigInt(student.id) },
      select: { guardianConsent: true },
    });
    expect(row?.guardianConsent).toBe(false);
  });

  it('self-registers a teacher as pending, fail-closed until approved', async () => {
    const t = await anon.auth.register({
      role: 'teacher',
      username: 'pending_teacher',
      password: 'password123',
      displayName: 'Pending Teacher',
      email: 'pt@example.com',
    });
    expect(t.user.role).toBe('teacher');
    expect(t.user.status).toBe('pending');
    // A pending teacher can sign in but cannot use any teacher feature.
    await expect(as(t.user).teacher.classes.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      as(t.user).teacher.classes.create({ name: 'nope' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('never lets an admin be self-registered', async () => {
    await expect(
      anon.auth.register({
        role: 'admin',
        username: 'sneaky_admin',
        password: 'password123',
        displayName: 'Sneaky',
      } as unknown as Parameters<typeof anon.auth.register>[0]),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('treats usernames case-insensitively (no look-alike accounts)', async () => {
    await anon.auth.register({
      role: 'guardian',
      username: 'CaseUser',
      password: 'password123',
      displayName: 'Case User',
      email: 'case@example.com',
    });
    // A different-case variant can't be registered as a second account.
    await expect(
      anon.auth.register({
        role: 'guardian',
        username: 'caseuser',
        password: 'password123',
        displayName: 'Impostor',
        email: 'impostor@example.com',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    // ...and login accepts any casing.
    const login = await anon.auth.login({ username: 'CASEUSER', password: 'password123' });
    expect(login.accessToken).toBeTruthy();
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

  it('rate-limits repeated login attempts against one account from an IP', async () => {
    // Dedicated IP + username so this bucket is isolated from other tests.
    const attacker = appRouter.createCaller({ user: null, ip: '203.0.113.42' });
    let limited = false;
    for (let i = 0; i < 12; i++) {
      try {
        await attacker.auth.login({ username: 'brute_target', password: `guess-${i}` });
      } catch (err) {
        if (err instanceof TRPCError && err.code === 'TOO_MANY_REQUESTS') {
          limited = true;
          break;
        }
        // otherwise it's the expected UNAUTHORIZED — keep guessing
      }
    }
    expect(limited).toBe(true);
  });
});

describe('httpOnly refresh cookie (web transport, security #3)', () => {
  const creds = { username: 'web_user', password: 'password123' };
  const REFRESH = 'tutor_rt';

  // A web-transport context: `x-auth-transport: cookie` (cookieTransport),
  // https (secure), and a mutable collector the auth mutations push onto.
  const webCtx = (refreshCookie: string | null = null) => ({
    user: null,
    ip: '198.51.100.7',
    cookieTransport: true,
    secure: true,
    refreshCookie,
    cookies: [] as string[],
  });

  // Pull the refresh token out of the emitted Set-Cookie string.
  const cookieToken = (cookies: string[]) => {
    const set = cookies.find((c) => c.startsWith(`${REFRESH}=`))!;
    return set.split(';')[0]!.slice(REFRESH.length + 1);
  };

  it('registers on web with the token in an httpOnly cookie, not the body', async () => {
    const ctx = webCtx();
    const res = await appRouter.createCaller(ctx).auth.register({
      role: 'student',
      ...creds,
      displayName: 'Web User',
    });
    expect(res.accessToken).toBeTruthy();
    expect(res).not.toHaveProperty('refreshToken');
    expect(ctx.cookies).toHaveLength(1);
    const cookie = ctx.cookies[0]!;
    expect(cookie).toContain('tutor_rt=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/trpc');
    expect(cookie).toContain('Secure'); // secure request
  });

  it('logs in then refreshes from the cookie, rotating it, no body token', async () => {
    const loginCtx = webCtx();
    const login = await appRouter.createCaller(loginCtx).auth.login(creds);
    expect(login).not.toHaveProperty('refreshToken');
    const rt = cookieToken(loginCtx.cookies);

    const refreshCtx = webCtx(rt);
    const refreshed = await appRouter.createCaller(refreshCtx).auth.refresh({});
    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed).not.toHaveProperty('refreshToken');
    expect(cookieToken(refreshCtx.cookies)).not.toBe(rt); // rotated

    // rotation: the old cookie token is now dead
    await expect(
      appRouter.createCaller(webCtx(rt)).auth.refresh({}),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a missing refresh cookie and clears it', async () => {
    const ctx = webCtx(null);
    await expect(appRouter.createCaller(ctx).auth.refresh({})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(ctx.cookies.some((c) => c.includes('Max-Age=0'))).toBe(true);
  });

  it('logout revokes the refresh token server-side and clears the cookie', async () => {
    const loginCtx = webCtx();
    await appRouter.createCaller(loginCtx).auth.login(creds);
    const rt = cookieToken(loginCtx.cookies);

    const logoutCtx = webCtx(rt);
    const res = await appRouter.createCaller(logoutCtx).auth.logout({});
    expect(res.ok).toBe(true);
    expect(logoutCtx.cookies.some((c) => c.includes('Max-Age=0'))).toBe(true);
    // the revoked token can no longer refresh
    await expect(
      appRouter.createCaller(webCtx(rt)).auth.refresh({}),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('native transport still returns the refresh token in the response body', async () => {
    const res = await anon.auth.login(creds);
    expect(res.refreshToken).toBeTruthy();
    // and native logout revokes that body token
    await anon.auth.logout({ refreshToken: res.refreshToken });
    await expect(anon.auth.refresh({ refreshToken: res.refreshToken })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('account settings (self-service profile + password)', () => {
  it('renames displayName and username, but rejects a taken username', async () => {
    const reg = await anon.auth.register({
      role: 'guardian',
      username: 'settings_user',
      password: 'password123',
      displayName: 'Old Name',
      email: 'settings@example.com',
    });
    const caller = as(reg.user);

    const updated = await caller.auth.updateProfile({
      displayName: 'New Name',
      username: 'settings_renamed',
    });
    expect(updated.user.displayName).toBe('New Name');
    expect(updated.user.username).toBe('settings_renamed');
    expect(updated.accessToken).toBeTruthy();

    // Colliding with an existing username is a CONFLICT.
    await expect(caller.auth.updateProfile({ username: 'student1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('changes password only with the correct current one, and revokes other sessions', async () => {
    const reg = await anon.auth.register({
      role: 'guardian',
      username: 'pw_user',
      password: 'password123',
      displayName: 'PW User',
      email: 'pw@example.com',
    });
    const oldRefresh = reg.refreshToken;
    const caller = as(reg.user);

    // Wrong current password is rejected and leaves the password unchanged.
    await expect(
      caller.auth.changePassword({ currentPassword: 'wrongpass', newPassword: 'newpassword123' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const res = await caller.auth.changePassword({
      currentPassword: 'password123',
      newPassword: 'newpassword123',
    });
    // A fresh session is issued for this device...
    expect(res.refreshToken).toBeTruthy();
    // ...while any previously-issued refresh token is revoked.
    await expect(anon.auth.refresh({ refreshToken: oldRefresh })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    // The old password no longer works; the new one does.
    await expect(anon.auth.login({ username: 'pw_user', password: 'password123' })).rejects.toMatchObject(
      { code: 'UNAUTHORIZED' },
    );
    const relogin = await anon.auth.login({ username: 'pw_user', password: 'newpassword123' });
    expect(relogin.accessToken).toBeTruthy();
  });

  it('deletes an account only after the current password is re-verified', async () => {
    const reg = await anon.auth.register({
      role: 'guardian',
      username: 'delete_me',
      password: 'password123',
      displayName: 'Delete Me',
      email: 'delete@example.com',
    });
    const caller = as(reg.user);

    // A stolen access token alone is not enough — the wrong password is rejected
    // and the account survives.
    await expect(caller.auth.deleteAccount({ password: 'wrongpass' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(await prisma.user.findUnique({ where: { id: BigInt(reg.user.id) } })).not.toBeNull();

    // The correct password deletes it.
    const res = await caller.auth.deleteAccount({ password: 'password123' });
    expect(res.deleted).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: BigInt(reg.user.id) } })).toBeNull();
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
    const key = await prisma.problem.findUnique({ where: { id: BigInt(problem.id) } });
    const res = await as(student).practice.attempt({
      problemId: problem.id,
      submittedLatex: '99999999',
    });
    expect(res.correct).toBe(false);
    // Wrong answers surface the correct value so the sprint review can
    // show "you wrote X · correct answer Y" side-by-side.
    expect(res.correctAnswer).toBe(key!.answerLatex);
  });

  it('grades the correct answer', async () => {
    const key = await prisma.problem.findUnique({ where: { id: BigInt(problem.id) } });
    const res = await as(student).practice.attempt({
      problemId: problem.id,
      submittedLatex: key!.answerLatex,
      hintsUsed: 1,
    });
    expect(res.correct).toBe(true);
    // Correct submissions don't need to echo the answer back.
    expect(res.correctAnswer).toBeNull();
  });

  it('records animation views on the attempt row', async () => {
    const key = await prisma.problem.findUnique({ where: { id: BigInt(problem.id) } });
    await as(student).practice.attempt({
      problemId: problem.id,
      submittedLatex: key!.answerLatex,
      hintsUsed: 2,
      animViews: 2,
    });
    const attempt = await prisma.attempt.findFirst({
      where: { problemId: BigInt(problem.id) },
      orderBy: { createdAt: 'desc' },
    });
    expect(attempt?.animViews).toBe(2);
    expect(attempt?.hintsUsed).toBe(2);
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

  it('serves sprint problems with params + slug for post-round walkthroughs', async () => {
    const res = await as(student).practice.sprint({ count: 5 });
    expect(res.problems.length).toBe(5);
    for (const p of res.problems) {
      expect(p).toHaveProperty('params');
      expect(p).toHaveProperty('skillSlug');
    }
  });

  it('has no difficulty option: every served problem is easy (standard tier)', async () => {
    const res = await as(student).practice.sprint({ count: 20 });
    expect(res.problems.length).toBeGreaterThan(0);
    const ids = res.problems.map((p) => BigInt(p.id));
    const rows = await prisma.problem.findMany({ where: { id: { in: ids } } });
    for (const row of rows) expect(row.tier).toBe('standard');
  });

  it('lists the 6th/7th-grade drill registry as the sprint topics', async () => {
    const { topics } = await as(student).practice.sprintTopics();
    // The registry only — never the Algebra 1 curriculum skills.
    expect(topics.map((s) => s.slug)).toEqual(sprintTopicDefs.map((d) => d.slug));
    for (const s of topics) {
      expect(s.nameEn.length).toBeGreaterThan(0);
      expect(s.nameEs.length).toBeGreaterThan(0);
      expect(s.icon.length).toBeGreaterThan(0);
    }
  });

  it('serves only dedicated drill problems — never curriculum practice problems', async () => {
    const res = await as(student).practice.sprint({ count: 20 });
    expect(res.problems.length).toBe(20);
    const rows = await prisma.problem.findMany({
      where: { id: { in: res.problems.map((p) => BigInt(p.id)) } },
    });
    const templates = new Set(sprintTopicDefs.map((d) => d.slug));
    for (const row of rows) {
      expect(row.isSprint).toBe(true);
      const params = row.paramsJson as { template?: string } | null;
      expect(templates.has(params?.template ?? '')).toBe(true);
    }
  });

  it('filters sprint problems by a single drill topic', async () => {
    const res = await as(student).practice.sprint({
      count: 5,
      topics: ['sprint_perfect_squares'],
    });
    expect(res.problems.length).toBeGreaterThan(0);
    const rows = await prisma.problem.findMany({
      where: { id: { in: res.problems.map((p) => BigInt(p.id)) } },
    });
    for (const row of rows) {
      expect(row.isSprint).toBe(true);
      expect((row.paramsJson as { template?: string })?.template).toBe('sprint_perfect_squares');
    }
  });

  it('grows a drill pool from nothing for topics the database has never seen', async () => {
    // sprint_fraction_ops rows may not predate this round; the registry-driven
    // top-up creates them on demand.
    const res = await as(student).practice.sprint({ count: 5, topics: ['sprint_fraction_ops'] });
    expect(res.problems.length).toBeGreaterThan(0);
    const rows = await prisma.problem.findMany({
      where: { id: { in: res.problems.map((p) => BigInt(p.id)) } },
    });
    for (const row of rows) {
      expect((row.paramsJson as { template?: string })?.template).toBe('sprint_fraction_ops');
    }
  });

  it('mixes a full round from several chosen topics', async () => {
    const chosen = ['sprint_perfect_squares', 'sprint_integer_ops'];
    // 30 > any single topic's seeded pool, so a full round draws from BOTH
    // chosen topics — and never others.
    const res = await as(student).practice.sprint({ count: 30, topics: chosen });
    expect(res.problems.length).toBe(30);
    const rows = await prisma.problem.findMany({
      where: { id: { in: res.problems.map((p) => BigInt(p.id)) } },
    });
    const seen = new Set(rows.map((r) => (r.paramsJson as { template?: string })?.template));
    expect([...seen].sort()).toEqual([...chosen].sort());
  });

  it('generates fresh drill variants on demand — the pool grows each round', async () => {
    const skill = await prisma.skill.findUnique({ where: { slug: 'properties-real-numbers' } });
    const poolSize = () =>
      prisma.problem.count({ where: { skillId: skill!.id, tier: 'standard', isSprint: true } });
    const before = await poolSize();
    await as(student).practice.sprint({ count: 12, topics: ['sprint_integer_ops'] });
    // integer-ops has a huge variant space, so the top-up lands new rows
    expect(await poolSize()).toBeGreaterThan(before);
  });

  it('serves a fresh round: problems the student attempted are not repeated', async () => {
    const first = await as(student).practice.sprint({
      count: 12,
      topics: ['sprint_integer_ops'],
    });
    const attempted = first.problems.slice(0, 3);
    for (const p of attempted) {
      await as(student).practice.attempt({
        problemId: p.id,
        submittedLatex: '12345678',
        context: 'sprint',
      });
    }
    // Never-attempted problems sample first, and the top-up guarantees more
    // than 12 unattempted variants exist — so none of the 3 can reappear.
    const second = await as(student).practice.sprint({
      count: 12,
      topics: ['sprint_integer_ops'],
    });
    const secondIds = new Set(second.problems.map((p) => p.id));
    for (const p of attempted) expect(secondIds.has(p.id)).toBe(false);
  });

  it('records completed sprints and unlocks the badge ladder', async () => {
    for (let i = 0; i < 5; i++) {
      await as(student).practice.sprintComplete({ total: 10, correct: 7 });
    }
    const last = await as(student).practice.sprintComplete({
      skillSlug: 'sprint_one_step_equations',
      total: 12,
      correct: 12,
    });
    expect(last.completions).toBe(6);

    const progress = await as(student).progress.me();
    const starter = progress.achievements.find((a) => a.id === 'sprint-5');
    expect(starter?.earned).toBe(true);
    const veteran = progress.achievements.find((a) => a.id === 'sprint-15');
    expect(veteran?.earned).toBe(false);
    expect(veteran?.value).toBe(6);
  });

  it('rejects a sprint completion claiming more correct than attempted', async () => {
    await expect(
      as(student).practice.sprintComplete({ total: 3, correct: 4 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
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
      // animation params can encode the answer — never before the attempt
      expect(q).not.toHaveProperty('anim');
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
    // handwritten bank questions have no animation params
    expect(wrong).toHaveProperty('anim', null);
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
    // r1:q1 is the two-step archetype: its params drive a replay animation.
    expect(res.anim?.skillSlug).toBe('multi-step-equations');
    expect(res.anim?.params).toMatchObject({ a: expect.any(Number), x: expect.any(Number) });

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

  it('refuses to ANSWER a question in a round that was never unlocked', async () => {
    // The write path must gate the same way the read path does — posting an
    // answer straight into a locked round used to inflate the counters.
    await expect(
      as(student).regents.answer({ questionId: 'linear-equations:r2:q1', choiceIndex: 0 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    // An untouched topic can't be answered past round 0 either.
    await expect(
      as(student).regents.answer({ questionId: 'systems:r1:q1', choiceIndex: 0 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
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

  it('keeps the guardian link PENDING from an unverified email, blocking access', async () => {
    // The link created at signup from an unverified guardian email must not
    // grant access on its own (FERPA/COPPA) — it starts pending.
    const link = await prisma.guardianLink.findUnique({
      where: {
        guardianUserId_studentUserId: {
          guardianUserId: BigInt(guardian.id),
          studentUserId: BigInt(student.id),
        },
      },
    });
    expect(link?.status).toBe('pending');
    await expect(
      as(guardian).progress.student({ studentId: student.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets the guardian view the student once the link is verified (activated)', async () => {
    // Simulate the out-of-band verification that activates the link.
    await prisma.guardianLink.update({
      where: {
        guardianUserId_studentUserId: {
          guardianUserId: BigInt(guardian.id),
          studentUserId: BigInt(student.id),
        },
      },
      data: { status: 'active' },
    });
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

  it('blocks an unaffiliated teacher from a student (class-scoped, see below)', async () => {
    const row = await prisma.user.create({
      data: { role: 'teacher', username: 'lonely_teacher', passwordHash: 'x', displayName: 'Nobody' },
      select: { id: true },
    });
    const teacher: AuthUser = {
      id: Number(row.id),
      role: 'teacher',
      username: 'lonely_teacher',
      displayName: 'Nobody',
      locale: 'en',
      status: 'active',
    };
    // A teacher with no shared class sees nothing (full flow in 'teacher classes').
    await expect(
      as(teacher).progress.student({ studentId: student.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('exports the student data', async () => {
    const res = await as(student).progress.export();
    expect(res.attempts.length).toBeGreaterThan(0);
  });
});

describe('teacher classes (roster + scoping)', () => {
  const mkTeacher = async (username: string, displayName: string): Promise<AuthUser> => {
    const row = await prisma.user.create({
      data: { role: 'teacher', username, passwordHash: 'x', displayName },
      select: { id: true },
    });
    return { id: Number(row.id), role: 'teacher', username, displayName, locale: 'en', status: 'active' };
  };
  let teacherA: AuthUser;
  let teacherB: AuthUser;
  let joinCode = '';
  let classId = 0;

  it('lets an out-of-band teacher create a class with a join code', async () => {
    teacherA = await mkTeacher('teacher_a', 'Teacher A');
    teacherB = await mkTeacher('teacher_b', 'Teacher B');
    const cls = await as(teacherA).teacher.classes.create({ name: 'Period 1 Algebra' });
    // Crockford base32, 8 chars, no ambiguous I/L/O/U.
    expect(cls.joinCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(cls.studentCount).toBe(0);
    joinCode = cls.joinCode;
    classId = cls.id;
  });

  it('rejects a non-teacher creating a class and a non-student joining', async () => {
    await expect(as(student).teacher.classes.create({ name: 'nope' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(as(guardian).teacher.classes.join({ code: joinCode })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects an unknown join code', async () => {
    await expect(as(student).teacher.classes.join({ code: 'ZZZZZZZZ' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('lets a student join (case-insensitive) and appear on the roster', async () => {
    const joined = await as(student).teacher.classes.join({ code: joinCode.toLowerCase() });
    expect(joined.classId).toBe(classId);

    const roster = await as(teacherA).teacher.classes.roster({ classId });
    expect(roster.students).toHaveLength(1);
    const row = roster.students[0]!;
    expect(row.id).toBe(student.id);
    expect(row.displayName).toBe('Student One');
    // lightweight summary fields are present
    expect(row).toHaveProperty('streakDays');
    expect(row).toHaveProperty('mastered');
    expect(row).toHaveProperty('struggling');
    expect(row).toHaveProperty('lastActiveAt');

    const list = await as(teacherA).teacher.classes.list();
    expect(list.classes.find((c) => c.id === classId)?.studentCount).toBe(1);
  });

  it('grants the owning teacher read access to the enrolled student', async () => {
    const res = await as(teacherA).progress.student({ studentId: student.id });
    expect(res.student.displayName).toBe('Student One');
  });

  it('isolates other teachers from the class and its students', async () => {
    await expect(as(teacherB).teacher.classes.roster({ classId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(as(teacherB).progress.student({ studentId: student.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rotating the join code invalidates the old one', async () => {
    const { joinCode: rotated } = await as(teacherA).teacher.classes.regenerateCode({ classId });
    expect(rotated).not.toBe(joinCode);

    const s2 = await anon.auth.register({
      role: 'student',
      username: 'joiner2',
      password: 'password123',
      displayName: 'Joiner Two',
    });
    await expect(as(s2.user).teacher.classes.join({ code: joinCode })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const ok = await as(s2.user).teacher.classes.join({ code: rotated });
    expect(ok.classId).toBe(classId);
    joinCode = rotated;
  });

  it('removing a student revokes their roster spot and the teacher’s access', async () => {
    await as(teacherA).teacher.classes.removeStudent({ classId, studentId: student.id });
    const roster = await as(teacherA).teacher.classes.roster({ classId });
    expect(roster.students.find((r) => r.id === student.id)).toBeUndefined();
    await expect(as(teacherA).progress.student({ studentId: student.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('guardian consent (Tier 0 attestation)', () => {
  const mkUser = async (role: string, username: string): Promise<AuthUser> => {
    const row = await prisma.user.create({
      data: { role, username, passwordHash: 'x', displayName: username },
      select: { id: true },
    });
    return { id: Number(row.id), role: role as AuthUser['role'], username, displayName: username, locale: 'en', status: 'active' };
  };

  let teacher: AuthUser;
  let admin: AuthUser;
  let kid: AuthUser; // under-13, enrolled in teacher's class
  let outsider: AuthUser; // under-13, NOT in teacher's class
  let classId = 0;

  beforeAll(async () => {
    teacher = await mkUser('teacher', 'consent_teacher');
    admin = await mkUser('admin', 'consent_admin');
    const reg = await anon.auth.register({
      role: 'student', username: 'consent_kid', password: 'password123',
      displayName: 'Consent Kid', under13: true, guardianEmail: 'g1@example.com',
    });
    kid = reg.user;
    const reg2 = await anon.auth.register({
      role: 'student', username: 'consent_outsider', password: 'password123',
      displayName: 'Outsider', under13: true, guardianEmail: 'g2@example.com',
    });
    outsider = reg2.user;
    const cls = await as(teacher).teacher.classes.create({ name: 'Consent Class' });
    classId = cls.id;
    await as(kid).teacher.classes.join({ code: cls.joinCode });
  });

  it('starts with consent pending and the tutor blocked', async () => {
    const roster = await as(teacher).teacher.classes.roster({ classId });
    expect(roster.students.find((s) => s.id === kid.id)?.consentPending).toBe(true);
    await expect(as(kid).tutor.createSession({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets the owning teacher attest, unblocking the tutor and writing an audit row', async () => {
    const res = await as(teacher).teacher.verifyGuardianConsent({
      studentId: kid.id, note: 'signed form on file',
    });
    expect(res.ok).toBe(true);

    const row = await prisma.user.findUnique({
      where: { id: BigInt(kid.id) }, select: { guardianConsent: true },
    });
    expect(row?.guardianConsent).toBe(true);

    const records = await prisma.guardianConsent.findMany({ where: { studentUserId: BigInt(kid.id) } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ method: 'school', grantedByUserId: BigInt(teacher.id) });

    // roster now shows consent satisfied, and the tutor opens
    const roster = await as(teacher).teacher.classes.roster({ classId });
    expect(roster.students.find((s) => s.id === kid.id)?.consentPending).toBe(false);
    const session = await as(kid).tutor.createSession({});
    expect(session.sessionId).toBeTruthy();
  });

  it('is idempotent: re-attesting appends an audit row and stays consented', async () => {
    await as(teacher).teacher.verifyGuardianConsent({ studentId: kid.id });
    const records = await prisma.guardianConsent.findMany({ where: { studentUserId: BigInt(kid.id) } });
    expect(records.length).toBe(2);
  });

  it('refuses a teacher attesting for a student not in their roster', async () => {
    await expect(
      as(teacher).teacher.verifyGuardianConsent({ studentId: outsider.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const row = await prisma.user.findUnique({
      where: { id: BigInt(outsider.id) }, select: { guardianConsent: true },
    });
    expect(row?.guardianConsent).toBe(false);
  });

  it('refuses a non-teacher (the student) attesting', async () => {
    await expect(
      as(kid).teacher.verifyGuardianConsent({ studentId: kid.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets an admin break-glass attest for an out-of-roster student (note required)', async () => {
    // The note is required on the admin path.
    await expect(
      // @ts-expect-error — note is required for the admin endpoint
      as(admin).admin.verifyGuardianConsent({ studentId: outsider.id }),
    ).rejects.toBeDefined();

    const res = await as(admin).admin.verifyGuardianConsent({
      studentId: outsider.id, note: 'principal confirmed paper consent',
    });
    expect(res.ok).toBe(true);
    const records = await prisma.guardianConsent.findMany({ where: { studentUserId: BigInt(outsider.id) } });
    expect(records[0]).toMatchObject({ method: 'admin_manual', grantedByUserId: BigInt(admin.id) });
  });

  it('404s when attesting for a non-student', async () => {
    await expect(
      as(admin).admin.verifyGuardianConsent({ studentId: teacher.id, note: 'nope' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('admin approval (teacher provisioning)', () => {
  let admin: AuthUser;
  let pendingTeacher: AuthUser;
  const creds = { username: 'approve_me', password: 'password123' };

  it('bootstraps an admin out-of-band; a self-signup teacher lands pending', async () => {
    const row = await prisma.user.create({
      data: { role: 'admin', status: 'active', username: 'root_admin', passwordHash: 'x', displayName: 'Root' },
      select: { id: true },
    });
    admin = {
      id: Number(row.id),
      role: 'admin',
      username: 'root_admin',
      displayName: 'Root',
      locale: 'en',
      status: 'active',
    };
    const t = await anon.auth.register({
      role: 'teacher',
      ...creds,
      displayName: 'Approve Me',
      email: 'am@example.com',
    });
    expect(t.user.status).toBe('pending');
    pendingTeacher = t.user;
    await expect(as(pendingTeacher).teacher.classes.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lists the pending teacher for the admin but hides student data', async () => {
    const pend = await as(admin).admin.teachers.listPending();
    expect(pend.teachers.some((tt) => tt.username === creds.username)).toBe(true);
    // Least privilege: an admin cannot read a student's records.
    await expect(as(admin).progress.student({ studentId: student.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('keeps non-admins out of the admin console', async () => {
    await expect(as(student).admin.teachers.listPending()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(as(pendingTeacher).admin.teachers.listPending()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('gates the usage dashboard to admins and fails safe without an admin key', async () => {
    // A student never reaches the Admin API call — rejected at the role gate.
    await expect(as(student).admin.usage.summary({ window: '30d' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    // With no ANTHROPIC_ADMIN_KEY configured, the endpoint degrades to
    // unavailable rather than erroring — the UI then shows the Console
    // link-out card. (The key is read at call time, so deleting here works.)
    delete process.env.ANTHROPIC_ADMIN_KEY;
    const res = await as(admin).admin.usage.summary({ window: '7d' });
    expect(res).toEqual({ available: false, summary: null });
  });

  it('approves a teacher, unlocking teacher features', async () => {
    await as(admin).admin.teachers.approve({ userId: pendingTeacher.id });
    // Re-login: the server reloads role/status from the DB each request.
    const relog = await anon.auth.login(creds);
    expect(relog.user.status).toBe('active');
    const cls = await as(relog.user).teacher.classes.create({ name: 'Approved Class' });
    expect(cls.joinCode).toBeTruthy();
  });

  it('disables a teacher, revoking access immediately', async () => {
    await as(admin).admin.teachers.disable({ userId: pendingTeacher.id });
    const relog = await anon.auth.login(creds);
    expect(relog.user.status).toBe('disabled');
    await expect(as(relog.user).teacher.classes.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // reject only applies to pending accounts, not an active/disabled one
    await expect(as(admin).admin.teachers.reject({ userId: pendingTeacher.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects a pending teacher by removing the account', async () => {
    const t = await anon.auth.register({
      role: 'teacher',
      username: 'reject_me',
      password: 'password123',
      displayName: 'Reject Me',
      email: 'rm@example.com',
    });
    await as(admin).admin.teachers.reject({ userId: t.user.id });
    const gone = await prisma.user.findUnique({ where: { id: BigInt(t.user.id) } });
    expect(gone).toBeNull();
  });
});

describe('tutor sessions', () => {
  it('blocks an under-13 student without verified guardian consent', async () => {
    const kid = await anon.auth.register({
      role: 'student',
      username: 'unconsented_kid',
      password: 'password123',
      displayName: 'Kid',
      under13: true,
      guardianEmail: 'noparent@example.com',
    });
    // consent is pending → the tutor (external LLM/PII path) is closed
    await expect(as(kid.user).tutor.createSession({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('opens a session and reports availability', async () => {
    // student1 is under-13; simulate the guardian verification that grants
    // consent so the happy-path tutor flow is reachable.
    await prisma.user.update({
      where: { id: BigInt(student.id) },
      data: { guardianConsent: true },
    });
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
