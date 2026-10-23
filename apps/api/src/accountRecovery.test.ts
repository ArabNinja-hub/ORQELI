import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { createApp, hashPassword } = await import('./server.js');
const { envSchema } = await import('./config.js');
const { InMemoryDataRepository } = await import('./repository.js');
const { createPgSessionStore, createSimulatedPgPool } = await import('./session.js');
const { hashPasswordResetToken, generatePasswordResetToken } = await import('./passwordReset.js');

const BASE_ENV = {
  NODE_ENV: 'test' as const,
  PORT: 4000,
  DATABASE_URL: 'postgresql://orqeli:placeholder@localhost:5432/orqeli',
  WEB_ORIGIN: 'http://localhost:5173',
  SESSION_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters'
};

interface ResetMessage {
  userId: string;
  email: string;
  name: string;
  token: string;
  expiresAt: Date;
}

const servers: Server[] = [];
const pools: { end?: () => Promise<void> }[] = [];

async function closeAll(): Promise<void> {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
  for (const pool of pools.splice(0)) {
    await pool.end?.();
  }
}

after(closeAll);

interface Harness {
  baseUrl: string;
  repository: InstanceType<typeof InMemoryDataRepository>;
  messages: ResetMessage[];
}

async function startHarness(options: {
  repository?: InstanceType<typeof InMemoryDataRepository>;
  passwordReset?: 'enabled' | 'disabled';
  withDelivery?: boolean;
  passwordResetTokenPruneIntervalMs?: number;
  passwordResetTokenPruneLimit?: number;
  authRateLimits?: Record<string, number>;
} = {}): Promise<Harness> {
  const config = envSchema.parse({
    ...BASE_ENV,
    PASSWORD_RESET_MODE: options.passwordReset ?? 'enabled'
  });
  const repository = options.repository ?? new InMemoryDataRepository();
  const pool = createSimulatedPgPool();
  pools.push(pool);

  const messages: ResetMessage[] = [];
  const withDelivery = options.withDelivery ?? true;
  const app = createApp({
    config,
    repository,
    sessionStore: createPgSessionStore(config, { pool }),
    ...(withDelivery
      ? {
          passwordResetDelivery: {
            async sendPasswordReset(input: ResetMessage) {
              messages.push({ ...input });
            }
          }
        }
      : {}),
    ...(options.passwordResetTokenPruneIntervalMs === undefined
      ? {}
      : { passwordResetTokenPruneIntervalMs: options.passwordResetTokenPruneIntervalMs }),
    ...(options.passwordResetTokenPruneLimit === undefined
      ? {}
      : { passwordResetTokenPruneLimit: options.passwordResetTokenPruneLimit }),
    authRateLimits: {
      loginMaxPerIdentity: 500,
      loginMaxPerIp: 500,
      registerMaxPerIp: 500,
      passwordResetRequestMaxPerIp: 500,
      passwordResetConfirmMaxPerIp: 500,
      passwordChangeMaxPerUser: 500,
      ...(options.authRateLimits ?? {})
    }
  });

  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return { baseUrl, repository, messages };
}

function cookieOf(response: Response): string | undefined {
  const header = response.headers.get('set-cookie');
  return header ? header.split(';')[0] : undefined;
}

async function csrfToken(baseUrl: string, cookie?: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: cookie ? { cookie } : undefined
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as { csrfToken: string }).csrfToken;
}

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
  options: { cookie?: string; csrf?: string } = {}
): Promise<{ status: number; body: Record<string, unknown>; cookie?: string }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-csrf-token': options.csrf ?? (await csrfToken(baseUrl, options.cookie))
  };
  if (options.cookie) headers.cookie = options.cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {},
    ...(cookieOf(response) ? { cookie: cookieOf(response) } : {})
  };
}

function errorCode(body: Record<string, unknown>): string {
  return (body.error as { code: string }).code;
}

const CUSTOMER_EMAIL = 'stale.session@example.com';
const CUSTOMER_PASSWORD = 'OriginalSessionPass123!';

