import type {
  AuditEventItem,
  AuthenticatedUserProfile,
  CommunicationChannel,
  GuardianResultsOverview,
  MarkEntryStatus,
  MembershipStatus,
  MembershipSummary,
  MissingMarkItem,
  PackLearnerRow,
  PackMarkCell,
  PackSubjectColumn,
  ReportCard,
  ReportCardSubjectLine,
  ResultPackDetail,
  ResultPackStatus,
  ResultPackSummary,
  SandboxPersona,
  SandboxPersonasResponse,
  SchoolOverview,
  SchoolRole,
  SchoolSector,
  SchoolStatus,
  SchoolSummary,
  TermNumber
} from './types';

/**
 * Browser-only synthetic sandbox transport used EXCLUSIVELY when building the static
 * GitHub Pages preview (`VITE_STATIC_SANDBOX=true`).
 *
 * Normal development, CI, and production builds leave `VITE_STATIC_SANDBOX` unset
 * and talk strictly to the real `@orqeli/api` server.
 */

export const STATIC_SANDBOX_CREDENTIAL = 'SyntheticDemo!2026';
const STORAGE_KEY = 'orqeli.static_sandbox.state.v1';
const STATIC_CSRF_TOKEN = 'static-pages-sandbox-csrf-token';

const STAFF_ROLES: readonly SchoolRole[] = [
  'SCHOOL_ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD',
  'TEACHER'
];
const LEADERSHIP_ROLES: readonly SchoolRole[] = [
  'SCHOOL_ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD'
];
const APPROVAL_ROLES: readonly SchoolRole[] = ['SCHOOL_ADMIN', 'HEAD_TEACHER'];

