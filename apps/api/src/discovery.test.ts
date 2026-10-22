import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import {
  discoveryQuerySchema,
  discoveryWhere,
  publicBusinessSelect,
  publicBusinessWhere
} from './discovery.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';
const { createApp, hashPassword } = await import('./server.js');
const { InMemoryDataRepository, PrismaDataRepository } = await import('./repository.js');
const repository = new InMemoryDataRepository();
const app = createApp({ repository });
let base: string;
let server: ReturnType<typeof app.listen>;

before(async () => {
  const passwordHash = await hashPassword('TestingPassword123!');
  for (const role of ['CUSTOMER', 'BUSINESS_OWNER', 'ADMIN'] as const) {
    repository.seedUser({
      id: role,
      name: 'Private test user',
      email: `${role}@example.test`,
      passwordHash,
      role
    });
  }
  repository.seedUser({
    id: 'disabled',
    name: 'Private disabled owner',
    email: 'disabled@example.test',
    passwordHash: null,
    role: 'BUSINESS_OWNER',
    status: 'DISABLED'
  });
  for (const [id, city, status, ownerId] of [
    ['approved-kitwe', 'Kitwe', 'APPROVED', 'BUSINESS_OWNER'],
    ['approved-ndola', 'Ndola', 'APPROVED', 'BUSINESS_OWNER'],
    ['pending', 'Kitwe', 'PENDING', 'BUSINESS_OWNER'],
    ['rejected', 'Kitwe', 'REJECTED', 'BUSINESS_OWNER'],
    ['suspended', 'Kitwe', 'SUSPENDED', 'BUSINESS_OWNER'],
    ['inactive-owner', 'Kitwe', 'APPROVED', 'disabled']
  ] as const)
    repository.seedBusiness({
      id,
      name: `Test ${id}`,
      city,
      status,
      ownerId,
      description: 'Test-only local service',
      location: 'Test address',
      phone: '+260970000000'
    });
  for (const [id, active, priceMinorUnits] of [
    ['priced', true, 12550],
    ['unpriced', true, null],
    ['zero', true, 0],
    ['hidden', false, 500]
  ] as const) {
    repository.seedService({
      id,
      businessId: 'approved-kitwe',
      name: `Service ${id}`,
      description: null,
      durationMinutes: 30,
      priceMinorUnits,
      currency: 'ZMW',
      active
    });
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});
const get = (path: string, cookie?: string) =>
  fetch(`${base}${path}`, { headers: cookie ? { cookie } : undefined });

test('anonymous discovery returns only approved businesses in the requested city, without private fields', async () => {
  for (const city of ['Kitwe', 'Ndola']) {
    const response = await get(`/api/businesses?city=${city}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    const body = await response.json();
    assert.deepEqual(
      body.businesses.map((b: { id: string }) => b.id),
      [`approved-${city.toLowerCase()}`]
    );
    assert.deepEqual(
      Object.keys(body.businesses[0]).sort(),
      ['id', 'name', 'description', 'city', 'location', 'phone', 'email', 'services'].sort()
    );
    assert.doesNotMatch(
      JSON.stringify(body),
      /passwordHash|ownerId|customer|Private test user|example.test|createdAt|bookings/
    );
  }
});

test('profiles enforce city and approval, treating hidden records like nonexistent records', async () => {
  const missing = await (await get('/api/businesses/missing?city=Kitwe')).json();
  for (const id of ['pending', 'rejected', 'suspended', 'inactive-owner', 'approved-ndola']) {
    const response = await get(`/api/businesses/${id}?city=Kitwe`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), missing);
  }
  const response = await get('/api/businesses/approved-kitwe?city=Kitwe');
  assert.equal(response.status, 200);
  const { business } = await response.json();
  assert.equal(business.services.length, 3);
  assert.deepEqual(
    business.services.map((s: { priceMinorUnits: number | null }) => s.priceMinorUnits),
    [12550, null, 0]
  );
  assert.doesNotMatch(JSON.stringify(business), /hidden|ownerId|businessId|active|password/);
});

test('search is case-insensitive across names, descriptions and active service names; filters and empty results work', async () => {
  for (const query of ['q=APPROVED-KITWE', 'q=local', 'q=Service%20priced', 'hasServices=true']) {
    const body = await (await get(`/api/businesses?city=Kitwe&${query}`)).json();
    assert.equal(body.businesses.length, 1);
  }
  for (const query of [
    'city=Ndola&hasServices=true',
    'city=Kitwe&q=hidden',
    'city=Kitwe&q=not-a-match',
    'city=Kitwe&page=2',
    'city=Kitwe&q=%25'
  ]) {
    const response = await get(`/api/businesses?${query}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.businesses, []);
    assert.equal(body.hasMore, false);
  }
});

test('public input validation rejects unknown, duplicated, oversized and malformed parameters', async () => {
  for (const query of [
    '',
    'city=Lusaka',
    'city=kitwe',
    'city=Kitwe&city=Ndola',
    'city=Kitwe&status=PENDING',
    'city=Kitwe&ownerId=BUSINESS_OWNER',
    'city=Kitwe&hasServices=1',
    'city=Kitwe&page=0',
    'city=Kitwe&page=-1',
    'city=Kitwe&page=1.5',
    'city=Kitwe&page=10000',
    `city=Kitwe&q=${'x'.repeat(101)}`,
    'city[equals]=Kitwe'
  ]) {
    const response = await get(`/api/businesses?${query}`);
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  }
  for (const path of [
    '/api/businesses/approved-kitwe',
    '/api/businesses/approved-kitwe?city=Kitwe&status=APPROVED',
    '/api/businesses/bad%20id?city=Kitwe'
  ]) {
    assert.equal((await get(path)).status, 400, path);
  }
});

async function login(role: string): Promise<{ cookie: string; csrfToken: string }> {
  const csrf = await (await get('/api/auth/csrf')).json();
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
    body: JSON.stringify({ email: `${role}@example.test`, password: 'TestingPassword123!' })
  });
  assert.equal(response.status, 200);
  return {
    cookie: response.headers.get('set-cookie')!.split(';')[0],
    csrfToken: (await response.json()).csrfToken
  };
}

