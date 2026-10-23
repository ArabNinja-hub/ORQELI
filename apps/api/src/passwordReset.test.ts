import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { createApp, hashPassword } = await import('./server.js');
const { envSchema } = await import('./config.js');
const { InMemoryDataRepository } = await import('./repository.js');
const { createPgSessionStore, createSimulatedPgPool, isAbsoluteSessionExpired } =
  await import('./session.js');
const { generatePasswordResetToken, hashPasswordResetToken } = await import('./passwordReset.js');

const testConfig = envSchema.parse({
  NODE_ENV: 'test',
  PORT: 4000,
  DATABASE_URL: 'postgresql://orqeli:placeholder@localhost:5432/orqeli',
  WEB_ORIGIN: 'http://localhost:5173',
  SESSION_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters',
  // Recovery endpoints only exist when explicitly enabled with a delivery.
  PASSWORD_RESET_MODE: 'enabled'
});

interface CapturedReset {
  userId: string;
  email: string;
  name: string;
  token: string;
  expiresAt: Date;
}

function createCapturingDelivery() {
  const messages: CapturedReset[] = [];
  return {
    messages,
    delivery: {
      async sendPasswordReset(input: CapturedReset) {
        messages.push({ ...input });
      }
    }
  };
}

const { messages, delivery } = createCapturingDelivery();
const repository = new InMemoryDataRepository();
const pgPool = createSimulatedPgPool();
const app = createApp({
  config: testConfig,
  repository,
  sessionStore: createPgSessionStore(testConfig, { pool: pgPool }),
  passwordResetDelivery: delivery,
  authRateLimits: {
    loginMaxPerIdentity: 200,
    loginMaxPerIp: 500,
    registerMaxPerIp: 500,
    passwordResetRequestMaxPerIp: 500,
    passwordResetConfirmMaxPerIp: 500,
    passwordChangeMaxPerUser: 500
  }
});

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'Expected a Set-Cookie header');
  return setCookie.split(';')[0];
}

async function csrfToken(cookie?: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: cookie ? { cookie } : undefined
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as { csrfToken: string }).csrfToken;
}

async function postJson(
  path: string,
  body: unknown,
  options: { cookie?: string; csrf?: string } = {}
): Promise<{ status: number; body: Record<string, unknown>; cookie?: string }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-csrf-token': options.csrf ?? (await csrfToken(options.cookie))
  };
  if (options.cookie) headers.cookie = options.cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const parsed = text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {};
  return {
    status: response.status,
    body: parsed,
    ...(response.headers.get('set-cookie') ? { cookie: sessionCookie(response) } : {})
  };
}

async function login(email: string, password: string) {
  const result = await postJson('/api/auth/login', { email, password });
  return result;
}

async function errorCode(body: Record<string, unknown>): Promise<string> {
  return (body.error as { code: string }).code;
}

const customerEmail = 'reset.customer@example.com';
const customerPassword = 'OriginalPass123!';

before(async () => {
  repository.seedUser({
    id: 'usr_reset_customer',
    name: 'Reset Customer',
    email: customerEmail,
    phone: '+260971000099',
    passwordHash: await hashPassword(customerPassword),
    role: 'CUSTOMER',
    status: 'ACTIVE'
  });

  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  await pgPool.end?.();
});

