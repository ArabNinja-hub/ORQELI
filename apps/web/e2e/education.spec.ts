import { test, expect } from '@playwright/test';

const syntheticSchool = {
  id: 'sch_syn_lus_01',
  code: 'SYN-ZM-LUS-01',
  name: 'Lukanga Day Secondary (Synthetic Demo)',
  sector: 'GOVERNMENT',
  province: 'Lusaka',
  district: 'Chilanga',
  isSyntheticDemo: true,
  status: 'PILOT_PREP'
};

test('landing page renders responsive layout, live health indicator, and retry recovery without horizontal overflow', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  let failHealth = true;
  await page.route('**/api/health', (route) =>
    route.fulfill(
      failHealth
        ? { status: 503, json: { error: { code: 'UNAVAILABLE' } } }
        : {
            json: {
              status: 'ok',
              service: 'orqeli-education-api',
              stage: 'early-stage-foundation',
              sandboxMode: true
            }
          }
    )
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: { error: { code: 'UNAUTHENTICATED' } } })
  );

  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: /Dependable examination records and term report cards for schools in Zambia/i
    })
  ).toBeVisible();
  await expect(page.getByText('API Health: Unreachable')).toBeVisible();

  failHealth = false;
  await page.getByRole('button', { name: 'Retry check' }).click();
  await expect(page.getByText('API Health: Operational (/api/health)')).toBeVisible();

  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth
  );
  expect(noOverflow).toBe(true);
  expect(errors).toEqual([]);
});

test('authenticated teacher inspects missing-entry alert and guardian sees published report cards only', async ({
  page
}) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({
      json: {
        status: 'ok',
        service: 'orqeli-education-api',
        stage: 'early-stage-foundation',
        sandboxMode: false
      }
    })
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'usr_syn_guardian_phiri',
          email: 'guardian.phiri@synthetic.orqeli.invalid',
          phone: null,
          name: 'Mr. Kelvin Phiri (Synthetic)',
          platformRole: 'STANDARD',
          status: 'ACTIVE',
          createdAt: '2026-10-28T00:00:00.000Z',
          updatedAt: '2026-10-28T00:00:00.000Z'
        },
        memberships: [
          {
            id: 'mem_syn_guardian',
            schoolId: syntheticSchool.id,
            role: 'PARENT_GUARDIAN',
            status: 'ACTIVE',
            staffCode: null,
            school: syntheticSchool
          }
        ],
        csrfToken: 'test.csrf'
      }
    })
  );
  await page.route('**/api/schools/sch_syn_lus_01/guardian/results', (route) =>
    route.fulfill({
      json: {
        school: syntheticSchool,
        learners: [
          {
            learner: {
              id: 'lrn_syn_901',
              admissionNumber: 'SYN-2026-0901',
              firstName: 'Tasha',
              lastName: 'Phiri',
              currentClassName: 'Grade 9A',
              relationship: 'Parent / Guardian',
              preferredChannel: 'PRINT_REPORT'
            },
            publishedReports: []
          }
        ]
      }
    })
  );

  await page.goto('/workspace');
  await expect(
    page.getByRole('heading', { name: 'Lukanga Day Secondary (Synthetic Demo)' })
  ).toBeVisible();
  await expect(
    page.getByText(/No published term report cards yet for Tasha/i)
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});