function seedCustomer(
  repository: InstanceType<typeof InMemoryDataRepository>,
  overrides: { id?: string; email?: string; password?: string; status?: 'ACTIVE' | 'DISABLED' } = {}
) {
  const email = overrides.email ?? CUSTOMER_EMAIL;
  const password = overrides.password ?? CUSTOMER_PASSWORD;
  return hashPassword(password).then((passwordHash) => {
    repository.seedUser({
      id: overrides.id ?? 'usr_stale_session',
      name: 'Stale Session',
      email,
      passwordHash,
      role: 'CUSTOMER',
      status: overrides.status ?? 'ACTIVE'
    });
    return { email, password };
  });
}

// ---------------------------------------------------------------------------
// F1: an invalidated session must never turn login/registration into a 500
// ---------------------------------------------------------------------------

test('re-login succeeds after a password reset invalidated the browser session', async () => {
  const harness = await startHarness();
  const repository = harness.repository;
  await seedCustomer(repository);

  const firstLogin = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD
  });
  assert.equal(firstLogin.status, 200);
  const staleCookie = firstLogin.cookie!;

  const resetRequest = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: CUSTOMER_EMAIL
  });
  assert.equal(resetRequest.status, 200);
  const token = harness.messages[harness.messages.length - 1].token;

  const confirm = await postJson(harness.baseUrl, '/api/auth/password-reset/confirm', {
    token,
    password: 'ResetSessionPass456!'
  });
  assert.equal(confirm.status, 200);

  // The same browser now has a dead cookie. Logging back in must work, not 500.
  const relogin = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: 'ResetSessionPass456!'
  }, { cookie: staleCookie });

  assert.equal(relogin.status, 200, 'login with an invalidated cookie must succeed');
  assert.ok(relogin.cookie, 'a fresh session cookie must be issued');

  const me = await fetch(`${harness.baseUrl}/api/auth/me`, {
    headers: { cookie: relogin.cookie! }
  });
  assert.equal(me.status, 200);
});

test('re-login succeeds after a password change invalidated another browser session', async () => {
  const harness = await startHarness();
  await seedCustomer(harness.repository);

  const sessionA = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD
  });
  const sessionB = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD
  });
  assert.equal(sessionA.status, 200);
  assert.equal(sessionB.status, 200);

  const changed = await postJson(
    harness.baseUrl,
    '/api/auth/password/change',
    { currentPassword: CUSTOMER_PASSWORD, newPassword: 'ChangedSessionPass789!' },
    { cookie: sessionA.cookie!, csrf: (sessionA.body as { csrfToken: string }).csrfToken }
  );
  assert.equal(changed.status, 200);

  const relogin = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: 'ChangedSessionPass789!'
  }, { cookie: sessionB.cookie! });

  assert.equal(relogin.status, 200, 'login with the invalidated other-device cookie must succeed');
  assert.ok(relogin.cookie);
});

test('registration succeeds from a browser holding an invalidated session', async () => {
  const harness = await startHarness();
  await seedCustomer(harness.repository);

  const login = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD
  });
  const staleCookie = login.cookie!;
  const staleCsrf = (login.body as { csrfToken: string }).csrfToken;

  // Out-of-band credential change kills the session.
  await harness.repository.changePassword({
    userId: 'usr_stale_session',
    passwordHash: await hashPassword('AnotherNewPass321!')
  });

  const registration = await postJson(
    harness.baseUrl,
    '/api/auth/register',
    { name: 'Fresh Person', email: 'fresh.person@example.com', password: 'FreshPersonPass123!' },
    { cookie: staleCookie, csrf: staleCsrf }
  );

  assert.equal(registration.status, 201, 'registration with a dead session cookie must succeed');
  assert.ok(registration.cookie);
});