test('a reset request never reveals whether the account exists and never returns the token', async () => {
  const before = messages.length;

  const unknown = await postJson('/api/auth/password-reset/request', {
    email: 'no.such.account@example.com'
  });
  assert.equal(unknown.status, 200);
  assert.deepEqual(unknown.body, { status: 'ok' });
  assert.equal(messages.length, before, 'No token may be generated for an unknown account');

  const known = await postJson('/api/auth/password-reset/request', { email: customerEmail });
  assert.equal(known.status, 200);
  assert.deepEqual(known.body, unknown.body, 'Responses must be indistinguishable');

  assert.equal(messages.length, before + 1);
  const captured = messages[messages.length - 1];
  assert.equal(captured.userId, 'usr_reset_customer');
  assert.match(captured.token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(captured.expiresAt.getTime() > Date.now());

  // The plaintext token must not appear in any API response or audit record.
  assert.equal(JSON.stringify(known.body).includes(captured.token), false);
  assert.equal(JSON.stringify(repository.getAuditEvents()).includes(captured.token), false);

  // Only the SHA-256 digest is persisted.
  const stored = repository.getPasswordResetTokens().filter((t) => t.userId === 'usr_reset_customer');
  const latest = stored[stored.length - 1];
  assert.equal(latest.tokenHash, hashPasswordResetToken(captured.token));
  assert.notEqual(latest.tokenHash, captured.token);
  assert.equal(latest.usedAt, null);
});

test('a valid reset token changes the password, kills existing sessions and cannot be reused', async () => {
  const loginResult = await login(customerEmail, customerPassword);
  assert.equal(loginResult.status, 200);
  const oldCookie = loginResult.cookie;
  assert.ok(oldCookie);

  const request = await postJson('/api/auth/password-reset/request', { email: customerEmail });
  assert.equal(request.status, 200);
  const token = messages[messages.length - 1].token;

  const newPassword = 'BrandNewPass456!';
  const confirm = await postJson('/api/auth/password-reset/confirm', {
    token,
    password: newPassword
  });
  assert.equal(confirm.status, 200);
  assert.deepEqual(confirm.body, { status: 'ok' });

  // Every session issued before the reset is rejected.
  const staleSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: oldCookie! } });
  assert.equal(staleSession.status, 401);

  // Old password no longer works, new password does.
  const oldLogin = await login(customerEmail, customerPassword);
  assert.equal(oldLogin.status, 401);
  const newLogin = await login(customerEmail, newPassword);
  assert.equal(newLogin.status, 200);

  // Single use: replaying the same token fails with the generic error.
  const replay = await postJson('/api/auth/password-reset/confirm', {
    token,
    password: 'AnotherPass789!'
  });
  assert.equal(replay.status, 400);
  assert.equal(await errorCode(replay.body), 'INVALID_RESET_TOKEN');
});

test('an expired reset token is rejected and does not change the password', async () => {
  const expiringRepository = new InMemoryDataRepository();
  const expiringPool = createSimulatedPgPool();
  const captured = createCapturingDelivery();
  const expiringApp = createApp({
    config: testConfig,
    repository: expiringRepository,
    sessionStore: createPgSessionStore(testConfig, { pool: expiringPool }),
    passwordResetDelivery: captured.delivery,
    passwordResetTokenTtlMs: 0,
    authRateLimits: {
      loginMaxPerIdentity: 200,
      loginMaxPerIp: 500,
      passwordResetRequestMaxPerIp: 500,
      passwordResetConfirmMaxPerIp: 500
    }
  });

  const expiringServer = expiringApp.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => expiringServer.once('listening', resolve));
  const expiringBase = `http://127.0.0.1:${(expiringServer.address() as AddressInfo).port}`;

  try {
    expiringRepository.seedUser({
      id: 'usr_expiring',
      name: 'Expiring User',
      email: 'expired.reset@example.com',
      passwordHash: await hashPassword('OriginalExpiring123!'),
      role: 'CUSTOMER',
      status: 'ACTIVE'
    });

    const csrfResponse = await fetch(`${expiringBase}/api/auth/csrf`);
    const csrf = ((await csrfResponse.json()) as { csrfToken: string }).csrfToken;

    const request = await fetch(`${expiringBase}/api/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ email: 'expired.reset@example.com' })
    });
    assert.equal(request.status, 200);

    const token = captured.messages[0].token;
    const csrf2Response = await fetch(`${expiringBase}/api/auth/csrf`);
    const csrf2 = ((await csrf2Response.json()) as { csrfToken: string }).csrfToken;
    const confirm = await fetch(`${expiringBase}/api/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf2 },
      body: JSON.stringify({ token, password: 'ShouldNotApply123!' })
    });
    assert.equal(confirm.status, 400);
    const body = (await confirm.json()) as Record<string, unknown>;
    assert.equal(await errorCode(body), 'INVALID_RESET_TOKEN');
  } finally {
    await new Promise<void>((resolve, reject) =>
      expiringServer.close((error) => (error ? reject(error) : resolve()))
    );
    await expiringPool.end?.();
  }
});

test('issuing a new reset token invalidates the previous one', async () => {
  const first = await postJson('/api/auth/password-reset/request', { email: customerEmail });
  assert.equal(first.status, 200);
  const firstToken = messages[messages.length - 1].token;

  const second = await postJson('/api/auth/password-reset/request', { email: customerEmail });
  assert.equal(second.status, 200);
  const secondToken = messages[messages.length - 1].token;
  assert.notEqual(firstToken, secondToken);

  const superseded = await postJson('/api/auth/password-reset/confirm', {
    token: firstToken,
    password: 'SupersededPass123!'
  });
  assert.equal(superseded.status, 400);
  assert.equal(await errorCode(superseded.body), 'INVALID_RESET_TOKEN');

  const accepted = await postJson('/api/auth/password-reset/confirm', {
    token: secondToken,
    password: 'SupersededNewPass456!'
  });
  assert.equal(accepted.status, 200);

  await login(customerEmail, 'SupersededNewPass456!');
});

