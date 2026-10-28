import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request, Response, NextFunction } from 'express';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { envSchema, resolveEnvFilePaths } = await import('./config.js');
const { app } = await import('./server.js');
const { requireSchoolRole, schoolScope } = await import('./authz.js');

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

test('environment schema accepts required config and defaults to postgres store', () => {
  const parsed = envSchema.parse({
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    SESSION_SECRET: 'a'.repeat(32)
  });
  assert.equal(parsed.PORT, 4000);
  assert.equal(parsed.WEB_ORIGIN, 'http://localhost:5173');
  assert.equal(parsed.DATA_STORE_MODE, 'postgres');
});

test('environment schema rejects missing secrets, invalid URLs, and memory-sandbox in production', () => {
  assert.equal(
    envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/db',
      SESSION_SECRET: 'short'
    }).success,
    false
  );
  assert.equal(
    envSchema.safeParse({
      DATABASE_URL: '',
      SESSION_SECRET: 'a'.repeat(32),
      PORT: '70000'
    }).success,
    false
  );
  assert.equal(
    envSchema.safeParse({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/db',
      SESSION_SECRET: 'a'.repeat(40),
      DATA_STORE_MODE: 'memory-sandbox'
    }).success,
    false
  );
});

test('the API .env lookup is independent of the process working directory', () => {
  const paths = resolveEnvFilePaths('/repo/apps/api/src');
  assert.deepEqual(paths, ['/repo/apps/api/.env', '/repo/.env']);
});

test('health endpoint responds without attempting database access', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'orqeli-education-api');
  assert.equal(body.stage, 'early-stage-foundation');
});

test('malformed JSON gets a safe client error response', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{broken'
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' }
  });
});

test('unknown route returns the standard not-found response and open public registration is absent', async () => {
  const missing = await fetch(`${baseUrl}/api/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' }
  });

  const openRegister = await fetch(`${baseUrl}/api/auth/register`);
  assert.equal(openRegister.status, 404);
});

test('school role middleware enforces authentication, tenant membership, active school status, and role', () => {
  const guard = requireSchoolRole('HEAD_TEACHER', 'SCHOOL_ADMIN');

  const invoke = (reqInit: Partial<Request>) => {
    let statusCode = 200;
    let payload: unknown;
    let advanced = false;
    const req = { params: { schoolId: 'sch_1' }, ...reqInit } as unknown as Request;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
        return this;
      }
    } as Response;
    guard(req, res, (() => {
      advanced = true;
    }) as NextFunction);
    return { statusCode, payload, advanced, schoolAccess: req.schoolAccess };
  };

  assert.equal(invoke({}).statusCode, 401);

  // Authenticated at sch_2, attempting sch_1 -> 403 SCHOOL_ACCESS_DENIED
  const wrongSchool = invoke({
    user: { id: 'usr_1', platformRole: 'STANDARD' },
    memberships: [
      {
        id: 'mem_2',
        schoolId: 'sch_2',
        role: 'HEAD_TEACHER',
        status: 'ACTIVE',
        staffCode: null,
        school: {
          id: 'sch_2',
          code: 'SYN-2',
          name: 'Other School',
          sector: 'PRIVATE',
          province: 'Lusaka',
          district: 'Lusaka',
          isSyntheticDemo: true,
          status: 'ACTIVE'
        }
      }
    ]
  });
  assert.equal(wrongSchool.statusCode, 403);

  // Teacher at sch_1 attempting HEAD_TEACHER action -> 403 FORBIDDEN
  const wrongRole = invoke({
    user: { id: 'usr_1', platformRole: 'STANDARD' },
    memberships: [
      {
        id: 'mem_1',
        schoolId: 'sch_1',
        role: 'TEACHER',
        status: 'ACTIVE',
        staffCode: null,
        school: {
          id: 'sch_1',
          code: 'SYN-1',
          name: 'School 1',
          sector: 'GOVERNMENT',
          province: 'Lusaka',
          district: 'Chilanga',
          isSyntheticDemo: true,
          status: 'PILOT_PREP'
        }
      }
    ]
  });
  assert.equal(wrongRole.statusCode, 403);

  // Suspended school -> 403 SCHOOL_ACCESS_DENIED
  const suspendedSchool = invoke({
    user: { id: 'usr_1', platformRole: 'STANDARD' },
    memberships: [
      {
        id: 'mem_1',
        schoolId: 'sch_1',
        role: 'HEAD_TEACHER',
        status: 'ACTIVE',
        staffCode: null,
        school: {
          id: 'sch_1',
          code: 'SYN-1',
          name: 'School 1',
          sector: 'GOVERNMENT',
          province: 'Lusaka',
          district: 'Chilanga',
          isSyntheticDemo: true,
          status: 'SUSPENDED'
        }
      }
    ]
  });
  assert.equal(suspendedSchool.statusCode, 403);

  // Valid Head Teacher at sch_1 -> advances with verified schoolScope
  const allowed = invoke({
    user: { id: 'usr_1', platformRole: 'STANDARD' },
    memberships: [
      {
        id: 'mem_1',
        schoolId: 'sch_1',
        role: 'HEAD_TEACHER',
        status: 'ACTIVE',
        staffCode: 'STF-1',
        school: {
          id: 'sch_1',
          code: 'SYN-1',
          name: 'School 1',
          sector: 'GOVERNMENT',
          province: 'Lusaka',
          district: 'Chilanga',
          isSyntheticDemo: true,
          status: 'PILOT_PREP'
        }
      }
    ]
  });
  assert.equal(allowed.advanced, true);
  assert.deepEqual(schoolScope(allowed.schoolAccess!), { schoolId: 'sch_1' });
});
