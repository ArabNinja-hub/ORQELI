import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { NextFunction, Request, Response } from 'express';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { createApp } = await import('./server.js');
const { envSchema } = await import('./config.js');
const { createCsrfProtectionMiddleware } = await import('./csrf.js');
const { createRateLimiter } = await import('./rateLimit.js');
const { InMemoryDataRepository } = await import('./repository.js');
const { createPgSessionStore, createSimulatedPgPool } = await import('./session.js');

const testConfig = envSchema.parse({
  NODE_ENV: 'test',
  PORT: 4000,
  DATABASE_URL: 'postgresql://orqeli:placeholder@localhost:5432/orqeli',
  WEB_ORIGIN: 'http://localhost:5173',
  SESSION_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters'
});

const productionConfig = envSchema.parse({
  NODE_ENV: 'production',
  PORT: 4000,
  DATABASE_URL: 'postgresql://orqeli:placeholder@localhost:5432/orqeli',
  WEB_ORIGIN: 'https://orqeli.zm',
  SESSION_SECRET: 'production-grade-secret-value-with-more-than-32-chars'
});

const pgPool = createSimulatedPgPool();
const repository = new InMemoryDataRepository();
const app = createApp({
  config: testConfig,
  repository,
  sessionStore: createPgSessionStore(testConfig, { pool: pgPool }),
  authRateLimits: {
    loginWindowMs: 60_000,
    loginMaxPerIdentity: 3,
    loginMaxPerIp: 100,
    registerWindowMs: 60_000,
    registerMaxPerIp: 2
  }
});

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

interface FakeResponseResult {
  status: number;
  headers: Map<string, string>;
  body: unknown;
}

function createFakeResponse(): { res: Response; result: FakeResponseResult } {
  const result: FakeResponseResult = { status: 200, headers: new Map(), body: undefined };
  const res = {
    headersSent: false,
    setHeader(name: string, value: string) {
      result.headers.set(name.toLowerCase(), String(value));
      return res;
    },
    set(name: string, value: string) {
      return res.setHeader(name, value);
    },
    status(code: number) {
      result.status = code;
      return res;
    },
    json(payload: unknown) {
      result.body = payload;
      res.headersSent = true;
      return res;
    }
  } as unknown as Response;
  return { res, result };
}