test('a suspended account cannot log in with a dead cookie, but never gets a 500', async () => {
  const harness = await startHarness();
  await seedCustomer(harness.repository);

  const login = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD
  });
  const staleCookie = login.cookie!;

  // Administrative suspension invalidates the session on the next request.
  await harness.repository.updateUserStatusForAdmin(
    { id: 'usr_admin_actor', role: 'ADMIN' },
    'usr_stale_session',
    'SUSPENDED'
  );

  const relogin = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD
  }, { cookie: staleCookie });

  assert.equal(relogin.status, 403);
  assert.equal(errorCode(relogin.body), 'ACCOUNT_INACTIVE');
});

test('a destroyed session is never resurrected for the caller', async () => {
  const harness = await startHarness();
  await seedCustomer(harness.repository);

  const login = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD
  });
  const staleCookie = login.cookie!;

  await harness.repository.changePassword({
    userId: 'usr_stale_session',
    passwordHash: await hashPassword('YetAnotherPass654!')
  });

  const me = await fetch(`${harness.baseUrl}/api/auth/me`, { headers: { cookie: staleCookie } });
  assert.equal(me.status, 401);
});

// ---------------------------------------------------------------------------
// F3: an unavailable delivery is an explicit unavailable state
// ---------------------------------------------------------------------------

test('password reset answers 503 when recovery is disabled', async () => {
  const harness = await startHarness({ passwordReset: 'disabled', withDelivery: false });
  await seedCustomer(harness.repository);

  const request = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: CUSTOMER_EMAIL
  });
  assert.equal(request.status, 503);
  assert.equal(errorCode(request.body), 'PASSWORD_RESET_UNAVAILABLE');

  const confirm = await postJson(harness.baseUrl, '/api/auth/password-reset/confirm', {
    token: generatePasswordResetToken(),
    password: 'ShouldNotApply123!'
  });
  assert.equal(confirm.status, 503);
  assert.equal(errorCode(confirm.body), 'PASSWORD_RESET_UNAVAILABLE');

  // No token may be created or delivered while recovery is unavailable.
  assert.equal(harness.messages.length, 0);
  assert.equal(harness.repository.getPasswordResetTokens().length, 0);
});

test('disabling recovery does not affect the rest of authentication', async () => {
  const harness = await startHarness({ passwordReset: 'disabled', withDelivery: false });
  await seedCustomer(harness.repository);

  const login = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD
  });
  assert.equal(login.status, 200);
});

test('enabling recovery without a delivery implementation fails fast in production', async () => {
  const config = envSchema.parse({
    ...BASE_ENV,
    NODE_ENV: 'production',
    PASSWORD_RESET_MODE: 'enabled'
  });
  const pool = createSimulatedPgPool();
  try {
    assert.throws(
      () =>
        createApp({
          config,
          repository: new InMemoryDataRepository(),
          sessionStore: createPgSessionStore(config, { pool })
        }),
      /PasswordResetDelivery/
    );
  } finally {
    await pool.end?.();
  }
});

test('outside production an enabled mode without a delivery degrades to unavailable', async () => {
  const harness = await startHarness({ passwordReset: 'enabled', withDelivery: false });
  await seedCustomer(harness.repository);

  const health = await fetch(`${harness.baseUrl}/api/health`);
  assert.equal(((await health.json()) as { passwordReset: string }).passwordReset, 'disabled');

  const request = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: CUSTOMER_EMAIL
  });
  assert.equal(request.status, 503);
  assert.equal(errorCode(request.body), 'PASSWORD_RESET_UNAVAILABLE');
});

