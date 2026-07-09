/**
 * End-to-end API tests against a real Postgres test database:
 * register → curriculum → lesson → adaptive practice → per-step checks →
 * exit ticket → progress/guardian scoping.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';
import { pool } from './db/pool.js';

process.env.DATABASE_URL ??= 'postgres://tutor:tutor@localhost:5432/algebra_tutor_test';

const app = createApp();
let studentToken = '';
let guardianToken = '';
let studentId = 0;

beforeAll(async () => {
  await migrate();
  await seed();
  // Idempotent runs: wipe user data, keep the seeded curriculum.
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
}, 120_000);

afterAll(async () => {
  await pool.end();
});

describe('auth (COPPA-aware)', () => {
  it('rejects under-13 student signup without guardian email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      role: 'student',
      username: 'kid_no_guardian',
      password: 'password123',
      displayName: 'Kid',
      under13: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('guardian_consent_required');
  });

  it('rejects student signup with an email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      role: 'student',
      username: 'kid_with_email',
      password: 'password123',
      displayName: 'Kid',
      email: 'kid@example.com',
    });
    expect(res.status).toBe(400);
  });

  it('registers guardian then under-13 student with consent, and links them', async () => {
    const g = await request(app).post('/api/auth/register').send({
      role: 'guardian',
      username: 'guardian1',
      password: 'password123',
      displayName: 'Guardian One',
      email: 'guardian@example.com',
    });
    expect(g.status).toBe(201);
    guardianToken = g.body.accessToken;

    const s = await request(app).post('/api/auth/register').send({
      role: 'student',
      username: 'student1',
      password: 'password123',
      displayName: 'Student One',
      locale: 'en',
      grade: 8,
      under13: true,
      guardianEmail: 'guardian@example.com',
    });
    expect(s.status).toBe(201);
    expect(s.body.user.role).toBe('student');
    studentToken = s.body.accessToken;
    studentId = s.body.user.id;
  });

  it('logs in and refreshes tokens', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'student1', password: 'password123' });
    expect(login.status).toBe(200);
    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    // rotation: old refresh token no longer valid
    const reused = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(reused.status).toBe(401);
  });
});

describe('curriculum', () => {
  it('returns 9 units with lessons and mastery overlay', async () => {
    const res = await request(app)
      .get('/api/curriculum')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.units).toHaveLength(9);
    const unit1 = res.body.units[0];
    expect(unit1.title).toBe('Number Sense');
    expect(unit1.lessons.length).toBeGreaterThanOrEqual(4);
    expect(unit1.lessons[0].mastery.label).toBe('not_started');
  });

  it('localizes to Spanish', async () => {
    const res = await request(app)
      .get('/api/curriculum?locale=es')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.body.units[0].title).toBe('Sentido Numérico');
  });

  it('serves a lesson with scaffold steps and mnemonic', async () => {
    const cur = await request(app)
      .get('/api/curriculum')
      .set('Authorization', `Bearer ${studentToken}`);
    const lesson22 = cur.body.units[1].lessons.find((l: { code: string }) => l.code === '2.2');
    const res = await request(app)
      .get(`/api/lessons/${lesson22.id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.steps.length).toBeGreaterThanOrEqual(2);
    expect(res.body.mnemonic).toContain('STANDARD FORM');
    expect(res.body.skill.slug).toBe('combine-like-terms');
    // the original classroom scaffold sections ride along with the lesson
    expect(res.body.classroomScaffolds.length).toBeGreaterThanOrEqual(2);
    expect(res.body.classroomScaffolds[0].title).toContain('Standard Form');
    expect(res.body.classroomScaffolds[0].body).toContain('COMBINING LIKE-TERMS');
  });

  it('serves the reference sheet in both languages without auth', async () => {
    const en = await request(app).get('/api/reference-sheet');
    expect(en.status).toBe(200);
    expect(en.body.sections[0].title).toBe('Conversions');
    const es = await request(app).get('/api/reference-sheet?locale=es');
    expect(es.body.sections[0].title).toBe('Conversiones');
  });
});

describe('practice loop', () => {
  let skillId = 0;
  let problem: { id: number; steps: { position: number }[] };

  it('selects a standard-tier problem for a new student', async () => {
    const cur = await request(app)
      .get('/api/curriculum')
      .set('Authorization', `Bearer ${studentToken}`);
    skillId = cur.body.units[0].lessons[0].skillId;
    const res = await request(app)
      .get(`/api/practice/next?skill=${skillId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('standard');
    problem = res.body.problem;
    expect(problem.prompt).toBeTruthy();
  });

  it('grades a wrong answer and returns scaffold steps (tutor loop)', async () => {
    const res = await request(app)
      .post(`/api/problems/${problem.id}/attempt`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ submittedLatex: '99999999' });
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(false);
  });

  it('grades the correct answer', async () => {
    const answer = await pool.query('SELECT answer_latex FROM problems WHERE id=$1', [problem.id]);
    const res = await request(app)
      .post(`/api/problems/${problem.id}/attempt`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ submittedLatex: answer.rows[0].answer_latex, hintsUsed: 1 });
    expect(res.body.correct).toBe(true);
  });

  it('checks an individual step', async () => {
    // find any problem with steps for this skill
    const p = await pool.query(
      `SELECT ps.problem_id, ps.position, ps.expected_latex FROM problem_steps ps
       JOIN problems p ON p.id = ps.problem_id WHERE p.skill_id=$1 LIMIT 1`,
      [skillId],
    );
    if (!p.rowCount) return;
    const { problem_id, position, expected_latex } = p.rows[0];
    const ok = await request(app)
      .post(`/api/problems/${problem_id}/steps/${position}/check`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ submittedLatex: expected_latex });
    expect(ok.body.correct).toBe(true);
    const bad = await request(app)
      .post(`/api/problems/${problem_id}/steps/${position}/check`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ submittedLatex: 'obviously wrong 123456' });
    expect(bad.body.correct).toBe(false);
  });

  it('moves struggling students to the modified tier', async () => {
    for (let i = 0; i < 5; i++) {
      const next = await request(app)
        .get(`/api/practice/next?skill=${skillId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      await request(app)
        .post(`/api/problems/${next.body.problem.id}/attempt`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ submittedLatex: '999999999' });
    }
    const res = await request(app)
      .get(`/api/practice/next?skill=${skillId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.body.tier).toBe('modified');
  });

  it('serves sprint problems', async () => {
    const res = await request(app)
      .get('/api/sprints/next?count=5')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBe(5);
  });

  it('assembles a review session from practiced skills', async () => {
    const res = await request(app)
      .get('/api/review/session')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBeGreaterThan(0);
  });
});

describe('exit tickets', () => {
  it('grades an exit ticket and records the result', async () => {
    const cur = await request(app)
      .get('/api/curriculum')
      .set('Authorization', `Bearer ${studentToken}`);
    const lessonId = cur.body.units[0].lessons[0].id;
    const et = await request(app)
      .get(`/api/lessons/${lessonId}/exit-ticket`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(et.status).toBe(200);
    expect(et.body.problems.length).toBeGreaterThanOrEqual(4);

    // answer the first correctly (peek at the key), the rest wrong
    const key = await pool.query('SELECT id, answer_latex FROM problems WHERE id=$1', [
      et.body.problems[0].id,
    ]);
    const answers = et.body.problems.map((p: { id: number }, i: number) => ({
      problemId: p.id,
      submittedLatex: i === 0 ? key.rows[0].answer_latex : 'wrong-42x',
    }));
    const res = await request(app)
      .post(`/api/exit-tickets/${et.body.id}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.maxScore).toBe(et.body.problems.length);
  });
});

describe('progress & FERPA scoping', () => {
  it('returns the student dashboard with streak and struggle flags', async () => {
    const res = await request(app)
      .get('/api/progress/me')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.streakDays).toBeGreaterThanOrEqual(1);
    expect(res.body.skills.length).toBeGreaterThan(0);
    expect(res.body.exitTickets.length).toBe(1);
  });

  it('lets the linked guardian view the student, read-only', async () => {
    const res = await request(app)
      .get(`/api/progress/${studentId}`)
      .set('Authorization', `Bearer ${guardianToken}`);
    expect(res.status).toBe(200);
    expect(res.body.student.displayName).toBe('Student One');
  });

  it('blocks unlinked guardians', async () => {
    const other = await request(app).post('/api/auth/register').send({
      role: 'guardian',
      username: 'stranger',
      password: 'password123',
      displayName: 'Stranger',
      email: 'stranger@example.com',
    });
    const res = await request(app)
      .get(`/api/progress/${studentId}`)
      .set('Authorization', `Bearer ${other.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks students from other students', async () => {
    const res = await request(app)
      .get(`/api/progress/${studentId + 9999}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('exports the student data', async () => {
    const res = await request(app)
      .get('/api/progress/me/export')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.attempts.length).toBeGreaterThan(0);
  });
});

describe('tutor sessions', () => {
  it('opens a session and reports availability', async () => {
    const res = await request(app)
      .post('/api/tutor/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeTruthy();
    expect(typeof res.body.available).toBe('boolean');
  });

  it('streams a fallback reply when no API key is configured', async () => {
    const open = await request(app)
      .post('/api/tutor/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});
    const res = await request(app)
      .post(`/api/tutor/sessions/${open.body.sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ message: "I don't get it" });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('data:');
  });
});
