import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const {
  AdminProvisioningError,
  describeDatabaseTarget,
  parseAdminProvisioningArgs,
  provisionAdmin
} = await import('./adminProvisioning.js');
const { InMemoryDataRepository } = await import('./repository.js');
const { hashPassword, verifyPassword } = await import('./passwords.js');

function codeOf(error: unknown): string {
  assert.ok(error instanceof AdminProvisioningError, 'Expected AdminProvisioningError');
  return error.code;
}

test('provisioning creates an ADMIN with an Argon2 hash, an audit event and no secrets in the profile', async () => {
  const repository = new InMemoryDataRepository();

  const created = await provisionAdmin({
    repository,
    confirmed: true,
    input: {
      name: '  Platform Admin  ',
      email: '  Admin@Orqeli.ZM ',
      phone: '+260 971 000 123',
      password: 'StrongAdminPassword123!'
    }
  });

  assert.equal(created.role, 'ADMIN');
  assert.equal(created.status, 'ACTIVE');
  assert.equal(created.email, 'admin@orqeli.zm');
  assert.equal(created.name, 'Platform Admin');

  const serializedProfile = JSON.stringify(created);
  assert.equal(serializedProfile.includes('passwordHash'), false);
  assert.equal(serializedProfile.includes('StrongAdminPassword123!'), false);
  assert.equal(serializedProfile.includes('$argon2'), false);

  const stored = await repository.findUserByEmail('admin@orqeli.zm');
  assert.ok(stored?.passwordHash);
  assert.match(stored.passwordHash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(stored.passwordHash, 'StrongAdminPassword123!'), true);
  assert.equal(await verifyPassword(stored.passwordHash, 'wrong-password'), false);
  assert.equal(stored.sessionVersion, 0);

  const audit = repository.getAuditEvents();
  const provisioningEvent = audit.find((event) => event.action === 'ADMIN_PROVISIONED');
  assert.ok(provisioningEvent, 'Provisioning must be audited');
  assert.equal(provisioningEvent.actorId, null);
  assert.equal(provisioningEvent.entityId, created.id);
  assert.deepEqual(provisioningEvent.metadata, { source: 'cli', role: 'ADMIN' });
  assert.equal(JSON.stringify(audit).includes('StrongAdminPassword123!'), false);
});

test('provisioning refuses to promote an existing account', async () => {
  const repository = new InMemoryDataRepository();
  repository.seedUser({
    id: 'usr_existing_customer',
    name: 'Existing Customer',
    email: 'existing@example.com',
    passwordHash: await hashPassword('ExistingPass123!'),
    role: 'CUSTOMER',
    status: 'ACTIVE'
  });

  await assert.rejects(
    provisionAdmin({
      repository,
      confirmed: true,
      input: {
        name: 'Wants Admin',
        email: 'existing@example.com',
        password: 'AttemptedEscalation123!'
      }
    }),
    (error: unknown) => codeOf(error) === 'ACCOUNT_EXISTS'
  );

  const unchanged = await repository.findUserByEmail('existing@example.com');
  assert.equal(unchanged?.role, 'CUSTOMER', 'An existing role must never be escalated');
});

test('provisioning requires explicit confirmation', async () => {
  const repository = new InMemoryDataRepository();

  await assert.rejects(
    provisionAdmin({
      repository,
      confirmed: false,
      input: { name: 'Unconfirmed Admin', email: 'unconfirmed@example.com', password: 'UnconfirmedPass123!' }
    }),
    (error: unknown) => codeOf(error) === 'NOT_CONFIRMED'
  );

  assert.equal(await repository.findUserByEmail('unconfirmed@example.com'), null);
});

test('provisioning rejects weak or malformed input without echoing the password', async () => {
  const repository = new InMemoryDataRepository();
  const attempts = [
    { name: 'Valid Name', email: 'admin.short@example.com', password: 'short' },
    { name: 'Valid Name', email: 'not-an-email', password: 'ValidAdminPassword123!' },
    { name: 'A', email: 'admin.name@example.com', password: 'ValidAdminPassword123!' }
  ];

  for (const input of attempts) {
    await assert.rejects(
      provisionAdmin({ repository, confirmed: true, input }),
      (error: unknown) => {
        assert.equal(codeOf(error), 'INVALID_INPUT');
        assert.equal((error as Error).message.includes(input.password), false);
        return true;
      }
    );
  }

  assert.equal(repository.getAuditEvents().length, 0);
});

test('the CLI argument parser accepts only documented flags and never the password', () => {
  const parsed = parseAdminProvisioningArgs([
    '--email',
    'admin@orqeli.zm',
    '--name',
    'Platform Admin',
    '--phone=+260971000123',
    '--password-stdin',
    '--yes'
  ]);

  assert.deepEqual(parsed, {
    email: 'admin@orqeli.zm',
    name: 'Platform Admin',
    phone: '+260971000123',
    passwordStdin: true,
    yes: true,
    help: false
  });

  assert.equal(parseAdminProvisioningArgs(['--help']).help, true);
  assert.equal(parseAdminProvisioningArgs(['-h']).help, true);

  const invalidArgv = [
    ['--password', 'plaintext'],
    ['--password=plaintext'],
    ['--unknown-flag'],
    ['--email'],
    ['positional@example.com'],
    ['--yes=maybe']
  ];

  for (const argv of invalidArgv) {
    assert.throws(
      () => parseAdminProvisioningArgs(argv),
      (error: unknown) => codeOf(error) === 'INVALID_INPUT',
      `Expected rejection for ${argv.join(' ')}`
    );
  }
});

test('the provisioning error type carries a stable code', () => {
  const error = new AdminProvisioningError('ACCOUNT_EXISTS', 'exists');
  assert.equal(error.code, 'ACCOUNT_EXISTS');
  assert.equal(error.name, 'AdminProvisioningError');
});

test('the database target description never reveals credentials or query secrets', () => {
  const target = describeDatabaseTarget(
    'postgresql://orqeli:sup3r-s3cret@db.internal.example:5432/orqeli?schema=public&password=leak'
  );
  assert.equal(target, 'db.internal.example:5432/orqeli (schema public)');
  assert.ok(!target.includes('sup3r-s3cret'));
  assert.ok(!target.includes('orqeli:'));
  assert.ok(!target.includes('leak'));
  assert.equal(describeDatabaseTarget(undefined), '(DATABASE_URL is not set)');
  assert.equal(describeDatabaseTarget('not a url'), '(unparseable DATABASE_URL)');
});
