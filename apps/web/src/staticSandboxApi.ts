import type {
  AdminRegistrationRequest,
  AdminRosterLearner,
  AnnouncementAudience,
  AuditEventItem,
  AuthenticatedUserProfile,
  CommunicationChannel,
  GuardianResultsOverview,
  IssuedEnrolmentCode,
  MarkEntryStatus,
  MembershipStatus,
  MembershipSummary,
  MissingMarkItem,
  PackLearnerRow,
  PackMarkCell,
  PackSubjectColumn,
  PublicSchoolProfile,
  ReportCard,
  ReportCardSubjectLine,
  ResultPackDetail,
  ResultPackStatus,
  ResultPackSummary,
  SandboxPersona,
  SandboxPersonasResponse,
  SchoolAdminPortalState,
  SchoolAnnouncementItem,
  SchoolOverview,
  SchoolRole,
  SchoolSector,
  SchoolStatus,
  SchoolSummary,
  StudentPortalAccount,
  StudentPortalOverview,
  StudentRegistrationStatus,
  StudentTermResultStatus,
  StudentVerificationMethod,
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
export const STATIC_DEMO_ENROLMENT_CODE = 'ORQ-8B02-2026';
export const STATIC_DEMO_ENROLMENT_ADMISSION_NO = 'SYN-2026-0802';
const STORAGE_KEY = 'orqeli.static_sandbox.state.v2';
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

interface SandboxUser {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
}

interface SandboxSchool {
  id: string;
  code: string;
  registrationNumber: string | null;
  name: string;
  sector: SchoolSector;
  province: string;
  district: string;
  levelSummary: string | null;
  publicDescription: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  isSyntheticDemo: boolean;
  studentPortalEnabled: boolean;
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

interface SandboxStudentLink {
  id: string;
  schoolId: string;
  membershipId: string;
  learnerId: string;
  verificationMethod: StudentVerificationMethod;
  verifiedAt: string;
}

interface SandboxEnrolmentCode {
  id: string;
  schoolId: string;
  learnerId: string;
  canonicalCode: string;
  codeHint: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface SandboxRegistrationRequest {
  id: string;
  schoolId: string;
  userId: string;
  claimedAdmissionNo: string;
  claimedName: string;
  claimedClassNote: string | null;
  status: StudentRegistrationStatus;
  approvedLearnerId: string | null;
  reviewedByMembershipId: string | null;
  reviewedAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
}

interface SandboxAnnouncement {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  postedByMembershipId: string;
  publishedAt: string;
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
  studentLinks: SandboxStudentLink[];
  enrolmentCodes: SandboxEnrolmentCode[];
  registrationRequests: SandboxRegistrationRequest[];
  announcements: SandboxAnnouncement[];
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
      },
      {
        id: 'usr_syn_student_lubasi',
        email: 'student.lubasi@synthetic.orqeli.invalid',
        phone: null,
        name: 'Lubasi Phiri',
        createdAt: created,
        updatedAt: created
      },
      {
        id: 'usr_syn_student_pending',
        email: 'student.pending@synthetic.orqeli.invalid',
        phone: null,
        name: 'Bupe Kasonde',
        createdAt: created,
        updatedAt: created
      }
    ],
    schools: [
      {
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
        timezone: 'Africa/Lusaka',
        isSyntheticDemo: true,
        studentPortalEnabled: true,
        status: 'PILOT_PREP'
      },
      {
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
        timezone: 'Africa/Lusaka',
        isSyntheticDemo: true,
        studentPortalEnabled: true,
        status: 'PILOT_PREP'
      },
      {
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
        timezone: 'Africa/Lusaka',
        isSyntheticDemo: true,
        studentPortalEnabled: false,
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
      },
      {
        id: 'mem_syn_student_lubasi',
        schoolId: 'sch_syn_lus_01',
        userId: 'usr_syn_student_lubasi',
        role: 'STUDENT',
        status: 'ACTIVE',
        staffCode: null
      },
      {
        id: 'mem_syn_student_pending',
        schoolId: 'sch_syn_lus_01',
        userId: 'usr_syn_student_pending',
        role: 'STUDENT',
        status: 'INACTIVE',
        staffCode: null
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
        id: 'lrn_syn_802',
        schoolId: 'sch_syn_lus_01',
        admissionNumber: STATIC_DEMO_ENROLMENT_ADMISSION_NO,
        firstName: 'Chisomo',
        lastName: 'Banda',
        schoolClassId: 'cls_syn_g8b',
        guardianName: 'Mrs. Ruth Banda (Synthetic)',
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
    studentLinks: [
      {
        id: 'slk_syn_lubasi_801',
        schoolId: 'sch_syn_lus_01',
        membershipId: 'mem_syn_student_lubasi',
        learnerId: 'lrn_syn_801',
        verificationMethod: 'ENROLMENT_CODE',
        verifiedAt: '2026-08-10T09:00:00.000Z'
      }
    ],
    enrolmentCodes: [
      {
        id: 'ecd_syn_chisomo_802',
        schoolId: 'sch_syn_lus_01',
        learnerId: 'lrn_syn_802',
        canonicalCode: 'ORQ8B022026',
        codeHint: 'ORQ-••••-2026',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        usedAt: null,
        revokedAt: null,
        createdAt: created
      }
    ],
    registrationRequests: [
      {
        id: 'srq_syn_bupe_903',
        schoolId: 'sch_syn_lus_01',
        userId: 'usr_syn_student_pending',
        claimedAdmissionNo: 'SYN-2026-0903',
        claimedName: 'Bupe Kasonde',
        claimedClassNote: 'Grade 9A',
        status: 'PENDING',
        approvedLearnerId: null,
        reviewedByMembershipId: null,
        reviewedAt: null,
        decisionNotes: null,
        createdAt: '2026-10-20T08:15:00.000Z'
      }
    ],
    announcements: [
      {
        id: 'ann_syn_t2_published',
        schoolId: 'sch_syn_lus_01',
        title: 'Term 2 (2026) Official Results Published for Grade 8B',
        body: 'Approved Term 2 academic results for Grade 8B are now available in the student portal and as printable A4 statements.',
        audience: 'STUDENTS_AND_STAFF',
        postedByMembershipId: 'mem_syn_head_1',
        publishedAt: '2026-08-06T14:30:00.000Z'
      },
      {
        id: 'ann_syn_staff_internal',
        schoolId: 'sch_syn_lus_01',
        title: 'Staff Mark-Sheet Deadline Reminder (Internal)',
        body: 'All subject teachers must complete pending Term 3 entries before Friday 16:00 CAT.',
        audience: 'STAFF_ONLY',
        postedByMembershipId: 'mem_syn_head_1',
        publishedAt: '2026-10-19T07:30:00.000Z'
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
        id: 'pck_syn_g8b_t3',
        schoolId: 'sch_syn_lus_01',
        academicTermId: 'trm_syn_2026_t3',
        schoolClassId: 'cls_syn_g8b',
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
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g8b_t2', learnerId: 'lrn_syn_801', subjectId: 'sub_syn_sci', status: 'PRESENT', score: 84, teacherComment: 'Strong curiosity in experiments.', enteredByMembershipId: 'mem_syn_banda', enteredAt: '2026-08-03T12:00:00.000Z' },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g8b_t2', learnerId: 'lrn_syn_802', subjectId: 'sub_syn_math', status: 'PRESENT', score: 72, teacherComment: 'Good accuracy in linear equations.', enteredByMembershipId: 'mem_syn_banda', enteredAt: '2026-08-03T09:00:00.000Z' },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g8b_t2', learnerId: 'lrn_syn_802', subjectId: 'sub_syn_eng', status: 'PRESENT', score: 79, teacherComment: 'Expressive composition writing.', enteredByMembershipId: 'mem_syn_mwamba', enteredAt: '2026-08-03T11:00:00.000Z' },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g8b_t2', learnerId: 'lrn_syn_802', subjectId: 'sub_syn_sci', status: 'PRESENT', score: 68, teacherComment: 'Solid understanding of plant biology.', enteredByMembershipId: 'mem_syn_banda', enteredAt: '2026-08-03T12:00:00.000Z' },
      { schoolId: 'sch_syn_lus_01', packId: 'pck_syn_g8b_t3', learnerId: 'lrn_syn_801', subjectId: 'sub_syn_math', status: 'PRESENT', score: 91, teacherComment: 'Draft Term 3 score — hidden until published.', enteredByMembershipId: 'mem_syn_banda', enteredAt: created }
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
    .filter((m) => m.userId === userId && (m.status === 'ACTIVE' || m.role === 'STUDENT'))
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

function computeStaticSubjectGrade(
  status: Exclude<MarkEntryStatus, 'PENDING'>,
  score: number | null,
  maxMark: number
): { percentage: number | null; grade: string } {
  if (status === 'ABSENT') return { percentage: null, grade: 'ABS' };
  if (status === 'EXEMPT') return { percentage: null, grade: 'EX' };
  if (score === null || maxMark <= 0) return { percentage: null, grade: '—' };
  const percentage = Math.round((score / maxMark) * 1000) / 10;
  if (percentage >= 75) return { percentage, grade: 'Distinction (1)' };
  if (percentage >= 65) return { percentage, grade: 'Merit (2)' };
  if (percentage >= 50) return { percentage, grade: 'Credit (3)' };
  if (percentage >= 40) return { percentage, grade: 'Pass (4)' };
  return { percentage, grade: 'Unsatisfactory (9)' };
}

function toPublicSchoolProfile(state: SandboxState, s: SandboxSchool): PublicSchoolProfile {
  const yr = state.years.find((y) => y.schoolId === s.id && y.isCurrent);
  return {
    id: s.id,
    code: s.code,
    registrationNumber: s.registrationNumber,
    name: s.name,
    sector: s.sector,
    province: s.province,
    district: s.district,
    levelSummary: s.levelSummary,
    publicDescription: s.publicDescription,
    phone: s.phone,
    email: s.email,
    status: s.status,
    isSyntheticDemo: s.isSyntheticDemo,
    studentPortalEnabled: s.studentPortalEnabled,
    canSelfRegister: s.status !== 'SUSPENDED' && s.studentPortalEnabled,
    currentAcademicYearLabel: yr?.label ?? null
  };
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
      ...computeStaticSubjectGrade(cell.status, cell.score, sub.maxMark),
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
      demoEnrolmentWalkthrough: {
        schoolCode: 'SYN-ZM-LUS-01',
        admissionNumber: STATIC_DEMO_ENROLMENT_ADMISSION_NO,
        enrolmentCode: STATIC_DEMO_ENROLMENT_CODE
      },
      personas: STATIC_SANDBOX_PERSONAS
    };
    return jsonResponse(200, payload);
  }

  if (method === 'GET' && path === '/api/public/schools') {
    const q = (parsedUrl.searchParams.get('q') ?? '').trim().toLowerCase();
    const prov = (parsedUrl.searchParams.get('province') ?? '').trim().toLowerCase();
    const sector = (parsedUrl.searchParams.get('sector') ?? '').trim();
    const portalOnly = parsedUrl.searchParams.get('portalOnly') === 'true';

    const schools = state.schools
      .filter((s) => {
        if (s.status === 'SUSPENDED') return false;
        if (prov && s.province.toLowerCase() !== prov) return false;
        if (sector && s.sector !== sector) return false;
        if (portalOnly && !s.studentPortalEnabled) return false;
        if (q) {
          const hay = [
            s.name,
            s.code,
            s.registrationNumber ?? '',
            s.province,
            s.district,
            s.levelSummary ?? ''
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((s) => toPublicSchoolProfile(state, s));

    return jsonResponse(200, { schools });
  }

  const publicProfileMatch = path.match(/^\/api\/public\/schools\/([^/]+)$/);
  if (method === 'GET' && publicProfileMatch) {
    const needle = decodeURIComponent(publicProfileMatch[1]!).trim().toLowerCase();
    const school = state.schools.find(
      (s) =>
        s.status !== 'SUSPENDED' &&
        (s.code.toLowerCase() === needle || s.id.toLowerCase() === needle)
    );
    if (!school) {
      return errorResponse(404, 'SCHOOL_NOT_FOUND', 'Public school profile was not found.');
    }
    return jsonResponse(200, { school: toPublicSchoolProfile(state, school) });
  }

  if (method === 'GET' && path === '/api/auth/csrf') {
    return jsonResponse(200, { csrfToken: STATIC_CSRF_TOKEN });
  }

  if (method === 'POST' && path === '/api/student/register') {
    const body = parseJsonBody(init);
    const schoolId = String(body.schoolId ?? '').trim();
    const fullName = String(body.fullName ?? '').trim();
    const admissionNumber = String(body.admissionNumber ?? '').trim().toUpperCase();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const verificationMode = String(
      body.verificationMode ?? ''
    ) as StudentVerificationMethod;
    const rawCode =
      typeof body.enrolmentCode === 'string'
        ? body.enrolmentCode.toUpperCase().replace(/[\s-]+/g, '')
        : '';
    const classHint =
      typeof body.classHint === 'string' && body.classHint.trim()
        ? body.classHint.trim()
        : null;

    if (!schoolId || fullName.length < 2 || admissionNumber.length < 2 || password.length < 8) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Please complete all required fields.');
    }

    const school = state.schools.find((s) => s.id === schoolId);
    if (!school || school.status === 'SUSPENDED' || !school.studentPortalEnabled) {
      return errorResponse(
        403,
        'STUDENT_PORTAL_NOT_ENABLED',
        'Student portal self-registration is not enabled for this school.'
      );
    }

    if (state.users.some((u) => u.email.toLowerCase() === email)) {
      return errorResponse(
        409,
        'ACCOUNT_EMAIL_CONFLICT',
        'Unable to create a student account with this email address.'
      );
    }

    const now = new Date().toISOString();
    if (verificationMode === 'ENROLMENT_CODE') {
      const codeRecord = state.enrolmentCodes.find(
        (c) => c.schoolId === school.id && c.canonicalCode === rawCode
      );
      const learner = codeRecord
        ? state.learners.find((l) => l.id === codeRecord.learnerId)
        : undefined;
      const alreadyLinked = learner
        ? state.studentLinks.some((sl) => sl.learnerId === learner.id)
        : false;

      if (
        !codeRecord ||
        !learner ||
        learner.admissionNumber.toUpperCase() !== admissionNumber ||
        codeRecord.usedAt !== null ||
        codeRecord.revokedAt !== null ||
        new Date(codeRecord.expiresAt).getTime() <= Date.now() ||
        alreadyLinked
      ) {
        return errorResponse(
          400,
          'INVALID_ENROLMENT_VERIFICATION',
          'Enrolment verification failed. Confirm your school, learner admission number, and active single-use enrolment code.'
        );
      }

      const newUser: SandboxUser = {
        id: `usr_syn_stu_${state.nextEventCounter++}`,
        email,
        phone: null,
        name: fullName,
        password,
        createdAt: now,
        updatedAt: now
      };
      state.users.push(newUser);
      codeRecord.usedAt = now;

      const memId = `mem_syn_stu_${state.nextEventCounter++}`;
      state.memberships.push({
        id: memId,
        schoolId: school.id,
        userId: newUser.id,
        role: 'STUDENT',
        status: 'ACTIVE',
        staffCode: null
      });
      state.studentLinks.push({
        id: `slk_syn_${state.nextEventCounter++}`,
        schoolId: school.id,
        membershipId: memId,
        learnerId: learner.id,
        verificationMethod: 'ENROLMENT_CODE',
        verifiedAt: now
      });
      state.currentUserId = newUser.id;
      saveState(state);

      return jsonResponse(201, {
        outcome: 'VERIFIED',
        schoolCode: school.code,
        requestId: null,
        message: 'Student account verified and linked to your school academic record.',
        user: toUserProfile(newUser),
        memberships: getUserMemberships(state, newUser.id),
        csrfToken: STATIC_CSRF_TOKEN
      });
    }

    const newUser: SandboxUser = {
      id: `usr_syn_stu_${state.nextEventCounter++}`,
      email,
      phone: null,
      name: fullName,
      password,
      createdAt: now,
      updatedAt: now
    };
    state.users.push(newUser);

    const memId = `mem_syn_stu_${state.nextEventCounter++}`;
    state.memberships.push({
      id: memId,
      schoolId: school.id,
      userId: newUser.id,
      role: 'STUDENT',
      status: 'INACTIVE',
      staffCode: null
    });

    const reqId = `srq_syn_${state.nextEventCounter++}`;
    state.registrationRequests.unshift({
      id: reqId,
      schoolId: school.id,
      userId: newUser.id,
      claimedAdmissionNo: admissionNumber,
      claimedName: fullName,
      claimedClassNote: classHint,
      status: 'PENDING',
      approvedLearnerId: null,
      reviewedByMembershipId: null,
      reviewedAt: null,
      decisionNotes: null,
      createdAt: now
    });
    state.currentUserId = newUser.id;
    saveState(state);

    return jsonResponse(201, {
      outcome: 'PENDING_APPROVAL',
      schoolCode: school.code,
      requestId: reqId,
      message:
        'Registration request submitted. School administration must verify your learner record before academic results become visible.',
      user: toUserProfile(newUser),
      memberships: getUserMemberships(state, newUser.id),
      csrfToken: STATIC_CSRF_TOKEN
    });
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = parseJsonBody(init);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const user = state.users.find((u) => u.email.toLowerCase() === email);
    const expectedPass = user?.password ?? STATIC_SANDBOX_CREDENTIAL;
    if (!user || password !== expectedPass) {
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

  if (method === 'GET' && path === '/api/student/portal') {
    const studentMemberships = state.memberships.filter(
      (m) => m.userId === currentUser.id && m.role === 'STUDENT'
    );

    const accounts: StudentPortalAccount[] = studentMemberships.map((mem) => {
      const school = state.schools.find((s) => s.id === mem.schoolId)!;
      const link = state.studentLinks.find(
        (sl) => sl.schoolId === school.id && sl.membershipId === mem.id
      );
      const reqRecord = state.registrationRequests.find(
        (r) => r.schoolId === school.id && r.userId === currentUser.id
      );
      const schoolDto = {
        ...toSchoolSummary(school),
        registrationNumber: school.registrationNumber,
        levelSummary: school.levelSummary,
        phone: school.phone,
        email: school.email
      };

      const announcements: SchoolAnnouncementItem[] = state.announcements
        .filter((a) => a.schoolId === school.id && a.audience === 'STUDENTS_AND_STAFF')
        .map((a) => ({
          id: a.id,
          schoolId: school.id,
          title: a.title,
          body: a.body,
          audience: a.audience,
          postedByName:
            resolveMembershipUserName(state, a.postedByMembershipId) ??
            'School Administration',
          publishedAt: a.publishedAt
        }));

      if (!link || mem.status !== 'ACTIVE') {
        const verificationState: 'PENDING_APPROVAL' | 'REJECTED' =
          reqRecord?.status === 'REJECTED' ? 'REJECTED' : 'PENDING_APPROVAL';
        return {
          membershipId: mem.id,
          school: schoolDto,
          verificationState,
          learner: null,
          pendingRequest: reqRecord
            ? {
                id: reqRecord.id,
                claimedAdmissionNo: reqRecord.claimedAdmissionNo,
                claimedClassNote: reqRecord.claimedClassNote,
                status: reqRecord.status,
                decisionNotes: reqRecord.decisionNotes,
                createdAt: reqRecord.createdAt,
                reviewedAt: reqRecord.reviewedAt
              }
            : null,
          termResults: [],
          announcements: []
        };
      }

      const learner = state.learners.find((l) => l.id === link.learnerId)!;
      const cls = state.classes.find((c) => c.id === learner.schoolClassId) ?? null;
      const currentYr =
        state.years.find((y) => y.schoolId === school.id && y.isCurrent) ?? null;
      const currentTrm =
        state.terms.find((t) => t.schoolId === school.id && t.isCurrent) ?? null;

      const classPacks = learner.schoolClassId
        ? state.packs.filter(
            (p) => p.schoolId === school.id && p.schoolClassId === learner.schoolClassId
          )
        : [];

      const termResults: StudentTermResultStatus[] = classPacks.map((p) => {
        const term = state.terms.find((t) => t.id === p.academicTermId)!;
        const year = state.years.find((y) => y.id === term.academicYearId)!;
        const pCls = state.classes.find((c) => c.id === p.schoolClassId)!;

        if (p.status === 'PUBLISHED') {
          const rc = buildReportCard(state, school, p, learner);
          if (rc) {
            return {
              packId: p.id,
              academicYearLabel: year.label,
              academicTermLabel: term.label,
              termNumber: term.termNumber,
              className: pCls.name,
              gradeLevel: pCls.gradeLevel,
              publicationState: 'PUBLISHED',
              statusMessage:
                'Approved by school administration and officially published.',
              publishedAt: p.publishedAt,
              reportCard: rc
            };
          }
        }

        const statusMessage =
          p.status === 'APPROVED' || p.status === 'SUBMITTED'
            ? 'Term results are undergoing school review and have not yet been published.'
            : 'Term assessments are still in preparation. Marks remain hidden until officially published.';

        return {
          packId: p.id,
          academicYearLabel: year.label,
          academicTermLabel: term.label,
          termNumber: term.termNumber,
          className: pCls.name,
          gradeLevel: pCls.gradeLevel,
          publicationState: 'UNPUBLISHED',
          statusMessage,
          publishedAt: null,
          reportCard: null
        };
      });

      return {
        membershipId: mem.id,
        school: schoolDto,
        verificationState: 'VERIFIED',
        learner: {
          id: learner.id,
          admissionNumber: learner.admissionNumber,
          firstName: learner.firstName,
          lastName: learner.lastName,
          currentClassName: cls?.name ?? null,
          gradeLevel: cls?.gradeLevel ?? null,
          currentAcademicYearLabel: currentYr?.label ?? null,
          currentTermLabel: currentTrm?.label ?? null,
          verificationMethod: link.verificationMethod,
          verifiedAt: link.verifiedAt
        },
        pendingRequest: null,
        termResults,
        announcements
      };
    });

    const payload: StudentPortalOverview = {
      studentUser: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email
      },
      accounts
    };
    return jsonResponse(200, payload);
  }

  const studentReportMatch = path.match(
    /^\/api\/student\/schools\/([^/]+)\/learners\/([^/]+)\/report-cards\/([^/]+)$/
  );
  if (method === 'GET' && studentReportMatch) {
    const sId = decodeURIComponent(studentReportMatch[1]!);
    const lId = decodeURIComponent(studentReportMatch[2]!);
    const pId = decodeURIComponent(studentReportMatch[3]!);

    const isLinked = state.studentLinks.some((sl) => {
      if (sl.schoolId !== sId || sl.learnerId !== lId) return false;
      const mem = state.memberships.find((m) => m.id === sl.membershipId);
      return (
        mem &&
        mem.userId === currentUser.id &&
        mem.role === 'STUDENT' &&
        mem.status === 'ACTIVE'
      );
    });
    if (!isLinked) {
      return errorResponse(
        403,
        'STUDENT_LEARNER_ACCESS_DENIED',
        'Student portal access is strictly restricted to your own verified learner record.'
      );
    }

    const school = state.schools.find((s) => s.id === sId);
    const pack = state.packs.find((p) => p.schoolId === sId && p.id === pId);
    const learner = state.learners.find((l) => l.schoolId === sId && l.id === lId);
    if (!school || !pack || !learner || pack.schoolClassId !== learner.schoolClassId) {
      return errorResponse(404, 'NOT_FOUND', 'Published report card was not found.');
    }
    if (pack.status !== 'PUBLISHED') {
      return errorResponse(
        403,
        'REPORT_CARD_NOT_PUBLISHED',
        'Students can only access report cards after official publication.'
      );
    }
    const reportCard = buildReportCard(state, school, pack, learner);
    if (!reportCard) {
      return errorResponse(404, 'NOT_FOUND', 'Published report card was not found.');
    }
    return jsonResponse(200, { reportCard });
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

  if (subPath.startsWith('admin/')) {
    if (!LEADERSHIP_ROLES.includes(membership.role)) {
      return errorResponse(403, 'INSUFFICIENT_SCHOOL_ROLE', 'Leadership role required.');
    }

    const toAdminRequestDto = (r: SandboxRegistrationRequest): AdminRegistrationRequest => {
      const usr = state.users.find((u) => u.id === r.userId);
      const matched = state.learners.find(
        (l) =>
          l.schoolId === schoolId &&
          l.admissionNumber.toUpperCase() === r.claimedAdmissionNo.toUpperCase()
      );
      const matchedCls = matched
        ? state.classes.find((c) => c.id === matched.schoolClassId) ?? null
        : null;
      return {
        id: r.id,
        userId: r.userId,
        applicantEmail: usr?.email ?? null,
        claimedAdmissionNo: r.claimedAdmissionNo,
        claimedName: r.claimedName,
        claimedClassNote: r.claimedClassNote,
        status: r.status,
        approvedLearnerId: r.approvedLearnerId,
        reviewedByName: resolveMembershipUserName(state, r.reviewedByMembershipId),
        reviewedAt: r.reviewedAt,
        decisionNotes: r.decisionNotes,
        createdAt: r.createdAt,
        suggestedLearner: matched
          ? {
              id: matched.id,
              admissionNumber: matched.admissionNumber,
              firstName: matched.firstName,
              lastName: matched.lastName,
              currentClassName: matchedCls?.name ?? null,
              alreadyLinked: state.studentLinks.some((sl) => sl.learnerId === matched.id)
            }
          : null
      };
    };

    if (method === 'GET' && subPath === 'admin/student-portal') {
      const classes = state.classes
        .filter((c) => c.schoolId === schoolId)
        .map((c) => {
          const yr = state.years.find((y) => y.id === c.academicYearId);
          return {
            id: c.id,
            name: c.name,
            gradeLevel: c.gradeLevel,
            academicYearLabel: yr?.label ?? '2026 Academic Year'
          };
        });

      const learners: AdminRosterLearner[] = state.learners
        .filter((l) => l.schoolId === schoolId)
        .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))
        .map((l) => {
          const cls = state.classes.find((c) => c.id === l.schoolClassId) ?? null;
          const link = state.studentLinks.find(
            (sl) => sl.schoolId === schoolId && sl.learnerId === l.id
          );
          const linkedMem = link
            ? state.memberships.find((m) => m.id === link.membershipId)
            : null;
          const linkedUser = linkedMem
            ? state.users.find((u) => u.id === linkedMem.userId)
            : null;
          const activeCode = state.enrolmentCodes.find(
            (c) =>
              c.schoolId === schoolId &&
              c.learnerId === l.id &&
              c.usedAt === null &&
              c.revokedAt === null &&
              new Date(c.expiresAt).getTime() > Date.now()
          );

          return {
            id: l.id,
            admissionNumber: l.admissionNumber,
            firstName: l.firstName,
            lastName: l.lastName,
            schoolClassId: cls?.id ?? null,
            currentClassName: cls?.name ?? null,
            gradeLevel: cls?.gradeLevel ?? null,
            preferredChannel: l.preferredChannel,
            active: true,
            linkedStudent:
              link && linkedUser
                ? {
                    userId: linkedUser.id,
                    name: linkedUser.name,
                    email: linkedUser.email,
                    verificationMethod: link.verificationMethod,
                    verifiedAt: link.verifiedAt
                  }
                : null,
            activeEnrolmentCode: activeCode
              ? {
                  id: activeCode.id,
                  codeHint: activeCode.codeHint,
                  expiresAt: activeCode.expiresAt,
                  createdAt: activeCode.createdAt
                }
              : null
          };
        });

      const registrationRequests: AdminRegistrationRequest[] = state.registrationRequests
        .filter((r) => r.schoolId === schoolId)
        .map(toAdminRequestDto);

      const announcements: SchoolAnnouncementItem[] = state.announcements
        .filter((a) => a.schoolId === schoolId)
        .map((a) => ({
          id: a.id,
          schoolId,
          title: a.title,
          body: a.body,
          audience: a.audience,
          postedByName:
            resolveMembershipUserName(state, a.postedByMembershipId) ??
            'School Administration',
          publishedAt: a.publishedAt
        }));

      const adminState: SchoolAdminPortalState = {
        school: {
          ...toSchoolSummary(school),
          registrationNumber: school.registrationNumber,
          levelSummary: school.levelSummary,
          studentPortalEnabled: school.studentPortalEnabled
        },
        classes,
        learners,
        registrationRequests,
        announcements
      };
      return jsonResponse(200, adminState);
    }

    if (method === 'POST' && subPath === 'admin/learners') {
      const body = parseJsonBody(init);
      const admissionNumber = String(body.admissionNumber ?? '').trim().toUpperCase();
      const firstName = String(body.firstName ?? '').trim();
      const lastName = String(body.lastName ?? '').trim();
      const schoolClassId =
        typeof body.schoolClassId === 'string' && body.schoolClassId
          ? body.schoolClassId
          : '';
      if (!admissionNumber || !firstName || !lastName) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Learner fields are required.');
      }
      if (
        state.learners.some(
          (l) =>
            l.schoolId === schoolId &&
            l.admissionNumber.toUpperCase() === admissionNumber
        )
      ) {
        return errorResponse(
          409,
          'DUPLICATE_ADMISSION_NUMBER',
          'A learner with this admission number already exists.'
        );
      }
      const cls = schoolClassId
        ? state.classes.find((c) => c.schoolId === schoolId && c.id === schoolClassId)
        : null;
      const newLearner: SandboxLearner = {
        id: `lrn_syn_${state.nextEventCounter++}`,
        schoolId,
        admissionNumber,
        firstName,
        lastName,
        schoolClassId: cls?.id ?? '',
        guardianName: typeof body.guardianName === 'string' ? body.guardianName : '',
        preferredChannel: 'PRINT_REPORT'
      };
      state.learners.push(newLearner);
      appendAudit(state, {
        schoolId,
        action: 'LEARNER_CREATED',
        entityType: 'Learner',
        entityId: newLearner.id,
        actorName: currentUser.name,
        actorRole: membership.role,
        afterState: { admissionNumber, firstName, lastName }
      });
      saveState(state);
      const createdDto: AdminRosterLearner = {
        id: newLearner.id,
        admissionNumber: newLearner.admissionNumber,
        firstName: newLearner.firstName,
        lastName: newLearner.lastName,
        schoolClassId: cls?.id ?? null,
        currentClassName: cls?.name ?? null,
        gradeLevel: cls?.gradeLevel ?? null,
        preferredChannel: newLearner.preferredChannel,
        active: true,
        linkedStudent: null,
        activeEnrolmentCode: null
      };
      return jsonResponse(201, { learner: createdDto });
    }

    const genCodeMatch = subPath.match(/^admin\/learners\/([^/]+)\/enrolment-codes$/);
    if (method === 'POST' && genCodeMatch) {
      const learnerId = decodeURIComponent(genCodeMatch[1]!);
      const learner = state.learners.find(
        (l) => l.schoolId === schoolId && l.id === learnerId
      );
      if (!learner) {
        return errorResponse(404, 'LEARNER_NOT_FOUND', 'Learner not found in this school.');
      }
      if (state.studentLinks.some((sl) => sl.learnerId === learner.id)) {
        return errorResponse(
          409,
          'LEARNER_ALREADY_LINKED',
          'This learner is already linked to a verified student account.'
        );
      }
      const now = new Date().toISOString();
      for (const c of state.enrolmentCodes) {
        if (c.schoolId === schoolId && c.learnerId === learnerId && !c.usedAt && !c.revokedAt) {
          c.revokedAt = now;
        }
      }
      const suffix = String(1000 + state.nextEventCounter++).slice(-4);
      const plainCode = `ORQ-ST${suffix.slice(0, 2)}-${suffix}`;
      const codeHint = `ORQ-••••-${suffix}`;
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const id = `ecd_syn_${state.nextEventCounter++}`;
      state.enrolmentCodes.unshift({
        id,
        schoolId,
        learnerId,
        canonicalCode: plainCode.replace(/-/g, ''),
        codeHint,
        expiresAt,
        usedAt: null,
        revokedAt: null,
        createdAt: now
      });
      saveState(state);
      const enrolmentCode: IssuedEnrolmentCode = {
        id,
        learnerId: learner.id,
        admissionNumber: learner.admissionNumber,
        learnerName: `${learner.firstName} ${learner.lastName}`,
        plainCode,
        codeHint,
        expiresAt
      };
      return jsonResponse(201, { enrolmentCode });
    }

    const revokeCodeMatch = subPath.match(/^admin\/enrolment-codes\/([^/]+)\/revoke$/);
    if (method === 'POST' && revokeCodeMatch) {
      const codeId = decodeURIComponent(revokeCodeMatch[1]!);
      const rec = state.enrolmentCodes.find(
        (c) => c.schoolId === schoolId && c.id === codeId
      );
      if (!rec) {
        return errorResponse(404, 'CODE_NOT_FOUND', 'Enrolment code not found.');
      }
      rec.revokedAt = new Date().toISOString();
      saveState(state);
      return jsonResponse(200, { status: 'revoked' });
    }

    const approveReqMatch = subPath.match(/^admin\/student-requests\/([^/]+)\/approve$/);
    if (method === 'POST' && approveReqMatch) {
      const requestId = decodeURIComponent(approveReqMatch[1]!);
      const body = parseJsonBody(init);
      const learnerId = String(body.learnerId ?? '');
      const reqRecord = state.registrationRequests.find(
        (r) => r.schoolId === schoolId && r.id === requestId
      );
      if (!reqRecord || reqRecord.status !== 'PENDING') {
        return errorResponse(404, 'REQUEST_NOT_PENDING', 'Pending request not found.');
      }
      if (reqRecord.userId === currentUser.id) {
        return errorResponse(403, 'SELF_APPROVAL_FORBIDDEN', 'Cannot approve own request.');
      }
      const learner = state.learners.find(
        (l) => l.schoolId === schoolId && l.id === learnerId
      );
      if (!learner) {
        return errorResponse(404, 'LEARNER_NOT_FOUND', 'Learner not found in this school.');
      }
      if (state.studentLinks.some((sl) => sl.learnerId === learner.id)) {
        return errorResponse(409, 'LEARNER_ALREADY_LINKED', 'Learner already linked.');
      }

      const now = new Date().toISOString();
      let stuMem = state.memberships.find(
        (m) =>
          m.schoolId === schoolId &&
          m.userId === reqRecord.userId &&
          m.role === 'STUDENT'
      );
      if (!stuMem) {
        stuMem = {
          id: `mem_syn_stu_${state.nextEventCounter++}`,
          schoolId,
          userId: reqRecord.userId,
          role: 'STUDENT',
          status: 'ACTIVE',
          staffCode: null
        };
        state.memberships.push(stuMem);
      } else {
        stuMem.status = 'ACTIVE';
      }

      state.studentLinks.push({
        id: `slk_syn_${state.nextEventCounter++}`,
        schoolId,
        membershipId: stuMem.id,
        learnerId: learner.id,
        verificationMethod: 'STAFF_APPROVAL',
        verifiedAt: now
      });

      reqRecord.status = 'APPROVED';
      reqRecord.approvedLearnerId = learner.id;
      reqRecord.reviewedByMembershipId = membership.id;
      reqRecord.reviewedAt = now;
      reqRecord.decisionNotes =
        typeof body.decisionNotes === 'string' ? body.decisionNotes : null;
      saveState(state);

      return jsonResponse(200, { request: toAdminRequestDto(reqRecord) });
    }

    const rejectReqMatch = subPath.match(/^admin\/student-requests\/([^/]+)\/reject$/);
    if (method === 'POST' && rejectReqMatch) {
      const requestId = decodeURIComponent(rejectReqMatch[1]!);
      const body = parseJsonBody(init);
      const reqRecord = state.registrationRequests.find(
        (r) => r.schoolId === schoolId && r.id === requestId
      );
      if (!reqRecord || reqRecord.status !== 'PENDING') {
        return errorResponse(404, 'REQUEST_NOT_PENDING', 'Pending request not found.');
      }
      reqRecord.status = 'REJECTED';
      reqRecord.reviewedByMembershipId = membership.id;
      reqRecord.reviewedAt = new Date().toISOString();
      reqRecord.decisionNotes = String(body.decisionNotes ?? 'Rejected');
      saveState(state);

      return jsonResponse(200, { request: toAdminRequestDto(reqRecord) });
    }

    if (method === 'POST' && subPath === 'admin/announcements') {
      const body = parseJsonBody(init);
      const title = String(body.title ?? '').trim();
      const noticeBody = String(body.body ?? '').trim();
      const audience = (body.audience === 'STAFF_ONLY'
        ? 'STAFF_ONLY'
        : 'STUDENTS_AND_STAFF') as AnnouncementAudience;
      if (title.length < 3 || noticeBody.length < 5) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Notice title and message are required.');
      }
      const publishedAt = new Date().toISOString();
      const id = `ann_syn_${state.nextEventCounter++}`;
      state.announcements.unshift({
        id,
        schoolId,
        title,
        body: noticeBody,
        audience,
        postedByMembershipId: membership.id,
        publishedAt
      });
      saveState(state);
      const createdNotice: SchoolAnnouncementItem = {
        id,
        schoolId,
        title,
        body: noticeBody,
        audience,
        postedByName: currentUser.name,
        publishedAt
      };
      return jsonResponse(201, { announcement: createdNotice });
    }
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
