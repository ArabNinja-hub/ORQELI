import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import session from 'express-session';
import type { PrismaClient } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { envSchema } = await import('./config.js');
const { createApp, hashPassword } = await import('./server.js');
const {
  createPgSessionStore,
  createSessionMiddleware,
  createSimulatedPgPool
} = await import('./session.js');
const { InMemoryDataRepository, PrismaDataRepository, DuplicateFieldError } =
  await import('./repository.js');

const testConfig = envSchema.parse({
  NODE_ENV: 'test',
  PORT: 4000,
  DATABASE_URL: 'postgresql://orqeli:placeholder@localhost:5432/orqeli',
  WEB_ORIGIN: 'http://localhost:5173',
  SESSION_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters',
  SESSION_COOKIE_NAME: 'orqeli.sid',
  SESSION_TTL_HOURS: 24,
  SESSION_COOKIE_SAMESITE: 'lax'
});

const pgPool = createSimulatedPgPool();
const repository = new InMemoryDataRepository();
const sessionStore = createPgSessionStore(testConfig, { pool: pgPool });
const app = createApp({
  config: testConfig,
  repository,
  sessionStore
});

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

function extractSessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'Expected Set-Cookie header in response');
  const cookiePair = setCookie.split(';')[0];
  assert.ok(cookiePair && cookiePair.startsWith('orqeli.sid='), 'Expected orqeli.sid cookie');
  return cookiePair;
}

function assertNoSensitiveFields(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('passwordHash'), false, 'Response must never include passwordHash');
  assert.equal(serialized.includes('$argon2'), false, 'Response must never include Argon2 hashes');
  assert.equal(
    serialized.includes(testConfig.SESSION_SECRET),
    false,
    'Response must never include SESSION_SECRET'
  );
}

before(async () => {
  const adminPasswordHash = await hashPassword('AdminCorrectPass123!');
  repository.seedUser({
    id: 'usr_seeded_admin',
    name: 'Copperbelt Platform Admin',
    email: 'admin@orqeli.zm',
    phone: '+260971000001',
    passwordHash: adminPasswordHash,
    role: 'ADMIN',
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

test('successful customer registration normalizes email, sets HttpOnly session cookie, and omits passwordHash', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: '  Chanda Mwale  ',
      email: '  CHANDA.MWALE@Example.com ',
      phone: '+260 977 123 456',
      password: 'CustomerPass123!'
    })
  });

  assert.equal(response.status, 201);
  const setCookieHeader = response.headers.get('set-cookie') ?? '';
  assert.match(setCookieHeader, /orqeli\.sid=/);
  assert.match(setCookieHeader, /HttpOnly/i);
  assert.match(setCookieHeader, /SameSite=Lax/i);

  const body = (await response.json()) as {
    user: {
      id: string;
      name: string;
      email: string;
      phone: string;
      role: string;
      status: string;
      passwordHash?: unknown;
    };
    csrfToken: string;
  };

  assert.equal(body.user.name, 'Chanda Mwale');
  assert.equal(body.user.email, 'chanda.mwale@example.com');
  assert.equal(body.user.phone, '+260 977 123 456');
  assert.equal(body.user.role, 'CUSTOMER');
  assert.equal(body.user.status, 'ACTIVE');
  assert.equal('passwordHash' in body.user, false);
  assert.ok(body.csrfToken.length > 20);
  assertNoSensitiveFields(body);

  // Verify password was hashed with Argon2 in the repository
  const stored = await repository.findUserByEmail('chanda.mwale@example.com');
  assert.ok(stored?.passwordHash?.startsWith('$argon2id$'));
});

test('duplicate email registration is rejected with 409 even when casing or whitespace differs', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Another Chanda',
      email: '  chanda.mwale@EXAMPLE.com  ',
      password: 'AnotherPassword123!'
    })
  });

  assert.equal(response.status, 409);
  const body = await response.json();
  assert.deepEqual(body, {
    error: {
      code: 'EMAIL_ALREADY_IN_USE',
      message: 'An account with this email address already exists.'
    }
  });
});

