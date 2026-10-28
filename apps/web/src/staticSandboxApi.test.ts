import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STATIC_SANDBOX_CREDENTIAL,
  handleStaticSandboxRequest,
  resetStaticSandboxState
} from './staticSandboxApi';

test('static sandbox enforces missing-mark detection, approval gate, guardian gating, and school isolation', async () => {
  resetStaticSandboxState();

  // 1. Guardian initially sees Grade 8B published report card, NOT unpublished Grade 9A
  const guardianLogin = await handleStaticSandboxRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'guardian.phiri@synthetic.orqeli.invalid',
      password: STATIC_SANDBOX_CREDENTIAL
    })
  });
  assert.equal(guardianLogin.status, 200);

  const initialGuardianRes = await handleStaticSandboxRequest(
    '/api/schools/sch_syn_lus_01/guardian/results'
  );
  assert.equal(initialGuardianRes.status, 200);
  const initialGuardian = (await initialGuardianRes.json()) as {
    learners: Array<{ learner: { id: string }; publishedReports: unknown[] }>;
  };
  const tashaBefore = initialGuardian.learners.find((l) => l.learner.id === 'lrn_syn_901');
  const lubasiBefore = initialGuardian.learners.find((l) => l.learner.id === 'lrn_syn_801');
  assert.equal(tashaBefore?.publishedReports.length, 0);
  assert.equal(lubasiBefore?.publishedReports.length, 1);

  // 2. Teacher Banda logs in, cannot access School 2, cannot submit incomplete Grade 9A, records missing mark, and submits
  await handleStaticSandboxRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'teacher.banda@synthetic.orqeli.invalid',
      password: STATIC_SANDBOX_CREDENTIAL
    })
  });

  const crossSchool = await handleStaticSandboxRequest(
    '/api/schools/sch_syn_eas_02/overview'
  );
  assert.equal(crossSchool.status, 403);

  const prematureSubmit = await handleStaticSandboxRequest(
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/submit',
    { method: 'POST' }
  );
  assert.equal(prematureSubmit.status, 409);

  const saveMark = await handleStaticSandboxRequest(
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/marks',
    {
      method: 'PUT',
      body: JSON.stringify({
        entries: [
          {
            learnerId: 'lrn_syn_902',
            subjectId: 'sub_syn_math',
            status: 'PRESENT',
            score: 77,
            teacherComment: 'Recovered missing exam script.'
          }
        ]
      })
    }
  );
  assert.equal(saveMark.status, 200);

  const submitRes = await handleStaticSandboxRequest(
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/submit',
    { method: 'POST' }
  );
  assert.equal(submitRes.status, 200);

  // 3. Head Teacher Mulenga approves and publishes Grade 9A
  await handleStaticSandboxRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'head.mulenga@synthetic.orqeli.invalid',
      password: STATIC_SANDBOX_CREDENTIAL
    })
  });

  const prematurePublish = await handleStaticSandboxRequest(
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/publish',
    { method: 'POST' }
  );
  assert.equal(prematurePublish.status, 409);

  const approveRes = await handleStaticSandboxRequest(
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/approve',
    { method: 'POST' }
  );
  assert.equal(approveRes.status, 200);

  const publishRes = await handleStaticSandboxRequest(
    '/api/schools/sch_syn_lus_01/result-packs/pck_syn_g9a_t3/publish',
    { method: 'POST' }
  );
  assert.equal(publishRes.status, 200);

  // 4. Guardian Phiri now sees Tasha Phiri's published Grade 9A report card
  await handleStaticSandboxRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'guardian.phiri@synthetic.orqeli.invalid',
      password: STATIC_SANDBOX_CREDENTIAL
    })
  });
  const afterGuardianRes = await handleStaticSandboxRequest(
    '/api/schools/sch_syn_lus_01/guardian/results'
  );
  const afterGuardian = (await afterGuardianRes.json()) as {
    learners: Array<{ learner: { id: string }; publishedReports: unknown[] }>;
  };
  const tashaAfter = afterGuardian.learners.find((l) => l.learner.id === 'lrn_syn_901');
  assert.equal(tashaAfter?.publishedReports.length, 1);
});