const STATIC_SANDBOX_PERSONAS: SandboxPersona[] = [
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
      'Inspect school-wide completeness, review submitted packs, return packs for correction with notes, and inspect audit events.'
  },
  {
    label: 'Head Teacher (Approver)',
    name: 'Mrs. Mutale Mulenga (Synthetic)',
    email: 'head.mulenga@synthetic.orqeli.invalid',
    role: 'HEAD_TEACHER',
    schoolName: 'Lukanga Day Secondary (Synthetic Demo)',
    schoolCode: 'SYN-ZM-LUS-01',
    purpose:
      'Perform final approval and publication of complete result packs and generate printable A4 report cards.'
  },
  {
    label: 'Parent / Guardian',
    name: 'Mr. Kelvin Phiri (Synthetic)',
    email: 'guardian.phiri@synthetic.orqeli.invalid',
    role: 'PARENT_GUARDIAN',
    schoolName: 'Lukanga Day Secondary (Synthetic Demo)',
    schoolCode: 'SYN-ZM-LUS-01',
    purpose:
      'View strictly PUBLISHED learner report cards only; unpublished Grade 9A marks remain completely hidden.'
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

interface SandboxUser {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface SandboxSchool {
  id: string;
  code: string;
  name: string;
  sector: SchoolSector;
  province: string;
  district: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  isSyntheticDemo: boolean;
  status: SchoolStatus;
}

interface SandboxMembership {
  id: string;
  schoolId: string;
  userId: string;
  role: SchoolRole;
  status: MembershipStatus;
  staffCode: string | null;
}

interface SandboxYear {
  id: string;
  schoolId: string;
  year: number;
  label: string;
  isCurrent: boolean;
}

interface SandboxTerm {
  id: string;
  schoolId: string;
  academicYearId: string;
  termNumber: TermNumber;
  label: string;
  isCurrent: boolean;
}

interface SandboxClass {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  gradeLevel: number;
  classTeacherMembershipId: string | null;
}

interface SandboxSubject {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  isCore: boolean;
  maxMark: number;
}

interface SandboxAllocation {
  id: string;
  schoolId: string;
  schoolClassId: string;
  subjectId: string;
  teacherMembershipId: string;
}

interface SandboxLearner {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  schoolClassId: string;
  guardianName: string | null;
  preferredChannel: CommunicationChannel;
}

interface SandboxGuardianLink {
  schoolId: string;
  membershipId: string;
  learnerId: string;
  relationship: string;
}

interface SandboxResultPack {
  id: string;
  schoolId: string;
  academicTermId: string;
  schoolClassId: string;
  status: ResultPackStatus;
  reviewNotes: string | null;
  submittedAt: string | null;
  submittedByMembershipId: string | null;
  reviewedAt: string | null;
  reviewedByMembershipId: string | null;
  approvedAt: string | null;
  approvedByMembershipId: string | null;
  publishedAt: string | null;
  publishedByMembershipId: string | null;
}

interface SandboxMark {
  schoolId: string;
  packId: string;
  learnerId: string;
  subjectId: string;
  status: MarkEntryStatus;
  score: number | null;
  teacherComment: string | null;
  enteredByMembershipId: string | null;
  enteredAt: string | null;
}

interface SandboxState {
  currentUserId: string | null;
  nextEventCounter: number;
  users: SandboxUser[];
  schools: SandboxSchool[];
  memberships: SandboxMembership[];
  years: SandboxYear[];
  terms: SandboxTerm[];
  classes: SandboxClass[];
  subjects: SandboxSubject[];
  allocations: SandboxAllocation[];
  learners: SandboxLearner[];
  guardianLinks: SandboxGuardianLink[];
  packs: SandboxResultPack[];
  marks: SandboxMark[];
  auditEvents: AuditEventItem[];
}

function createInitialSandboxState(): SandboxState {
  const created = '2026-08-01T08:00:00.000Z';
  return {
    currentUserId: null,
    nextEventCounter: 1,
    users: [
      {
        id: 'usr_syn_head_mulenga',
        email: 'head.mulenga@synthetic.orqeli.invalid',
        phone: null,
        name: 'Mrs. Mutale Mulenga (Synthetic)',
        createdAt: created,
        updatedAt: created
      },
      {
        id: 'usr_syn_deputy_zulu',
        email: 'deputy.zulu@synthetic.orqeli.invalid',
        phone: null,
        name: 'Mr. Daka Zulu (Synthetic)',
        createdAt: created,
        updatedAt: created
      },
      {
        id: 'usr_syn_teacher_banda',
        email: 'teacher.banda@synthetic.orqeli.invalid',
        phone: null,
        name: 'Mr. Chanda Banda (Synthetic)',
        createdAt: created,
        updatedAt: created
      },
      {
        id: 'usr_syn_teacher_mwamba',
        email: 'teacher.mwamba@synthetic.orqeli.invalid',
        phone: null,
        name: 'Ms. Namwali Mwamba (Synthetic)',
        createdAt: created,
        updatedAt: created
      },
      {
        id: 'usr_syn_guardian_phiri',
        email: 'guardian.phiri@synthetic.orqeli.invalid',
        phone: null,
        name: 'Mr. Kelvin Phiri (Synthetic)',
        createdAt: created,
        updatedAt: created
      },
      {
        id: 'usr_syn_head_tembo',
        email: 'head.tembo@synthetic.orqeli.invalid',
        phone: null,
        name: 'Mr. Joseph Tembo (Synthetic)',
        createdAt: created,
        updatedAt: created
      }
    ],
    schools: [
      {
        id: 'sch_syn_lus_01',
        code: 'SYN-ZM-LUS-01',
        name: 'Lukanga Day Secondary (Synthetic Demo)',
        sector: 'GOVERNMENT',
        province: 'Lusaka',
        district: 'Chilanga',
        phone: '+260211000101',
        email: 'office@lukanga.synthetic.orqeli.invalid',
        timezone: 'Africa/Lusaka',
        isSyntheticDemo: true,
        status: 'PILOT_PREP'
      },
      {
        id: 'sch_syn_eas_02',
        code: 'SYN-ZM-EAS-02',
        name: 'Mpezeni Trust Academy (Synthetic Demo)',
        sector: 'PRIVATE',
        province: 'Eastern',
        district: 'Chipata',
        phone: '+260216000202',
        email: 'office@mpezeni.synthetic.orqeli.invalid',
        timezone: 'Africa/Lusaka',
        isSyntheticDemo: true,
        status: 'PILOT_PREP'
      }
    ],
    memberships: [
      {
        id: 'mem_syn_head_1',
        schoolId: 'sch_syn_lus_01',
        userId: 'usr_syn_head_mulenga',
        role: 'HEAD_TEACHER',
        status: 'ACTIVE',
        staffCode: 'SYN-STF-001'
      },
      {
        id: 'mem_syn_deputy_1',
        schoolId: 'sch_syn_lus_01',
        userId: 'usr_syn_deputy_zulu',
        role: 'DEPUTY_HEAD',
        status: 'ACTIVE',
        staffCode: 'SYN-STF-002'
      },
      {
        id: 'mem_syn_banda',
        schoolId: 'sch_syn_lus_01',
        userId: 'usr_syn_teacher_banda',
        role: 'TEACHER',
        status: 'ACTIVE',
        staffCode: 'SYN-STF-014'
      },
      {
        id: 'mem_syn_mwamba',
        schoolId: 'sch_syn_lus_01',
        userId: 'usr_syn_teacher_mwamba',
        role: 'TEACHER',
        status: 'ACTIVE',
        staffCode: 'SYN-STF-019'
      },
      {
        id: 'mem_syn_guardian_phiri',
        schoolId: 'sch_syn_lus_01',
        userId: 'usr_syn_guardian_phiri',
        role: 'PARENT_GUARDIAN',
        status: 'ACTIVE',
        staffCode: null
      },
      {
        id: 'mem_syn_head_2',
        schoolId: 'sch_syn_eas_02',
        userId: 'usr_syn_head_tembo',
        role: 'HEAD_TEACHER',
        status: 'ACTIVE',
        staffCode: 'SYN-EAS-001'
      }
    ],
    years: [
      {
        id: 'yr_syn_2026_1',
        schoolId: 'sch_syn_lus_01',
        year: 2026,
        label: '2026 Academic Year',
        isCurrent: true
      },
      {
        id: 'yr_syn_2026_2',
        schoolId: 'sch_syn_eas_02',
        year: 2026,
        label: '2026 Academic Year',
        isCurrent: true
      }
    ],
    terms: [
      {
        id: 'trm_syn_2026_t2',
        schoolId: 'sch_syn_lus_01',
        academicYearId: 'yr_syn_2026_1',
        termNumber: 'TERM_2',
        label: 'Term 2 (2026)',
        isCurrent: false
      },
      {
        id: 'trm_syn_2026_t3',
        schoolId: 'sch_syn_lus_01',
        academicYearId: 'yr_syn_2026_1',
        termNumber: 'TERM_3',
        label: 'Term 3 (2026)',
        isCurrent: true
      },
      {
        id: 'trm_syn_2026_t3_2',
        schoolId: 'sch_syn_eas_02',
        academicYearId: 'yr_syn_2026_2',
        termNumber: 'TERM_3',
        label: 'Term 3 (2026)',
        isCurrent: true
      }
    ],
    classes: [
      {
        id: 'cls_syn_g9a',
        schoolId: 'sch_syn_lus_01',
        academicYearId: 'yr_syn_2026_1',
        name: 'Grade 9A',
        gradeLevel: 9,
        classTeacherMembershipId: 'mem_syn_banda'
      },
      {
        id: 'cls_syn_g8b',
        schoolId: 'sch_syn_lus_01',
        academicYearId: 'yr_syn_2026_1',
        name: 'Grade 8B',
        gradeLevel: 8,
        classTeacherMembershipId: 'mem_syn_mwamba'
      },
      {
        id: 'cls_syn_g7a_2',
        schoolId: 'sch_syn_eas_02',
        academicYearId: 'yr_syn_2026_2',
        name: 'Grade 7A',
        gradeLevel: 7,
        classTeacherMembershipId: 'mem_syn_head_2'
      }
    ],
    subjects: [
      { id: 'sub_syn_math', schoolId: 'sch_syn_lus_01', code: 'MATH', name: 'Mathematics', isCore: true, maxMark: 100 },
      { id: 'sub_syn_eng', schoolId: 'sch_syn_lus_01', code: 'ENG', name: 'English Language', isCore: true, maxMark: 100 },
      { id: 'sub_syn_sci', schoolId: 'sch_syn_lus_01', code: 'ISCI', name: 'Integrated Science', isCore: true, maxMark: 100 },
      { id: 'sub_syn_soc', schoolId: 'sch_syn_lus_01', code: 'SOC', name: 'Social Studies', isCore: true, maxMark: 100 },
      { id: 'sub_syn_math_2', schoolId: 'sch_syn_eas_02', code: 'MATH-7', name: 'Mathematics', isCore: true, maxMark: 100 }
    ],
    allocations: [
      { id: 'alc_1', schoolId: 'sch_syn_lus_01', schoolClassId: 'cls_syn_g9a', subjectId: 'sub_syn_math', teacherMembershipId: 'mem_syn_banda' },
      { id: 'alc_2', schoolId: 'sch_syn_lus_01', schoolClassId: 'cls_syn_g9a', subjectId: 'sub_syn_sci', teacherMembershipId: 'mem_syn_banda' },
      { id: 'alc_3', schoolId: 'sch_syn_lus_01', schoolClassId: 'cls_syn_g9a', subjectId: 'sub_syn_eng', teacherMembershipId: 'mem_syn_mwamba' },
      { id: 'alc_4', schoolId: 'sch_syn_lus_01', schoolClassId: 'cls_syn_g9a', subjectId: 'sub_syn_soc', teacherMembershipId: 'mem_syn_mwamba' },
      { id: 'alc_5', schoolId: 'sch_syn_lus_01', schoolClassId: 'cls_syn_g8b', subjectId: 'sub_syn_math', teacherMembershipId: 'mem_syn_banda' },
      { id: 'alc_6', schoolId: 'sch_syn_lus_01', schoolClassId: 'cls_syn_g8b', subjectId: 'sub_syn_eng', teacherMembershipId: 'mem_syn_mwamba' },
      { id: 'alc_7', schoolId: 'sch_syn_lus_01', schoolClassId: 'cls_syn_g8b', subjectId: 'sub_syn_sci', teacherMembershipId: 'mem_syn_banda' },
      { id: 'alc_8', schoolId: 'sch_syn_eas_02', schoolClassId: 'cls_syn_g7a_2', subjectId: 'sub_syn_math_2', teacherMembershipId: 'mem_syn_head_2' }
    ],
    learners: [
      {
        id: 'lrn_syn_901',
        schoolId: 'sch_syn_lus_01',
        admissionNumber: 'SYN-2026-0901',
        firstName: 'Tasha',
        lastName: 'Phiri',
        schoolClassId: 'cls_syn_g9a',
        guardianName: 'Mr. Kelvin Phiri (Synthetic)',
        preferredChannel: 'PRINT_REPORT'
      },
      {
        id: 'lrn_syn_902',
        schoolId: 'sch_syn_lus_01',
        admissionNumber: 'SYN-2026-0902',
        firstName: 'Mwila',
        lastName: 'Chibwe',
        schoolClassId: 'cls_syn_g9a',
        guardianName: 'Mrs. Grace Chibwe (Synthetic)',
        preferredChannel: 'SMS_SUMMARY'
      },
      {
        id: 'lrn_syn_903',
        schoolId: 'sch_syn_lus_01',
        admissionNumber: 'SYN-2026-0903',
        firstName: 'Bupe',
        lastName: 'Kasonde',
        schoolClassId: 'cls_syn_g9a',
        guardianName: 'Mr. Peter Kasonde (Synthetic)',
        preferredChannel: 'PRINT_REPORT'
      },
      {
        id: 'lrn_syn_801',
        schoolId: 'sch_syn_lus_01',
        admissionNumber: 'SYN-2026-0801',
        firstName: 'Lubasi',
        lastName: 'Phiri',
        schoolClassId: 'cls_syn_g8b',
        guardianName: 'Mr. Kelvin Phiri (Synthetic)',
        preferredChannel: 'PRINT_REPORT'
      },
      {
        id: 'lrn_syn_2_701',
        schoolId: 'sch_syn_eas_02',
        admissionNumber: 'SYN-EAS-0701',
        firstName: 'Chipo',
        lastName: 'Lungu',
        schoolClassId: 'cls_syn_g7a_2',
        guardianName: 'Mrs. Esther Lungu (Synthetic)',
        preferredChannel: 'PRINT_REPORT'
      }
    ],
    guardianLinks: [
      {
        schoolId: 'sch_syn_lus_01',
        membershipId: 'mem_syn_guardian_phiri',
        learnerId: 'lrn_syn_901',
        relationship: 'Parent / Guardian'
      },
      {
        schoolId: 'sch_syn_lus_01',
        membershipId: 'mem_syn_guardian_phiri',
        learnerId: 'lrn_syn_801',
        relationship: 'Parent / Guardian'
      }
    ],
    packs: [
      {
        id: 'pck_syn_g9a_t3',
        schoolId: 'sch_syn_lus_01',
        academicTermId: 'trm_syn_2026_t3',
        schoolClassId: 'cls_syn_g9a',
        status: 'DRAFT',
        reviewNotes: null,
        submittedAt: null,
        submittedByMembershipId: null,
        reviewedAt: null,
        reviewedByMembershipId: null,
        approvedAt: null,
        approvedByMembershipId: null,
        publishedAt: null,
        publishedByMembershipId: null
      },
      {
        id: 'pck_syn_g8b_t2',
        schoolId: 'sch_syn_lus_01',
        academicTermId: 'trm_syn_2026_t2',
        schoolClassId: 'cls_syn_g8b',
        status: 'PUBLISHED',
        reviewNotes: null,
        submittedAt: '2026-08-04T10:00:00.000Z',
        submittedByMembershipId: 'mem_syn_mwamba',
        reviewedAt: null,
        reviewedByMembershipId: null,
        approvedAt: '2026-08-05T15:30:00.000Z',
        approvedByMembershipId: 'mem_syn_head_1',
        publishedAt: '2026-08-06T14:00:00.000Z',
        publishedByMembershipId: 'mem_syn_head_1'
      },
      {
        id: 'pck_syn_g7a_t3_2',
        schoolId: 'sch_syn_eas_02',
        academicTermId: 'trm_syn_2026_t3_2',
        schoolClassId: 'cls_syn_g7a_2',
        status: 'DRAFT',
        reviewNotes: null,
        submittedAt: null,
        submittedByMembershipId: null,
        reviewedAt: null,
        reviewedByMembershipId: null,
        approvedAt: null,
        approvedByMembershipId: null,
        publishedAt: null,
        publishedByMembershipId: null
      }
    ],
    marks: [
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_901', subjectId: 'sub_syn_math', status: 'PRESENT', score: 78, teacherComment: 'Steady algebraic reasoning.', enteredByMembershipId: 'mem_syn_banda', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_901', subjectId: 'sub_syn_sci', status: 'PRESENT', score: 82, teacherComment: 'Clear practical lab notes.', enteredByMembershipId: 'mem_syn_banda', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_901', subjectId: 'sub_syn_eng', status: 'PRESENT', score: 74, teacherComment: 'Good comprehension structure.', enteredByMembershipId: 'mem_syn_mwamba', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_901', subjectId: 'sub_syn_soc', status: 'PRESENT', score: 80, teacherComment: 'Thorough civic studies work.', enteredByMembershipId: 'mem_syn_mwamba', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_902', subjectId: 'sub_syn_sci', status: 'PRESENT', score: 69, teacherComment: 'Consistent class participation.', enteredByMembershipId: 'mem_syn_banda', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_902', subjectId: 'sub_syn_eng', status: 'PRESENT', score: 71, teacherComment: 'Clear essay organisation.', enteredByMembershipId: 'mem_syn_mwamba', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_902', subjectId: 'sub_syn_soc', status: 'PRESENT', score: 75, teacherComment: 'Well-prepared map reading.', enteredByMembershipId: 'mem_syn_mwamba', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_903', subjectId: 'sub_syn_math', status: 'PRESENT', score: 85, teacherComment: 'Strong geometry problem-solving.', enteredByMembershipId: 'mem_syn_banda', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_903', subjectId: 'sub_syn_sci', status: 'PRESENT', score: 88, teacherComment: 'Excellent scientific inquiry.', enteredByMembershipId: 'mem_syn_banda', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_903', subjectId: 'sub_syn_eng', status: 'PRESENT', score: 79, teacherComment: 'Articulate written expression.', enteredByMembershipId: 'mem_syn_mwamba', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g9a_t3', learnerId: 'lrn_syn_903', subjectId: 'sub_syn_soc', status: 'PRESENT', score: 83, teacherComment: 'Insightful historical analysis.', enteredByMembershipId: 'mem_syn_mwamba', enteredAt: created },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g8b_t2', learnerId: 'lrn_syn_801', subjectId: 'sub_syn_math', status: 'PRESENT', score: 81, teacherComment: 'Confident numerical work.', enteredByMembershipId: 'mem_syn_banda', enteredAt: '2026-08-03T09:00:00.000Z' },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g8b_t2', learnerId: 'lrn_syn_801', subjectId: 'sub_syn_eng', status: 'PRESENT', score: 76, teacherComment: 'Attentive reading and grammar.', enteredByMembershipId: 'mem_syn_mwamba', enteredAt: '2026-08-03T11:00:00.000Z' },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g8b_t2', learnerId: 'lrn_syn_801', subjectId: 'sub_syn_sci', status: 'PRESENT', score: 84, teacherComment: 'Strong curiosity in experiments.', enteredByMembershipId: 'mem_syn_banda', enteredAt: '2026-08-03T12:00:00.000Z' }
    ],
    auditEvents: [
      {
        id: 'aud_syn_seed_1',
        schoolId: 'sch_syn_lus_01',
        action: 'RESULT_PACK_PUBLISHED',
        entityType: 'TermResultPack',
        entityId: 'pck_syn_g8b_t2',
        actorName: 'Mrs. Mutale Mulenga (Synthetic)',
        actorRole: 'HEAD_TEACHER',
        beforeState: { status: 'APPROVED' },
        afterState: { status: 'PUBLISHED' },
        metadata: { className: 'Grade 8B', termLabel: 'Term 2 (2026)' },
        createdAt: '2026-08-06T14:00:00.000Z'
      }
    ]
  };
}

