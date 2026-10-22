/**
 * End-to-end verification of registration, sessions, roles and CSRF against a real
 * PostgreSQL database, using the actual production code paths (PrismaDataRepository,
 * connect-pg-simple session store, Express CSRF middleware).
 *
 * The regular `npm test` suite runs without a database (in-memory repository and a
 * simulated session-store pool). This script closes that gap: it proves the committed
 * migrations, the Prisma schema and the session table agree with the running code.
 *
 * Usage: DATABASE_URL=... SESSION_SECRET=... npm run db:verify-flow -w @orqeli/api
 * Requires `prisma migrate deploy` to have run first. Exits non-zero on failure.
 */
import { PrismaClient } from '@prisma/client';
import type { AddressInfo } from 'node:net';

// server.ts starts listening when NODE_ENV !== 'test'; tests use 'test' too.
process.env.NODE_ENV = 'test';

const { envSchema } = await import('../src/config.js');
const { createApp } = await import('../src/server.js');
const { createPgSessionStore } = await import('../src/session.js');
const { PrismaDataRepository } = await import('../src/repository.js');

const config = envSchema.parse(process.env);
const prisma = new PrismaClient();

const createdUserIds: string[] = [];
const createdBusinessIds: string[] = [];
const createdSids: string[] = [];

let failures = 0;

