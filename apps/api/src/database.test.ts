import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { resolveEnvFilePaths } = await import('./config.js');

const apiPackageDir = fileURLToPath(new URL('..', import.meta.url));
const prismaDir = path.join(apiPackageDir, 'prisma');

function readMigrationSql(): string {
  const migrationsDir = path.join(prismaDir, 'migrations');
  const migrationNames = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.ok(migrationNames.length > 0, 'At least one committed migration is required');
  return migrationNames
    .map((name) => fs.readFileSync(path.join(migrationsDir, name, 'migration.sql'), 'utf8'))
    .join('\n');
}

const schemaPrisma = fs.readFileSync(path.join(prismaDir, 'schema.prisma'), 'utf8');
const migrationSql = readMigrationSql();

const SCALAR_TYPES = new Set(['String', 'Int', 'Boolean', 'DateTime', 'Json', 'Float', 'BigInt', 'Decimal']);

function enumNames(schema: string): Set<string> {
  const names = new Set<string>();
  for (const match of schema.matchAll(/^enum\s+(\w+)\s*\{/gm)) {
    names.add(match[1]);
  }
  return names;
}

interface ParsedModel {
  name: string;
  tableName: string;
  columns: string[];
}

function parseModels(schema: string): ParsedModel[] {
  const enums = enumNames(schema);
  const models: ParsedModel[] = [];

  for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const name = match[1];
    const body = match[2];
    const mappedTable = body.match(/@@map\("([^"]+)"\)/)?.[1];
    const columns: string[] = [];

    for (const line of body.split('\n')) {
      const field = line.trim().match(/^(\w+)\s+([\w[\]]+)(\?|\[\])?/);
      if (!field) continue;
      const [, fieldName, rawType] = field;
      const baseType = rawType.replace('[]', '');
      if (!SCALAR_TYPES.has(baseType) && !enums.has(baseType)) continue;
      if (line.includes('@relation(')) continue;
      columns.push(fieldName);
    }

    models.push({ name, tableName: mappedTable ?? name, columns });
  }

  return models;
}

const models = parseModels(schemaPrisma);

test('every Prisma model has a committed migration table with all of its columns', () => {
  assert.ok(models.length >= 7, 'Expected the Prisma schema to define the application models');

  for (const model of models) {
    const createTable = migrationSql.match(
      new RegExp(`CREATE TABLE "${model.tableName}" \\(([\\s\\S]*?)\\n\\);`)
    );
    assert.ok(createTable, `No CREATE TABLE "${model.tableName}" found in the migrations`);

    for (const column of model.columns) {
      const columnPattern = new RegExp(`"${column}"\\s`);
      const createdWithTable = columnPattern.test(createTable[1]);
      const addedLater = new RegExp(`ALTER TABLE "${model.tableName}" ADD COLUMN\\s+"${column}"\\s`).test(
        migrationSql
      );
      assert.ok(
        createdWithTable || addedLater,
        `Column ${model.tableName}.${column} is modeled in Prisma but missing from the migrations`
      );
    }
  }
});

test('the session table matches the connect-pg-simple SQL contract', () => {
  // connect-pg-simple issues: INSERT INTO "session" (sess, expire, sid) ...
  // and SELECT ... WHERE sid = $1 AND expire >= to_timestamp($2)
  // so the table must have exactly these columns, types and the sid primary key.
  const sessionTable = migrationSql.match(/CREATE TABLE "session" \(([\s\S]*?)\n\);/);
  assert.ok(sessionTable, 'The session table must be created by a committed migration');
  const definition = sessionTable[1];

  assert.match(definition, /"sid"\s+VARCHAR\s+NOT NULL/);
  assert.match(definition, /"sess"\s+JSON\s+NOT NULL/);
  assert.match(definition, /"expire"\s+TIMESTAMP\(6\)\s+NOT NULL/);
  assert.match(migrationSql, /CONSTRAINT "session_pkey" PRIMARY KEY \("sid"\)/);
  assert.match(migrationSql, /CREATE INDEX "IDX_session_expire" ON "session"\("expire"\)/);

  const sessionModel = models.find((model) => model.name === 'Session');
  assert.ok(sessionModel, 'schema.prisma must keep the Session model used by the session store');
  assert.equal(sessionModel.tableName, 'session');
  assert.deepEqual([...sessionModel.columns].sort(), ['expire', 'sess', 'sid']);
});

test('authentication columns and defaults are present in the migrations', () => {
  assert.match(
    migrationSql,
    /CREATE TYPE "UserStatus" AS ENUM \('ACTIVE', 'DISABLED', 'SUSPENDED'\)/
  );
  assert.match(
    migrationSql,
    /ALTER TABLE "User" ADD COLUMN\s+"status" "UserStatus" NOT NULL DEFAULT 'ACTIVE'/
  );
  assert.match(migrationSql, /"passwordHash" TEXT/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "User_email_key" ON "User"\("email"\)/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "User_phone_key" ON "User"\("phone"\)/);
  // Booking instants stay timezone-aware so session/booking times are unambiguous.
  assert.match(migrationSql, /"startsAt" TIMESTAMPTZ\(3\) NOT NULL/);
  assert.match(migrationSql, /"endsAt" TIMESTAMPTZ\(3\) NOT NULL/);
});

test('the API .env lookup is independent of the process working directory', () => {
  // npm runs workspace scripts with cwd=apps/api, while the setup instructions
  // create the .env at the repository root. Both locations are resolved from the
  // module path, for src/ and for the compiled dist/ layout.
  for (const moduleDirectory of [
    path.join(apiPackageDir, 'src'),
    path.join(apiPackageDir, 'dist')
  ]) {
    assert.deepEqual(resolveEnvFilePaths(moduleDirectory), [
      path.join(apiPackageDir, '.env'),
      path.join(apiPackageDir, '..', '..', '.env')
    ]);
  }
});