test('authenticated roles never bypass public approval and cannot use discovery as a write endpoint', async () => {
  for (const role of ['CUSTOMER', 'BUSINESS_OWNER', 'ADMIN']) {
    const { cookie, csrfToken } = await login(role);
    assert.equal((await get('/api/businesses?city=Kitwe', cookie)).status, 200);
    assert.equal((await get('/api/businesses/pending?city=Kitwe', cookie)).status, 404);
    const response = await fetch(`${base}/api/businesses/approved-kitwe?city=Kitwe`, {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ status: 'APPROVED' })
    });
    assert.equal(response.status, 404);
    if (role === 'CUSTOMER') {
      assert.equal((await get('/api/owner/businesses', cookie)).status, 403);
      assert.equal((await get('/api/admin/businesses', cookie)).status, 403);
    }
  }
  assert.equal((await get('/api/owner/businesses')).status, 401);
  assert.equal((await get('/api/admin/businesses')).status, 401);
});

test('admin suspension immediately removes a listing and its public profile', async () => {
  repository.seedBusiness({
    id: 'revoked',
    ownerId: 'BUSINESS_OWNER',
    city: 'Kitwe',
    status: 'APPROVED',
    name: 'Revocable test record',
    location: 'Test',
    phone: '+260970000000'
  });
  assert.equal((await get('/api/businesses/revoked?city=Kitwe')).status, 200);
  const { cookie, csrfToken } = await login('ADMIN');
  const response = await fetch(`${base}/api/admin/businesses/revoked/status`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ status: 'SUSPENDED' })
  });
  assert.equal(response.status, 200);
  assert.equal((await get('/api/businesses/revoked?city=Kitwe')).status, 404);
  assert.deepEqual(
    (await (await get('/api/businesses?city=Kitwe&q=Revocable')).json()).businesses,
    []
  );
});

test('pagination is bounded and stable for equal names', async () => {
  const repo = new InMemoryDataRepository();
  repo.seedUser({
    id: 'owner',
    name: 'Test',
    email: null,
    passwordHash: null,
    role: 'BUSINESS_OWNER'
  });
  for (let i = 0; i < 15; i++)
    repo.seedBusiness({
      id: `b${String(i).padStart(2, '0')}`,
      ownerId: 'owner',
      name: 'Equal name',
      city: 'Kitwe',
      location: 'Test',
      phone: '1234567',
      status: 'APPROVED'
    });
  const first = await repo.discoverBusinesses(discoveryQuerySchema.parse({ city: 'Kitwe' }));
  const second = await repo.discoverBusinesses(
    discoveryQuerySchema.parse({ city: 'Kitwe', page: '2' })
  );
  assert.equal(first.businesses.length, 12);
  assert.equal(first.hasMore, true);
  assert.equal(second.businesses.length, 3);
  assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.businesses, ...second.businesses].map((b) => b.id)).size, 15);
});

test('Prisma queries enforce approval/active owner and explicit public projections at database boundary', async () => {
  const calls: unknown[] = [];
  const prisma = {
    business: {
      findMany: async (args: unknown) => {
        calls.push(args);
        return [];
      },
      findFirst: async (args: unknown) => {
        calls.push(args);
        return null;
      }
    }
  } as unknown as PrismaClient;
  const repo = new PrismaDataRepository(prisma);
  const query = discoveryQuerySchema.parse({
    city: 'Ndola',
    q: 'cut%_',
    hasServices: 'true',
    page: '2'
  });
  await repo.discoverBusinesses(query);
  await repo.getPublicBusiness('record', 'Ndola');
  assert.deepEqual(calls[0], {
    where: discoveryWhere(query),
    select: publicBusinessSelect,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    skip: 12,
    take: 13
  });
  assert.deepEqual(calls[1], {
    where: { ...publicBusinessWhere('Ndola'), id: 'record' },
    select: publicBusinessSelect
  });
  assert.deepEqual(publicBusinessWhere('Ndola'), {
    city: { equals: 'Ndola', mode: 'insensitive' },
    status: 'APPROVED',
    owner: { status: 'ACTIVE' }
  });
  assert.equal(
    (discoveryWhere(query).OR![0] as { name: { contains: string } }).name.contains,
    'cut\\%\\_'
  );
  assert.deepEqual(publicBusinessSelect.services.where, { active: true });
});

test('repository failures produce a safe error, not an empty successful result', async () => {
  const repo = new InMemoryDataRepository();
  repo.discoverBusinesses = async () => {
    throw new Error('database test failure');
  };
  const failing = createApp({ repository: repo }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => failing.once('listening', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(failing.address() as AddressInfo).port}/api/businesses?city=Kitwe`
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }
    });
  } finally {
    await new Promise<void>((resolve) => failing.close(() => resolve()));
  }
});
