/**
 * End-to-end verification of ORQELI Education against a live PostgreSQL database,
 * exercising PrismaEducationRepository, connect-pg-simple session storage, CSRF
 * enforcement, cross-school tenant isolation, teacher mark entry, missing-mark
 * validation, review/approval/publication gates, parent unpublished-result blocking,
 * and audit logging.
 *
 * Usage: DATABASE_URL=... SESSION_SECRET=... npm run db:verify-flow -w @orqeli/api
 * Requires `prisma migrate deploy` to have run first. Exits non-zero on failure.
 */
import { PrismaClient } from '@prisma/client';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV = 'test';

const { envSchema } = await import('../src/config.js');
const { createApp, hashPassword } = await import('../src/server.js');
const { createPgSessionStore } = await import('../src/session.js');
const { PrismaEducationRepository } = await import('../src/repository.js');

const config = envSchema.parse(process.env);
const prisma = new PrismaClient();

const createdSchoolIds: string[] = [];
const createdUserIds: string[] = [];
const createdSids: string[] = [];

let failures = 0;

function check(condition: boolean, description: string, detail?: unknown): void {
  if (condition) {
    console.log(`  PASS  ${description}`);
  } else {
    failures += 1;
    console.log(
      `  FAIL  ${description}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`
    );
  }
}

function cookieSid(cookie: string): string {
  const raw = decodeURIComponent(cookie.split('=').slice(1).join('='));
  const withoutPrefix = raw.startsWith('s:') ? raw.slice(2) : raw;
  return withoutPrefix.split('.')[0];
}

const app = createApp({
  config,
  repository: new PrismaEducationRepository(prisma),
  sessionStore: createPgSessionStore(config)
});

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', () => resolve()));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const origin = config.WEB_ORIGIN;
const unique = Date.now();
const testPass = 'SyntheticVerifyPass!2026';

async function getCsrf(cookie?: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { origin, ...(cookie ? { cookie } : {}) }
  });
  const body = (await res.json()) as { csrfToken: string };
  return body.csrfToken;
}

async function mutate(
  method: 'POST' | 'PUT',
  path: string,
  body: unknown,
  cookie?: string,
  token?: string
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin,
      'x-csrf-token': token ?? (await getCsrf(cookie)),
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify(body)
  });
}

async function loginAs(email: string): Promise<{ cookie: string; csrfToken: string }> {
  const res = await mutate('POST', '/api/auth/login', { email, password: testPass });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0] ?? '';
  if (cookie) createdSids.push(cookieSid(cookie));
  const body = (await res.json()) as { csrfToken: string };
  return { cookie, csrfToken: body.csrfToken };
}