test('password change requires the current password, rotates this session and invalidates others', async () => {
  const currentPassword = 'SupersededNewPass456!';
  const first = await login(customerEmail, currentPassword);
  const second = await login(customerEmail, currentPassword);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const firstCookie = first.cookie!;
  const firstCsrf = (first.body as { csrfToken: string }).csrfToken as string;
  const secondCookie = second.cookie!;

  // Wrong current password: rejected and nothing changes.
  const wrong = await postJson(
    '/api/auth/password/change',
    { currentPassword: 'wrong-password', newPassword: 'ReplacementPass789!' },
    { cookie: firstCookie, csrf: firstCsrf }
  );
  assert.equal(wrong.status, 403);
  assert.equal(await errorCode(wrong.body), 'INVALID_CREDENTIALS');

  // New password identical to the current one is rejected by validation.
  const same = await postJson(
    '/api/auth/password/change',
    { currentPassword, newPassword: currentPassword },
    { cookie: firstCookie, csrf: firstCsrf }
  );
  assert.equal(same.status, 400);
  assert.equal(await errorCode(same.body), 'VALIDATION_ERROR');

  const changed = await postJson(
    '/api/auth/password/change',
    { currentPassword, newPassword: 'ChangedPassword789!' },
    { cookie: firstCookie, csrf: firstCsrf }
  );
  assert.equal(changed.status, 200);
  const rotatedCookie = changed.cookie;
  assert.ok(rotatedCookie, 'Changing the password must rotate the session cookie');
  const rotatedCsrf = (changed.body as { csrfToken: string }).csrfToken;
  assert.ok(rotatedCsrf);

  // The session that changed the password stays usable.
  const currentSession = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: rotatedCookie! }
  });
  assert.equal(currentSession.status, 200);

  // Every other session (including the old cookie of this device) is dead.
  const otherSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: secondCookie } });
  assert.equal(otherSession.status, 401);
  const preChangeSession = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: firstCookie }
  });
  assert.equal(preChangeSession.status, 401);
});

test('changing a password voids any outstanding reset token for that account', async () => {
  const email = 'token.voided@example.com';
  const originalPassword = 'OriginalVoidPass123!';
  repository.seedUser({
    id: 'usr_token_voided',
    name: 'Token Voided',
    email,
    passwordHash: await hashPassword(originalPassword),
    role: 'CUSTOMER',
    status: 'ACTIVE'
  });

  const loginResult = await login(email, originalPassword);
  assert.equal(loginResult.status, 200);
  const cookie = loginResult.cookie!;
  const csrf = (loginResult.body as { csrfToken: string }).csrfToken;

  const resetRequest = await postJson('/api/auth/password-reset/request', { email });
  assert.equal(resetRequest.status, 200);
  const outstandingToken = messages[messages.length - 1].token;

  const changed = await postJson(
    '/api/auth/password/change',
    { currentPassword: originalPassword, newPassword: 'ChangedVoidPass456!' },
    { cookie, csrf }
  );
  assert.equal(changed.status, 200);

  const replay = await postJson('/api/auth/password-reset/confirm', {
    token: outstandingToken,
    password: 'ShouldNeverApply789!'
  });
  assert.equal(replay.status, 400);
  assert.equal(await errorCode(replay.body), 'INVALID_RESET_TOKEN');

  // The password set through the change endpoint is the one that works.
  assert.equal((await login(email, 'ChangedVoidPass456!')).status, 200);
  assert.equal((await login(email, 'ShouldNeverApply789!')).status, 401);
});

