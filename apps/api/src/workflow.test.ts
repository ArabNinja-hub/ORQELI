import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://orqeli:placeholder@localhost:5432/orqeli';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';

const { envSchema } = await import('./config.js');
const { createApp, hashPassword } = await import('./server.js');
const { InMemoryEducationRepository, PrismaEducationRepository } = await import('./repository.js');
const { createPgSessionStore, createSimulatedPgPool } = await import('./session.js');
const { populateSyntheticInMemoryDataset, SYNTHETIC_SANDBOX_CREDENTIAL } = await import(
  './syntheticData.js'
);

const WEB_ORIGIN = 'http://localhost:5173';
const activeServers: Array<ReturnType<ReturnType<typeof createApp>['listen']>> = [];

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!;
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }
});

async function setupWorkflowHarness() {
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
    sessionStore: createPgSessionStore(config, { pool: createSimulatedPgPool() })
  });

  const server = app.listen(0, '127.0.0.1');
  activeServers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function signIn(email: string) {
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`, { headers: { origin: WEB_ORIGIN } });
    const { csrfToken: anonToken } = (await csrfRes.json()) as { csrfToken: string };
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: WEB_ORIGIN,
        'x-csrf-token': anonToken
      },
      body: JSON.stringify({ email, password: SYNTHETIC_SANDBOX_CREDENTIAL })
    });
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

  return { baseUrl, repo, signIn };
}

test('strict school-level isolation denies staff at School B from accessing any School A resource', async () => {
  const { signIn } = await setupWorkflowHarness();
  const schoolBHead = await signIn('head.tembo@synthetic.orqeli.invalid');

  // Own school succeeds
  const ownSchool = await schoolBHead.get('/api/schools/sch_syn_eas_02/overview');
  assert.equal(ownSchool.status, 200);

  // Cross-school reads & writes all fail with 403 SCHOOL_ACCESS_DENIED
  for (const check of [
    () => schoolBHead.get('/api/schools/sch_syn_lus_01/overview'),
    () => schoolBHead.get('/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3'),
    () => schoolBHead.get('/api/schools/sch_syn_lus_01/audit-events'),
    () =>
      schoolBHead.mutate(
        'POST',
        '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/approve'
      ),
    () =>
      schoolBHead.get(
        '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g8b_t2/report-cards/lrn_syn_801'
      )
  ]) {
    const res = await check();
    assert.equal(res.status, 403);
    assert.equal(
      ((await res.json()) as { error: { code: string } }).error.code,
      'SCHOOL_ACCESS_DENIED'
    );
  }
});

test('subject allocation and score range rules prevent unauthorized or out-of-range mark entry', async () => {
  const { signIn } = await setupWorkflowHarness();
  // Teacher Mwamba teaches English & Social Studies in Grade 9A, NOT Mathematics
  const mwamba = await signIn('teacher.mwamba@synthetic.orqeli.invalid');

  const unallocatedSubjectAttempt = await mwamba.mutate(
    'PUT',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/marks',
    {
      entries: [
        {
          learnerId: 'lrn_syn_902',
          subjectId: 'sub_syn_math',
          status: 'PRESENT',
          score: 77,
          teacherComment: 'Unauthorized subject attempt'
        }
      ]
    }
  );
  assert.equal(unallocatedSubjectAttempt.status, 403);
  assert.equal(
    ((await unallocatedSubjectAttempt.json()) as { error: { code: string } }).error.code,
    'SUBJECT_ALLOCATION_REQUIRED'
  );

  // Teacher Banda IS allocated to Mathematics, but score > maxMark (100) must be rejected
  const banda = await signIn('teacher.banda@synthetic.orqeli.invalid');
  const outOfRange = await banda.mutate(
    'PUT',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/marks',
    {
      entries: [
        {
          learnerId: 'lrn_syn_902',
          subjectId: 'sub_syn_math',
          status: 'PRESENT',
          score: 105
        }
      ]
    }
  );
  assert.equal(outOfRange.status, 400);
  assert.equal(
    ((await outOfRange.json()) as { error: { code: string } }).error.code,
    'SCORE_OUT_OF_RANGE'
  );
});

test('full results lifecycle: missing-mark detection, revision cycle, approval gate, audit trail, printable report card, and guardian protection', async () => {
  const { signIn } = await setupWorkflowHarness();
  const teacher = await signIn('teacher.banda@synthetic.orqeli.invalid');
  const deputy = await signIn('deputy.zulu@synthetic.orqeli.invalid');
  const head = await signIn('head.mulenga@synthetic.orqeli.invalid');
  const guardian = await signIn('guardian.phiri@synthetic.orqeli.invalid');

  // 1. Guardian cannot access staff endpoints at all
  const guardianStaffAttempt = await guardian.get('/api/schools/sch_syn_lus_01/overview');
  assert.equal(guardianStaffAttempt.status, 403);

  // 2. Initially Guardian sees Lubasi's PUBLISHED Term 2 report card, and ZERO Term 3 reports for Tasha
  const initialGuardianRes = await guardian.get('/api/schools/sch_syn_lus_01/guardian/results');
  assert.equal(initialGuardianRes.status, 200);
  const initialGuardianBody = (await initialGuardianRes.json()) as {
    learners: Array<{
      learner: { id: string };
      publishedReports: Array<{ packId: string }>;
    }>;
  };
  const tashaInitial = initialGuardianBody.learners.find((l) => l.learner.id === 'lrn_syn_901')!;
  const lubasiInitial = initialGuardianBody.learners.find((l) => l.learner.id === 'lrn_syn_801')!;
  assert.equal(tashaInitial.publishedReports.length, 0);
  assert.equal(lubasiInitial.publishedReports.length, 1);

  // 3. Grade 9A Term 3 starts with 1 missing mark -> submission is blocked (409 INCOMPLETE_MARKS)
  const packBeforeRes = await teacher.get(
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3'
  );
  const packBefore = ((await packBeforeRes.json()) as {
    pack: { completeness: { missingCount: number; missingItems: Array<{ learnerId: string }> } };
  }).pack;
  assert.equal(packBefore.completeness.missingCount, 1);
  assert.equal(packBefore.completeness.missingItems[0].learnerId, 'lrn_syn_902');

  const blockedSubmit = await teacher.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/submit'
  );
  assert.equal(blockedSubmit.status, 409);
  assert.equal(
    ((await blockedSubmit.json()) as { error: { code: string } }).error.code,
    'INCOMPLETE_MARKS'
  );

  // Report card generation is blocked prior to approval
  const prematureReport = await head.get(
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/report-cards/lrn_syn_901'
  );
  assert.equal(prematureReport.status, 409);

  // 4. Teacher Banda enters the missing Mathematics mark (initial score 62) and submits
  const enterMissing = await teacher.mutate(
    'PUT',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/marks',
    {
      entries: [
        {
          learnerId: 'lrn_syn_902',
          subjectId: 'sub_syn_math',
          status: 'PRESENT',
          score: 62,
          teacherComment: 'Initial entry from paper script.'
        }
      ]
    }
  );
  assert.equal(enterMissing.status, 200);

  const submitRes = await teacher.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/submit'
  );
  assert.equal(submitRes.status, 200);

  // 5. While SUBMITTED, marks are locked against silent teacher edits
  const lockedEdit = await teacher.mutate(
    'PUT',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/marks',
    {
      entries: [
        {
          learnerId: 'lrn_syn_902',
          subjectId: 'sub_syn_math',
          status: 'PRESENT',
          score: 70
        }
      ]
    }
  );
  assert.equal(lockedEdit.status, 409);
  assert.equal(
    ((await lockedEdit.json()) as { error: { code: string } }).error.code,
    'RESULT_PACK_LOCKED'
  );

  // 6. Deputy Head reviews and returns pack for revision; Deputy cannot approve
  const deputyApproveAttempt = await deputy.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/approve'
  );
  assert.equal(deputyApproveAttempt.status, 403);

  const returnRevision = await deputy.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/request-revision',
    { reviewNotes: 'Recheck Section B total for Mwila Chibwe Mathematics script.' }
  );
  assert.equal(returnRevision.status, 200);
  assert.equal(
    ((await returnRevision.json()) as { pack: { status: string } }).pack.status,
    'NEEDS_REVISION'
  );

  // 7. Teacher corrects score to 73 and resubmits
  const corrected = await teacher.mutate(
    'PUT',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/marks',
    {
      entries: [
        {
          learnerId: 'lrn_syn_902',
          subjectId: 'sub_syn_math',
          status: 'PRESENT',
          score: 73,
          teacherComment: 'Verified Section B addition.'
        }
      ]
    }
  );
  assert.equal(corrected.status, 200);

  const resubmit = await teacher.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/submit'
  );
  assert.equal(resubmit.status, 200);

  // 8. Cannot skip explicit approval before publication
  const skipApprove = await head.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/publish'
  );
  assert.equal(skipApprove.status, 409);
  assert.equal(
    ((await skipApprove.json()) as { error: { code: string } }).error.code,
    'APPROVAL_REQUIRED_BEFORE_PUBLICATION'
  );

  // 9. Head Teacher approves -> staff can preview report card, but Guardian STILL cannot see it!
  const approveRes = await head.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/approve'
  );
  assert.equal(approveRes.status, 200);

  const staffPreview = await head.get(
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/report-cards/lrn_syn_901'
  );
  assert.equal(staffPreview.status, 200);
  assert.equal(
    ((await staffPreview.json()) as { reportCard: { publicationState: string } }).reportCard
      .publicationState,
    'APPROVED_PREVIEW'
  );

  const guardianWhileApproved = await guardian.get(
    '/api/schools/sch_syn_lus_01/guardian/results'
  );
  const tashaWhileApproved = (
    (await guardianWhileApproved.json()) as {
      learners: Array<{ learner: { id: string }; publishedReports: unknown[] }>;
    }
  ).learners.find((l) => l.learner.id === 'lrn_syn_901')!;
  assert.equal(tashaWhileApproved.publishedReports.length, 0);

  // 10. Head Teacher publishes -> Guardian immediately sees Tasha's published Term 3 report card
  const publishRes = await head.mutate(
    'POST',
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/publish'
  );
  assert.equal(publishRes.status, 200);

  const guardianAfterPublish = await guardian.get(
    '/api/schools/sch_syn_lus_01/guardian/results'
  );
  const tashaPublished = (
    (await guardianAfterPublish.json()) as {
      learners: Array<{
        learner: { id: string };
        publishedReports: Array<{
          reportCard: { publicationState: string; summary: { averagePercentage: number } };
        }>;
      }>;
    }
  ).learners.find((l) => l.learner.id === 'lrn_syn_901')!;
  assert.equal(tashaPublished.publishedReports.length, 1);
  assert.equal(tashaPublished.publishedReports[0].reportCard.publicationState, 'PUBLISHED');
  assert.equal(tashaPublished.publishedReports[0].reportCard.summary.averagePercentage, 78.5);

  // 11. Audit trail records before/after mark states and workflow transitions
  const auditRes = await head.get('/api/schools/sch_syn_lus_01/audit-events');
  assert.equal(auditRes.status, 200);
  const { events } = (await auditRes.json()) as {
    events: Array<{
      action: string;
      beforeState: Record<string, unknown> | null;
      afterState: Record<string, unknown> | null;
    }>;
  };
  const actions = events.map((e) => e.action);
  assert.ok(actions.includes('MARK_RECORDED'));
  assert.ok(actions.includes('MARK_UPDATED'));
  assert.ok(actions.includes('RESULT_PACK_SUBMITTED'));
  assert.ok(actions.includes('RESULT_PACK_RETURNED_FOR_REVISION'));
  assert.ok(actions.includes('RESULT_PACK_APPROVED'));
  assert.ok(actions.includes('RESULT_PACK_PUBLISHED'));

  const updatedMarkEvent = events.find((e) => e.action === 'MARK_UPDATED')!;
  assert.equal(updatedMarkEvent.beforeState?.score, 62);
  assert.equal(updatedMarkEvent.afterState?.score, 73);
});

test('PrismaEducationRepository enforces schoolId isolation and PUBLISHED-only guardian filter at the database query boundary', async () => {
  const capturedPackWhere: Array<Record<string, unknown>> = [];
  const capturedAuditWhere: Array<Record<string, unknown>> = [];

  const mockPrisma = {
    school: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        code: 'SYN-MOCK',
        name: 'Mock School',
        sector: 'GOVERNMENT',
        province: 'Lusaka',
        district: 'Lusaka',
        phone: null,
        email: null,
        timezone: 'Africa/Lusaka',
        isSyntheticDemo: true,
        status: 'ACTIVE'
      })
    },
    schoolMembership: {
      findFirst: async () => ({
        id: 'mem_g_1',
        schoolId: 'sch_target',
        userId: 'usr_g_1',
        role: 'PARENT_GUARDIAN',
        status: 'ACTIVE'
      })
    },
    learnerGuardianLink: {
      findMany: async () => [
        {
          id: 'lnk_1',
          schoolId: 'sch_target',
          membershipId: 'mem_g_1',
          learnerId: 'lrn_1',
          relationship: 'Guardian',
          learner: {
            id: 'lrn_1',
            admissionNumber: 'SYN-1',
            firstName: 'Test',
            lastName: 'Learner',
            guardianName: null,
            preferredChannel: 'PRINT_REPORT',
            schoolClass: { name: 'Grade 9A' }
          }
        }
      ]
    },
    termResultPack: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        capturedPackWhere.push(where);
        return [];
      }
    },
    auditEvent: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        capturedAuditWhere.push(where);
        return [];
      }
    }
  } as unknown as PrismaClient;

  const prismaRepo = new PrismaEducationRepository(mockPrisma);

  await prismaRepo.getGuardianPublishedResults({
    schoolId: 'sch_target',
    actorUserId: 'usr_g_1',
    actorMembershipId: 'mem_g_1',
    roles: ['PARENT_GUARDIAN']
  });

  assert.equal(capturedPackWhere.length, 1);
  assert.equal(capturedPackWhere[0].schoolId, 'sch_target');
  assert.equal(capturedPackWhere[0].status, 'PUBLISHED');

  await prismaRepo.listSchoolAuditEvents({
    schoolId: 'sch_target',
    actorUserId: 'usr_h_1',
    actorMembershipId: 'mem_h_1',
    roles: ['HEAD_TEACHER']
  });

  assert.equal(capturedAuditWhere.length, 1);
  assert.equal(capturedAuditWhere[0].schoolId, 'sch_target');
});