test('health reports the recovery state and readiness checks the database', async () => {
  const enabled = await startHarness();
  const enabledHealth = await fetch(`${enabled.baseUrl}/api/health`);
  assert.equal(enabledHealth.status, 200);
  assert.equal(
    ((await enabledHealth.json()) as { passwordReset: string }).passwordReset,
    'enabled'
  );

  const ready = await fetch(`${enabled.baseUrl}/api/health/ready`);
  assert.equal(ready.status, 200);
  const readyBody = (await ready.json()) as { status: string; checks: Record<string, string> };
  assert.equal(readyBody.status, 'ready');
  assert.equal(readyBody.checks.database, 'ok');
  assert.equal(readyBody.checks.passwordReset, 'enabled');

  const disabled = await startHarness({ passwordReset: 'disabled', withDelivery: false });
  const disabledHealth = await fetch(`${disabled.baseUrl}/api/health`);
  assert.equal(
    ((await disabledHealth.json()) as { passwordReset: string }).passwordReset,
    'disabled'
  );
  const disabledReady = await fetch(`${disabled.baseUrl}/api/health/ready`);
  assert.equal(disabledReady.status, 200);
  assert.equal(
    ((await disabledReady.json()) as { checks: Record<string, string> }).checks.passwordReset,
    'disabled'
  );
});

test('readiness fails closed when the repository is unreachable', async () => {
  class UnreachableRepository extends InMemoryDataRepository {
    override async ping(): Promise<boolean> {
      throw new Error('connection refused');
    }
  }

  const harness = await startHarness({ repository: new UnreachableRepository() });
  const ready = await fetch(`${harness.baseUrl}/api/health/ready`);
  assert.equal(ready.status, 503);
  const body = (await ready.json()) as { status: string; checks: Record<string, string> };
  assert.equal(body.status, 'not_ready');
  assert.equal(body.checks.database, 'unavailable');

  // Liveness stays up: the process itself is healthy.
  const health = await fetch(`${harness.baseUrl}/api/health`);
  assert.equal(health.status, 200);
});

// ---------------------------------------------------------------------------
// F5: database/audit failures must not become an account-existence oracle
// ---------------------------------------------------------------------------

test('a token-storage failure still returns the generic response and leaks nothing', async () => {
  class FailingTokenRepository extends InMemoryDataRepository {
    override async createPasswordResetToken(): Promise<void> {
      throw new Error('insert failed: relation "PasswordResetToken" does not exist');
    }
  }

  const harness = await startHarness({ repository: new FailingTokenRepository() });
  await seedCustomer(harness.repository);

  const known = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: CUSTOMER_EMAIL
  });
  const unknown = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: 'nobody.at.all@example.com'
  });

  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(known.body, unknown.body, 'failure must not distinguish existing accounts');
  assert.equal(harness.messages.length, 0, 'no token may be delivered when storage failed');
});

test('an audit-write failure does not block delivery or change the response', async () => {
  class FailingAuditRepository extends InMemoryDataRepository {
    override async recordAuditEvent(): Promise<void> {
      throw new Error('audit insert failed');
    }
  }

  const harness = await startHarness({ repository: new FailingAuditRepository() });
  await seedCustomer(harness.repository);

  const request = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: CUSTOMER_EMAIL
  });
  assert.equal(request.status, 200);
  assert.equal(harness.messages.length, 1, 'delivery must still happen');
});

// ---------------------------------------------------------------------------
// F6: bounded cleanup of expired/consumed reset tokens
// ---------------------------------------------------------------------------

test('expired and consumed tokens are pruned, live tokens are kept, and work is bounded', async () => {
  const harness = await startHarness({
    passwordResetTokenPruneIntervalMs: 0,
    passwordResetTokenPruneLimit: 3
  });
  const repository = harness.repository;
  await seedCustomer(repository);

  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 30 * 60_000);

  for (let index = 0; index < 5; index += 1) {
    await repository.createPasswordResetToken({
      userId: 'usr_stale_session',
      tokenHash: `expired-${index}`,
      expiresAt: past
    });
  }
  await repository.createPasswordResetToken({
    userId: 'usr_stale_session',
    tokenHash: 'live-token',
    expiresAt: future
  });

  const before = repository.getPasswordResetTokens().length;
  assert.equal(before, 6);

  const response = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: 'unknown.person@example.com'
  });
  assert.equal(response.status, 200);

  const remaining = repository.getPasswordResetTokens();
  // Three expired rows were deleted (the configured bound), the live row survives.
  assert.equal(remaining.length, 3);
  assert.deepEqual(
    remaining.map((token) => token.tokenHash),
    ['expired-3', 'expired-4', 'live-token']
  );
  assert.ok(remaining.some((token) => token.tokenHash === 'live-token'));
});

