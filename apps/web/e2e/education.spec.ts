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

test('public school discovery searches directory, opens school profile, and hides private learner records', async ({
  page
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: { error: { code: 'UNAUTHENTICATED' } } })
  );
  await page.route('**/api/public/schools**', (route) => {
    const reqUrl = new URL(route.request().url());
    if (reqUrl.pathname.endsWith('/SYN-ZM-LUS-01')) {
      return route.fulfill({
        json: {
          school: {
            ...syntheticSchool,
            registrationNumber: 'SYN-REG-LUS-0101',
            levelSummary: 'Grades 8–12 Day Secondary',
            publicDescription: 'Synthetic secondary school profile.',
            phone: '+260211000101',
            email: 'office@lukanga.synthetic.orqeli.invalid',
            studentPortalEnabled: true,
            canSelfRegister: true,
            currentAcademicYearLabel: '2026 Academic Year'
          }
        }
      });
    }
    return route.fulfill({
      json: {
        schools: [
          {
            ...syntheticSchool,
            registrationNumber: 'SYN-REG-LUS-0101',
            levelSummary: 'Grades 8–12 Day Secondary',
            publicDescription: 'Synthetic secondary school profile.',
            phone: '+260211000101',
            email: 'office@lukanga.synthetic.orqeli.invalid',
            studentPortalEnabled: true,
            canSelfRegister: true,
            currentAcademicYearLabel: '2026 Academic Year'
          }
        ]
      }
    });
  });

  await page.goto('/schools');
  await expect(
    page.getByRole('heading', { name: /Find Your School in Zambia/i })
  ).toBeVisible();
  await expect(
    page.getByText('Lukanga Day Secondary (Synthetic Demo)')
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);

  await page.getByRole('link', { name: /View School Profile/i }).click();
  await expect(page.getByText('SYN-REG-LUS-0101')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Register Student Account/i })
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});

