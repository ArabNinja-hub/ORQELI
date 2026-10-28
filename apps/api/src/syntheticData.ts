import type { InMemoryEducationRepository } from './repository.js';

export const SYNTHETIC_SANDBOX_CREDENTIAL = 'SyntheticDemo!2026';
export const SYNTHETIC_DEMO_ENROLMENT_CODE = 'ORQ-8B02-2026';
export const SYNTHETIC_DEMO_ENROLMENT_ADMISSION_NO = 'SYN-2026-0802';

export interface SandboxPersonaInfo {
  label: string;
  name: string;
  email: string;
  role: string;
  schoolName: string;
  schoolCode: string;
  purpose: string;
}

export const SANDBOX_PERSONAS: readonly SandboxPersonaInfo[] = [
  {
    label: 'Verified Student (OPUS-Style Portal)',
    name: 'Lubasi Phiri (Synthetic Student)',
    email: 'student.lubasi@synthetic.orqeli.invalid',
    role: 'STUDENT',
    schoolName: 'Lukanga Day Secondary (Synthetic Demo)',
    schoolCode: 'SYN-ZM-LUS-01',
    purpose:
      'Open the verified Grade 8B student portal, inspect published Term 2 subject marks & grades, print the A4 report card, and confirm Term 3 unpublished marks stay hidden.'
  },
  {
    label: 'Pending Student (Awaiting Approval)',
    name: 'Bupe Kasonde (Synthetic Applicant)',
    email: 'student.pending@synthetic.orqeli.invalid',
    role: 'STUDENT',
    schoolName: 'Lukanga Day Secondary (Synthetic Demo)',
    schoolCode: 'SYN-ZM-LUS-01',
    purpose:
      'Sign in before school verification is complete to inspect the pending approval status view with zero access to academic records.'
  },
  {
    label: 'Head Teacher (Admin & Approver)',
    name: 'Mrs. Mutale Mulenga (Synthetic)',
    email: 'head.mulenga@synthetic.orqeli.invalid',
    role: 'HEAD_TEACHER',
    schoolName: 'Lukanga Day Secondary (Synthetic Demo)',
    schoolCode: 'SYN-ZM-LUS-01',
    purpose:
      'Manage learner roster, issue/revoke single-use enrolment codes, approve pending student requests, post announcements, and approve/publish term result packs.'
  },
  {
    label: 'Subject & Class Teacher',
    name: 'Mr. Chanda Banda (Synthetic)',
    email: 'teacher.banda@synthetic.orqeli.invalid',
    role: 'TEACHER',
    schoolName: 'Lukanga Day Secondary (Synthetic Demo)',
    schoolCode: 'SYN-ZM-LUS-01',
    purpose:
      'Enter allocated Mathematics & Integrated Science marks for Grade 9A, resolve the missing mark, and submit for review.'
  },
  {
    label: 'Deputy Head (Reviewer)',
    name: 'Mr. Daka Zulu (Synthetic)',
    email: 'deputy.zulu@synthetic.orqeli.invalid',
    role: 'DEPUTY_HEAD',
    schoolName: 'Lukanga Day Secondary (Synthetic Demo)',
    schoolCode: 'SYN-ZM-LUS-01',
    purpose:
      'Inspect school-wide completeness, review submitted packs, return packs for correction with notes, and manage student verification.'
  },
  {
    label: 'Second School Head Teacher',
    name: 'Mr. Joseph Tembo (Synthetic)',
    email: 'head.tembo@synthetic.orqeli.invalid',
    role: 'HEAD_TEACHER',
    schoolName: 'Mpezeni Trust Academy (Synthetic Demo)',
    schoolCode: 'SYN-ZM-EAS-02',
    purpose:
      'Demonstrates strict school-level tenant isolation across separate Zambian schools.'
  }
];