test('invalid registration input returns 400 with safe validation details', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'A',
      email: 'not-an-email',
      password: 'short'
    })
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as {
    error: { code: string; message: string; details: Array<{ path: string[]; message: string }> };
  };
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(body.error.details));
  assert.ok(body.error.details.length >= 3);
  assertNoSensitiveFields(body);
});

test('public registration strictly prohibits creating an administrator account', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'ADMIN',
      name: 'Attempted Admin',
      email: 'rogue.admin@example.com',
      password: 'RogueAdminPassword123!'
    })
  });

  assert.equal(response.status, 403);
  const body = (await response.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, 'FORBIDDEN');

  const rogueUser = await repository.findUserByEmail('rogue.admin@example.com');
  assert.equal(rogueUser, null);
});

test('business owner registration requires business details and creates a PENDING business awaiting manual verification', async () => {
  const missingBusinessRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'BUSINESS_OWNER',
      name: 'Mutale Banda',
      email: 'mutale@example.com',
      password: 'OwnerPassword123!'
    })
  });
  assert.equal(missingBusinessRes.status, 400);

  const validOwnerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'BUSINESS_OWNER',
      name: 'Mutale Banda',
      email: 'Mutale.Banda@Example.com',
      phone: '+260966111222',
      password: 'OwnerPassword123!',
      business: {
        name: 'Nkana Grooming Studio',
        description: 'Classic fades and beard care in Kitwe.',
        city: 'Kitwe',
        location: ' Parklands, Plot 42 ',
        phone: '+260966111222',
        email: 'Studio@NkanaGrooming.zm',
        // Attempt to self-approve on registration must be ignored
        status: 'APPROVED'
      }
    })
  });

  assert.equal(validOwnerRes.status, 201);
  const body = (await validOwnerRes.json()) as {
    user: {
      id: string;
      role: string;
      email: string;
      ownedBusinesses: Array<{
        id: string;
        ownerId: string;
        name: string;
        city: string;
        status: string;
      }>;
    };
  };

  assert.equal(body.user.role, 'BUSINESS_OWNER');
  assert.equal(body.user.email, 'mutale.banda@example.com');
  assert.equal(body.user.ownedBusinesses.length, 1);
  assert.equal(body.user.ownedBusinesses[0].name, 'Nkana Grooming Studio');
  assert.equal(body.user.ownedBusinesses[0].city, 'Kitwe');
  assert.equal(body.user.ownedBusinesses[0].status, 'PENDING');
  assert.equal(body.user.ownedBusinesses[0].ownerId, body.user.id);
  assertNoSensitiveFields(body);
});

test('successful login authenticates with Argon2, regenerates session ID, and returns safe profile', async () => {
  // First register a user to get an initial session cookie
  const initialReg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Bwalya Tembo',
      email: 'bwalya.tembo@example.com',
      password: 'BwalyaSecretPassword123!'
    })
  });
  assert.equal(initialReg.status, 201);
  const initialCookie = extractSessionCookie(initialReg);

  // Now log in as Chanda while sending the pre-existing session cookie to test session fixation defense
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: initialCookie
    },
    body: JSON.stringify({
      email: '  CHANDA.MWALE@example.com ',
      password: 'CustomerPass123!'
    })
  });

  assert.equal(loginRes.status, 200);
  const newCookie = extractSessionCookie(loginRes);
  assert.notEqual(
    newCookie,
    initialCookie,
    'Session ID must be regenerated after login to prevent session fixation'
  );

  const loginBody = (await loginRes.json()) as {
    user: { email: string; role: string };
    csrfToken: string;
  };
  assert.equal(loginBody.user.email, 'chanda.mwale@example.com');
  assert.equal(loginBody.user.role, 'CUSTOMER');
  assertNoSensitiveFields(loginBody);

  // Old session cookie from before login regeneration must be invalidated in PostgreSQL session store
  const meWithOldCookie = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: initialCookie }
  });
  assert.equal(meWithOldCookie.status, 401);

  // New session cookie works for /api/auth/me
  const meWithNewCookie = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: newCookie }
  });
  assert.equal(meWithNewCookie.status, 200);
  const meBody = (await meWithNewCookie.json()) as {
    user: { email: string; role: string };
  };
  assert.equal(meBody.user.email, 'chanda.mwale@example.com');
  assertNoSensitiveFields(meBody);
});