function check(condition: boolean, description: string, detail?: unknown): void {
  if (condition) {
    console.log(`  PASS  ${description}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${description}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  }
}

function cookieSid(cookie: string): string {
  const raw = decodeURIComponent(cookie.split('=').slice(1).join('='));
  const withoutPrefix = raw.startsWith('s:') ? raw.slice(2) : raw;
  return withoutPrefix.split('.')[0];
}

const app = createApp({
  config,
  repository: new PrismaDataRepository(prisma),
  sessionStore: createPgSessionStore(config)
});

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', () => resolve()));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const origin = config.WEB_ORIGIN;
const unique = Date.now();
const customerEmail = `flow.customer.${unique}@example.com`;
const ownerEmail = `flow.owner.${unique}@example.com`;

async function csrfToken(cookie?: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { origin, ...(cookie ? { cookie } : {}) }
  });
  const body = (await response.json()) as { csrfToken: string };
  return body.csrfToken;
}

async function post(
  path: string,
  body: unknown,
  options: { cookie?: string; token?: string } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin,
    'x-csrf-token': options.token ?? (await csrfToken(options.cookie))
  };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

try {
  console.log('\n1. Customer registration (browser-shaped: Origin + CSRF header)');
  const registerRes = await post('/api/auth/register', {
    role: 'CUSTOMER',
    name: 'Flow Customer',
    email: `  ${customerEmail.toUpperCase()}  `,
    phone: `+26097${String(unique).slice(-7)}`,
    password: 'FlowCustomerPass123!'
  });
  const registerBody = (await registerRes.json()) as {
    user: { id: string; email: string; role: string; status: string };
    csrfToken: string;
  };
  check(registerRes.status === 201, 'registration returns 201', registerRes.status);
  check(registerBody.user?.email === customerEmail, 'email is normalised', registerBody.user?.email);
  check(registerBody.user?.role === 'CUSTOMER', 'role is CUSTOMER', registerBody.user?.role);
  const customerSetCookie = registerRes.headers.get('set-cookie') ?? '';
  check(/HttpOnly/i.test(customerSetCookie), 'session cookie is HttpOnly');
  check(/SameSite=Lax/i.test(customerSetCookie), 'session cookie is SameSite=Lax');
  check(
    !JSON.stringify(registerBody).includes('passwordHash'),
    'response never includes passwordHash'
  );

  const customerCookie = customerSetCookie.split(';')[0] ?? '';
  createdUserIds.push(registerBody.user.id);
  createdSids.push(cookieSid(customerCookie));

  console.log('\n2. PostgreSQL rows written by Prisma');
  const storedUser = await prisma.user.findUnique({ where: { email: customerEmail } });
  check(Boolean(storedUser), 'User row exists in PostgreSQL');
  check(
    typeof storedUser?.passwordHash === 'string' && storedUser.passwordHash.startsWith('$argon2id$'),
    'password is stored as an Argon2id hash'
  );
  check(storedUser?.status === 'ACTIVE', 'account status is ACTIVE', storedUser?.status);

  const sessionRows = await prisma.$queryRaw<Array<{ sid: string; expire: Date }>>`
    SELECT sid, expire FROM "session" WHERE sid = ${createdSids[0]}
  `;
  check(sessionRows.length === 1, 'session row exists in the PostgreSQL session table');
  check(
    sessionRows.length === 1 && new Date(sessionRows[0].expire).getTime() > Date.now(),
    'stored session expires in the future'
  );

  const auditRows = await prisma.auditEvent.findMany({ where: { actorId: registerBody.user.id } });
  check(auditRows.length >= 1, 'registration audit event recorded');

  console.log('\n3. Session persistence and account access');
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: customerCookie, origin }
  });
  check(meRes.status === 200, 'GET /api/auth/me returns 200 for the new session', meRes.status);
  const accountRes = await fetch(`${baseUrl}/api/account`, {
    headers: { cookie: customerCookie, origin }
  });
  check(accountRes.status === 200, 'GET /api/account returns 200', accountRes.status);

  console.log('\n4. CSRF enforcement');
  const tokenlessLogout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, cookie: customerCookie },
    body: '{}'
  });
  check(tokenlessLogout.status === 403, 'mutation without a CSRF token is rejected', tokenlessLogout.status);
  check(
    ((await tokenlessLogout.json()) as { error: { code: string } }).error.code === 'CSRF_MISSING',
    'rejection code is CSRF_MISSING'
  );

  const storedSessionBeforeLogout = await prisma.$queryRaw<Array<{ sid: string }>>`
    SELECT sid FROM "session" WHERE sid = ${createdSids[0]}
  `;
  check(storedSessionBeforeLogout.length === 1, 'rejected request left the session intact');

  console.log('\n5. Logout destroys the server-side session');
  const logoutRes = await post('/api/auth/logout', {}, { cookie: customerCookie, token: registerBody.csrfToken });
  check(logoutRes.status === 200, 'logout returns 200', logoutRes.status);
  const sessionRowsAfterLogout = await prisma.$queryRaw<Array<{ sid: string }>>`
    SELECT sid FROM "session" WHERE sid = ${createdSids[0]}
  `;
  check(sessionRowsAfterLogout.length === 0, 'session row deleted from PostgreSQL');
  const meAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: customerCookie, origin }
  });
  check(meAfterLogout.status === 401, 'old cookie is rejected after logout', meAfterLogout.status);

  console.log('\n6. Login and credential failures');
  const loginRes = await post('/api/auth/login', {
    email: customerEmail,
    password: 'FlowCustomerPass123!'
  });
  const loginBody = (await loginRes.json()) as { user: { id: string }; csrfToken: string };
  check(loginRes.status === 200, 'login returns 200', loginRes.status);
  const loginCookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  createdSids.push(cookieSid(loginCookie));
  check(cookieSid(loginCookie) !== createdSids[0], 'session id is regenerated on login (fixation defence)');

  const wrongPassword = await post('/api/auth/login', {
    email: customerEmail,
    password: 'WrongPassword123!'
  });
  check(wrongPassword.status === 401, 'incorrect password returns 401', wrongPassword.status);

  const duplicate = await post('/api/auth/register', {
    name: 'Duplicate Customer',
    email: customerEmail,
    password: 'FlowCustomerPass123!'
  });
  check(duplicate.status === 409, 'duplicate email returns 409', duplicate.status);

  const adminAttempt = await post('/api/auth/register', {
    role: 'ADMIN',
    name: 'Rogue Admin',
    email: `flow.admin.${unique}@example.com`,
    password: 'RogueAdminPass123!'
  });
  check(adminAttempt.status === 403, 'public ADMIN registration is forbidden', adminAttempt.status);

  console.log('\n7. Business owner registration creates a PENDING business');
  const ownerRes = await post('/api/auth/register', {
    role: 'BUSINESS_OWNER',
    name: 'Flow Owner',
    email: ownerEmail,
    phone: `+26096${String(unique).slice(-7)}`,
    password: 'FlowOwnerPass123!',
    business: {
      name: 'Flow Barbershop',
      city: 'Kitwe',
      location: 'Flow Street 1',
      phone: `+26096${String(unique).slice(-7)}`
    }
  });
  const ownerBody = (await ownerRes.json()) as {
    user: { id: string; role: string; ownedBusinesses: Array<{ id: string; status: string }> };
    csrfToken: string;
  };
  check(ownerRes.status === 201, 'owner registration returns 201', ownerRes.status);
  check(ownerBody.user?.role === 'BUSINESS_OWNER', 'role is BUSINESS_OWNER', ownerBody.user?.role);
  const createdBusiness = ownerBody.user?.ownedBusinesses?.[0];
  check(createdBusiness?.status === 'PENDING', 'business starts PENDING', createdBusiness?.status);
  createdUserIds.push(ownerBody.user.id);
  if (createdBusiness) {
    createdBusinessIds.push(createdBusiness.id);
  }
  const ownerCookie = (ownerRes.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  createdSids.push(cookieSid(ownerCookie));
  const storedBusiness = await prisma.business.findUnique({ where: { id: createdBusiness?.id } });
  check(storedBusiness?.ownerId === ownerBody.user.id, 'business is owned by the new owner');

  console.log('\n8. Role isolation on PostgreSQL-backed sessions');
  const customerToOwner = await fetch(`${baseUrl}/api/owner/businesses`, {
    headers: { cookie: loginCookie, origin }
  });
  check(customerToOwner.status === 403, 'customer is denied owner routes', customerToOwner.status);
  const customerToAdmin = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { cookie: loginCookie, origin }
  });
  check(customerToAdmin.status === 403, 'customer is denied admin routes', customerToAdmin.status);
  const ownerRoutes = await fetch(`${baseUrl}/api/owner/businesses`, {
    headers: { cookie: ownerCookie, origin }
  });
  check(ownerRoutes.status === 200, 'owner can access owner routes', ownerRoutes.status);
} finally {
  // Remove only the rows this run created.
  try {
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ actorId: { in: createdUserIds } }, { entityId: { in: [...createdUserIds, ...createdBusinessIds] } }] }
    });
    await prisma.business.deleteMany({ where: { id: { in: createdBusinessIds } } });
    await prisma.session.deleteMany({ where: { sid: { in: createdSids } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  } catch (error) {
    console.error('Cleanup warning:', error);
  }
  await prisma.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

if (failures > 0) {
  console.error(`\nPostgreSQL end-to-end verification FAILED (${failures} check(s)).`);
  process.exit(1);
}
console.log('\nPostgreSQL end-to-end verification passed.');