export function populateSyntheticInMemoryDataset(
  repo: InMemoryEducationRepository,
  sharedPasswordHash: string
): void {
  // School 1: Government Secondary School (Synthetic, Student Portal Active)
  const school1 = repo.seedSchool({
    id: 'sch_syn_lus_01',
    code: 'SYN-ZM-LUS-01',
    registrationNumber: 'SYN-REG-LUS-0101',
    name: 'Lukanga Day Secondary (Synthetic Demo)',
    sector: 'GOVERNMENT',
    province: 'Lusaka',
    district: 'Chilanga',
    levelSummary: 'Grades 8–12 Day Secondary',
    publicDescription:
      'Synthetic public secondary school profile for demonstrating teacher mark entry, approval workflow, and verified student portal access.',
    phone: '+260211000101',
    email: 'office@lukanga.synthetic.orqeli.invalid',
    isSyntheticDemo: true,
    studentPortalEnabled: true,
    status: 'PILOT_PREP'
  });

  const headMulenga = repo.seedUser({
    id: 'usr_syn_head_mulenga',
    name: 'Mrs. Mutale Mulenga (Synthetic)',
    email: 'head.mulenga@synthetic.orqeli.invalid',
    passwordHash: sharedPasswordHash
  });
  const deputyZulu = repo.seedUser({
    id: 'usr_syn_deputy_zulu',
    name: 'Mr. Daka Zulu (Synthetic)',
    email: 'deputy.zulu@synthetic.orqeli.invalid',
    passwordHash: sharedPasswordHash
  });
  const teacherBanda = repo.seedUser({
    id: 'usr_syn_teacher_banda',
    name: 'Mr. Chanda Banda (Synthetic)',
    email: 'teacher.banda@synthetic.orqeli.invalid',
    passwordHash: sharedPasswordHash
  });
  const teacherMwamba = repo.seedUser({
    id: 'usr_syn_teacher_mwamba',
    name: 'Ms. Namwali Mwamba (Synthetic)',
    email: 'teacher.mwamba@synthetic.orqeli.invalid',
    passwordHash: sharedPasswordHash
  });
  const guardianPhiri = repo.seedUser({
    id: 'usr_syn_guardian_phiri',
    name: 'Mr. Kelvin Phiri (Synthetic)',
    email: 'guardian.phiri@synthetic.orqeli.invalid',
    passwordHash: sharedPasswordHash
  });
  const studentLubasi = repo.seedUser({
    id: 'usr_syn_student_lubasi',
    name: 'Lubasi Phiri',
    email: 'student.lubasi@synthetic.orqeli.invalid',
    passwordHash: sharedPasswordHash
  });
  const studentPending = repo.seedUser({
    id: 'usr_syn_student_pending',
    name: 'Bupe Kasonde',
    email: 'student.pending@synthetic.orqeli.invalid',
    passwordHash: sharedPasswordHash
  });

  const memHead1 = repo.seedMembership({
    id: 'mem_syn_head_1',
    schoolId: school1.id,
    userId: headMulenga.id,
    role: 'HEAD_TEACHER',
    staffCode: 'SYN-STF-001'
  });
  repo.seedMembership({
    id: 'mem_syn_deputy_1',
    schoolId: school1.id,
    userId: deputyZulu.id,
    role: 'DEPUTY_HEAD',
    staffCode: 'SYN-STF-002'
  });
  const memBanda = repo.seedMembership({
    id: 'mem_syn_banda',
    schoolId: school1.id,
    userId: teacherBanda.id,
    role: 'TEACHER',
    staffCode: 'SYN-STF-014'
  });
  const memMwamba = repo.seedMembership({
    id: 'mem_syn_mwamba',
    schoolId: school1.id,
    userId: teacherMwamba.id,
    role: 'TEACHER',
    staffCode: 'SYN-STF-019'
  });
  const memGuardianPhiri = repo.seedMembership({
    id: 'mem_syn_guardian_phiri',
    schoolId: school1.id,
    userId: guardianPhiri.id,
    role: 'PARENT_GUARDIAN'
  });
  const memStudentLubasi = repo.seedMembership({
    id: 'mem_syn_student_lubasi',
    schoolId: school1.id,
    userId: studentLubasi.id,
    role: 'STUDENT',
    status: 'ACTIVE'
  });
  const memStudentPending = repo.seedMembership({
    id: 'mem_syn_student_pending',
    schoolId: school1.id,
    userId: studentPending.id,
    role: 'STUDENT',
    status: 'INACTIVE'
  });

  const year2026 = repo.seedAcademicYear({
    id: 'yr_syn_2026_1',
    schoolId: school1.id,
    year: 2026,
    label: '2026 Academic Year',
    isCurrent: true,
    startsOn: new Date('2026-01-12T00:00:00.000Z'),
    endsOn: new Date('2026-12-04T00:00:00.000Z')
  });

  const term2 = repo.seedAcademicTerm({
    id: 'trm_syn_2026_t2',
    schoolId: school1.id,
    academicYearId: year2026.id,
    termNumber: 'TERM_2',
    label: 'Term 2 (2026)',
    isCurrent: false,
    startsOn: new Date('2026-05-11T00:00:00.000Z'),
    endsOn: new Date('2026-08-07T00:00:00.000Z')
  });

  const term3 = repo.seedAcademicTerm({
    id: 'trm_syn_2026_t3',
    schoolId: school1.id,
    academicYearId: year2026.id,
    termNumber: 'TERM_3',
    label: 'Term 3 (2026)',
    isCurrent: true,
    startsOn: new Date('2026-09-07T00:00:00.000Z'),
    endsOn: new Date('2026-12-04T00:00:00.000Z')
  });

  const class9A = repo.seedClass({
    id: 'cls_syn_g9a',
    schoolId: school1.id,
    academicYearId: year2026.id,
    name: 'Grade 9A',
    gradeLevel: 9,
    classTeacherMembershipId: memBanda.id
  });

  const class8B = repo.seedClass({
    id: 'cls_syn_g8b',
    schoolId: school1.id,
    academicYearId: year2026.id,
    name: 'Grade 8B',
    gradeLevel: 8,
    classTeacherMembershipId: memMwamba.id
  });

  const subMath = repo.seedSubject({
    id: 'sub_syn_math',
    schoolId: school1.id,
    code: 'MATH',
    name: 'Mathematics',
    isCore: true,
    maxMark: 100
  });
  const subEng = repo.seedSubject({
    id: 'sub_syn_eng',
    schoolId: school1.id,
    code: 'ENG',
    name: 'English Language',
    isCore: true,
    maxMark: 100
  });
  const subSci = repo.seedSubject({
    id: 'sub_syn_sci',
    schoolId: school1.id,
    code: 'ISCI',
    name: 'Integrated Science',
    isCore: true,
    maxMark: 100
  });
  const subSoc = repo.seedSubject({
    id: 'sub_syn_soc',
    schoolId: school1.id,
    code: 'SOC',
    name: 'Social Studies',
    isCore: true,
    maxMark: 100
  });

  // Allocations for Grade 9A
  repo.seedAllocation({
    schoolId: school1.id,
    schoolClassId: class9A.id,
    subjectId: subMath.id,
    teacherMembershipId: memBanda.id
  });
  repo.seedAllocation({
    schoolId: school1.id,
    schoolClassId: class9A.id,
    subjectId: subSci.id,
    teacherMembershipId: memBanda.id
  });
  repo.seedAllocation({
    schoolId: school1.id,
    schoolClassId: class9A.id,
    subjectId: subEng.id,
    teacherMembershipId: memMwamba.id
  });
  repo.seedAllocation({
    schoolId: school1.id,
    schoolClassId: class9A.id,
    subjectId: subSoc.id,
    teacherMembershipId: memMwamba.id
  });

  // Allocations for Grade 8B
  repo.seedAllocation({
    schoolId: school1.id,
    schoolClassId: class8B.id,
    subjectId: subMath.id,
    teacherMembershipId: memBanda.id
  });
  repo.seedAllocation({
    schoolId: school1.id,
    schoolClassId: class8B.id,
    subjectId: subEng.id,
    teacherMembershipId: memMwamba.id
  });
  repo.seedAllocation({
    schoolId: school1.id,
    schoolClassId: class8B.id,
    subjectId: subSci.id,
    teacherMembershipId: memBanda.id
  });

  // Grade 9A Synthetic Learners
  const lrnTasha = repo.seedLearner({
    id: 'lrn_syn_901',
    schoolId: school1.id,
    admissionNumber: 'SYN-2026-0901',
    firstName: 'Tasha',
    lastName: 'Phiri',
    schoolClassId: class9A.id,
    guardianName: 'Mr. Kelvin Phiri (Synthetic)',
    guardianPhone: '+260970000101',
    preferredChannel: 'PRINT_REPORT'
  });
  const lrnMwila = repo.seedLearner({
    id: 'lrn_syn_902',
    schoolId: school1.id,
    admissionNumber: 'SYN-2026-0902',
    firstName: 'Mwila',
    lastName: 'Chibwe',
    schoolClassId: class9A.id,
    guardianName: 'Mrs. Grace Chibwe (Synthetic)',
    guardianPhone: '+260970000102',
    preferredChannel: 'SMS_SUMMARY'
  });
  const lrnBupe = repo.seedLearner({
    id: 'lrn_syn_903',
    schoolId: school1.id,
    admissionNumber: 'SYN-2026-0903',
    firstName: 'Bupe',
    lastName: 'Kasonde',
    schoolClassId: class9A.id,
    guardianName: 'Mr. Peter Kasonde (Synthetic)',
    guardianPhone: '+260970000103',
    preferredChannel: 'PRINT_REPORT'
  });

  // Grade 8B Synthetic Learners
  const lrnLubasi = repo.seedLearner({
    id: 'lrn_syn_801',
    schoolId: school1.id,
    admissionNumber: 'SYN-2026-0801',
    firstName: 'Lubasi',
    lastName: 'Phiri',
    schoolClassId: class8B.id,
    guardianName: 'Mr. Kelvin Phiri (Synthetic)',
    guardianPhone: '+260970000101',
    preferredChannel: 'PRINT_REPORT'
  });
  const lrnChisomo = repo.seedLearner({
    id: 'lrn_syn_802',
    schoolId: school1.id,
    admissionNumber: SYNTHETIC_DEMO_ENROLMENT_ADMISSION_NO,
    firstName: 'Chisomo',
    lastName: 'Banda',
    schoolClassId: class8B.id,
    guardianName: 'Mrs. Ruth Banda (Synthetic)',
    guardianPhone: '+260970000108',
    preferredChannel: 'PRINT_REPORT'
  });

  repo.seedGuardianLink({
    schoolId: school1.id,
    membershipId: memGuardianPhiri.id,
    learnerId: lrnTasha.id,
    relationship: 'Parent / Guardian'
  });
  repo.seedGuardianLink({
    schoolId: school1.id,
    membershipId: memGuardianPhiri.id,
    learnerId: lrnLubasi.id,
    relationship: 'Parent / Guardian'
  });

  // Verified student link for Lubasi Phiri (SYN-2026-0801)
  repo.seedStudentLink({
    id: 'slk_syn_lubasi_801',
    schoolId: school1.id,
    membershipId: memStudentLubasi.id,
    learnerId: lrnLubasi.id,
    verificationMethod: 'ENROLMENT_CODE',
    verifiedByMembershipId: memHead1.id,
    verifiedAt: new Date('2026-08-10T09:00:00.000Z')
  });

  // Single-use enrolment code ready for self-registration walkthrough (Chisomo Banda, SYN-2026-0802)
  repo.seedEnrolmentCode({
    id: 'ecd_syn_chisomo_802',
    schoolId: school1.id,
    learnerId: lrnChisomo.id,
    plainCode: SYNTHETIC_DEMO_ENROLMENT_CODE,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdByMembershipId: memHead1.id
  });

  // Pending student registration request awaiting school office review (Bupe Kasonde, SYN-2026-0903)
  repo.seedRegistrationRequest({
    id: 'srq_syn_bupe_903',
    schoolId: school1.id,
    userId: studentPending.id,
    membershipId: memStudentPending.id,
    claimedAdmissionNo: 'SYN-2026-0903',
    claimedName: 'Bupe Kasonde',
    claimedClassNote: 'Grade 9A',
    status: 'PENDING',
    createdAt: new Date('2026-10-20T08:15:00.000Z')
  });

  // School Announcements (1 public student/staff notice, 1 internal staff-only notice)
  repo.seedAnnouncement({
    id: 'ann_syn_t2_published',
    schoolId: school1.id,
    title: 'Term 2 (2026) Official Results Published for Grade 8B',
    body: 'Approved Term 2 academic results for Grade 8B are now available in the student portal and as printable A4 statements.',
    audience: 'STUDENTS_AND_STAFF',
    postedByMembershipId: memHead1.id,
    publishedAt: new Date('2026-08-06T14:30:00.000Z')
  });
  repo.seedAnnouncement({
    id: 'ann_syn_t3_schedule',
    schoolId: school1.id,
    title: 'Term 3 End-of-Term Moderation in Progress',
    body: 'Term 3 subject marks are currently under teacher entry and leadership moderation. Results appear only after formal Head Teacher publication.',
    audience: 'STUDENTS_AND_STAFF',
    postedByMembershipId: memHead1.id,
    publishedAt: new Date('2026-10-18T10:00:00.000Z')
  });
  repo.seedAnnouncement({
    id: 'ann_syn_staff_internal',
    schoolId: school1.id,
    title: 'Staff Mark-Sheet Deadline Reminder (Internal)',
    body: 'All subject teachers must complete pending Term 3 entries before Friday 16:00 CAT for Deputy Head moderation.',
    audience: 'STAFF_ONLY',
    postedByMembershipId: memHead1.id,
    publishedAt: new Date('2026-10-19T07:30:00.000Z')
  });

  // Pack 1: Grade 9A Term 3 — DRAFT with 1 missing Mathematics mark for Mwila Chibwe
  const pack9AT3 = repo.seedResultPack({
    id: 'pck_syn_g9a_t3',
    schoolId: school1.id,
    academicTermId: term3.id,
    schoolClassId: class9A.id,
    status: 'DRAFT'
  });

  const g9InitialMarks: Array<{
    learnerId: string;
    subjectId: string;
    score: number;
    comment: string;
    by: string;
  }> = [
    { learnerId: lrnTasha.id, subjectId: subMath.id, score: 78, comment: 'Steady algebraic reasoning.', by: memBanda.id },
    { learnerId: lrnTasha.id, subjectId: subSci.id, score: 82, comment: 'Clear practical lab notes.', by: memBanda.id },
    { learnerId: lrnTasha.id, subjectId: subEng.id, score: 74, comment: 'Good comprehension structure.', by: memMwamba.id },
    { learnerId: lrnTasha.id, subjectId: subSoc.id, score: 80, comment: 'Thorough civic studies work.', by: memMwamba.id },
    // Notice: lrnMwila Mathematics mark is intentionally omitted (PENDING) to demonstrate missing-mark detection!
    { learnerId: lrnMwila.id, subjectId: subSci.id, score: 69, comment: 'Consistent class participation.', by: memBanda.id },
    { learnerId: lrnMwila.id, subjectId: subEng.id, score: 71, comment: 'Clear essay organisation.', by: memMwamba.id },
    { learnerId: lrnMwila.id, subjectId: subSoc.id, score: 75, comment: 'Well-prepared map reading.', by: memMwamba.id },
    { learnerId: lrnBupe.id, subjectId: subMath.id, score: 85, comment: 'Strong geometry problem-solving.', by: memBanda.id },
    { learnerId: lrnBupe.id, subjectId: subSci.id, score: 88, comment: 'Excellent scientific inquiry.', by: memBanda.id },
    { learnerId: lrnBupe.id, subjectId: subEng.id, score: 79, comment: 'Articulate written expression.', by: memMwamba.id },
    { learnerId: lrnBupe.id, subjectId: subSoc.id, score: 83, comment: 'Insightful historical analysis.', by: memMwamba.id }
  ];

  for (const item of g9InitialMarks) {
    repo.seedSubjectMark({
      schoolId: school1.id,
      termResultPackId: pack9AT3.id,
      learnerId: item.learnerId,
      subjectId: item.subjectId,
      status: 'PRESENT',
      score: item.score,
      teacherComment: item.comment,
      enteredByMembershipId: item.by
    });
  }

  // Pack 2: Grade 8B Term 2 — PUBLISHED (complete, approved & published for both Grade 8B learners)
  const publishedDate = new Date('2026-08-06T14:00:00.000Z');
  const pack8BT2 = repo.seedResultPack({
    id: 'pck_syn_g8b_t2',
    schoolId: school1.id,
    academicTermId: term2.id,
    schoolClassId: class8B.id,
    status: 'PUBLISHED',
    submittedAt: new Date('2026-08-04T10:00:00.000Z'),
    submittedByMembershipId: memMwamba.id,
    approvedAt: new Date('2026-08-05T15:30:00.000Z'),
    approvedByMembershipId: memHead1.id,
    publishedAt: publishedDate,
    publishedByMembershipId: memHead1.id
  });

  const g8T2Marks: Array<{
    learnerId: string;
    subjectId: string;
    score: number;
    comment: string;
    by: string;
  }> = [
    { learnerId: lrnLubasi.id, subjectId: subMath.id, score: 81, comment: 'Confident numerical work.', by: memBanda.id },
    { learnerId: lrnLubasi.id, subjectId: subEng.id, score: 76, comment: 'Attentive reading and grammar.', by: memMwamba.id },
    { learnerId: lrnLubasi.id, subjectId: subSci.id, score: 84, comment: 'Strong curiosity in experiments.', by: memBanda.id },
    { learnerId: lrnChisomo.id, subjectId: subMath.id, score: 72, comment: 'Good accuracy in linear equations.', by: memBanda.id },
    { learnerId: lrnChisomo.id, subjectId: subEng.id, score: 79, comment: 'Expressive composition writing.', by: memMwamba.id },
    { learnerId: lrnChisomo.id, subjectId: subSci.id, score: 68, comment: 'Solid understanding of plant biology.', by: memBanda.id }
  ];

  for (const m of g8T2Marks) {
    repo.seedSubjectMark({
      schoolId: school1.id,
      termResultPackId: pack8BT2.id,
      learnerId: m.learnerId,
      subjectId: m.subjectId,
      status: 'PRESENT',
      score: m.score,
      teacherComment: m.comment,
      enteredByMembershipId: m.by,
      enteredAt: new Date('2026-08-03T11:00:00.000Z')
    });
  }

  // Pack 3: Grade 8B Term 3 — DRAFT (unpublished — demonstrates that verified Grade 8B students
  // see a clear "not yet published" status and NEVER see draft scores!)
  const pack8BT3 = repo.seedResultPack({
    id: 'pck_syn_g8b_t3',
    schoolId: school1.id,
    academicTermId: term3.id,
    schoolClassId: class8B.id,
    status: 'DRAFT'
  });
  repo.seedSubjectMark({
    schoolId: school1.id,
    termResultPackId: pack8BT3.id,
    learnerId: lrnLubasi.id,
    subjectId: subMath.id,
    status: 'PRESENT',
    score: 91,
    teacherComment: 'Draft Term 3 score — must remain hidden until published.',
    enteredByMembershipId: memBanda.id
  });

  // School 2: Separate Private School (Synthetic, Student Portal Active) to verify strict multi-school isolation
  const school2 = repo.seedSchool({
    id: 'sch_syn_eas_02',
    code: 'SYN-ZM-EAS-02',
    registrationNumber: 'SYN-REG-EAS-0202',
    name: 'Mpezeni Trust Academy (Synthetic Demo)',
    sector: 'PRIVATE',
    province: 'Eastern',
    district: 'Chipata',
    levelSummary: 'Grades 1–9 Primary & Junior Secondary',
    publicDescription:
      'Synthetic independent school profile in Eastern Province demonstrating strict tenant isolation across schools.',
    phone: '+260216000202',
    email: 'office@mpezeni.synthetic.orqeli.invalid',
    isSyntheticDemo: true,
    studentPortalEnabled: true,
    status: 'PILOT_PREP'
  });

  const headTembo = repo.seedUser({
    id: 'usr_syn_head_tembo',
    name: 'Mr. Joseph Tembo (Synthetic)',
    email: 'head.tembo@synthetic.orqeli.invalid',
    passwordHash: sharedPasswordHash
  });
  const memTembo = repo.seedMembership({
    id: 'mem_syn_head_2',
    schoolId: school2.id,
    userId: headTembo.id,
    role: 'HEAD_TEACHER',
    staffCode: 'SYN-EAS-001'
  });

  const year2026School2 = repo.seedAcademicYear({
    id: 'yr_syn_2026_2',
    schoolId: school2.id,
    year: 2026,
    label: '2026 Academic Year',
    isCurrent: true,
    startsOn: new Date('2026-01-12T00:00:00.000Z'),
    endsOn: new Date('2026-12-04T00:00:00.000Z')
  });
  const term3School2 = repo.seedAcademicTerm({
    id: 'trm_syn_2026_t3_2',
    schoolId: school2.id,
    academicYearId: year2026School2.id,
    termNumber: 'TERM_3',
    label: 'Term 3 (2026)',
    isCurrent: true,
    startsOn: new Date('2026-09-07T00:00:00.000Z'),
    endsOn: new Date('2026-12-04T00:00:00.000Z')
  });
  const class7ASchool2 = repo.seedClass({
    id: 'cls_syn_g7a_2',
    schoolId: school2.id,
    academicYearId: year2026School2.id,
    name: 'Grade 7A',
    gradeLevel: 7,
    classTeacherMembershipId: memTembo.id
  });
  const subMathSchool2 = repo.seedSubject({
    id: 'sub_syn_math_2',
    schoolId: school2.id,
    code: 'MATH-7',
    name: 'Mathematics',
    isCore: true,
    maxMark: 100
  });
  repo.seedAllocation({
    schoolId: school2.id,
    schoolClassId: class7ASchool2.id,
    subjectId: subMathSchool2.id,
    teacherMembershipId: memTembo.id
  });
  repo.seedLearner({
    id: 'lrn_syn_2_701',
    schoolId: school2.id,
    admissionNumber: 'SYN-EAS-0701',
    firstName: 'Chipo',
    lastName: 'Lungu',
    schoolClassId: class7ASchool2.id,
    guardianName: 'Mrs. Esther Lungu (Synthetic)',
    guardianPhone: '+260970000201',
    preferredChannel: 'PRINT_REPORT'
  });
  repo.seedResultPack({
    id: 'pck_syn_g7a_t3_2',
    schoolId: school2.id,
    academicTermId: term3School2.id,
    schoolClassId: class7ASchool2.id,
    status: 'DRAFT'
  });

  // School 3: Community Secondary School (Synthetic, Student Portal NOT Yet Enabled)
  // Demonstrates public school discovery where student self-enrolment is disabled.
  repo.seedSchool({
    id: 'sch_syn_cb_03',
    code: 'SYN-ZM-CB-03',
    registrationNumber: 'SYN-REG-CB-0303',
    name: 'Mindolo Community Day Secondary (Synthetic Demo)',
    sector: 'COMMUNITY',
    province: 'Copperbelt',
    district: 'Kitwe',
    levelSummary: 'Grades 8–9 Community Secondary',
    publicDescription:
      'Synthetic community school listed in the public directory prior to student portal activation.',
    phone: '+260212000303',
    email: 'office@mindolo.synthetic.orqeli.invalid',
    isSyntheticDemo: true,
    studentPortalEnabled: false,
    status: 'PILOT_PREP'
  });
}