test('cleanup is throttled so it does not run on every request', async () => {
  class CountingRepository extends InMemoryDataRepository {
    pruneCalls = 0;
    override async deleteExpiredPasswordResetTokens(now: Date, limit: number): Promise<number> {
      this.pruneCalls += 1;
      return super.deleteExpiredPasswordResetTokens(now, limit);
    }
  }

  const repository = new CountingRepository();
  const harness = await startHarness({
    repository,
    passwordResetTokenPruneIntervalMs: 60 * 60 * 1000
  });

  for (let index = 0; index < 3; index += 1) {
    const response = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
      email: 'unknown.person@example.com'
    });
    assert.equal(response.status, 200);
  }

  assert.equal(repository.pruneCalls, 1, 'cleanup must run at most once per interval');
});

test('a cleanup failure never changes the reset response', async () => {
  class FailingPruneRepository extends InMemoryDataRepository {
    override async deleteExpiredPasswordResetTokens(): Promise<number> {
      throw new Error('delete failed');
    }
  }

  const harness = await startHarness({
    repository: new FailingPruneRepository(),
    passwordResetTokenPruneIntervalMs: 0
  });
  await seedCustomer(harness.repository);

  const response = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: CUSTOMER_EMAIL
  });
  assert.equal(response.status, 200);
  assert.equal(harness.messages.length, 1);
});

// ---------------------------------------------------------------------------
// Remaining regression gaps: rate limiting, ineligible accounts
// ---------------------------------------------------------------------------

test('password change is rate limited per account', async () => {
  const harness = await startHarness({ authRateLimits: { passwordChangeMaxPerUser: 2 } });
  await seedCustomer(harness.repository);

  const login = await postJson(harness.baseUrl, '/api/auth/login', {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD
  });
  assert.equal(login.status, 200);
  const cookie = login.cookie!;
  const csrf = (login.body as { csrfToken: string }).csrfToken;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await postJson(
      harness.baseUrl,
      '/api/auth/password/change',
      { currentPassword: 'wrong-password', newPassword: 'ReplacementPass123!' },
      { cookie, csrf }
    );
    assert.equal(response.status, 403, `attempt ${attempt} should reach the handler`);
  }

  const limited = await postJson(
    harness.baseUrl,
    '/api/auth/password/change',
    { currentPassword: 'wrong-password', newPassword: 'ReplacementPass123!' },
    { cookie, csrf }
  );
  assert.equal(limited.status, 429);
  assert.equal(errorCode(limited.body), 'RATE_LIMITED');
});

test('reset requests for ineligible accounts issue no token and look identical', async () => {
  const harness = await startHarness();
  await seedCustomer(harness.repository, {
    id: 'usr_disabled',
    email: 'disabled.user@example.com',
    status: 'DISABLED'
  });

  const disabled = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: 'disabled.user@example.com'
  });
  const unknown = await postJson(harness.baseUrl, '/api/auth/password-reset/request', {
    email: 'no.account@example.com'
  });

  assert.equal(disabled.status, 200);
  assert.deepEqual(disabled.body, unknown.body);
  assert.equal(harness.messages.length, 0);
  assert.equal(harness.repository.getPasswordResetTokens().length, 0);
});

test('only the SHA-256 digest of a stored token is persisted', async () => {
  const harness = await startHarness();
  await seedCustomer(harness.repository);

  await postJson(harness.baseUrl, '/api/auth/password-reset/request', { email: CUSTOMER_EMAIL });
  const delivered = harness.messages[harness.messages.length - 1].token;
  const stored = harness.repository.getPasswordResetTokens();

  assert.equal(stored.length, 1);
  assert.equal(stored[0].tokenHash, hashPasswordResetToken(delivered));
  assert.notEqual(stored[0].tokenHash, delivered);
});
