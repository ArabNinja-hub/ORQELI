export type PlatformRole = 'STANDARD' | 'PLATFORM_ADMIN';
export type UserAccountStatus = 'ACTIVE' | 'DISABLED' | 'SUSPENDED';
export type SchoolSector = 'GOVERNMENT' | 'PRIVATE' | 'COMMUNITY';
export type SchoolStatus = 'PILOT_PREP' | 'ACTIVE' | 'SUSPENDED';
export type SchoolRole =
  | 'SCHOOL_ADMIN'
  | 'HEAD_TEACHER'
  | 'DEPUTY_HEAD'
  | 'TEACHER'
  | 'PARENT_GUARDIAN'
  | 'STUDENT';
export type MembershipStatus = 'ACTIVE' | 'INACTIVE';
export type TermNumber = 'TERM_1' | 'TERM_2' | 'TERM_3';
export type ResultPackStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'PUBLISHED';
export type MarkEntryStatus = 'PENDING' | 'PRESENT' | 'ABSENT' | 'EXEMPT';
export type CommunicationChannel = 'PRINT_REPORT' | 'SMS_SUMMARY' | 'GUARDIAN_PORTAL';
export type StudentVerificationMethod = 'ENROLMENT_CODE' | 'STAFF_APPROVAL';
export type StudentRegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type AnnouncementAudience = 'STUDENTS_AND_STAFF' | 'STAFF_ONLY';

export interface SchoolSummary {
  id: string;
  code: string;
  name: string;
  sector: SchoolSector;
  province: string;
  district: string;
  isSyntheticDemo: boolean;
  status: SchoolStatus;
}

export interface PublicSchoolProfile {
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
  status: SchoolStatus;
  isSyntheticDemo: boolean;
  studentPortalEnabled: boolean;
  canSelfRegister: boolean;
  currentAcademicYearLabel: string | null;
}

export interface MembershipSummary {
  id: string;
  schoolId: string;
  role: SchoolRole;
  status: MembershipStatus;
  staffCode: string | null;
  school: SchoolSummary;
}

export interface AuthenticatedUserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  platformRole: PlatformRole;
  status: UserAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  stage: string;
  sandboxMode: boolean;
}

export interface SandboxPersona {
  label: string;
  name: string;
  email: string;
  role: string;
  schoolName: string;
  schoolCode: string;
  purpose: string;
}

export interface SandboxPersonasResponse {
  syntheticOnly: boolean;
  credentialHint: string;
  demoEnrolmentWalkthrough?: {
    schoolCode: string;
    admissionNumber: string;
    enrolmentCode: string;
  };
  personas: SandboxPersona[];
}

export interface ResultPackSummary {
  id: string;
  schoolClassId: string;
  className: string;
  gradeLevel: number;
  academicTermId: string;
  termLabel: string;
  termNumber: TermNumber;
  academicYearLabel: string;
  status: ResultPackStatus;
  reviewNotes: string | null;
  learnerCount: number;
  subjectCount: number;
  expectedEntries: number;
  recordedEntries: number;
  missingCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  canOpen: boolean;
}

export interface TeacherAllocation {
  allocationId: string;
  schoolClassId: string;
  className: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
}

export interface SchoolOverview {
  school: SchoolSummary & {
    phone: string | null;
    email: string | null;
    timezone: string;
  };
  viewerRoles: SchoolRole[];
  currentAcademicYear: { id: string; year: number; label: string } | null;
  currentTerm: { id: string; termNumber: TermNumber; label: string } | null;
  mySubjectAllocations: TeacherAllocation[];
  resultPacks: ResultPackSummary[];
}

export interface PackSubjectColumn {
  subjectId: string;
  code: string;
  name: string;
  isCore: boolean;
  maxMark: number;
  teacherMembershipId: string;
  teacherName: string;
  canEdit: boolean;
}

export interface PackLearnerRow {
  learnerId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  preferredChannel: CommunicationChannel;
}

export interface PackMarkCell {
  learnerId: string;
  subjectId: string;
  status: MarkEntryStatus;
  score: number | null;
  teacherComment: string | null;
  enteredByName: string | null;
  enteredAt: string | null;
}

export interface MissingMarkItem {
  learnerId: string;
  admissionNumber: string;
  learnerName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
}

export interface ResultPackDetail {
  id: string;
  school: SchoolSummary;
  academicYear: { id: string; year: number; label: string };
  academicTerm: { id: string; termNumber: TermNumber; label: string };
  schoolClass: {
    id: string;
    name: string;
    gradeLevel: number;
    classTeacherName: string | null;
  };
  status: ResultPackStatus;
  reviewNotes: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  publishedAt: string | null;
  publishedByName: string | null;
  subjects: PackSubjectColumn[];
  learners: PackLearnerRow[];
  marks: PackMarkCell[];
  completeness: {
    expectedEntries: number;
    recordedEntries: number;
    missingCount: number;
    readyForSubmission: boolean;
    missingItems: MissingMarkItem[];
  };
  permissions: {
    canEditAllocatedMarks: boolean;
    canSubmit: boolean;
    canRequestRevision: boolean;
    canApprove: boolean;
    canPublish: boolean;
    canViewReportCards: boolean;
  };
}