let inMemoryFallbackState: SandboxState | null = null;

function loadState(): SandboxState {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as SandboxState;
      }
    }
  } catch {
    // Fall back to in-memory singleton when sessionStorage is unavailable.
  }
  if (!inMemoryFallbackState) {
    inMemoryFallbackState = createInitialSandboxState();
  }
  return inMemoryFallbackState;
}

function saveState(state: SandboxState): void {
  inMemoryFallbackState = state;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore storage quota or SSR absence.
  }
}

export function resetStaticSandboxState(): void {
  const fresh = createInitialSandboxState();
  saveState(fresh);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } });
}

function toSchoolSummary(school: SandboxSchool): SchoolSummary {
  return {
    id: school.id,
    code: school.code,
    name: school.name,
    sector: school.sector,
    province: school.province,
    district: school.district,
    isSyntheticDemo: school.isSyntheticDemo,
    status: school.status
  };
}

function toUserProfile(user: SandboxUser): AuthenticatedUserProfile {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    platformRole: 'STANDARD',
    status: 'ACTIVE',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function getUserMemberships(state: SandboxState, userId: string): MembershipSummary[] {
  return state.memberships
    .filter((m) => m.userId === userId && m.status === 'ACTIVE')
    .map((m) => {
      const school = state.schools.find((s) => s.id === m.schoolId)!;
      return {
        id: m.id,
        schoolId: m.schoolId,
        role: m.role,
        status: m.status,
        staffCode: m.staffCode,
        school: toSchoolSummary(school)
      };
    });
}

function resolveMembershipUserName(state: SandboxState, membershipId: string | null): string | null {
  if (!membershipId) return null;
  const mem = state.memberships.find((m) => m.id === membershipId);
  if (!mem) return null;
  return state.users.find((u) => u.id === mem.userId)?.name ?? null;
}

function appendAudit(
  state: SandboxState,
  input: {
    schoolId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    actorName: string | null;
    actorRole: SchoolRole | null;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }
): void {
  const id = `aud_syn_live_${state.nextEventCounter++}`;
  state.auditEvents.unshift({
    id,
    schoolId: input.schoolId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date().toISOString()
  });
}

function computeCompleteness(state: SandboxState, pack: SandboxResultPack) {
  const allocations = state.allocations.filter(
    (a) => a.schoolId === pack.schoolId && a.schoolClassId === pack.schoolClassId
  );
  const learners = state.learners
    .filter((l) => l.schoolId === pack.schoolId && l.schoolClassId === pack.schoolClassId)
    .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber));

  const missingItems: MissingMarkItem[] = [];
  let recordedEntries = 0;
  const expectedEntries = learners.length * allocations.length;

  for (const learner of learners) {
    for (const allocation of allocations) {
      const subject = state.subjects.find((s) => s.id === allocation.subjectId)!;
      const cell = state.marks.find(
        (m) =>
          m.schoolId === pack.schoolId &&
          m.packId === pack.id &&
          m.learnerId === learner.id &&
          m.subjectId === subject.id
      );
      const isComplete =
        cell &&
        cell.status !== 'PENDING' &&
        (cell.status !== 'PRESENT' || typeof cell.score === 'number');
      if (isComplete) {
        recordedEntries += 1;
      } else {
        missingItems.push({
          learnerId: learner.id,
          admissionNumber: learner.admissionNumber,
          learnerName: `${learner.firstName} ${learner.lastName}`,
          subjectId: subject.id,
          subjectCode: subject.code,
          subjectName: subject.name
        });
      }
    }
  }

  return {
    learners,
    allocations,
    expectedEntries,
    recordedEntries,
    missingCount: missingItems.length,
    readyForSubmission: expectedEntries > 0 && missingItems.length === 0,
    missingItems
  };
}