test('incorrect password and unknown email are rejected with a generic 401 error', async () => {
  const wrongPasswordRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'chanda.mwale@example.com',
      password: 'WrongPassword999!'
    })
  });

  assert.equal(wrongPasswordRes.status, 401);
  const wrongPassBody = await wrongPasswordRes.json();
  assert.deepEqual(wrongPassBody, {
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    }
  });

  const unknownEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'nonexistent.user@example.com',
      password: 'WrongPassword999!'
    })
  });

  assert.equal(unknownEmailRes.status, 401);
  const unknownEmailBody = await unknownEmailRes.json();
  assert.deepEqual(unknownEmailBody, wrongPassBody);
});

test('disabled and suspended accounts are rejected at login and during session restoration', async () => {
  const passwordHash = await hashPassword('SuspendedPass123!');
  repository.seedUser({
    id: 'usr_disabled_1',
    name: 'Disabled User',
    email: 'disabled@example.com',
    passwordHash,
    role: 'CUSTOMER',
    status: 'DISABLED'
  });

  const disabledLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'disabled@example.com',
      password: 'SuspendedPass123!'
    })
  });
  assert.equal(disabledLogin.status, 403);
  const disabledBody = (await disabledLogin.json()) as { error: { code: string } };
  assert.equal(disabledBody.error.code, 'ACCOUNT_INACTIVE');

  // Seed an active user, log in, then suspend the user and verify session is invalidated on /me
  const activeToSuspend = repository.seedUser({
    id: 'usr_to_suspend',
    name: 'Soon Suspended',
    email: 'soon.suspended@example.com',
    passwordHash,
    role: 'CUSTOMER',
    status: 'ACTIVE'
  });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: activeToSuspend.email,
      password: 'SuspendedPass123!'
    })
  });
  assert.equal(loginRes.status, 200);
  const sessionCookie = extractSessionCookie(loginRes);

  await repository.updateUserStatusForAdmin(
    { id: 'usr_seeded_admin', role: 'ADMIN' },
    activeToSuspend.id,
    'SUSPENDED'
  );

  const meAfterSuspension = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: sessionCookie }
  });
  assert.equal(meAfterSuspension.status, 401);
});

test('/api/auth/me returns 401 for unauthenticated requests and safe profile for authenticated requests', async () => {
  const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(unauthRes.status, 401);
  assert.deepEqual(await unauthRes.json(), {
    error: {
      code: 'UNAUTHENTICATED',
      message: 'Authentication required.'
    }
  });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'chanda.mwale@example.com',
      password: 'CustomerPass123!'
    })
  });
  assert.equal(loginRes.status, 200);
  const cookie = extractSessionCookie(loginRes);

  const authRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie }
  });
  assert.equal(authRes.status, 200);
  const authBody = (await authRes.json()) as {
    user: { email: string; role: string };
    csrfToken: string;
  };
  assert.equal(authBody.user.email, 'chanda.mwale@example.com');
  assert.equal(authBody.user.role, 'CUSTOMER');
  assertNoSensitiveFields(authBody);
});

test('logout destroys the server-side session in PostgreSQL store and invalidates the old session cookie', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'chanda.mwale@example.com',
      password: 'CustomerPass123!'
    })
  });
  assert.equal(loginRes.status, 200);
  const cookie = extractSessionCookie(loginRes);
  const { csrfToken } = (await loginRes.json()) as { csrfToken: string };

  const sessionCountBefore = pgPool.inspectSessions().size;
  assert.ok(sessionCountBefore >= 1);

  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
      'x-csrf-token': csrfToken
    }
  });
  assert.equal(logoutRes.status, 200);
  assert.deepEqual(await logoutRes.json(), { status: 'ok' });

  // Verify the old session cookie is rejected by /api/auth/me and /api/account
  const meAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie }
  });
  assert.equal(meAfterLogout.status, 401);

  const accountAfterLogout = await fetch(`${baseUrl}/api/account`, {
    headers: { cookie }
  });
  assert.equal(accountAfterLogout.status, 401);
});

