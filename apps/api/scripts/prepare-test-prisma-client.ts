/**
 * Generates a test-only Prisma Client that talks to PostgreSQL through the `pg`
 * driver adapter instead of a native query engine.
 *
 * The production client (`@prisma/client`) is untouched: this script writes a
 * throwaway copy of `prisma/schema.prisma` with `engineType = "client"` and an
 * isolated output directory, so the real `PrismaDataRepository` code can be
 * exercised against PostgreSQL in environments where the native engine binary is
 * unavailable (for example a sandbox with restricted egress).
 *
 * Usage: npm run db:test-client -w @orqeli/api
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptDirectory, '..');
const sourceSchema = path.join(apiRoot, 'prisma', 'schema.prisma');
const workDirectory = path.join(apiRoot, '.prisma-test-client');
const generatedClientDirectory = path.join(workDirectory, 'client');
const testSchemaPath = path.join(workDirectory, 'schema.prisma');

if (!existsSync(sourceSchema)) {
  console.error(`Cannot find ${sourceSchema}`);
  process.exit(1);
}

const schema = readFileSync(sourceSchema, 'utf8');
const generatorPattern = /generator\s+client\s*\{[^}]*\}/;
if (!generatorPattern.test(schema)) {
  console.error('prisma/schema.prisma has no "generator client" block.');
  process.exit(1);
}

const outputPath = generatedClientDirectory.replace(/\\/g, '/');
const testSchema = schema.replace(
  generatorPattern,
  [
    'generator client {',
    '  provider   = "prisma-client-js"',
    `  output     = "${outputPath}"`,
    '  // Test-only: uses the WASM query compiler + pg driver adapter.',
    '  engineType = "client"',
    '}'
  ].join('\n')
);

mkdirSync(workDirectory, { recursive: true });
writeFileSync(testSchemaPath, testSchema, 'utf8');

console.log(`Prepared test schema at ${path.relative(apiRoot, testSchemaPath)}`);

execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'generate', '--schema', testSchemaPath],
  {
    cwd: apiRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      // The schema references env("DATABASE_URL"); generation never connects.
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/orqeli'
    }
  }
);

// Record which version of the canonical schema produced this client so the
// verification scripts can refuse to run against a stale build.
writeFileSync(
  path.join(workDirectory, 'schema.sha256'),
  createHash('sha256').update(schema, 'utf8').digest('hex'),
  'utf8'
);

console.log('Generated the PostgreSQL driver-adapter test client.');