function buildPackDetail(
  state: SandboxState,
  school: SandboxSchool,
  pack: SandboxResultPack,
  viewerMembership: SandboxMembership
): ResultPackDetail {
  const schoolClass = state.classes.find((c) => c.id === pack.schoolClassId)!;
  const term = state.terms.find((t) => t.id === pack.academicTermId)!;
  const year = state.years.find((y) => y.id === term.academicYearId)!;
  const completeness = computeCompleteness(state, pack);

  const isEditablePackState =
    pack.status === 'DRAFT' || pack.status === 'NEEDS_REVISION';
  const subjects: PackSubjectColumn[] = completeness.allocations.map((alc) => {
    const sub = state.subjects.find((s) => s.id === alc.subjectId)!;
    const canEdit =
      isEditablePackState &&
      viewerMembership.role === 'TEACHER' &&
      alc.teacherMembershipId === viewerMembership.id;
    return {
      subjectId: sub.id,
      code: sub.code,
      name: sub.name,
      isCore: sub.isCore,
      maxMark: sub.maxMark,
      teacherMembershipId: alc.teacherMembershipId,
      teacherName: resolveMembershipUserName(state, alc.teacherMembershipId) ?? 'Assigned Teacher',
      canEdit
    };
  });

  const learners: PackLearnerRow[] = completeness.learners.map((l) => ({
    learnerId: l.id,
    admissionNumber: l.admissionNumber,
    firstName: l.firstName,
    lastName: l.lastName,
    preferredChannel: l.preferredChannel
  }));

  const marks: PackMarkCell[] = [];
  for (const learner of completeness.learners) {
    for (const sub of subjects) {
      const existing = state.marks.find(
        (m) =>
          m.schoolId === school.id &&
          m.packId === pack.id &&
          m.learnerId === learner.id &&
          m.subjectId === sub.subjectId
      );
      marks.push({
        learnerId: learner.id,
        subjectId: sub.subjectId,
        status: existing?.status ?? 'PENDING',
        score: existing?.score ?? null,
        teacherComment: existing?.teacherComment ?? null,
        enteredByName: resolveMembershipUserName(state, existing?.enteredByMembershipId ?? null),
        enteredAt: existing?.enteredAt ?? null
      });
    }
  }

  const isLeader = LEADERSHIP_ROLES.includes(viewerMembership.role);
  const isApprover = APPROVAL_ROLES.includes(viewerMembership.role);
  const isClassTeacher = schoolClass.classTeacherMembershipId === viewerMembership.id;
  const hasSubjectAllocation = subjects.some(
    (s) => s.teacherMembershipId === viewerMembership.id
  );

  return {
    id: pack.id,
    school: toSchoolSummary(school),
    academicYear: { id: year.id, year: year.year, label: year.label },
    academicTerm: { id: term.id, termNumber: term.termNumber, label: term.label },
    schoolClass: {
      id: schoolClass.id,
      name: schoolClass.name,
      gradeLevel: schoolClass.gradeLevel,
      classTeacherName: resolveMembershipUserName(state, schoolClass.classTeacherMembershipId)
    },
    status: pack.status,
    reviewNotes: pack.reviewNotes,
    submittedAt: pack.submittedAt,
    submittedByName: resolveMembershipUserName(state, pack.submittedByMembershipId),
    reviewedAt: pack.reviewedAt,
    reviewedByName: resolveMembershipUserName(state, pack.reviewedByMembershipId),
    approvedAt: pack.approvedAt,
    approvedByName: resolveMembershipUserName(state, pack.approvedByMembershipId),
    publishedAt: pack.publishedAt,
    publishedByName: resolveMembershipUserName(state, pack.publishedByMembershipId),
    subjects,
    learners,
    marks,
    completeness: {
      expectedEntries: completeness.expectedEntries,
      recordedEntries: completeness.recordedEntries,
      missingCount: completeness.missingCount,
      readyForSubmission: completeness.readyForSubmission,
      missingItems: completeness.missingItems
    },
    permissions: {
      canEditAllocatedMarks: subjects.some((s) => s.canEdit),
      canSubmit:
        isEditablePackState &&
        completeness.readyForSubmission &&
        (isLeader || isClassTeacher || hasSubjectAllocation),
      canRequestRevision:
        isLeader && (pack.status === 'SUBMITTED' || pack.status === 'APPROVED'),
      canApprove:
        isApprover && pack.status === 'SUBMITTED' && completeness.readyForSubmission,
      canPublish: isApprover && pack.status === 'APPROVED',
      canViewReportCards: pack.status === 'APPROVED' || pack.status === 'PUBLISHED'
    }
  };
}

