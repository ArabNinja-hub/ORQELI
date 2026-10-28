import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const SCALAR_TYPES = new Set([
  'String',
  'Int',
  'Boolean',
  'DateTime',
  'Json',
  'Float',
  'BigInt',
  'Decimal'
]);

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
const enums = enumNames(schemaPrisma);

test('every Prisma enum and model has a committed migration definition with all columns', () => {
  assert.equal(models.length, 14, 'Expected the 14 ORQELI Education & session models');

  for (const enumName of enums) {
    assert.match(
      migrationSql,
      new RegExp(`CREATE TYPE "${enumName}" AS ENUM`),
      `Enum ${enumName} missing from migration.sql`
    );
  }

  for (const model of models) {
    const createTable = migrationSql.match(
      new RegExp(`CREATE TABLE "${model.tableName}" \\(([\\s\\S]*?)\\n\\);`)
    );
    assert.ok(createTable, `No CREATE TABLE "${model.tableName}" found in migrations`);

    for (const column of model.columns) {
      const columnPattern = new RegExp(`"${column}"\\s`);
      assert.ok(
        columnPattern.test(createTable[1]),
        `Column ${model.tableName}.${column} is modeled in Prisma but missing from migration.sql`
      );
    }
  }
});

test('obsolete marketplace tables and enums are completely absent from schema and migrations', () => {
  for (const legacySymbol of [
    'Business',
    'Service',
    'WorkingHour',
    'Booking',
    'BUSINESS_OWNER',
    'CUSTOMER'
  ]) {
    assert.doesNotMatch(schemaPrisma, new RegExp(`\\b${legacySymbol}\\b`));
    assert.doesNotMatch(migrationSql, new RegExp(`\\b${legacySymbol}\\b`));
  }
});

test('every domain academic table enforces school-level isolation via a schoolId foreign key', () => {
  const schoolTenantTables = [
    'SchoolMembership',
    'AcademicYear',
    'AcademicTerm',
    'SchoolClass',
    'Subject',
    'ClassSubjectAllocation',
    'Learner',
    'LearnerGuardianLink',
    'TermResultPack',
    'SubjectMark'
  ];

  for (const table of schoolTenantTables) {
    const model = models.find((m) => m.tableName === table);
    assert.ok(model?.columns.includes('schoolId'), `${table} must carry a schoolId column`);
    assert.match(
      migrationSql,
      new RegExp(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_schoolId_fkey" FOREIGN KEY \\("schoolId"\\) REFERENCES "School"\\("id"\\)`
      ),
      `${table} must enforce a foreign key to School(id)`
    );
  }
});

test('the session table matches the connect-pg-simple SQL contract', () => {
  const sessionTable = migrationSql.match(/CREATE TABLE "session" \(([\s\S]*?)\n\);/);
  assert.ok(sessionTable, 'The session table must be created by a committed migration');
  const definition = sessionTable[1];

  assert.match(definition, /"sid"\s+VARCHAR\s+NOT NULL/);
  assert.match(definition, /"sess"\s+JSON\s+NOT NULL/);
  assert.match(definition, /"expire"\s+TIMESTAMP\(6\)\s+NOT NULL/);
  assert.match(migrationSql, /CONSTRAINT "session_pkey" PRIMARY KEY \("sid"\)/);
  assert.match(migrationSql, /CREATE INDEX "IDX_session_expire" ON "session"\("expire"\)/);
});