export interface ReportCardSubjectLine {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  status: Exclude<MarkEntryStatus, 'PENDING'>;
  score: number | null;
  maxMark: number;
  percentage: number | null;
  grade: string;
  teacherComment: string | null;
  teacherName: string;
}

export interface ReportCard {
  school: SchoolSummary & {
    phone: string | null;
    timezone: string;
  };
  publicationState: 'APPROVED_PREVIEW' | 'PUBLISHED';
  academicYearLabel: string;
  academicTermLabel: string;
  termNumber: TermNumber;
  className: string;
  gradeLevel: number;
  classTeacherName: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  learner: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    guardianName: string | null;
    preferredChannel: CommunicationChannel;
  };
  subjects: ReportCardSubjectLine[];
  summary: {
    gradedSubjectsCount: number;
    totalScore: number;
    totalPossible: number;
    averagePercentage: number | null;
  };
}

export interface GuardianLearnerResults {
  learner: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    currentClassName: string | null;
    relationship: string;
    preferredChannel: CommunicationChannel;
  };
  publishedReports: Array<{
    packId: string;
    reportCard: ReportCard;
  }>;
}

export interface GuardianResultsOverview {
  school: SchoolSummary;
  learners: GuardianLearnerResults[];
}

export interface AuditEventItem {
  id: string;
  schoolId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  actorRole: SchoolRole | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface StudentRegistrationPayload {
  schoolId: string;
  fullName: string;
  admissionNumber: string;
  email: string;
  password: string;
  verificationMode: StudentVerificationMethod;
  enrolmentCode?: string | null;
  classHint?: string | null;
}

export interface StudentRegistrationResponse {
  outcome: 'VERIFIED' | 'PENDING_APPROVAL';
  schoolCode: string;
  requestId: string | null;
  message: string;
  user: AuthenticatedUserProfile;
  memberships: MembershipSummary[];
  csrfToken: string;
  sandboxSessionToken?: string;
}

export interface SchoolAnnouncementItem {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  postedByName: string;
  publishedAt: string;
}

export interface IssuedEnrolmentCode {
  id: string;
  learnerId: string;
  admissionNumber: string;
  learnerName: string;
  plainCode: string;
  codeHint: string;
  expiresAt: string;
}

export interface AdminRosterLearner {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  schoolClassId: string | null;
  currentClassName: string | null;
  gradeLevel: number | null;
  preferredChannel: CommunicationChannel;
  active: boolean;
  linkedStudent: {
    userId: string;
    name: string;
    email: string | null;
    verificationMethod: StudentVerificationMethod;
    verifiedAt: string;
  } | null;
  activeEnrolmentCode: {
    id: string;
    codeHint: string;
    expiresAt: string;
    createdAt: string;
  } | null;
}

export interface AdminRegistrationRequest {
  id: string;
  userId: string;
  applicantEmail: string | null;
  claimedName: string;
  claimedAdmissionNo: string;
  claimedClassNote: string | null;
  status: StudentRegistrationStatus;
  decisionNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  approvedLearnerId: string | null;
  suggestedLearner: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    currentClassName: string | null;
    alreadyLinked: boolean;
  } | null;
}

export interface SchoolAdminPortalState {
  school: SchoolSummary & {
    registrationNumber: string | null;
    levelSummary: string | null;
    studentPortalEnabled: boolean;
  };
  classes: Array<{
    id: string;
    name: string;
    gradeLevel: number;
    academicYearLabel: string;
  }>;
  learners: AdminRosterLearner[];
  registrationRequests: AdminRegistrationRequest[];
  announcements: SchoolAnnouncementItem[];
}

export interface StudentTermResultStatus {
  packId: string;
  academicYearLabel: string;
  academicTermLabel: string;
  termNumber: TermNumber;
  className: string;
  gradeLevel: number;
  publicationState: 'PUBLISHED' | 'UNPUBLISHED';
  statusMessage: string;
  publishedAt: string | null;
  reportCard: ReportCard | null;
}

export interface StudentPortalAccount {
  membershipId: string;
  school: SchoolSummary & {
    registrationNumber: string | null;
    levelSummary: string | null;
    phone: string | null;
    email: string | null;
  };
  verificationState: 'VERIFIED' | 'PENDING_APPROVAL' | 'REJECTED';
  learner: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    currentClassName: string | null;
    gradeLevel: number | null;
    currentAcademicYearLabel: string | null;
    currentTermLabel: string | null;
    verificationMethod: StudentVerificationMethod;
    verifiedAt: string;
  } | null;
  pendingRequest: {
    id: string;
    claimedAdmissionNo: string;
    claimedClassNote: string | null;
    status: StudentRegistrationStatus;
    decisionNotes: string | null;
    createdAt: string;
    reviewedAt: string | null;
  } | null;
  termResults: StudentTermResultStatus[];
  announcements: SchoolAnnouncementItem[];
}

export interface StudentPortalOverview {
  studentUser: {
    id: string;
    name: string;
    email: string | null;
  };
  accounts: StudentPortalAccount[];
}