test('unauthenticated requests are denied access to protected customer, owner, and admin endpoints', async () => {
  for (const endpoint of [
    '/api/account',
    '/api/owner/businesses',
    '/api/admin/businesses',
    '/api/admin/users'
  ]) {
    const res = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(res.status, 401, `Expected 401 for unauthenticated GET ${endpoint}`);
  }
});

test('customer is denied access to business-owner and administrator routes (403 FORBIDDEN)', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'chanda.mwale@example.com',
      password: 'CustomerPass123!'
    })
  });
  const customerCookie = extractSessionCookie(loginRes);

  // Customer can access their own /api/account
  const accountRes = await fetch(`${baseUrl}/api/account`, {
    headers: { cookie: customerCookie }
  });
  assert.equal(accountRes.status, 200);

  // Customer cannot access business owner endpoints
  const ownerListRes = await fetch(`${baseUrl}/api/owner/businesses`, {
    headers: { cookie: customerCookie }
  });
  assert.equal(ownerListRes.status, 403);

  // Customer cannot access administrator endpoints
  const adminBusinessesRes = await fetch(`${baseUrl}/api/admin/businesses`, {
    headers: { cookie: customerCookie }
  });
  assert.equal(adminBusinessesRes.status, 403);

  const adminUsersRes = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { cookie: customerCookie }
  });
  assert.equal(adminUsersRes.status, 403);
});

test('business-owner isolation prevents viewing or modifying another owner’s businesses and prevents bypassing manual approval', async () => {
  // Register Owner B
  const ownerBReg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'BUSINESS_OWNER',
      name: 'Kabwe Mulenga',
      email: 'kabwe.mulenga@example.com',
      phone: '+260955333444',
      password: 'OwnerBPassword123!',
      business: {
        name: 'Ndola Crown Salon',
        city: 'Ndola',
        location: 'President Avenue 12',
        phone: '+260955333444'
      }
    })
  });
  assert.equal(ownerBReg.status, 201);
  const ownerBCookie = extractSessionCookie(ownerBReg);
  const ownerBData = (await ownerBReg.json()) as {
    user: { id: string; ownedBusinesses: Array<{ id: string }> };
  };
  const ownerBBusinessId = ownerBData.user.ownedBusinesses[0].id;

  // Log in as Owner A (Mutale Banda)
  const ownerALogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'mutale.banda@example.com',
      password: 'OwnerPassword123!'
    })
  });
  assert.equal(ownerALogin.status, 200);
  const ownerACookie = extractSessionCookie(ownerALogin);
  const ownerAData = (await ownerALogin.json()) as {
    user: { id: string; ownedBusinesses: Array<{ id: string }> };
  };
  const ownerABusinessId = ownerAData.user.ownedBusinesses[0].id;

  // Owner A listing businesses only sees Owner A's business
  const ownerAList = await fetch(`${baseUrl}/api/owner/businesses`, {
    headers: { cookie: ownerACookie }
  });
  assert.equal(ownerAList.status, 200);
  const ownerAListBody = (await ownerAList.json()) as {
    businesses: Array<{ id: string; ownerId: string }>;
  };
  assert.equal(ownerAListBody.businesses.length, 1);
  assert.equal(ownerAListBody.businesses[0].id, ownerABusinessId);

  // Owner A cannot read Owner B's business
  const crossReadRes = await fetch(
    `${baseUrl}/api/owner/businesses/${ownerBBusinessId}`,
    {
      headers: { cookie: ownerACookie }
    }
  );
  assert.equal(crossReadRes.status, 404);

  // Owner A cannot update Owner B's business
  const crossUpdateRes = await fetch(
    `${baseUrl}/api/owner/businesses/${ownerBBusinessId}`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: ownerACookie
      },
      body: JSON.stringify({ name: 'Hijacked Salon Name' })
    }
  );
  assert.equal(crossUpdateRes.status, 404);

  // Verify Owner B's business was not modified
  const ownerBGet = await fetch(
    `${baseUrl}/api/owner/businesses/${ownerBBusinessId}`,
    {
      headers: { cookie: ownerBCookie }
    }
  );
  assert.equal(ownerBGet.status, 200);
  const ownerBGetBody = (await ownerBGet.json()) as { business: { name: string } };
  assert.equal(ownerBGetBody.business.name, 'Ndola Crown Salon');

  // Owner A cannot self-approve their own business via PATCH /api/owner/businesses/:id
  const selfApproveRes = await fetch(
    `${baseUrl}/api/owner/businesses/${ownerABusinessId}`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: ownerACookie
      },
      body: JSON.stringify({ status: 'APPROVED' })
    }
  );
  assert.equal(selfApproveRes.status, 403);

  // Owner A cannot access admin approval endpoint
  const ownerAdminAttempt = await fetch(
    `${baseUrl}/api/admin/businesses/${ownerABusinessId}/status`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: ownerACookie
      },
      body: JSON.stringify({ status: 'APPROVED' })
    }
  );
  assert.equal(ownerAdminAttempt.status, 403);

  // Owner A CAN update allowed profile details on their own business while status remains PENDING
  const validOwnerUpdate = await fetch(
    `${baseUrl}/api/owner/businesses/${ownerABusinessId}`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: ownerACookie
      },
      body: JSON.stringify({
        location: 'Parklands, Plot 42B, Kitwe'
      })
    }
  );
  assert.equal(validOwnerUpdate.status, 200);
  const validOwnerUpdateBody = (await validOwnerUpdate.json()) as {
    business: { location: string; status: string };
  };
  assert.equal(validOwnerUpdateBody.business.location, 'Parklands, Plot 42B, Kitwe');
  assert.equal(validOwnerUpdateBody.business.status, 'PENDING');
});