function createFakeRequest(input: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  ip?: string;
  session?: unknown;
}): Request {
  return {
    method: input.method ?? 'POST',
    headers: input.headers ?? {},
    body: input.body,
    ip: input.ip ?? '203.0.113.9',
    socket: { remoteAddress: input.ip ?? '203.0.113.9' },
    session: input.session
  } as unknown as Request;
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/csrf`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { csrfToken: string };
  return body.csrfToken;
}

async function postJson(
  path: string,
  body: unknown
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': await getCsrfToken()
    },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    json: (await response.json()) as Record<string, unknown>,
    headers: response.headers
  };
}

before(async () => {
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

test('the fixed-window limiter blocks the request after the maximum within the window', () => {
  let nowMs = 1_000_000;
  const limiter = createRateLimiter({
    name: 'unit',
    windowMs: 1_000,
    max: 2,
    keyGenerator: () => 'client',
    now: () => nowMs
  });

  const run = () => {
    let nextCalled = false;
    const { res, result } = createFakeResponse();
    limiter(createFakeRequest({}), res, () => {
      nextCalled = true;
    });
    return { nextCalled, ...result };
  };

  const first = run();
  assert.equal(first.nextCalled, true);
  assert.equal(first.headers.get('ratelimit-remaining'), '1');

  const second = run();
  assert.equal(second.nextCalled, true);
  assert.equal(second.headers.get('ratelimit-remaining'), '0');

  const third = run();
  assert.equal(third.nextCalled, false);
  assert.equal(third.status, 429);
  assert.equal((third.body as { error: { code: string } }).error.code, 'RATE_LIMITED');
  assert.equal(third.headers.get('cache-control'), 'no-store');
  assert.ok(Number(third.headers.get('retry-after')) >= 1);

  // A new window allows traffic again.
  nowMs += 1_000;
  const afterWindow = run();
  assert.equal(afterWindow.nextCalled, true);
});

test('the limiter keeps memory bounded when many distinct keys are seen', () => {
  let nowMs = 0;
  let counter = 0;
  const limiter = createRateLimiter({
    name: 'bounded',
    windowMs: 1_000,
    max: 5,
    keyGenerator: () => `key-${counter++}`,
    now: () => nowMs,
    maxEntries: 10
  });

  for (let index = 0; index < 100; index += 1) {
    limiter(createFakeRequest({}), createFakeResponse().res, () => undefined);
    nowMs += 1;
  }

  assert.ok(limiter.size() <= 10, `expected at most 10 tracked keys, got ${limiter.size()}`);
});

test('repeated failed logins are rate limited without disclosing account existence or credentials', async () => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await postJson('/api/auth/login', {
      email: 'brute.force.target@example.com',
      password: 'WrongPassword123!'
    });
    assert.equal(response.status, 401, `attempt ${attempt} should still reach the login handler`);
    assert.equal(
      (response.json.error as { code: string }).code,
      'INVALID_CREDENTIALS'
    );
  }

  const limited = await postJson('/api/auth/login', {
    email: 'brute.force.target@example.com',
    password: 'WrongPassword123!'
  });
  assert.equal(limited.status, 429);
  assert.equal((limited.json.error as { code: string }).code, 'RATE_LIMITED');
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  assert.equal(limited.headers.get('cache-control'), 'no-store');

  const serialized = JSON.stringify(limited.json);
  assert.equal(serialized.includes('brute.force.target@example.com'), false);
  assert.equal(serialized.includes('WrongPassword123!'), false);
  assert.equal(serialized.includes('stack'), false);

  // A different identity from the same client is still allowed through.
  const otherIdentity = await postJson('/api/auth/login', {
    email: 'another.account@example.com',
    password: 'WrongPassword123!'
  });
  assert.equal(otherIdentity.status, 401);
});

test('registrations are rate limited per client', async () => {
  const first = await postJson('/api/auth/register', {
    name: 'First Rate Limited',
    email: 'rate.limit.first@example.com',
    password: 'CustomerPass123!'
  });
  assert.equal(first.status, 201);

  const second = await postJson('/api/auth/register', {
    name: 'Second Rate Limited',
    email: 'rate.limit.second@example.com',
    password: 'CustomerPass123!'
  });
  assert.equal(second.status, 201);

  const limited = await postJson('/api/auth/register', {
    name: 'Third Rate Limited',
    email: 'rate.limit.third@example.com',
    password: 'CustomerPass123!'
  });
  assert.equal(limited.status, 429);
  assert.equal((limited.json.error as { code: string }).code, 'RATE_LIMITED');
  assert.equal(
    await repository.findUserByEmail('rate.limit.third@example.com'),
    null,
    'a rejected registration must not create a user'
  );
});

test('production CSRF checks do not trust an origin derived from the Host header', () => {
  const productionMiddleware = createCsrfProtectionMiddleware(productionConfig);
  const request = createFakeRequest({
    method: 'POST',
    headers: {
      host: 'attacker.example',
      origin: 'https://attacker.example',
      'content-type': 'application/json'
    },
    body: {}
  });

  const { res, result } = createFakeResponse();
  let nextCalled = false;
  productionMiddleware(request, res, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(result.status, 403);
  assert.equal((result.body as { error: { code: string } }).error.code, 'CSRF_REJECTED');

  // Non-production environments keep the convenience host-derived allowance, so the
  // same request gets past the origin check and only fails the token check.
  const developmentMiddleware = createCsrfProtectionMiddleware(testConfig);
  const developmentResult = createFakeResponse();
  developmentMiddleware(request, developmentResult.res, (() => undefined) as NextFunction);
  assert.equal(
    (developmentResult.result.body as { error: { code: string } }).error.code,
    'CSRF_MISSING'
  );
});

test('trust proxy stays at one hop in production and follows TRUST_PROXY elsewhere', () => {
  const productionApp = createApp({
    config: productionConfig,
    repository: new InMemoryDataRepository(),
    sessionStore: createPgSessionStore(productionConfig, { pool: createSimulatedPgPool() })
  });
  assert.equal(productionApp.get('trust proxy'), 1);

  const withoutProxy = envSchema.parse({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://orqeli:placeholder@localhost:5432/orqeli',
    SESSION_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters',
    TRUST_PROXY: 'false'
  });
  const appWithoutProxy = createApp({
    config: withoutProxy,
    repository: new InMemoryDataRepository(),
    sessionStore: createPgSessionStore(withoutProxy, { pool: createSimulatedPgPool() })
  });
  assert.equal(appWithoutProxy.get('trust proxy'), false);

  const withProxy = envSchema.parse({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://orqeli:placeholder@localhost:5432/orqeli',
    SESSION_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters',
    TRUST_PROXY: 'true'
  });
  const appWithProxy = createApp({
    config: withProxy,
    repository: new InMemoryDataRepository(),
    sessionStore: createPgSessionStore(withProxy, { pool: createSimulatedPgPool() })
  });
  assert.equal(appWithProxy.get('trust proxy'), 1);
});

test('authenticated API responses are marked Cache-Control: no-store and Helmet headers are present', async () => {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  assert.equal(csrfResponse.status, 200);
  assert.equal(csrfResponse.headers.get('cache-control'), 'no-store');

  const meResponse = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(meResponse.status, 401);
  assert.equal(meResponse.headers.get('cache-control'), 'no-store');

  const accountResponse = await fetch(`${baseUrl}/api/account`);
  assert.equal(accountResponse.status, 401);
  assert.equal(accountResponse.headers.get('cache-control'), 'no-store');

  assert.equal(meResponse.headers.get('x-powered-by'), null);
  assert.equal(meResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(meResponse.headers.get('x-frame-options'), 'SAMEORIGIN');
});