function buildReportCard(
  state: SandboxState,
  school: SandboxSchool,
  pack: SandboxResultPack,
  learner: SandboxLearner
): ReportCard | null {
  if (pack.status !== 'APPROVED' && pack.status !== 'PUBLISHED') {
    return null;
  }
  const schoolClass = state.classes.find((c) => c.id === pack.schoolClassId)!;
  const term = state.terms.find((t) => t.id === pack.academicTermId)!;
  const year = state.years.find((y) => y.id === term.academicYearId)!;
  const allocations = state.allocations.filter(
    (a) => a.schoolId === school.id && a.schoolClassId === schoolClass.id
  );

  const subjects: ReportCardSubjectLine[] = [];
  let gradedSubjectsCount = 0;
  let totalScore = 0;
  let totalPossible = 0;

  for (const alc of allocations) {
    const sub = state.subjects.find((s) => s.id === alc.subjectId)!;
    const cell = state.marks.find(
      (m) =>
        m.schoolId === school.id &&
        m.packId === pack.id &&
        m.learnerId === learner.id &&
        m.subjectId === sub.id
    );
    if (!cell || cell.status === 'PENDING') {
      return null;
    }
    if (cell.status === 'PRESENT' && typeof cell.score === 'number') {
      gradedSubjectsCount += 1;
      totalScore += cell.score;
      totalPossible += sub.maxMark;
    }
    subjects.push({
      subjectId: sub.id,
      subjectCode: sub.code,
      subjectName: sub.name,
      status: cell.status,
      score: cell.score,
      maxMark: sub.maxMark,
      teacherComment: cell.teacherComment,
      teacherName: resolveMembershipUserName(state, alc.teacherMembershipId) ?? 'Assigned Teacher'
    });
  }

  const averagePercentage =
    totalPossible > 0 ? Math.round((totalScore / totalPossible) * 1000) / 10 : null;

  return {
    school: {
      ...toSchoolSummary(school),
      phone: school.phone,
      timezone: school.timezone
    },
    publicationState: pack.status === 'PUBLISHED' ? 'PUBLISHED' : 'APPROVED_PREVIEW',
    academicYearLabel: year.label,
    academicTermLabel: term.label,
    termNumber: term.termNumber,
    className: schoolClass.name,
    gradeLevel: schoolClass.gradeLevel,
    classTeacherName: resolveMembershipUserName(state, schoolClass.classTeacherMembershipId),
    approvedByName: resolveMembershipUserName(state, pack.approvedByMembershipId),
    approvedAt: pack.approvedAt,
    publishedAt: pack.publishedAt,
    learner: {
      id: learner.id,
      admissionNumber: learner.admissionNumber,
      firstName: learner.firstName,
      lastName: learner.lastName,
      guardianName: learner.guardianName,
      preferredChannel: learner.preferredChannel
    },
    subjects,
    summary: {
      gradedSubjectsCount,
      totalScore,
      totalPossible,
      averagePercentage
    }
  };
}

function parseJsonBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function handleStaticSandboxRequest(
  rawUrl: string,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const apiIndex = parsedUrl.pathname.indexOf('/api/');
  const path = apiIndex >= 0 ? parsedUrl.pathname.slice(apiIndex) : parsedUrl.pathname;

  const state = loadState();

  if (method === 'GET' && path === '/api/health') {
    return jsonResponse(200, {
      status: 'ok',
      service: 'orqeli-education-static-sandbox',
      stage: 'early-stage-foundation',
      sandboxMode: true
    });
  }

  if (method === 'GET' && path === '/api/sandbox/personas') {
    const payload: SandboxPersonasResponse = {
      syntheticOnly: true,
      credentialHint: STATIC_SANDBOX_CREDENTIAL,
      personas: STATIC_SANDBOX_PERSONAS
    };
    return jsonResponse(200, payload);
  }

  if (method === 'GET' && path === '/api/auth/csrf') {
    return jsonResponse(200, { csrfToken: STATIC_CSRF_TOKEN });
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = parseJsonBody(init);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const user = state.users.find((u) => u.email.toLowerCase() === email);
    if (!user || password !== STATIC_SANDBOX_CREDENTIAL) {
      return errorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    state.currentUserId = user.id;
    saveState(state);
    return jsonResponse(200, {
      user: toUserProfile(user),
      memberships: getUserMemberships(state, user.id),
      csrfToken: STATIC_CSRF_TOKEN
    });
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    state.currentUserId = null;
    saveState(state);
    return jsonResponse(200, { status: 'ok' });
  }

  const currentUser = state.currentUserId
    ? state.users.find((u) => u.id === state.currentUserId) ?? null
    : null;

  if (method === 'GET' && path === '/api/auth/me') {
    if (!currentUser) {
      return errorResponse(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    return jsonResponse(200, {
      user: toUserProfile(currentUser),
      memberships: getUserMemberships(state, currentUser.id),
      csrfToken: STATIC_CSRF_TOKEN
    });
  }

  if (!currentUser) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }

  const schoolRouteMatch = path.match(/^\/api\/schools\/([^/]+)\/(.+)$/);
  if (!schoolRouteMatch) {
    return errorResponse(404, 'NOT_FOUND', 'The requested resource was not found.');
  }

  const schoolId = decodeURIComponent(schoolRouteMatch[1]!);
  const subPath = schoolRouteMatch[2]!;
  const school = state.schools.find((s) => s.id === schoolId);
  const membership = state.memberships.find(
    (m) => m.schoolId === schoolId && m.userId === currentUser.id && m.status === 'ACTIVE'
  );

  if (!school || !membership) {
    return errorResponse(
      403,
      'SCHOOL_ACCESS_DENIED',
      'Your account does not belong to this school.'
    );
  }

  if (method === 'GET' && subPath === 'guardian/results') {
    if (membership.role !== 'PARENT_GUARDIAN') {
      return errorResponse(403, 'INSUFFICIENT_SCHOOL_ROLE', 'Guardian access required.');
    }
    const links = state.guardianLinks.filter(
      (g) => g.schoolId === schoolId && g.membershipId === membership.id
    );
    const overview: GuardianResultsOverview = {
      school: toSchoolSummary(school),
      learners: links.map((link) => {
        const learner = state.learners.find(
          (l) => l.schoolId === schoolId && l.id === link.learnerId
        )!;
        const currentClass = state.classes.find((c) => c.id === learner.schoolClassId) ?? null;
        const publishedPacks = state.packs.filter(
          (p) =>
            p.schoolId === schoolId &&
            p.schoolClassId === learner.schoolClassId &&
            p.status === 'PUBLISHED'
        );
        const publishedReports = publishedPacks
          .map((p) => {
            const rc = buildReportCard(state, school, p, learner);
            return rc ? { packId: p.id, reportCard: rc } : null;
          })
          .filter((item): item is { packId: string; reportCard: ReportCard } => item !== null);
        return {
          learner: {
            id: learner.id,
            admissionNumber: learner.admissionNumber,
            firstName: learner.firstName,
            lastName: learner.lastName,
            currentClassName: currentClass?.name ?? null,
            relationship: link.relationship,
            preferredChannel: learner.preferredChannel
          },
          publishedReports
        };
      })
    };
    return jsonResponse(200, overview);
  }

  if (!STAFF_ROLES.includes(membership.role)) {
    return errorResponse(403, 'INSUFFICIENT_SCHOOL_ROLE', 'School staff access required.');
  }

  if (method === 'GET' && subPath === 'overview') {
    const currentYear =
      state.years.find((y) => y.schoolId === schoolId && y.isCurrent) ?? null;
    const currentTerm =
      state.terms.find((t) => t.schoolId === schoolId && t.isCurrent) ?? null;
    const mySubjectAllocations = state.allocations
      .filter((a) => a.schoolId === schoolId && a.teacherMembershipId === membership.id)
      .map((a) => {
        const cls = state.classes.find((c) => c.id === a.schoolClassId)!;
        const sub = state.subjects.find((s) => s.id === a.subjectId)!;
        return {
          allocationId: a.id,
          schoolClassId: cls.id,
          className: cls.name,
          subjectId: sub.id,
          subjectCode: sub.code,
          subjectName: sub.name
        };
      });

    const resultPacks: ResultPackSummary[] = state.packs
      .filter((p) => p.schoolId === schoolId)
      .map((p) => {
        const cls = state.classes.find((c) => c.id === p.schoolClassId)!;
        const term = state.terms.find((t) => t.id === p.academicTermId)!;
        const year = state.years.find((y) => y.id === term.academicYearId)!;
        const comp = computeCompleteness(state, p);
        const canOpen =
          LEADERSHIP_ROLES.includes(membership.role) ||
          cls.classTeacherMembershipId === membership.id ||
          comp.allocations.some((a) => a.teacherMembershipId === membership.id);
        return {
          id: p.id,
          schoolClassId: cls.id,
          className: cls.name,
          gradeLevel: cls.gradeLevel,
          academicTermId: term.id,
          termLabel: term.label,
          termNumber: term.termNumber,
          academicYearLabel: year.label,
          status: p.status,
          reviewNotes: p.reviewNotes,
          learnerCount: comp.learners.length,
          subjectCount: comp.allocations.length,
          expectedEntries: comp.expectedEntries,
          recordedEntries: comp.recordedEntries,
          missingCount: comp.missingCount,
          submittedAt: p.submittedAt,
          approvedAt: p.approvedAt,
          publishedAt: p.publishedAt,
          canOpen
        };
      });

    const overview: SchoolOverview = {
      school: {
        ...toSchoolSummary(school),
        phone: school.phone,
        email: school.email,
        timezone: school.timezone
      },
      viewerRoles: [membership.role],
      currentAcademicYear: currentYear
        ? { id: currentYear.id, year: currentYear.year, label: currentYear.label }
        : null,
      currentTerm: currentTerm
        ? { id: currentTerm.id, termNumber: currentTerm.termNumber, label: currentTerm.label }
        : null,
      mySubjectAllocations,
      resultPacks
    };
    return jsonResponse(200, overview);
  }

  if (method === 'GET' && subPath === 'audit-events') {
    if (!LEADERSHIP_ROLES.includes(membership.role)) {
      return errorResponse(403, 'INSUFFICIENT_SCHOOL_ROLE', 'Leadership role required.');
    }
    const events = state.auditEvents.filter((e) => e.schoolId === schoolId);
    return jsonResponse(200, { events });
  }

  const reportMatch = subPath.match(/^result-packs\/([^/]+)\/report-cards\/([^/]+)$/);
  if (method === 'GET' && reportMatch) {
    const packId = decodeURIComponent(reportMatch[1]!);
    const learnerId = decodeURIComponent(reportMatch[2]!);
    const pack = state.packs.find((p) => p.schoolId === schoolId && p.id === packId);
    const learner = state.learners.find((l) => l.schoolId === schoolId && l.id === learnerId);
    if (!pack || !learner) {
      return errorResponse(404, 'NOT_FOUND', 'Report card was not found.');
    }
    if (pack.status !== 'APPROVED' && pack.status !== 'PUBLISHED') {
      return errorResponse(
        409,
        'REPORT_CARD_NOT_APPROVED',
        'Printable report cards require explicit head-teacher approval first.'
      );
    }
    const reportCard = buildReportCard(state, school, pack, learner);
    if (!reportCard) {
      return errorResponse(404, 'NOT_FOUND', 'Report card was not found.');
    }
    return jsonResponse(200, { reportCard });
  }

  const packMatch = subPath.match(/^result-packs\/([^/]+)(?:\/(.+))?$/);
  if (packMatch) {
    const packId = decodeURIComponent(packMatch[1]!);
    const action = packMatch[2] ?? '';
    const pack = state.packs.find((p) => p.schoolId === schoolId && p.id === packId);
    if (!pack) {
      return errorResponse(404, 'NOT_FOUND', 'Result pack was not found.');
    }

    if (method === 'GET' && action === '') {
      return jsonResponse(200, {
        pack: buildPackDetail(state, school, pack, membership)
      });
    }

    if (method === 'PUT' && action === 'marks') {
      if (membership.role !== 'TEACHER') {
        return errorResponse(
          403,
          'INSUFFICIENT_SCHOOL_ROLE',
          'Only subject teachers record marks.'
        );
      }
      if (pack.status !== 'DRAFT' && pack.status !== 'NEEDS_REVISION') {
        return errorResponse(
          409,
          'PACK_LOCKED',
          'Marks can only be edited when the result pack is in DRAFT or NEEDS_REVISION status.'
        );
      }
      const body = parseJsonBody(init);
      const entries = Array.isArray(body.entries) ? body.entries : [];
      if (entries.length === 0) {
        return errorResponse(400, 'VALIDATION_ERROR', 'At least one mark entry is required.');
      }

      for (const rawEntry of entries as Array<Record<string, unknown>>) {
        const learnerId = String(rawEntry.learnerId ?? '');
        const subjectId = String(rawEntry.subjectId ?? '');
        const status = String(rawEntry.status ?? '') as MarkEntryStatus;
        const score =
          rawEntry.score === null || rawEntry.score === undefined
            ? null
            : Number(rawEntry.score);
        const teacherComment =
          typeof rawEntry.teacherComment === 'string' && rawEntry.teacherComment.trim()
            ? rawEntry.teacherComment.trim()
            : null;

        const allocation = state.allocations.find(
          (a) =>
            a.schoolId === schoolId &&
            a.schoolClassId === pack.schoolClassId &&
            a.subjectId === subjectId
        );
        if (!allocation || allocation.teacherMembershipId !== membership.id) {
          return errorResponse(
            403,
            'SUBJECT_NOT_ALLOCATED',
            'You can only record marks for subjects allocated to you in this class.'
          );
        }
        const subject = state.subjects.find((s) => s.id === subjectId)!;
        if (status === 'PRESENT') {
          if (
            score === null ||
            !Number.isInteger(score) ||
            score < 0 ||
            score > subject.maxMark
          ) {
            return errorResponse(
              400,
              'SCORE_OUT_OF_RANGE',
              `Score for ${subject.name} must be a whole number between 0 and ${subject.maxMark}.`
            );
          }
        } else if (score !== null) {
          return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Score must be empty when mark status is not PRESENT.'
          );
        }

        const existingIdx = state.marks.findIndex(
          (m) =>
            m.schoolId === schoolId &&
            m.packId === pack.id &&
            m.learnerId === learnerId &&
            m.subjectId === subjectId
        );
        const now = new Date().toISOString();
        const updatedCell: SandboxMark = {
          schoolId,
          packId: pack.id,
          learnerId,
          subjectId,
          status,
          score,
          teacherComment,
          enteredByMembershipId: membership.id,
          enteredAt: now
        };
        if (existingIdx >= 0) {
          state.marks[existingIdx] = updatedCell;
        } else {
          state.marks.push(updatedCell);
        }
      }

      appendAudit(state, {
        schoolId,
        action: 'SUBJECT_MARKS_RECORDED',
        entityType: 'TermResultPack',
        entityId: pack.id,
        actorName: currentUser.name,
        actorRole: membership.role,
        afterState: { updatedEntries: entries.length }
      });
      saveState(state);
      return jsonResponse(200, {
        pack: buildPackDetail(state, school, pack, membership)
      });
    }

    if (method === 'POST' && action === 'submit') {
      if (pack.status !== 'DRAFT' && pack.status !== 'NEEDS_REVISION') {
        return errorResponse(409, 'INVALID_PACK_TRANSITION', 'Pack cannot be submitted.');
      }
      const comp = computeCompleteness(state, pack);
      if (!comp.readyForSubmission) {
        return errorResponse(
          409,
          'INCOMPLETE_RESULT_PACK',
          `Cannot submit result pack while ${comp.missingCount} subject mark(s) are still missing.`
        );
      }
      const prevStatus = pack.status;
      pack.status = 'SUBMITTED';
      pack.submittedAt = new Date().toISOString();
      pack.submittedByMembershipId = membership.id;
      pack.reviewNotes = null;
      appendAudit(state, {
        schoolId,
        action: 'RESULT_PACK_SUBMITTED',
        entityType: 'TermResultPack',
        entityId: pack.id,
        actorName: currentUser.name,
        actorRole: membership.role,
        beforeState: { status: prevStatus },
        afterState: { status: 'SUBMITTED' }
      });
      saveState(state);
      return jsonResponse(200, {
        pack: buildPackDetail(state, school, pack, membership)
      });
    }

    if (method === 'POST' && action === 'request-revision') {
      if (!LEADERSHIP_ROLES.includes(membership.role)) {
        return errorResponse(403, 'INSUFFICIENT_SCHOOL_ROLE', 'Reviewer role required.');
      }
      if (pack.status !== 'SUBMITTED' && pack.status !== 'APPROVED') {
        return errorResponse(
          409,
          'INVALID_PACK_TRANSITION',
          'Only submitted or approved packs can be returned for revision.'
        );
      }
      const body = parseJsonBody(init);
      const reviewNotes =
        typeof body.reviewNotes === 'string' ? body.reviewNotes.trim() : '';
      if (reviewNotes.length < 5) {
        return errorResponse(
          400,
          'VALIDATION_ERROR',
          'Please provide clear revision notes of at least 5 characters.'
        );
      }
      const prevStatus = pack.status;
      pack.status = 'NEEDS_REVISION';
      pack.reviewNotes = reviewNotes;
      pack.reviewedAt = new Date().toISOString();
      pack.reviewedByMembershipId = membership.id;
      pack.approvedAt = null;
      pack.approvedByMembershipId = null;
      appendAudit(state, {
        schoolId,
        action: 'RESULT_PACK_REVISION_REQUESTED',
        entityType: 'TermResultPack',
        entityId: pack.id,
        actorName: currentUser.name,
        actorRole: membership.role,
        beforeState: { status: prevStatus },
        afterState: { status: 'NEEDS_REVISION', reviewNotes }
      });
      saveState(state);
      return jsonResponse(200, {
        pack: buildPackDetail(state, school, pack, membership)
      });
    }

    if (method === 'POST' && action === 'approve') {
      if (!APPROVAL_ROLES.includes(membership.role)) {
        return errorResponse(
          403,
          'INSUFFICIENT_SCHOOL_ROLE',
          'Head teacher or school admin approval required.'
        );
      }
      if (pack.status !== 'SUBMITTED') {
        return errorResponse(
          409,
          'INVALID_PACK_TRANSITION',
          'Only submitted result packs can be approved.'
        );
      }
      const comp = computeCompleteness(state, pack);
      if (!comp.readyForSubmission) {
        return errorResponse(
          409,
          'INCOMPLETE_RESULT_PACK',
          'Cannot approve an incomplete result pack.'
        );
      }
      pack.status = 'APPROVED';
      pack.approvedAt = new Date().toISOString();
      pack.approvedByMembershipId = membership.id;
      appendAudit(state, {
        schoolId,
        action: 'RESULT_PACK_APPROVED',
        entityType: 'TermResultPack',
        entityId: pack.id,
        actorName: currentUser.name,
        actorRole: membership.role,
        beforeState: { status: 'SUBMITTED' },
        afterState: { status: 'APPROVED' }
      });
      saveState(state);
      return jsonResponse(200, {
        pack: buildPackDetail(state, school, pack, membership)
      });
    }

    if (method === 'POST' && action === 'publish') {
      if (!APPROVAL_ROLES.includes(membership.role)) {
        return errorResponse(
          403,
          'INSUFFICIENT_SCHOOL_ROLE',
          'Head teacher or school admin role required to publish results.'
        );
      }
      if (pack.status !== 'APPROVED') {
        return errorResponse(
          409,
          'APPROVAL_REQUIRED_BEFORE_PUBLICATION',
          'Results must be explicitly approved before publication.'
        );
      }
      pack.status = 'PUBLISHED';
      pack.publishedAt = new Date().toISOString();
      pack.publishedByMembershipId = membership.id;
      appendAudit(state, {
        schoolId,
        action: 'RESULT_PACK_PUBLISHED',
        entityType: 'TermResultPack',
        entityId: pack.id,
        actorName: currentUser.name,
        actorRole: membership.role,
        beforeState: { status: 'APPROVED' },
        afterState: { status: 'PUBLISHED' }
      });
      saveState(state);
      return jsonResponse(200, {
        pack: buildPackDetail(state, school, pack, membership)
      });
    }
  }

  return errorResponse(404, 'NOT_FOUND', 'The requested resource was not found.');
}