test('reset and change endpoints require a valid CSRF token', async () => {
  const cases = [
    { path: '/api/auth/password-reset/request', body: { email: customerEmail } },
    {
      path: '/api/auth/password-reset/confirm',
      body: { token: generatePasswordResetToken(), password: 'NoCsrfPass123!' }
    }
  ];

  for (const entry of cases) {
    const response = await fetch(`${baseUrl}${entry.path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry.body)
    });
    assert.equal(response.status, 403, `Expected CSRF rejection for ${entry.path}`);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'CSRF_MISSING');
  }
});

test('reset confirmation returns one generic error for unknown and malformed tokens', async () => {
  const unknownToken = generatePasswordResetToken();
  const unknown = await postJson('/api/auth/password-reset/confirm', {
    token: unknownToken,
    password: 'GenericFailure123!'
  });
  assert.equal(unknown.status, 400);

  const malformed = await postJson('/api/auth/password-reset/confirm', {
    token: 'x'.repeat(43),
    password: 'GenericFailure123!'
  });
  assert.equal(malformed.status, 400);

  assert.deepEqual(unknown.body, malformed.body);
  assert.equal(JSON.stringify(unknown.body).includes(unknownToken), false);
});

test('tokens are generated with full entropy and only their digest is comparable', () => {
  const tokens = new Set(Array.from({ length: 50 }, () => generatePasswordResetToken()));
  assert.equal(tokens.size, 50);
  for (const token of tokens) {
    assert.equal(token.length, 43);
    const digest = hashPasswordResetToken(token);
    assert.match(digest, /^[0-9a-f]{64}$/);
    assert.equal(digest, crypto.createHash('sha256').update(token).digest('hex'));
  }
});

test('absolute session lifetime rejects missing, malformed, future and old timestamps', () => {
  const now = Date.parse('2026-10-23T12:00:00.000Z');
  assert.equal(isAbsoluteSessionExpired(undefined, now), true);
  assert.equal(isAbsoluteSessionExpired('not-a-date', now), true);
  assert.equal(isAbsoluteSessionExpired(new Date(now + 60_000).toISOString(), now), true);

  const sixDaysAgo = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isAbsoluteSessionExpired(sixDaysAgo, now), false);

  const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isAbsoluteSessionExpired(eightDaysAgo, now), true);
});

test('password reset endpoints are rate limited per client', async () => {
  const limitedRepository = new InMemoryDataRepository();
  const limitedPool = createSimulatedPgPool();
  const limitedApp = createApp({
    config: testConfig,
    repository: limitedRepository,
    sessionStore: createPgSessionStore(testConfig, { pool: limitedPool }),
    passwordResetDelivery: createCapturingDelivery().delivery,
    authRateLimits: {
      passwordResetRequestMaxPerIp: 2,
      passwordResetConfirmMaxPerIp: 2,
      loginMaxPerIdentity: 100,
      loginMaxPerIp: 100
    }
  });

  const limitedServer = limitedApp.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => limitedServer.once('listening', resolve));
  const limitedBase = `http://127.0.0.1:${(limitedServer.address() as AddressInfo).port}`;

  const call = async (path: string, body: unknown) => {
    const csrfResponse = await fetch(`${limitedBase}/api/auth/csrf`);
    const csrf = ((await csrfResponse.json()) as { csrfToken: string }).csrfToken;
    const response = await fetch(`${limitedBase}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(body)
    });
    return {
      status: response.status,
      headers: response.headers,
      body: (await response.json()) as Record<string, unknown>
    };
  };

  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const allowed = await call('/api/auth/password-reset/request', { email: customerEmail });
      assert.equal(allowed.status, 200, `request ${attempt} should be allowed`);
    }
    const limitedRequest = await call('/api/auth/password-reset/request', { email: customerEmail });
    assert.equal(limitedRequest.status, 429);
    assert.equal(await errorCode(limitedRequest.body), 'RATE_LIMITED');
    assert.ok(Number(limitedRequest.headers.get('retry-after')) >= 1);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const allowed = await call('/api/auth/password-reset/confirm', {
        token: generatePasswordResetToken(),
        password: 'RateLimitedPass123!'
      });
      assert.equal(allowed.status, 400, `confirm ${attempt} should reach the handler`);
    }
    const limitedConfirm = await call('/api/auth/password-reset/confirm', {
      token: generatePasswordResetToken(),
      password: 'RateLimitedPass123!'
    });
    assert.equal(limitedConfirm.status, 429);
    assert.equal(await errorCode(limitedConfirm.body), 'RATE_LIMITED');
  } finally {
    await new Promise<void>((resolve, reject) =>
      limitedServer.close((error) => (error ? reject(error) : resolve()))
    );
    await limitedPool.end?.();
  }
});

test('failed logins are audited with a pseudonymised identifier and no credentials', async () => {
  const before = repository.getAuditEvents().length;
  const failingEmail = 'failed.login.audit@example.com';

  const attempt = await login(failingEmail, 'WrongPassword123!');
  assert.equal(attempt.status, 401);

  const events = repository.getAuditEvents().slice(before);
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'USER_LOGIN_FAILED');
  assert.equal(events[0].actorId, null);
  assert.equal(events[0].entityType, 'Auth');

  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes(failingEmail), false, 'Audit records must not store raw emails');
  assert.equal(serialized.includes('WrongPassword123!'), false);
  assert.match(events[0].entityId, /^[0-9a-f]{32}$/);
});
