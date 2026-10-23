import { z } from 'zod';
import { normalizeEmail, type DataRepository } from './repository.js';
import type { SafeUserProfile } from './authz.js';
import { hashPassword } from './passwords.js';

/**
 * Controlled administrator provisioning used only by `npm run admin:create`
 * (apps/api/scripts/create-admin.ts). There is deliberately no HTTP route that
 * can create an ADMIN: public registration rejects the role, and this module
 * never promotes an existing account.
 */

export type AdminProvisioningErrorCode =
  | 'INVALID_INPUT'
  | 'ACCOUNT_EXISTS'
  | 'NOT_CONFIRMED'
  | 'TARGET_MISMATCH';

export class AdminProvisioningError extends Error {
  readonly code: AdminProvisioningErrorCode;

  constructor(code: AdminProvisioningErrorCode, message: string) {
    super(message);
    this.name = 'AdminProvisioningError';
    this.code = code;
  }
}

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(25, 'Phone number must be 25 characters or fewer.')
  .regex(/^[0-9+()\-\s]+$/, 'Phone number contains invalid characters.')
  .optional();

export const adminProvisioningInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(120, 'Name must be 120 characters or fewer.'),
  email: z
    .string()
    .trim()
    .email('A valid email address is required.')
    .max(254, 'Email address must be 254 characters or fewer.')
    .transform(normalizeEmail),
  phone: optionalPhoneSchema,
  password: z
    .string()
    .min(12, 'Administrator passwords must be at least 12 characters.')
    .max(128, 'Password must be 128 characters or fewer.')
    .refine((value) => value.trim().length >= 12, {
      message: 'Password cannot consist only of whitespace.'
    })
});

export type AdminProvisioningInput = z.input<typeof adminProvisioningInputSchema>;

export interface ProvisionAdminOptions {
  repository: Pick<DataRepository, 'findUserByEmail' | 'createAdminUser'>;
  input: AdminProvisioningInput;
  /** Provisioning must be explicitly confirmed by the operator. */
  confirmed: boolean;
}

export async function provisionAdmin({
  repository,
  input,
  confirmed
}: ProvisionAdminOptions): Promise<SafeUserProfile> {
  if (!confirmed) {
    throw new AdminProvisioningError(
      'NOT_CONFIRMED',
      'Administrator provisioning requires explicit confirmation (--yes).'
    );
  }

  const parsed = adminProvisioningInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AdminProvisioningError(
      'INVALID_INPUT',
      parsed.error.issues[0]?.message ?? 'Invalid administrator details.'
    );
  }

  // Never promote or modify an existing account: an existing e-mail address means
  // the operator must investigate manually instead of silently gaining ADMIN.
  const existing = await repository.findUserByEmail(parsed.data.email);
  if (existing) {
    throw new AdminProvisioningError(
      'ACCOUNT_EXISTS',
      'An account with this email address already exists. Provisioning never changes an existing account\'s role.'
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  return repository.createAdminUser({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ? parsed.data.phone.trim() : null,
    passwordHash
  });
}

export interface AdminProvisioningArgs {
  email?: string;
  name?: string;
  phone?: string;
  /** Exact credential-free description of the database the operator intends to write to. */
  expectTarget?: string;
  passwordStdin: boolean;
  yes: boolean;
  help: boolean;
}

const VALUE_FLAGS = new Set(['--email', '--name', '--phone', '--expect-target']);
const BOOLEAN_FLAGS = new Set(['--password-stdin', '--yes', '--help', '-h']);

/**
 * Strict argument parser. Unknown flags and stray positional arguments fail
 * closed so a typo can never silently provision the wrong account. The password
 * is never accepted as a command-line argument, which would leak it into shell
 * history and process listings.
 */
export function parseAdminProvisioningArgs(argv: string[]): AdminProvisioningArgs {
  const args: AdminProvisioningArgs = {
    passwordStdin: false,
    yes: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    const [flag, inlineValue] = raw.includes('=')
      ? [raw.slice(0, raw.indexOf('=')), raw.slice(raw.indexOf('=') + 1)]
      : [raw, undefined];

    if (BOOLEAN_FLAGS.has(flag)) {
      if (inlineValue !== undefined) {
        throw new AdminProvisioningError(
          'INVALID_INPUT',
          `The ${flag} flag does not take a value.`
        );
      }
      if (flag === '--password-stdin') args.passwordStdin = true;
      if (flag === '--yes') args.yes = true;
      if (flag === '--help' || flag === '-h') args.help = true;
      continue;
    }

    if (VALUE_FLAGS.has(flag)) {
      let value = inlineValue;
      if (value === undefined) {
        value = argv[index + 1];
        if (value === undefined || value.startsWith('--')) {
          throw new AdminProvisioningError('INVALID_INPUT', `The ${flag} flag requires a value.`);
        }
        index += 1;
      }
      if (value.trim().length === 0) {
        throw new AdminProvisioningError('INVALID_INPUT', `The ${flag} flag requires a value.`);
      }
      if (flag === '--email') args.email = value;
      if (flag === '--name') args.name = value;
      if (flag === '--phone') args.phone = value;
      if (flag === '--expect-target') args.expectTarget = value;
      continue;
    }

    if (flag === '--password') {
      throw new AdminProvisioningError(
        'INVALID_INPUT',
        'Passwords are not accepted on the command line. Use --password-stdin or the interactive prompt.'
      );
    }

    throw new AdminProvisioningError('INVALID_INPUT', `Unknown argument: ${raw}`);
  }

  return args;
}

/**
 * Reduces a database URL to a credential-free target description so the operator
 * can confirm which database the CLI is about to write to. Never returns user,
 * password or query-string values.
 */
export function describeDatabaseTarget(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    return '(DATABASE_URL is not set)';
  }
  try {
    const url = new URL(databaseUrl);
    const database = url.pathname.replace(/^\//, '') || '(default)';
    const schema = url.searchParams.get('schema');
    const host = url.hostname || '(local socket)';
    const port = url.port ? `:${url.port}` : '';
    return `${host}${port}/${database}${schema ? ` (schema ${schema})` : ''}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

/** Case/whitespace-insensitive comparison of two credential-free target descriptions. */
export function databaseTargetMatches(expected: string, actual: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(expected) === normalize(actual);
}

/**
 * `--yes` must never be a way to skip target validation: it only removes the
 * interactive prompt, not the requirement to name the database being written to.
 * Without `--expect-target` a non-interactive run is refused outright, and with a
 * mismatched value it is refused before any connection is opened.
 */
export function assertDatabaseTargetValidation(input: {
  expectedTarget: string | undefined;
  actualTarget: string;
  nonInteractive: boolean;
}): void {
  if (input.expectedTarget !== undefined) {
    if (!databaseTargetMatches(input.expectedTarget, input.actualTarget)) {
      throw new AdminProvisioningError(
        'TARGET_MISMATCH',
        `Refusing to run: --expect-target "${input.expectedTarget.trim()}" does not match the ` +
          `configured database "${input.actualTarget}". No connection was opened.`
      );
    }
    return;
  }

  if (input.nonInteractive) {
    throw new AdminProvisioningError(
      'INVALID_INPUT',
      '--yes requires --expect-target "<target>" copied exactly from the "Target database:" line. ' +
        'The flag removes the interactive prompt, never the target check. No connection was opened.'
    );
  }
}

/** The bare database name, used for the interactive confirmation prompt. */
export function describeDatabaseName(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    return '';
  }
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}
