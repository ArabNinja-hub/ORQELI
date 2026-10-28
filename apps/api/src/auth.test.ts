import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import session from 'express-session';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { envSchema } = await import('./config.js');
const { createApp, hashPassword } = await import('./server.js');
const { InMemoryEducationRepository } = await import('./repository.js');
const {
  createPgSessionStore,
  createSessionMiddleware,
  createSimulatedPgPool,
  getSessionCookieOptions
} = await import('./session.js');

const WEB_ORIGIN = 'http://localhost:5173';
const activeServers: Array<ReturnType<ReturnType<typeof createApp>['listen']>> = [];

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!;
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }
});

async function setupAuthHarness() {
  const config = envSchema.parse({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://orqeli:placeholder@localhost:5432/orqeli',
    SESSION_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters',
    WEB_ORIGIN
  });
  const repo = new InMemoryEducationRepository();
  const pool = createSimulatedPgPool();
  const sessionStore = createPgSessionStore(config, { pool });
  const app = createApp({ config, repository: repo, sessionStore });

  const server = app.listen(0, '127.0.0.1');
  activeServers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const passwordHash = await hashPassword('CorrectPass123!');
  const school = repo.seedSchool({
    id: 'sch_auth_1',
    code: 'SYN-AUTH-01',
    name: 'Auth Test School (Synthetic)',
    sector: 'GOVERNMENT',
    province: 'Lusaka',
    district: 'Lusaka'
  });
  const activeTeacher = repo.seedUser({
    id: 'usr_teacher_1',
    email: 'teacher@synthetic.orqeli.invalid',
    name: 'Synthetic Teacher',
    passwordHash,
    status: 'ACTIVE'
  });
  repo.seedMembership({
    schoolId: school.id,
    userId: activeTeacher.id,
    role: 'TEACHER',
    staffCode: 'SYN-T-01'
  });

  repo.seedUser({
    id: 'usr_disabled',
    email: 'disabled@synthetic.orqeli.invalid',
    name: 'Disabled Staff',
    passwordHash,
    status: 'DISABLED'
  });

  return { baseUrl, repo, pool, config, activeTeacher };
}

async function fetchCsrf(baseUrl: string, cookie?: string): Promise<{ token: string; cookie: string }> {
  const res = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { origin: WEB_ORIGIN, ...(cookie ? { cookie } : {}) }
  });
  const setCookie = res.headers.get('set-cookie')?.split(';')[0] ?? cookie ?? '';
  const body = (await res.json()) as { csrfToken: string };
  return { token: body.csrfToken, cookie: setCookie };
}

test('login normalizes email, regenerates session ID, sets HttpOnly cookie, and omits passwordHash', async () => {
  const { baseUrl } = await setupAuthHarness();
  const { token } = await fetchCsrf(baseUrl);

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: WEB_ORIGIN,
      'x-csrf-token': token
    },
    body: JSON.stringify({
      email: '  TEACHER@SYNTHETIC.ORQELI.INVALID  ',
      password: 'CorrectPass123!'
    })
  });

  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);

  const payload = (await loginRes.json()) as {
    user: Record<string, unknown>;
    memberships: Array<{ role: string; schoolId: string }>;
    csrfToken: string;
  };
  assert.equal(payload.user.email, 'teacher@synthetic.orqeli.invalid');
  assert.equal('passwordHash' in payload.user, false);
  assert.equal(payload.memberships.length, 1);
  assert.equal(payload.memberships[0].role, 'TEACHER');

  const sessionCookie = setCookie.split(';')[0]!;
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: sessionCookie }
  });
  assert.equal(meRes.status, 200);
});

test('incorrect password and unknown email return a generic 401 INVALID_CREDENTIALS error', async () => {
  const { baseUrl } = await setupAuthHarness();
  const { token } = await fetchCsrf(baseUrl);

  for (const body of [
    { email: 'teacher@synthetic.orqeli.invalid', password: 'WrongPassword!' },
    { email: 'nobody@synthetic.orqeli.invalid', password: 'CorrectPass123!' }
  ]) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: WEB_ORIGIN,
        'x-csrf-token': token
      },
      body: JSON.stringify(body)
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), {
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
    });
  }
});

test('disabled accounts are rejected at login, and logout destroys the server-side session', async () => {
  const { baseUrl, pool } = await setupAuthHarness();
  const { token } = await fetchCsrf(baseUrl);

  const disabledRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: WEB_ORIGIN,
      'x-csrf-token': token
    },
    body: JSON.stringify({
      email: 'disabled@synthetic.orqeli.invalid',
      password: 'CorrectPass123!'
    })
  });
  assert.equal(disabledRes.status, 403);

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: WEB_ORIGIN,
      'x-csrf-token': token
    },
    body: JSON.stringify({
      email: 'teacher@synthetic.orqeli.invalid',
      password: 'CorrectPass123!'
    })
  });
  const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]!;
  const { csrfToken: sessionCsrf } = (await loginRes.json()) as { csrfToken: string };
  assert.equal(pool.inspectSessions().size, 1);

  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: WEB_ORIGIN,
      cookie,
      'x-csrf-token': sessionCsrf
    },
    body: '{}'
  });
  assert.equal(logoutRes.status, 200);
  assert.equal(pool.inspectSessions().size, 0);

  const replayMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
  assert.equal(replayMe.status, 401);
});

test('CSRF protection rejects missing tokens, cross-origin mutations, form posts, and anonymous token replay', async () => {
  const { baseUrl } = await setupAuthHarness();
  const { token: anonCsrf } = await fetchCsrf(baseUrl);

  // Missing CSRF header -> 403 CSRF_MISSING
  const missingToken = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: WEB_ORIGIN },
    body: JSON.stringify({ email: 'teacher@synthetic.orqeli.invalid', password: 'CorrectPass123!' })
  });
  assert.equal(missingToken.status, 403);
  assert.equal(((await missingToken.json()) as { error: { code: string } }).error.code, 'CSRF_MISSING');

  // Cross-origin request -> 403 CSRF_REJECTED
  const crossOrigin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://evil.example',
      'x-csrf-token': anonCsrf
    },
    body: JSON.stringify({ email: 'teacher@synthetic.orqeli.invalid', password: 'CorrectPass123!' })
  });
  assert.equal(crossOrigin.status, 403);

  // Authenticate, then attempt logout using pre-login anonymous CSRF token -> 403 CSRF_INVALID
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: WEB_ORIGIN,
      'x-csrf-token': anonCsrf
    },
    body: JSON.stringify({ email: 'teacher@synthetic.orqeli.invalid', password: 'CorrectPass123!' })
  });
  const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]!;

  const anonReplay = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: WEB_ORIGIN,
      cookie,
      'x-csrf-token': anonCsrf
    },
    body: '{}'
  });
  assert.equal(anonReplay.status, 403);
  assert.equal(((await anonReplay.json()) as { error: { code: string } }).error.code, 'CSRF_INVALID');
});

test('production session configuration prohibits MemoryStore and enforces Secure cookies', () => {
  const prodConfig = envSchema.parse({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://orqeli:realpass@localhost:5432/orqeli',
    SESSION_SECRET: 'production-grade-random-secret-value-at-least-32-chars',
    WEB_ORIGIN: 'https://schools.orqeli.zm'
  });

  assert.equal(getSessionCookieOptions(prodConfig).secure, true);
  assert.equal(getSessionCookieOptions(prodConfig).httpOnly, true);
  assert.throws(
    () => createSessionMiddleware(prodConfig, new session.MemoryStore()),
    /prohibited in production/
  );
});