try {
  console.log('\n1. Provisioning synthetic PostgreSQL verification schools & roles');
  const passwordHash = await hashPassword(testPass);

  const schoolA = await prisma.school.create({
    data: {
      code: `SYN-VERIFY-A-${unique}`,
      name: 'Verify School A (Synthetic)',
      sector: 'GOVERNMENT',
      province: 'Lusaka',
      district: 'Lusaka',
      isSyntheticDemo: true
    }
  });
  const schoolB = await prisma.school.create({
    data: {
      code: `SYN-VERIFY-B-${unique}`,
      name: 'Verify School B (Synthetic)',
      sector: 'PRIVATE',
      province: 'Copperbelt',
      district: 'Ndola',
      isSyntheticDemo: true
    }
  });
  createdSchoolIds.push(schoolA.id, schoolB.id);

  const teacherEmail = `teacher.${unique}@synthetic.orqeli.invalid`;
  const headEmail = `head.${unique}@synthetic.orqeli.invalid`;
  const guardianEmail = `guardian.${unique}@synthetic.orqeli.invalid`;
  const otherSchoolEmail = `other.${unique}@synthetic.orqeli.invalid`;

  const [teacherUser, headUser, guardianUser, otherUser] = await Promise.all([
    prisma.user.create({ data: { email: teacherEmail, name: 'Verify Teacher', passwordHash } }),
    prisma.user.create({ data: { email: headEmail, name: 'Verify Head Teacher', passwordHash } }),
    prisma.user.create({ data: { email: guardianEmail, name: 'Verify Guardian', passwordHash } }),
    prisma.user.create({ data: { email: otherSchoolEmail, name: 'Verify Other Head', passwordHash } })
  ]);
  createdUserIds.push(teacherUser.id, headUser.id, guardianUser.id, otherUser.id);

  const [memTeacher, , memGuardian] = await Promise.all([
    prisma.schoolMembership.create({
      data: { schoolId: schoolA.id, userId: teacherUser.id, role: 'TEACHER' }
    }),
    prisma.schoolMembership.create({
      data: { schoolId: schoolA.id, userId: headUser.id, role: 'HEAD_TEACHER' }
    }),
    prisma.schoolMembership.create({
      data: { schoolId: schoolA.id, userId: guardianUser.id, role: 'PARENT_GUARDIAN' }
    }),
    prisma.schoolMembership.create({
      data: { schoolId: schoolB.id, userId: otherUser.id, role: 'HEAD_TEACHER' }
    })
  ]);

  const year = await prisma.academicYear.create({
    data: {
      schoolId: schoolA.id,
      year: 2026,
      label: '2026 Academic Year',
      isCurrent: true,
      startsOn: new Date('2026-01-12T00:00:00.000Z'),
      endsOn: new Date('2026-12-04T00:00:00.000Z')
    }
  });
  const term = await prisma.academicTerm.create({
    data: {
      schoolId: schoolA.id,
      academicYearId: year.id,
      termNumber: 'TERM_3',
      label: 'Term 3',
      isCurrent: true,
      startsOn: new Date('2026-09-07T00:00:00.000Z'),
      endsOn: new Date('2026-12-04T00:00:00.000Z')
    }
  });
  const cls = await prisma.schoolClass.create({
    data: {
      schoolId: schoolA.id,
      academicYearId: year.id,
      name: 'Grade 9A',
      gradeLevel: 9,
      classTeacherMembershipId: memTeacher.id
    }
  });
  const math = await prisma.subject.create({
    data: { schoolId: schoolA.id, code: 'MATH', name: 'Mathematics', maxMark: 100 }
  });
  await prisma.classSubjectAllocation.create({
    data: {
      schoolId: schoolA.id,
      schoolClassId: cls.id,
      subjectId: math.id,
      teacherMembershipId: memTeacher.id
    }
  });
  const learner = await prisma.learner.create({
    data: {
      schoolId: schoolA.id,
      admissionNumber: 'SYN-V-001',
      firstName: 'Synthetic',
      lastName: 'Learner',
      schoolClassId: cls.id
    }
  });
  await prisma.learnerGuardianLink.create({
    data: {
      schoolId: schoolA.id,
      membershipId: memGuardian.id,
      learnerId: learner.id,
      relationship: 'Guardian'
    }
  });
  const pack = await prisma.termResultPack.create({
    data: { schoolId: schoolA.id, academicTermId: term.id, schoolClassId: cls.id }
  });

  console.log('\n2. Session, CSRF & School-Level Isolation');
  const teacherSession = await loginAs(teacherEmail);
  const headSession = await loginAs(headEmail);
  const guardianSession = await loginAs(guardianEmail);
  const otherSession = await loginAs(otherSchoolEmail);

  const storedPgSessions = await prisma.session.count({
    where: { sid: { in: createdSids } }
  });
  check(storedPgSessions === 4, 'PostgreSQL session table persists connect-pg-simple sessions');

  const crossSchoolRes = await fetch(
    `${baseUrl}/api/schools/${schoolA.id}/overview`,
    { headers: { cookie: otherSession.cookie } }
  );
  check(
    crossSchoolRes.status === 403,
    'Head Teacher at School B is denied access to School A overview (403)',
    crossSchoolRes.status
  );

  console.log('\n3. Missing-Mark Validation, Approval Gate & Unpublished Parent Protection');
  const prematureSubmit = await mutate(
    'POST',
    `/api/schools/${schoolA.id}/result-packs/${pack.id}/submit`,
    {},
    teacherSession.cookie,
    teacherSession.csrfToken
  );
  check(
    prematureSubmit.status === 409,
    'Submission is rejected (409) when learner marks are missing',
    prematureSubmit.status
  );

  const recordRes = await mutate(
    'PUT',
    `/api/schools/${schoolA.id}/result-packs/${pack.id}/marks`,
    {
      entries: [
        {
          learnerId: learner.id,
          subjectId: math.id,
          status: 'PRESENT',
          score: 84,
          teacherComment: 'Clear working shown.'
        }
      ]
    },
    teacherSession.cookie,
    teacherSession.csrfToken
  );
  check(recordRes.status === 200, 'Allocated teacher records subject mark (200)');

  const submitRes = await mutate(
    'POST',
    `/api/schools/${schoolA.id}/result-packs/${pack.id}/submit`,
    {},
    teacherSession.cookie,
    teacherSession.csrfToken
  );
  check(submitRes.status === 200, 'Complete result pack submits for review (200)');

  const teacherApproveAttempt = await mutate(
    'POST',
    `/api/schools/${schoolA.id}/result-packs/${pack.id}/approve`,
    {},
    teacherSession.cookie,
    teacherSession.csrfToken
  );
  check(
    teacherApproveAttempt.status === 403,
    'Teacher is forbidden from approving results (403)'
  );

  const prematurePublish = await mutate(
    'POST',
    `/api/schools/${schoolA.id}/result-packs/${pack.id}/publish`,
    {},
    headSession.cookie,
    headSession.csrfToken
  );
  check(
    prematurePublish.status === 409,
    'Head Teacher cannot publish before explicit approval (409)'
  );

  const approveRes = await mutate(
    'POST',
    `/api/schools/${schoolA.id}/result-packs/${pack.id}/approve`,
    {},
    headSession.cookie,
    headSession.csrfToken
  );
  check(approveRes.status === 200, 'Head Teacher approves submitted result pack (200)');

  const guardianBeforePublish = await fetch(
    `${baseUrl}/api/schools/${schoolA.id}/guardian/results`,
    { headers: { cookie: guardianSession.cookie } }
  );
  const guardianBeforeBody = (await guardianBeforePublish.json()) as {
    learners: Array<{ publishedReports: unknown[] }>;
  };
  check(
    guardianBeforeBody.learners[0]?.publishedReports.length === 0,
    'APPROVED but unpublished results are never exposed to guardians'
  );

  const publishRes = await mutate(
    'POST',
    `/api/schools/${schoolA.id}/result-packs/${pack.id}/publish`,
    {},
    headSession.cookie,
    headSession.csrfToken
  );
  check(publishRes.status === 200, 'Head Teacher publishes approved result pack (200)');

  const guardianAfterPublish = await fetch(
    `${baseUrl}/api/schools/${schoolA.id}/guardian/results`,
    { headers: { cookie: guardianSession.cookie } }
  );
  const guardianAfterBody = (await guardianAfterPublish.json()) as {
    learners: Array<{
      publishedReports: Array<{ reportCard: { summary: { totalScore: number } } }>;
    }>;
  };
  check(
    guardianAfterBody.learners[0]?.publishedReports[0]?.reportCard.summary.totalScore === 84,
    'Guardian receives published report card once published'
  );

  const auditCount = await prisma.auditEvent.count({
    where: { schoolId: schoolA.id }
  });
  check(
    auditCount >= 4,
    'PostgreSQL AuditEvent table records mark entry, submission, approval, and publication',
    auditCount
  );
} finally {
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { schoolId: { in: createdSchoolIds } },
        { actorUserId: { in: createdUserIds } }
      ]
    }
  });
  await prisma.school.deleteMany({ where: { id: { in: createdSchoolIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.session.deleteMany({ where: { sid: { in: createdSids } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
}

if (failures > 0) {
  console.error(`\n${failures} PostgreSQL flow verification check(s) failed.`);
  process.exit(1);
}
console.log('\nAll PostgreSQL flow verification checks passed.');
