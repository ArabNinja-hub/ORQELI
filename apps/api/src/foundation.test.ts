import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request, Response, NextFunction } from 'express';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { envSchema } = await import('./config.js');
const { app } = await import('./server.js');
const { ownerScope, requireRole } = await import('./authz.js');
let baseUrl: string;
let server: ReturnType<typeof app.listen>;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

});

test('environment schema accepts required config and applies defaults', () => {
  const parsed = envSchema.parse({ DATABASE_URL: 'postgresql://user:pass@localhost:5432/db', SESSION_SECRET: 'a'.repeat(32) });
  assert.equal(parsed.PORT, 4000);
  assert.equal(parsed.WEB_ORIGIN, 'http://localhost:5173');
});

test('environment schema rejects missing secrets and invalid values', () => {
  assert.equal(envSchema.safeParse({ DATABASE_URL: 'postgresql://localhost/db', SESSION_SECRET: 'short' }).success, false);
  assert.equal(envSchema.safeParse({ DATABASE_URL: '', SESSION_SECRET: 'a'.repeat(32), PORT: '70000' }).success, false);
  assert.equal(envSchema.safeParse({ DATABASE_URL: 'postgresql://localhost/db', SESSION_SECRET: 'a'.repeat(32), WEB_ORIGIN: 'not a URL' }).success, false);
});

test('health endpoint responds without attempting database access', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('malformed JSON gets a safe client error response', async () => {
  const response = await fetch(`${baseUrl}/api/not-implemented`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' } });
});

test('unknown route returns the standard not-found response', async () => {
  const response = await fetch(`${baseUrl}/api/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } });
});

test('role authorization distinguishes unauthenticated, forbidden and allowed requests', () => {
  const check = requireRole('ADMIN');
  const invoke = (user?: Request['user']) => {
    let statusCode = 200;
    let responseBody: unknown;
    let advanced = false;
    const req = { user } as Request;
    const res = { status(code: number) { statusCode = code; return this; }, json(body: unknown) { responseBody = body; return this; } } as Response;
    check(req, res, (() => { advanced = true; }) as NextFunction);
    return { statusCode, responseBody, advanced };
  };
  assert.equal(invoke().statusCode, 401);
  assert.equal(invoke({ id: 'owner-1', role: 'BUSINESS_OWNER' }).statusCode, 403);
  assert.equal(invoke({ id: 'admin-1', role: 'ADMIN' }).advanced, true);
});

test('owner scope is constrained to the authenticated business owner', () => {
  assert.deepEqual(ownerScope({ id: 'owner-1', role: 'BUSINESS_OWNER' }), { ownerId: 'owner-1' });
  assert.throws(() => ownerScope({ id: 'customer-1', role: 'CUSTOMER' }), /requires a business owner/);
});