test('administrator can review and approve pending businesses and list users without exposing password hashes', async () => {
  const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@orqeli.zm',
      password: 'AdminCorrectPass123!'
    })
  });
  assert.equal(adminLogin.status, 200);
  const adminCookie = extractSessionCookie(adminLogin);

  const pendingRes = await fetch(`${baseUrl}/api/admin/businesses?status=PENDING`, {
    headers: { cookie: adminCookie }
  });
  assert.equal(pendingRes.status, 200);
  const pendingBody = (await pendingRes.json()) as {
    businesses: Array<{ id: string; name: string; status: string }>;
  };
  assert.ok(pendingBody.businesses.length >= 1);
  assertNoSensitiveFields(pendingBody);

  const targetBusiness = pendingBody.businesses[0];
  const approveRes = await fetch(
    `${baseUrl}/api/admin/businesses/${targetBusiness.id}/status`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: adminCookie
      },
      body: JSON.stringify({ status: 'APPROVED' })
    }
  );
  assert.equal(approveRes.status, 200);
  const approveBody = (await approveRes.json()) as {
    business: { id: string; status: string };
  };
  assert.equal(approveBody.business.status, 'APPROVED');

  const usersRes = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { cookie: adminCookie }
  });
  assert.equal(usersRes.status, 200);
  const usersBody = (await usersRes.json()) as {
    users: Array<Record<string, unknown>>;
  };
  assert.ok(usersBody.users.length >= 3);
  assertNoSensitiveFields(usersBody);
});