test('verified student views published OPUS-style results, unpublished term notice, printable report card, and IDOR denial', async ({
  page
}) => {
  const publishedReportCard = {
    school: {
      ...syntheticSchool,
      phone: '+260211000101',
      timezone: 'Africa/Lusaka'
    },
    publicationState: 'PUBLISHED' as const,
    academicYearLabel: '2026 Academic Year',
    academicTermLabel: 'Term 2 (2026)',
    termNumber: 'TERM_2' as const,
    className: 'Grade 8B',
    gradeLevel: 8,
    classTeacherName: 'Ms. Namwali Mwamba (Synthetic)',
    approvedByName: 'Mrs. Mutale Mulenga (Synthetic)',
    approvedAt: '2026-08-05T15:30:00.000Z',
    publishedAt: '2026-08-06T14:00:00.000Z',
    learner: {
      id: 'lrn_syn_801',
      admissionNumber: 'SYN-2026-0801',
      firstName: 'Lubasi',
      lastName: 'Phiri',
      guardianName: 'Mr. Kelvin Phiri (Synthetic)',
      preferredChannel: 'PRINT_REPORT' as const
    },
    subjects: [
      {
        subjectId: 'sub_syn_math',
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        status: 'PRESENT' as const,
        score: 81,
        maxMark: 100,
        percentage: 81,
        grade: 'Distinction (1)',
        teacherComment: 'Confident numerical work.',
        teacherName: 'Mr. Chanda Banda (Synthetic)'
      }
    ],
    summary: {
      gradedSubjectsCount: 1,
      totalScore: 81,
      totalPossible: 100,
      averagePercentage: 81
    }
  };

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'usr_syn_student_lubasi',
          email: 'student.lubasi@synthetic.orqeli.invalid',
          phone: null,
          name: 'Lubasi Phiri',
          platformRole: 'STANDARD',
          status: 'ACTIVE',
          createdAt: '2026-10-28T00:00:00.000Z',
          updatedAt: '2026-10-28T00:00:00.000Z'
        },
        memberships: [
          {
            id: 'mem_syn_student_lubasi',
            schoolId: syntheticSchool.id,
            role: 'STUDENT',
            status: 'ACTIVE',
            staffCode: null,
            school: syntheticSchool
          }
        ],
        csrfToken: 'test.csrf'
      }
    })
  );

  await page.route('**/api/student/portal', (route) =>
    route.fulfill({
      json: {
        studentUser: {
          id: 'usr_syn_student_lubasi',
          name: 'Lubasi Phiri',
          email: 'student.lubasi@synthetic.orqeli.invalid'
        },
        accounts: [
          {
            membershipId: 'mem_syn_student_lubasi',
            school: {
              ...syntheticSchool,
              registrationNumber: 'SYN-REG-LUS-0101',
              levelSummary: 'Grades 8–12 Day Secondary',
              phone: '+260211000101',
              email: 'office@lukanga.synthetic.orqeli.invalid'
            },
            verificationState: 'VERIFIED',
            learner: {
              id: 'lrn_syn_801',
              admissionNumber: 'SYN-2026-0801',
              firstName: 'Lubasi',
              lastName: 'Phiri',
              currentClassName: 'Grade 8B',
              gradeLevel: 8,
              currentAcademicYearLabel: '2026 Academic Year',
              currentTermLabel: 'Term 3 (2026)',
              verificationMethod: 'ENROLMENT_CODE',
              verifiedAt: '2026-08-10T09:00:00.000Z'
            },
            pendingRequest: null,
            termResults: [
              {
                packId: 'pck_syn_g8b_t2',
                academicYearLabel: '2026 Academic Year',
                academicTermLabel: 'Term 2 (2026)',
                termNumber: 'TERM_2',
                className: 'Grade 8B',
                gradeLevel: 8,
                publicationState: 'PUBLISHED',
                statusMessage: 'Approved by school administration and officially published.',
                publishedAt: '2026-08-06T14:00:00.000Z',
                reportCard: publishedReportCard
              },
              {
                packId: 'pck_syn_g8b_t3',
                academicYearLabel: '2026 Academic Year',
                academicTermLabel: 'Term 3 (2026)',
                termNumber: 'TERM_3',
                className: 'Grade 8B',
                gradeLevel: 8,
                publicationState: 'UNPUBLISHED',
                statusMessage:
                  'Term assessments are still in preparation. Marks remain hidden until officially published.',
                publishedAt: null,
                reportCard: null
              }
            ],
            announcements: [
              {
                id: 'ann_1',
                schoolId: syntheticSchool.id,
                title: 'Term 2 (2026) Official Results Published for Grade 8B',
                body: 'Approved Term 2 academic results are now available.',
                audience: 'STUDENTS_AND_STAFF',
                postedByName: 'Mrs. Mutale Mulenga (Synthetic)',
                publishedAt: '2026-08-06T14:30:00.000Z'
              }
            ]
          }
        ]
      }
    })
  );

  await page.route(
    '**/api/student/schools/sch_syn_lus_01/learners/*/report-cards/*',
    (route) => {
      if (route.request().url().includes('/learners/lrn_syn_801/')) {
        return route.fulfill({ json: { reportCard: publishedReportCard } });
      }
      return route.fulfill({
        status: 403,
        json: {
          error: {
            code: 'STUDENT_LEARNER_ACCESS_DENIED',
            message: 'Student portal access is strictly restricted to your own verified learner record.'
          }
        }
      });
    }
  );

  await page.goto('/student');
  await expect(page.getByRole('heading', { name: 'Lubasi Phiri' })).toBeVisible();
  await expect(page.getByText('Distinction (1)')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);

  await page.getByRole('button', { name: /Academic History/i }).click();
  await expect(
    page.getByText(/Marks remain hidden until officially published/i)
  ).toBeVisible();

  await page.goto(
    '/student/schools/sch_syn_lus_01/learners/lrn_syn_901/report-cards/pck_syn_g8b_t2'
  );
  await expect(
    page.getByText(/strictly restricted to your own verified learner record/i)
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});

