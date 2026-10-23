/**
 * Controlled initial administrator provisioning.
 *
 * Usage (from the repository root):
 *   npm run admin:create -- --email admin@example.com --name "Platform Admin"
 *
 * The password is read from an interactive hidden prompt or from stdin
 * (--password-stdin), never from the command line. The command refuses to run
 * without an explicit confirmation (--yes, or typing the e-mail address back)
 * and never promotes an existing account.
 *
 * This script is not executed by CI or the application; it must be run
 * deliberately by an operator with production database credentials.
 */
import { createInterface } from 'node:readline/promises';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config.js';
import { PrismaDataRepository, normalizeEmail } from '../src/repository.js';
import {
  AdminProvisioningError,
  describeDatabaseTarget,
  parseAdminProvisioningArgs,
  provisionAdmin
} from '../src/adminProvisioning.js';

const HELP = `ORQELI administrator provisioning

Usage:
  npm run admin:create -- --email <address> --name "<full name>" [options]

Options:
  --email <address>       Administrator email address (required)
  --name "<full name>"    Display name (required)
  --phone <number>        Optional phone number
  --password-stdin        Read the password from stdin instead of a hidden prompt
  --yes                   Skip the interactive confirmation (required when not a TTY)
  --help                  Show this help

The password is never accepted as an argument, is hashed with Argon2id and is
never printed. The command creates a new ADMIN only; it will not modify or
promote an existing account.
`;

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > 4096) {
      throw new AdminProvisioningError('INVALID_INPUT', 'Password input is too large.');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new AdminProvisioningError(
      'INVALID_INPUT',
      'No interactive terminal available. Pipe the password with --password-stdin instead.'
    );
  }

  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise<string>((resolve, reject) => {
    let value = '';

    const finish = (result: string | Error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', onData);
      process.stdout.write('\n');
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    };

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\r' || character === '\n' || character === '\u0004') {
          finish(value);
          return;
        }
        if (character === '\u0003') {
          finish(new Error('Cancelled.'));
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };

    process.stdin.on('data', onData);
  });
}

async function readPassword(passwordStdin: boolean): Promise<string> {
  if (passwordStdin) {
    const raw = await readAllStdin();
    const password = raw.replace(/\r?\n$/, '');
    if (password.includes('\n')) {
      throw new AdminProvisioningError('INVALID_INPUT', 'The password must be a single line.');
    }
    return password;
  }

  const first = await promptHidden('Administrator password: ');
  const second = await promptHidden('Repeat administrator password: ');
  if (first !== second) {
    throw new AdminProvisioningError('INVALID_INPUT', 'The passwords did not match.');
  }
  return first;
}

async function confirm(argvEmail: string | undefined, yes: boolean): Promise<boolean> {
  if (yes) {
    return true;
  }
  if (!process.stdin.isTTY) {
    throw new AdminProvisioningError(
      'NOT_CONFIRMED',
      'Confirmation requires --yes when running without a terminal.'
    );
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(
      `Type the administrator email (${argvEmail ?? ''}) to confirm: `
    );
    return normalizeEmail(answer) === normalizeEmail(argvEmail ?? '');
  } finally {
    readline.close();
  }
}

async function main(): Promise<number> {
  const args = parseAdminProvisioningArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }

  if (!args.email || !args.name) {
    process.stderr.write(HELP);
    throw new AdminProvisioningError(
      'INVALID_INPUT',
      '--email and --name are required. Use --help for usage.'
    );
  }

  // Show the target (host/database only, never credentials) before writing.
  process.stdout.write(
    `Target database: ${describeDatabaseTarget(env.DATABASE_URL)} (NODE_ENV=${env.NODE_ENV}).\n`
  );

  const confirmed = await confirm(args.email, args.yes);
  if (!confirmed) {
    throw new AdminProvisioningError('NOT_CONFIRMED', 'Confirmation failed; no account was created.');
  }

  const password = await readPassword(args.passwordStdin);
  if (password.length === 0) {
    throw new AdminProvisioningError('INVALID_INPUT', 'An empty password is not allowed.');
  }

  const prisma = new PrismaClient();
  try {
    const repository = new PrismaDataRepository(prisma);
    const created = await provisionAdmin({
      repository,
      confirmed: true,
      input: {
        name: args.name,
        email: args.email,
        phone: args.phone,
        password
      }
    });

    // Deliberately limited output: no password, no hash, no connection string.
    process.stdout.write(
      `Created administrator ${created.email ?? '(no email)'} (id ${created.id}, role ${created.role}) in ${env.NODE_ENV}.\n` +
        'Store the password in a password manager and share it with the operator out of band.\n'
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

try {
  const exitCode = await main();
  process.exitCode = exitCode;
} catch (error) {
  if (error instanceof AdminProvisioningError) {
    process.stderr.write(`Administrator provisioning failed (${error.code}): ${error.message}\n`);
  } else {
    // Never print stack traces or driver details: they can contain connection strings.
    const message = error instanceof Error ? error.message : 'Unknown error';
    process.stderr.write(`Administrator provisioning failed: ${message}\n`);
  }
  process.exitCode = 1;
}