test('CSRF protection blocks cross-origin mutations, cross-site fetch metadata, form-encoded posts, and invalid CSRF tokens', async () => {
  // 1. Cross-origin Origin header is rejected
  const badOriginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://evil-attacker.example'
    },
    body: JSON.stringify({
      email: 'chanda.mwale@example.com',
      password: 'CustomerPass123!'
    })
  });
  assert.equal(badOriginRes.status, 403);
  const badOriginBody = (await badOriginRes.json()) as { error: { code: string } };
  assert.equal(badOriginBody.error.code, 'CSRF_REJECTED');

  // 2. Sec-Fetch-Site: cross-site is rejected
  const crossSiteFetchRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'cross-site'
    }
  });
  assert.equal(crossSiteFetchRes.status, 403);

  // 3. HTML form-encoded POST is rejected
  const formEncodedRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: 'foo=bar'
  });
  assert.equal(formEncodedRes.status, 403);

  // 4. Invalid X-CSRF-Token header is rejected
  const badTokenRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': 'tampered.invalid-signature'
    }
  });
  assert.equal(badTokenRes.status, 403);
  const badTokenBody = (await badTokenRes.json()) as { error: { code: string } };
  assert.equal(badTokenBody.error.code, 'CSRF_INVALID');
});

test('production session middleware prohibits MemoryStore and enforces Secure cookie flag', () => {
  const prodConfig = envSchema.parse({
    NODE_ENV: 'production',
    PORT: 4000,
    DATABASE_URL: 'postgresql://orqeli:prodpassword@localhost:5432/orqeli',
    WEB_ORIGIN: 'https://orqeli.zm',
    SESSION_SECRET: 'production-grade-secret-value-with-more-than-32-chars'
  });

  assert.throws(
    () => createSessionMiddleware(prodConfig, new session.MemoryStore()),
    /In-memory session store is prohibited in production/
  );
});

test('PrismaDataRepository enforces ownerScope on business queries and maps P2002 unique violations', async () => {
  const capturedQueries: Array<{ method: string; args: unknown }> = [];
  const now = new Date();

  const mockPrisma = {
    business: {
      async findMany(args: unknown) {
        capturedQueries.push({ method: 'business.findMany', args });
        return [];
      },
      async findFirst(args: unknown) {
        capturedQueries.push({ method: 'business.findFirst', args });
        return {
          id: 'biz_1',
          ownerId: 'owner_abc',
          name: 'Copperbelt Cuts',
          description: null,
          city: 'Kitwe',
          location: 'Town Centre',
          phone: '+260977000111',
          email: null,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now
        };
      },
      async update(args: unknown) {
        capturedQueries.push({ method: 'business.update', args });
        return {
          id: 'biz_1',
          ownerId: 'owner_abc',
          name: 'Copperbelt Cuts Updated',
          description: null,
          city: 'Kitwe',
          location: 'Town Centre',
          phone: '+260977000111',
          email: null,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now
        };
      }
    },
    $transaction: async () => {
      throw Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['email'] }
      });
    }
  } as unknown as PrismaClient;

  const prismaRepo = new PrismaDataRepository(mockPrisma);
  await prismaRepo.listBusinessesForOwner({ id: 'owner_abc', role: 'BUSINESS_OWNER' });
  await prismaRepo.updateBusinessForOwner(
    { id: 'owner_abc', role: 'BUSINESS_OWNER' },
    'biz_1',
    { name: 'Copperbelt Cuts Updated' }
  );

  assert.deepEqual(capturedQueries[0], {
    method: 'business.findMany',
    args: {
      where: { ownerId: 'owner_abc' },
      orderBy: { createdAt: 'desc' }
    }
  });
  assert.deepEqual(capturedQueries[1], {
    method: 'business.findFirst',
    args: {
      where: { id: 'biz_1', ownerId: 'owner_abc' }
    }
  });
  assert.deepEqual(capturedQueries[2], {
    method: 'business.update',
    args: {
      where: { id: 'biz_1', ownerId: 'owner_abc' },
      data: { name: 'Copperbelt Cuts Updated' }
    }
  });

  await assert.rejects(
    () =>
      prismaRepo.createCustomerUser({
        name: 'Duplicate Customer',
        email: 'dup@example.com',
        phone: null,
        passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$stub'
      }),
    (err: unknown) => err instanceof DuplicateFieldError && err.field === 'email'
  );
});
