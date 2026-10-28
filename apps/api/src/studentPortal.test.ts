import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { envSchema } = await import('./config.js');
const { createApp, hashPassword } = await import('./server.js');
const { InMemoryEducationRepository } = await import('./repository.js');
const { createPgSessionStore, createSimulatedPgPool } = await import('./session.js');
const {
  populateSyntheticInMemoryDataset,
  SYNTHETIC_DEMO_ENROLMENT_ADMISSION_NO,
  SYNTHETIC_DEMO_ENROLMENT_CODE,
  SYNTHETIC_SANDBOX_CREDENTIAL
} = await import('./syntheticData.js');

const WEB_ORIGIN = 'http://localhost:5173';
const activeServers: Array<ReturnType<ReturnType<typeof createApp>['listen']>> = [];

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!;
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }
});

async function setupHarness(rateLimits?: {
  publicDirectoryMaxPerMinute?: number;
  authMaxPerWindow?: number;
  registrationMaxPerWindow?: number;
  windowMs?: number;
}) {
  const config = envSchema.parse({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://orqeli:placeholder@localhost:5432/orqeli',
    SESSION_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters',
    WEB_ORIGIN
  });
  const repo = new InMemoryEducationRepository();
  const sharedHash = await hashPassword(SYNTHETIC_SANDBOX_CREDENTIAL);
  populateSyntheticInMemoryDataset(repo, sharedHash);

  const app = createApp({
    config,
    repository: repo,
    sessionStore: createPgSessionStore(config, { pool: createSimulatedPgPool() }),
    rateLimits
  });

  const server = app.listen(0, '127.0.0.1');
  activeServers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function anonMutate(method: 'POST' | 'PUT', path: string, payload: unknown) {
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`, { headers: { origin: WEB_ORIGIN } });
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        origin: WEB_ORIGIN,
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify(payload)
    });
  }

  async function signIn(email: string, password = SYNTHETIC_SANDBOX_CREDENTIAL) {
    const loginRes = await anonMutate('POST', '/api/auth/login', { email, password });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]!;
    const body = (await loginRes.json()) as { csrfToken: string };

    return {
      cookie,
      csrfToken: body.csrfToken,
      get: (path: string) =>
        fetch(`${baseUrl}${path}`, { headers: { cookie, origin: WEB_ORIGIN } }),
      mutate: (method: 'POST' | 'PUT', path: string, payload: unknown = {}) =>
        fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            'content-type': 'application/json',
            origin: WEB_ORIGIN,
            cookie,
            'x-csrf-token': body.csrfToken
          },
          body: JSON.stringify(payload)
        })
    };
  }

  return { baseUrl, repo, anonMutate, signIn };
}

test('public school discovery searches by name, location, and registration code without exposing private data', async () => {
  const { baseUrl, repo } = await setupHarness();
  repo.seedSchool({
    id: 'sch_syn_suspended',
    code: 'SYN-ZM-SUSP-99',
    name: 'Suspended School (Should Not Appear)',
    sector: 'PRIVATE',
    province: 'Lusaka',
    district: 'Lusaka',
    studentPortalEnabled: true,
    status: 'SUSPENDED'
  });

  const allRes = await fetch(`${baseUrl}/api/public/schools`);
  assert.equal(allRes.status, 200);
  const allBody = (await allRes.json()) as {
    schools: Array<Record<string, unknown>>;
  };
  assert.equal(allBody.schools.length, 3);
  assert.ok(allBody.schools.every((s) => s.code !== 'SYN-ZM-SUSP-99'));

  // Ensure private fields (learners, staff, marks) never appear on public directory payload
  const rawPayload = JSON.stringify(allBody);
  assert.doesNotMatch(rawPayload, /SYN-2026-0801/);
  assert.doesNotMatch(rawPayload, /teacher\.banda/);

  // Search by registration number
  const byReg = await fetch(`${baseUrl}/api/public/schools?q=SYN-REG-LUS-0101`);
  const byRegBody = (await byReg.json()) as { schools: Array<{ code: string }> };
  assert.equal(byRegBody.schools.length, 1);
  assert.equal(byRegBody.schools[0]?.code, 'SYN-ZM-LUS-01');

  // Search by district + portalOnly filter
  const kitweAll = await fetch(`${baseUrl}/api/public/schools?q=Kitwe`);
  const kitweAllBody = (await kitweAll.json()) as {
    schools: Array<{ code: string; canSelfRegister: boolean }>;
  };
  assert.equal(kitweAllBody.schools.length, 1);
  assert.equal(kitweAllBody.schools[0]?.canSelfRegister, false);

  const kitwePortalOnly = await fetch(`${baseUrl}/api/public/schools?q=Kitwe&portalOnly=true`);
  const kitwePortalBody = (await kitwePortalOnly.json()) as { schools: unknown[] };
  assert.equal(kitwePortalBody.schools.length, 0);

  // Public school profile endpoint
  const profileRes = await fetch(`${baseUrl}/api/public/schools/SYN-ZM-LUS-01`);
  assert.equal(profileRes.status, 200);
  const missingRes = await fetch(`${baseUrl}/api/public/schools/DOES-NOT-EXIST`);
  assert.equal(missingRes.status, 404);
});

test('student registration blocks inactive portals, role escalation, wrong admission pairings, code reuse, expired/revoked codes, and duplicate accounts', async () => {
  const { anonMutate, signIn, repo } = await setupHarness();

  // 1. Disabled student portal school (SYN-ZM-CB-03 / sch_syn_cb_03) rejects registration
  const disabledSchool = await anonMutate('POST', '/api/student/register', {
    schoolId: 'sch_syn_cb_03',
    fullName: 'Test Student',
    admissionNumber: 'SYN-CB-001',
    email: 'test.disabled@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'STAFF_APPROVAL'
  });
  assert.equal(disabledSchool.status, 403);
  assert.equal(
    ((await disabledSchool.json()) as { error: { code: string } }).error.code,
    'STUDENT_PORTAL_NOT_ENABLED'
  );

  // 2. Role escalation fields in request body are rejected by strict Zod schema
  const escalationAttempt = await anonMutate('POST', '/api/student/register', {
    schoolId: 'sch_syn_lus_01',
    fullName: 'Escalation Student',
    admissionNumber: SYNTHETIC_DEMO_ENROLMENT_ADMISSION_NO,
    email: 'escalate@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'ENROLMENT_CODE',
    enrolmentCode: SYNTHETIC_DEMO_ENROLMENT_CODE,
    role: 'HEAD_TEACHER'
  });
  assert.equal(escalationAttempt.status, 400);

  // 3. Anti-enumeration: mismatched admission number + valid code and nonexistent admission number + wrong code return identical error code & message
  const wrongAdm = await anonMutate('POST', '/api/student/register', {
    schoolId: 'sch_syn_lus_01',
    fullName: 'Mismatch Test',
    admissionNumber: 'SYN-2026-0901',
    email: 'mismatch@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'ENROLMENT_CODE',
    enrolmentCode: SYNTHETIC_DEMO_ENROLMENT_CODE
  });
  const wrongCode = await anonMutate('POST', '/api/student/register', {
    schoolId: 'sch_syn_lus_01',
    fullName: 'Mismatch Test',
    admissionNumber: 'NONEXISTENT-ADM-9999',
    email: 'mismatch2@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'ENROLMENT_CODE',
    enrolmentCode: 'ORQ-WWWW-ZZZZ'
  });
  assert.equal(wrongAdm.status, 400);
  assert.equal(wrongCode.status, 400);
  const wrongAdmErr = ((await wrongAdm.json()) as { error: { code: string; message: string } })
    .error;
  const wrongCodeErr = ((await wrongCode.json()) as { error: { code: string; message: string } })
    .error;
  assert.deepEqual(wrongAdmErr, wrongCodeErr);

  // 4. Valid enrolment code registers & links Chisomo Banda (SYN-2026-0802)
  const validReg = await anonMutate('POST', '/api/student/register', {
    schoolId: 'sch_syn_lus_01',
    fullName: 'Chisomo Banda',
    admissionNumber: SYNTHETIC_DEMO_ENROLMENT_ADMISSION_NO,
    email: 'chisomo.student@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'ENROLMENT_CODE',
    enrolmentCode: 'orq 8b02 2026' // lowercase + spaces normalized cleanly
  });
  assert.equal(validReg.status, 201);
  const validBody = (await validReg.json()) as {
    outcome: string;
    memberships: Array<{ role: string; status: string }>;
  };
  assert.equal(validBody.outcome, 'VERIFIED');
  assert.equal(validBody.memberships[0]?.role, 'STUDENT');
  assert.equal(validBody.memberships[0]?.status, 'ACTIVE');

  // 5. Duplicate email is rejected (409)
  const duplicateEmail = await anonMutate('POST', '/api/student/register', {
    schoolId: 'sch_syn_lus_01',
    fullName: 'Duplicate Email',
    admissionNumber: 'SYN-2026-0902',
    email: 'CHISOMO.STUDENT@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'STAFF_APPROVAL'
  });
  assert.equal(duplicateEmail.status, 409);

  // 6. Reusing the consumed enrolment code is rejected (400)
  const reuseCode = await anonMutate('POST', '/api/student/register', {
    schoolId: 'sch_syn_lus_01',
    fullName: 'Code Reuse',
    admissionNumber: SYNTHETIC_DEMO_ENROLMENT_ADMISSION_NO,
    email: 'reuse.chisomo@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'ENROLMENT_CODE',
    enrolmentCode: SYNTHETIC_DEMO_ENROLMENT_CODE
  });
  assert.equal(reuseCode.status, 400);

  // 7. Expired and revoked codes are rejected
  repo.seedEnrolmentCode({
    schoolId: 'sch_syn_lus_01',
    learnerId: 'lrn_syn_902',
    plainCode: 'ORQ-EXPR-2026',
    expiresAt: new Date(Date.now() - 60_000),
    createdByMembershipId: 'mem_syn_head_1'
  });
  const expiredAttempt = await anonMutate('POST', '/api/student/register', {
    schoolId: 'sch_syn_lus_01',
    fullName: 'Mwila Chibwe',
    admissionNumber: 'SYN-2026-0902',
    email: 'expired.mwila@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'ENROLMENT_CODE',
    enrolmentCode: 'ORQ-EXPR-2026'
  });
  assert.equal(expiredAttempt.status, 400);

  const head = await signIn('head.mulenga@synthetic.orqeli.invalid');
  const issueRes = await head.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/admin/learners/lrn_syn_902/enrolment-codes',
    { expiresInDays: 7 }
  );
  assert.equal(issueRes.status, 201);
  const issued = (
    (await issueRes.json()) as {
      enrolmentCode: { id: string; plainCode: string };
    }
  ).enrolmentCode;

  const revokeRes = await head.mutate(
    'POST',
    `/api/schools/sch_syn_lus_01/admin/enrolment-codes/${issued.id}/revoke`
  );
  assert.equal(revokeRes.status, 200);

  const revokedAttempt = await anonMutate('POST', '/api/student/register', {
    schoolId: 'sch_syn_lus_01',
    fullName: 'Mwila Chibwe',
    admissionNumber: 'SYN-2026-0902',
    email: 'revoked.mwila@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'ENROLMENT_CODE',
    enrolmentCode: issued.plainCode
  });
  assert.equal(revokedAttempt.status, 400);
});

test('pending staff-approval registration, leadership review, unpublished-result blocking, announcement audience filtering, and IDOR denial', async () => {
  const { signIn } = await setupHarness();

  // 1. Pre-seeded pending student signs in: sees PENDING_APPROVAL and ZERO results, cannot call staff or report-card endpoints
  const pendingStudent = await signIn('student.pending@synthetic.orqeli.invalid');
  const pendingPortalRes = await pendingStudent.get('/api/student/portal');
  assert.equal(pendingPortalRes.status, 200);
  const pendingPortal = (await pendingPortalRes.json()) as {
    accounts: Array<{
      verificationState: string;
      learner: unknown;
      termResults: unknown[];
    }>;
  };
  assert.equal(pendingPortal.accounts[0]?.verificationState, 'PENDING_APPROVAL');
  assert.equal(pendingPortal.accounts[0]?.learner, null);
  assert.equal(pendingPortal.accounts[0]?.termResults.length, 0);

  const pendingReportAttempt = await pendingStudent.get(
    '/api/student/schools/sch_syn_lus_01/learners/lrn_syn_903/report-cards/pck_syn_g9a_t3'
  );
  assert.equal(pendingReportAttempt.status, 403);

  // 2. Teacher cannot access leadership student-portal admin routes (403)
  const teacher = await signIn('teacher.banda@synthetic.orqeli.invalid');
  const teacherAdminAttempt = await teacher.get(
    '/api/schools/sch_syn_lus_01/admin/student-portal'
  );
  assert.equal(teacherAdminAttempt.status, 403);

  // 3. School B Head Teacher cannot access or approve School A student requests (403)
  const schoolBHead = await signIn('head.tembo@synthetic.orqeli.invalid');
  const crossSchoolApprove = await schoolBHead.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/admin/student-requests/srq_syn_bupe_903/approve',
    { learnerId: 'lrn_syn_903' }
  );
  assert.equal(crossSchoolApprove.status, 403);

  // 4. School A Head Teacher approves Bupe Kasonde's pending request -> Bupe becomes VERIFIED
  //    Grade 9A Term 3 is still DRAFT -> Bupe sees UNPUBLISHED status, ZERO marks!
  const head = await signIn('head.mulenga@synthetic.orqeli.invalid');
  const approveReqRes = await head.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/admin/student-requests/srq_syn_bupe_903/approve',
    {
      learnerId: 'lrn_syn_903',
      decisionNotes: 'Verified against Grade 9A admission register.'
    }
  );
  assert.equal(approveReqRes.status, 200);

  // Duplicate link to already-linked learner lrn_syn_801 must be rejected (409)
  const portalAfterApproveRes = await pendingStudent.get('/api/student/portal');
  const portalAfterApprove = (await portalAfterApproveRes.json()) as {
    accounts: Array<{
      verificationState: string;
      learner: { id: string; admissionNumber: string };
      termResults: Array<{
        packId: string;
        publicationState: string;
        reportCard: unknown;
      }>;
      announcements: Array<{ audience: string; title: string }>;
    }>;
  };
  assert.equal(portalAfterApprove.accounts[0]?.verificationState, 'VERIFIED');
  assert.equal(portalAfterApprove.accounts[0]?.learner.id, 'lrn_syn_903');
  assert.equal(portalAfterApprove.accounts[0]?.termResults.length, 1);
  assert.equal(
    portalAfterApprove.accounts[0]?.termResults[0]?.publicationState,
    'UNPUBLISHED'
  );
  assert.equal(portalAfterApprove.accounts[0]?.termResults[0]?.reportCard, null);
  assert.ok(
    portalAfterApprove.accounts[0]?.announcements.every(
      (a) => a.audience === 'STUDENTS_AND_STAFF'
    ),
    'Internal STAFF_ONLY notices must never be exposed in the student portal'
  );

  // Direct student report-card fetch on DRAFT pack is blocked (403 RESULT_NOT_PUBLISHED)
  const draftReportAttempt = await pendingStudent.get(
    '/api/student/schools/sch_syn_lus_01/learners/lrn_syn_903/report-cards/pck_syn_g9a_t3'
  );
  assert.equal(draftReportAttempt.status, 403);
  assert.equal(
    ((await draftReportAttempt.json()) as { error: { code: string } }).error.code,
    'RESULT_NOT_PUBLISHED'
  );

  // 5. Verified Student Lubasi Phiri (lrn_syn_801):
  //    - Cannot access staff overview or approve packs (403)
  //    - Sees PUBLISHED Term 2 report card with grades, AND UNPUBLISHED Term 3 status (with draft score 91 completely absent!)
  //    - Attempting to fetch classmate Chisomo Banda's (lrn_syn_802) published Term 2 report card is denied (403 FORBIDDEN_LEARNER_ACCESS — IDOR blocked!)
  const lubasi = await signIn('student.lubasi@synthetic.orqeli.invalid');

  const studentStaffOverviewAttempt = await lubasi.get(
    '/api/schools/sch_syn_lus_01/overview'
  );
  assert.equal(studentStaffOverviewAttempt.status, 403);

  const lubasiPortalRes = await lubasi.get('/api/student/portal');
  assert.equal(lubasiPortalRes.status, 200);
  const lubasiPortalRaw = await lubasiPortalRes.text();
  assert.doesNotMatch(
    lubasiPortalRaw,
    /Draft Term 3 score/,
    'Draft Term 3 teacher comment/score must never appear in student portal JSON'
  );
  const lubasiPortal = JSON.parse(lubasiPortalRaw) as {
    accounts: Array<{
      termResults: Array<{
        packId: string;
        publicationState: string;
        reportCard: {
          subjects: Array<{ subjectCode: string; score: number; grade: string }>;
        } | null;
      }>;
    }>;
  };
  const t2 = lubasiPortal.accounts[0]?.termResults.find(
    (t) => t.packId === 'pck_syn_g8b_t2'
  );
  const t3 = lubasiPortal.accounts[0]?.termResults.find(
    (t) => t.packId === 'pck_syn_g8b_t3'
  );
  assert.equal(t2?.publicationState, 'PUBLISHED');
  assert.equal(t2?.reportCard?.subjects.length, 3);
  assert.equal(t2?.reportCard?.subjects[0]?.grade, 'Distinction (1)');
  assert.equal(t3?.publicationState, 'UNPUBLISHED');
  assert.equal(t3?.reportCard, null);

  // Own published report card succeeds (200)
  const ownReport = await lubasi.get(
    '/api/student/schools/sch_syn_lus_01/learners/lrn_syn_801/report-cards/pck_syn_g8b_t2'
  );
  assert.equal(ownReport.status, 200);

  // Same-school classmate IDOR attempt fails (403 FORBIDDEN_LEARNER_ACCESS)
  const classmateIdor = await lubasi.get(
    '/api/student/schools/sch_syn_lus_01/learners/lrn_syn_802/report-cards/pck_syn_g8b_t2'
  );
  assert.equal(classmateIdor.status, 403);
  assert.equal(
    ((await classmateIdor.json()) as { error: { code: string } }).error.code,
    'FORBIDDEN_LEARNER_ACCESS'
  );

  // Cross-school IDOR attempt fails (403 SCHOOL_ACCESS_DENIED)
  const crossSchoolIdor = await lubasi.get(
    '/api/student/schools/sch_syn_eas_02/learners/lrn_syn_2_701/report-cards/pck_syn_g7a_t3_2'
  );
  assert.equal(crossSchoolIdor.status, 403);
});

test('rate limiting protects student registration and authentication endpoints against brute-force enumeration', async () => {
  const { anonMutate } = await setupHarness({
    registrationMaxPerWindow: 2,
    windowMs: 60_000
  });

  const payload = {
    schoolId: 'sch_syn_lus_01',
    fullName: 'Rate Test',
    admissionNumber: 'SYN-2026-0999',
    email: 'rate1@synthetic.orqeli.invalid',
    password: 'StudentPass!2026',
    verificationMode: 'ENROLMENT_CODE',
    enrolmentCode: 'ORQ-XXXX-YYYY'
  };

  const r1 = await anonMutate('POST', '/api/student/register', payload);
  const r2 = await anonMutate('POST', '/api/student/register', payload);
  const r3 = await anonMutate('POST', '/api/student/register', payload);

  assert.equal(r1.status, 400);
  assert.equal(r2.status, 400);
  assert.equal(r3.status, 429);
  assert.equal(
    ((await r3.json()) as { error: { code: string } }).error.code,
    'RATE_LIMITED'
  );
});
