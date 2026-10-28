import crypto from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  APPROVAL_ROLES,
  LEADERSHIP_ROLES,
  schoolScope,
  type MembershipStatus,
  type PlatformRole,
  type SafeMembershipSummary,
  type SafeSchoolSummary,
  type SafeUserProfile,
  type SchoolAccessContext,
  type SchoolRole,
  type SchoolSector,
  type SchoolStatus,
  type UserAccountStatus
} from './authz.js';
import { normalizeAdmissionNumber, normalizeEmail } from './schemas.js';
import {
  computeSubjectGrade,
  formatEnrolmentCodeHint,
  generatePlainEnrolmentCode,
  hashEnrolmentCode
} from './enrolmentCrypto.js';

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

export interface StoredUserWithMemberships {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  passwordHash: string | null;
  platformRole: PlatformRole;
  status: UserAccountStatus;
  createdAt: Date;
  updatedAt: Date;
  memberships: Array<{
    id: string;
    schoolId: string;
    role: SchoolRole;
    status: MembershipStatus;
    staffCode: string | null;
    school: SafeSchoolSummary;
  }>;
}

export interface MissingMarkItem {
  learnerId: string;
  admissionNumber: string;
  learnerName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
}

export interface CompletenessSummary {
  expectedEntries: number;
  recordedEntries: number;
  missingCount: number;
  readyForSubmission: boolean;
  missingItems: MissingMarkItem[];
}

export interface ResultPackSummaryDto {
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

export interface TeacherAllocationDto {
  allocationId: string;
  schoolClassId: string;
  className: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
}

export interface SchoolOverviewDto {
  school: SafeSchoolSummary & {
    phone: string | null;
    email: string | null;
    timezone: string;
  };
  viewerRoles: SchoolRole[];
  currentAcademicYear: {
    id: string;
    year: number;
    label: string;
  } | null;
  currentTerm: {
    id: string;
    termNumber: TermNumber;
    label: string;
  } | null;
  mySubjectAllocations: TeacherAllocationDto[];
  resultPacks: ResultPackSummaryDto[];
}

export interface PackSubjectColumnDto {
  subjectId: string;
  code: string;
  name: string;
  isCore: boolean;
  maxMark: number;
  teacherMembershipId: string;
  teacherName: string;
  canEdit: boolean;
}

export interface PackLearnerRowDto {
  learnerId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  preferredChannel: CommunicationChannel;
}

export interface PackMarkCellDto {
  learnerId: string;
  subjectId: string;
  status: MarkEntryStatus;
  score: number | null;
  teacherComment: string | null;
  enteredByName: string | null;
  enteredAt: string | null;
}

export interface ResultPackDetailDto {
  id: string;
  school: SafeSchoolSummary;
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
  subjects: PackSubjectColumnDto[];
  learners: PackLearnerRowDto[];
  marks: PackMarkCellDto[];
  completeness: CompletenessSummary;
  permissions: {
    canEditAllocatedMarks: boolean;
    canSubmit: boolean;
    canRequestRevision: boolean;
    canApprove: boolean;
    canPublish: boolean;
    canViewReportCards: boolean;
  };
}

export interface ReportCardSubjectLineDto {
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

export interface ReportCardDto {
  school: SafeSchoolSummary & {
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
  subjects: ReportCardSubjectLineDto[];
  summary: {
    gradedSubjectsCount: number;
    totalScore: number;
    totalPossible: number;
    averagePercentage: number | null;
  };
}

export interface GuardianLearnerResultsDto {
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
    reportCard: ReportCardDto;
  }>;
}

export interface GuardianResultsOverviewDto {
  school: SafeSchoolSummary;
  learners: GuardianLearnerResultsDto[];
}

export interface AuditEventDto {
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

export interface MarkEntryWriteInput {
  learnerId: string;
  subjectId: string;
  status: MarkEntryStatus;
  score: number | null;
  teacherComment: string | null;
}

export interface PublicSchoolSearchFilters {
  q?: string;
  province?: string;
  sector?: SchoolSector;
  portalOnly?: boolean;
}

export interface PublicSchoolProfileDto {
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

export interface RegisterStudentAccountInput {
  schoolId: string;
  fullName: string;
  admissionNumber: string;
  email: string;
  passwordHash: string;
  verificationMode: StudentVerificationMethod;
  enrolmentCode: string | null;
  classHint: string | null;
}

export interface RegisterStudentAccountResult {
  outcome: 'VERIFIED' | 'PENDING_APPROVAL';
  user: StoredUserWithMemberships;
  schoolCode: string;
  requestId: string | null;
  message: string;
}

export interface SchoolAnnouncementDto {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  postedByName: string;
  publishedAt: string;
}

export interface IssuedEnrolmentCodeDto {
  id: string;
  learnerId: string;
  admissionNumber: string;
  learnerName: string;
  plainCode: string;
  codeHint: string;
  expiresAt: string;
}

export interface AdminRosterLearnerDto {
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

export interface AdminRegistrationRequestDto {
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

export interface SchoolAdminPortalStateDto {
  school: SafeSchoolSummary & {
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
  learners: AdminRosterLearnerDto[];
  registrationRequests: AdminRegistrationRequestDto[];
  announcements: SchoolAnnouncementDto[];
}

export interface StudentTermResultStatusDto {
  packId: string;
  academicYearLabel: string;
  academicTermLabel: string;
  termNumber: TermNumber;
  className: string;
  gradeLevel: number;
  publicationState: 'PUBLISHED' | 'UNPUBLISHED';
  statusMessage: string;
  publishedAt: string | null;
  reportCard: ReportCardDto | null;
}

export interface StudentPortalAccountDto {
  membershipId: string;
  school: SafeSchoolSummary & {
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
  termResults: StudentTermResultStatusDto[];
  announcements: SchoolAnnouncementDto[];
}

export interface StudentPortalOverviewDto {
  studentUser: {
    id: string;
    name: string;
    email: string | null;
  };
  accounts: StudentPortalAccountDto[];
}

export class DomainRuleError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainRuleError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function toSafeUser(record: StoredUserWithMemberships): SafeUserProfile {
  return {
    id: record.id,
    email: record.email,
    phone: record.phone,
    name: record.name,
    platformRole: record.platformRole,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function toSafeMemberships(
  record: StoredUserWithMemberships
): SafeMembershipSummary[] {
  return record.memberships.map((m) => ({
    id: m.id,
    schoolId: m.schoolId,
    role: m.role,
    status: m.status,
    staffCode: m.staffCode,
    school: { ...m.school }
  }));
}

export function computeCompleteness(
  learners: PackLearnerRowDto[],
  subjects: Array<{ subjectId: string; code: string; name: string }>,
  marks: Map<string, { status: MarkEntryStatus }>
): CompletenessSummary {
  const missingItems: MissingMarkItem[] = [];
  let recordedEntries = 0;
  const expectedEntries = learners.length * subjects.length;

  for (const learner of learners) {
    for (const subject of subjects) {
      const key = `${learner.learnerId}:${subject.subjectId}`;
      const mark = marks.get(key);
      if (!mark || mark.status === 'PENDING') {
        missingItems.push({
          learnerId: learner.learnerId,
          admissionNumber: learner.admissionNumber,
          learnerName: `${learner.firstName} ${learner.lastName}`,
          subjectId: subject.subjectId,
          subjectCode: subject.code,
          subjectName: subject.name
        });
      } else {
        recordedEntries += 1;
      }
    }
  }

  return {
    expectedEntries,
    recordedEntries,
    missingCount: missingItems.length,
    readyForSubmission: expectedEntries > 0 && missingItems.length === 0,
    missingItems
  };
}

function computeReportSummary(subjects: ReportCardSubjectLineDto[]) {
  let gradedSubjectsCount = 0;
  let totalScore = 0;
  let totalPossible = 0;

  for (const line of subjects) {
    if (line.status === 'PRESENT' && line.score !== null) {
      gradedSubjectsCount += 1;
      totalScore += line.score;
      totalPossible += line.maxMark;
    }
  }

  const averagePercentage =
    totalPossible > 0 ? Math.round((totalScore / totalPossible) * 1000) / 10 : null;

  return {
    gradedSubjectsCount,
    totalScore,
    totalPossible,
    averagePercentage
  };
}

function hasAnyRole(userRoles: readonly SchoolRole[], allowed: readonly SchoolRole[]): boolean {
  return userRoles.some((role) => allowed.includes(role));
}

export interface EducationRepository {
  findUserByEmail(email: string): Promise<StoredUserWithMemberships | null>;
  findUserById(id: string): Promise<StoredUserWithMemberships | null>;
  recordPlatformAuditEvent(input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  getSchoolOverview(access: SchoolAccessContext): Promise<SchoolOverviewDto | null>;
  getResultPackDetail(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto | null>;
  recordSubjectMarks(
    access: SchoolAccessContext,
    packId: string,
    entries: MarkEntryWriteInput[]
  ): Promise<ResultPackDetailDto>;
  submitResultPack(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto>;
  requestResultPackRevision(
    access: SchoolAccessContext,
    packId: string,
    reviewNotes: string
  ): Promise<ResultPackDetailDto>;
  approveResultPack(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto>;
  publishResultPack(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto>;
  getReportCardForStaff(
    access: SchoolAccessContext,
    packId: string,
    learnerId: string
  ): Promise<ReportCardDto | null>;
  getGuardianPublishedResults(
    access: SchoolAccessContext
  ): Promise<GuardianResultsOverviewDto | null>;
  listSchoolAuditEvents(access: SchoolAccessContext): Promise<AuditEventDto[]>;
  listPublicSchools(filters: PublicSchoolSearchFilters): Promise<PublicSchoolProfileDto[]>;
  getPublicSchoolProfile(codeOrId: string): Promise<PublicSchoolProfileDto | null>;
  registerStudentAccount(
    input: RegisterStudentAccountInput
  ): Promise<RegisterStudentAccountResult>;
  getSchoolAdminPortalState(
    access: SchoolAccessContext
  ): Promise<SchoolAdminPortalStateDto | null>;
  createSchoolLearner(
    access: SchoolAccessContext,
    input: {
      admissionNumber: string;
      firstName: string;
      lastName: string;
      schoolClassId: string;
      preferredChannel: CommunicationChannel;
    }
  ): Promise<AdminRosterLearnerDto>;
  issueLearnerEnrolmentCode(
    access: SchoolAccessContext,
    learnerId: string,
    expiresInDays: number
  ): Promise<IssuedEnrolmentCodeDto>;
  revokeLearnerEnrolmentCode(
    access: SchoolAccessContext,
    codeId: string
  ): Promise<void>;
  approveStudentRegistrationRequest(
    access: SchoolAccessContext,
    requestId: string,
    input: { learnerId: string; decisionNotes: string | null }
  ): Promise<AdminRegistrationRequestDto>;
  rejectStudentRegistrationRequest(
    access: SchoolAccessContext,
    requestId: string,
    input: { decisionNotes: string }
  ): Promise<AdminRegistrationRequestDto>;
  createSchoolAnnouncement(
    access: SchoolAccessContext,
    input: { title: string; body: string; audience: AnnouncementAudience }
  ): Promise<SchoolAnnouncementDto>;
  getStudentPortalOverview(userId: string): Promise<StudentPortalOverviewDto>;
  getReportCardForStudent(
    access: SchoolAccessContext,
    packId: string,
    learnerId: string
  ): Promise<ReportCardDto | null>;
}

// ============================================================================
// Prisma Implementation (Production & Local PostgreSQL)
// ============================================================================

const userWithMembershipsInclude = {
  memberships: {
    orderBy: { createdAt: 'asc' },
    include: {
      school: {
        select: {
          id: true,
          code: true,
          name: true,
          sector: true,
          province: true,
          district: true,
          isSyntheticDemo: true,
          status: true
        }
      }
    }
  }
} satisfies Prisma.UserInclude;

export class PrismaEducationRepository implements EducationRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findUserByEmail(email: string): Promise<StoredUserWithMemberships | null> {
    const normalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: userWithMembershipsInclude
    });
    return user as StoredUserWithMemberships | null;
  }

  async findUserById(id: string): Promise<StoredUserWithMemberships | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userWithMembershipsInclude
    });
    return user as StoredUserWithMemberships | null;
  }

  async recordPlatformAuditEvent(input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  }

  async getSchoolOverview(access: SchoolAccessContext): Promise<SchoolOverviewDto | null> {
    const scope = schoolScope(access);
    const school = await this.prisma.school.findUnique({
      where: { id: scope.schoolId }
    });
    if (!school || school.status === 'SUSPENDED') {
      return null;
    }

    const [currentYear, currentTerm, teacherMemberships, packs] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { schoolId: scope.schoolId, isCurrent: true },
        orderBy: { year: 'desc' }
      }),
      this.prisma.academicTerm.findFirst({
        where: { schoolId: scope.schoolId, isCurrent: true },
        orderBy: { startsOn: 'desc' }
      }),
      this.prisma.schoolMembership.findMany({
        where: {
          schoolId: scope.schoolId,
          userId: access.actorUserId,
          status: 'ACTIVE'
        }
      }),
      this.prisma.termResultPack.findMany({
        where: { schoolId: scope.schoolId },
        include: {
          academicTerm: { include: { academicYear: true } },
          schoolClass: {
            include: {
              learners: { where: { active: true }, select: { id: true } },
              allocations: {
                where: { subject: { active: true } },
                select: { subjectId: true, teacherMembershipId: true }
              }
            }
          },
          marks: {
            select: { learnerId: true, subjectId: true, status: true }
          }
        },
        orderBy: [
          { academicTerm: { startsOn: 'desc' } },
          { schoolClass: { gradeLevel: 'desc' } },
          { schoolClass: { name: 'asc' } }
        ]
      })
    ]);

    const teacherMembershipIds = new Set(teacherMemberships.map((m) => m.id));
    const allocations = await this.prisma.classSubjectAllocation.findMany({
      where: {
        schoolId: scope.schoolId,
        teacherMembershipId: { in: [...teacherMembershipIds] },
        subject: { active: true }
      },
      include: {
        schoolClass: { select: { id: true, name: true } },
        subject: { select: { id: true, code: true, name: true } }
      },
      orderBy: [{ schoolClass: { name: 'asc' } }, { subject: { name: 'asc' } }]
    });

    const isLeadership = hasAnyRole(access.roles, LEADERSHIP_ROLES);

    const resultPacks: ResultPackSummaryDto[] = packs.map((pack) => {
      const activeLearnerIds = new Set(pack.schoolClass.learners.map((l) => l.id));
      const activeSubjectIds = new Set(pack.schoolClass.allocations.map((a) => a.subjectId));
      const expectedEntries = activeLearnerIds.size * activeSubjectIds.size;
      let recordedEntries = 0;
      for (const mark of pack.marks) {
        if (
          activeLearnerIds.has(mark.learnerId) &&
          activeSubjectIds.has(mark.subjectId) &&
          mark.status !== 'PENDING'
        ) {
          recordedEntries += 1;
        }
      }
      const missingCount = Math.max(0, expectedEntries - recordedEntries);
      const isClassOrSubjectTeacher =
        (pack.schoolClass.classTeacherMembershipId !== null &&
          teacherMembershipIds.has(pack.schoolClass.classTeacherMembershipId)) ||
        pack.schoolClass.allocations.some((a) => teacherMembershipIds.has(a.teacherMembershipId));

      return {
        id: pack.id,
        schoolClassId: pack.schoolClassId,
        className: pack.schoolClass.name,
        gradeLevel: pack.schoolClass.gradeLevel,
        academicTermId: pack.academicTermId,
        termLabel: pack.academicTerm.label,
        termNumber: pack.academicTerm.termNumber,
        academicYearLabel: pack.academicTerm.academicYear.label,
        status: pack.status,
        reviewNotes: pack.reviewNotes,
        learnerCount: activeLearnerIds.size,
        subjectCount: activeSubjectIds.size,
        expectedEntries,
        recordedEntries,
        missingCount,
        submittedAt: pack.submittedAt ? pack.submittedAt.toISOString() : null,
        approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
        publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
        canOpen: isLeadership || isClassOrSubjectTeacher
      };
    });

    return {
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status,
        phone: school.phone,
        email: school.email,
        timezone: school.timezone
      },
      viewerRoles: access.roles,
      currentAcademicYear: currentYear
        ? { id: currentYear.id, year: currentYear.year, label: currentYear.label }
        : null,
      currentTerm: currentTerm
        ? {
            id: currentTerm.id,
            termNumber: currentTerm.termNumber,
            label: currentTerm.label
          }
        : null,
      mySubjectAllocations: allocations.map((a) => ({
        allocationId: a.id,
        schoolClassId: a.schoolClass.id,
        className: a.schoolClass.name,
        subjectId: a.subject.id,
        subjectCode: a.subject.code,
        subjectName: a.subject.name
      })),
      resultPacks
    };
  }

  private async loadPackForAccess(access: SchoolAccessContext, packId: string) {
    const scope = schoolScope(access);
    const [pack, viewerMemberships] = await Promise.all([
      this.prisma.termResultPack.findFirst({
        where: { id: packId, schoolId: scope.schoolId },
        include: {
          school: true,
          academicTerm: { include: { academicYear: true } },
          schoolClass: {
            include: {
              classTeacher: { include: { user: { select: { name: true } } } },
              learners: {
                where: { active: true },
                orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { admissionNumber: 'asc' }]
              },
              allocations: {
                where: { subject: { active: true } },
                include: {
                  subject: true,
                  teacherMembership: { include: { user: { select: { name: true } } } }
                },
                orderBy: [{ subject: { isCore: 'desc' } }, { subject: { name: 'asc' } }]
              }
            }
          },
          submittedBy: { include: { user: { select: { name: true } } } },
          reviewedBy: { include: { user: { select: { name: true } } } },
          approvedBy: { include: { user: { select: { name: true } } } },
          publishedBy: { include: { user: { select: { name: true } } } },
          marks: {
            include: {
              enteredBy: { include: { user: { select: { name: true } } } }
            }
          }
        }
      }),
      this.prisma.schoolMembership.findMany({
        where: {
          schoolId: scope.schoolId,
          userId: access.actorUserId,
          status: 'ACTIVE'
        }
      })
    ]);

    return { pack, viewerMemberships };
  }

  async getResultPackDetail(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto | null> {
    const { pack, viewerMemberships } = await this.loadPackForAccess(access, packId);
    if (!pack || pack.school.status === 'SUSPENDED') {
      return null;
    }

    const viewerMembershipIds = new Set(viewerMemberships.map((m) => m.id));
    const isLeadership = hasAnyRole(access.roles, LEADERSHIP_ROLES);
    const isApprovalAuthority = hasAnyRole(access.roles, APPROVAL_ROLES);
    const isClassTeacher =
      pack.schoolClass.classTeacherMembershipId !== null &&
      viewerMembershipIds.has(pack.schoolClass.classTeacherMembershipId);
    const hasSubjectAllocation = pack.schoolClass.allocations.some((a) =>
      viewerMembershipIds.has(a.teacherMembershipId)
    );

    if (!isLeadership && !isClassTeacher && !hasSubjectAllocation) {
      throw new DomainRuleError(
        403,
        'CLASS_ACCESS_DENIED',
        'Teachers may only open result packs for classes to which they are allocated.'
      );
    }

    const packEditableState = pack.status === 'DRAFT' || pack.status === 'NEEDS_REVISION';

    const subjects: PackSubjectColumnDto[] = pack.schoolClass.allocations.map((allocation) => ({
      subjectId: allocation.subject.id,
      code: allocation.subject.code,
      name: allocation.subject.name,
      isCore: allocation.subject.isCore,
      maxMark: allocation.subject.maxMark,
      teacherMembershipId: allocation.teacherMembershipId,
      teacherName: allocation.teacherMembership.user.name,
      canEdit: packEditableState && viewerMembershipIds.has(allocation.teacherMembershipId)
    }));

    const learners: PackLearnerRowDto[] = pack.schoolClass.learners.map((learner) => ({
      learnerId: learner.id,
      admissionNumber: learner.admissionNumber,
      firstName: learner.firstName,
      lastName: learner.lastName,
      preferredChannel: learner.preferredChannel
    }));

    const markLookup = new Map<string, (typeof pack.marks)[number]>();
    for (const mark of pack.marks) {
      markLookup.set(`${mark.learnerId}:${mark.subjectId}`, mark);
    }

    const marks: PackMarkCellDto[] = [];
    for (const learner of learners) {
      for (const subject of subjects) {
        const stored = markLookup.get(`${learner.learnerId}:${subject.subjectId}`);
        marks.push({
          learnerId: learner.learnerId,
          subjectId: subject.subjectId,
          status: stored?.status ?? 'PENDING',
          score: stored?.score ?? null,
          teacherComment: stored?.teacherComment ?? null,
          enteredByName: stored?.enteredBy?.user.name ?? null,
          enteredAt: stored?.enteredAt ? stored.enteredAt.toISOString() : null
        });
      }
    }

    const completeness = computeCompleteness(
      learners,
      subjects.map((s) => ({ subjectId: s.subjectId, code: s.code, name: s.name })),
      markLookup
    );

    return {
      id: pack.id,
      school: {
        id: pack.school.id,
        code: pack.school.code,
        name: pack.school.name,
        sector: pack.school.sector,
        province: pack.school.province,
        district: pack.school.district,
        isSyntheticDemo: pack.school.isSyntheticDemo,
        status: pack.school.status
      },
      academicYear: {
        id: pack.academicTerm.academicYear.id,
        year: pack.academicTerm.academicYear.year,
        label: pack.academicTerm.academicYear.label
      },
      academicTerm: {
        id: pack.academicTerm.id,
        termNumber: pack.academicTerm.termNumber,
        label: pack.academicTerm.label
      },
      schoolClass: {
        id: pack.schoolClass.id,
        name: pack.schoolClass.name,
        gradeLevel: pack.schoolClass.gradeLevel,
        classTeacherName: pack.schoolClass.classTeacher?.user.name ?? null
      },
      status: pack.status,
      reviewNotes: pack.reviewNotes,
      submittedAt: pack.submittedAt ? pack.submittedAt.toISOString() : null,
      submittedByName: pack.submittedBy?.user.name ?? null,
      reviewedAt: pack.reviewedAt ? pack.reviewedAt.toISOString() : null,
      reviewedByName: pack.reviewedBy?.user.name ?? null,
      approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
      approvedByName: pack.approvedBy?.user.name ?? null,
      publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
      publishedByName: pack.publishedBy?.user.name ?? null,
      subjects,
      learners,
      marks,
      completeness,
      permissions: {
        canEditAllocatedMarks: subjects.some((s) => s.canEdit),
        canSubmit:
          packEditableState &&
          completeness.readyForSubmission &&
          (isLeadership || isClassTeacher || hasSubjectAllocation),
        canRequestRevision:
          isLeadership && (pack.status === 'SUBMITTED' || pack.status === 'APPROVED'),
        canApprove:
          isApprovalAuthority &&
          pack.status === 'SUBMITTED' &&
          completeness.readyForSubmission,
        canPublish:
          isApprovalAuthority &&
          pack.status === 'APPROVED' &&
          completeness.readyForSubmission,
        canViewReportCards: pack.status === 'APPROVED' || pack.status === 'PUBLISHED'
      }
    };
  }

  async recordSubjectMarks(
    access: SchoolAccessContext,
    packId: string,
    entries: MarkEntryWriteInput[]
  ): Promise<ResultPackDetailDto> {
    const scope = schoolScope(access);
    const { pack, viewerMemberships } = await this.loadPackForAccess(access, packId);
    if (!pack || pack.school.status === 'SUSPENDED') {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }

    if (pack.status !== 'DRAFT' && pack.status !== 'NEEDS_REVISION') {
      throw new DomainRuleError(
        409,
        'RESULT_PACK_LOCKED',
        `Marks cannot be modified while the result pack is ${pack.status}. Return the pack for revision first.`
      );
    }

    const teacherMemberships = viewerMemberships.filter((m) => m.role === 'TEACHER');
    const teacherMembershipIds = new Set(teacherMemberships.map((m) => m.id));
    const allocationBySubject = new Map(
      pack.schoolClass.allocations.map((a) => [a.subjectId, a])
    );
    const validLearnerIds = new Set(pack.schoolClass.learners.map((l) => l.id));
    const existingMarkMap = new Map(
      pack.marks.map((m) => [`${m.learnerId}:${m.subjectId}`, m])
    );

    for (const entry of entries) {
      if (!validLearnerIds.has(entry.learnerId)) {
        throw new DomainRuleError(
          400,
          'INVALID_LEARNER_FOR_CLASS',
          'One or more learners do not belong to this active class.'
        );
      }
      const allocation = allocationBySubject.get(entry.subjectId);
      if (!allocation) {
        throw new DomainRuleError(
          400,
          'INVALID_SUBJECT_FOR_CLASS',
          'Subject is not allocated to this class.'
        );
      }
      if (!teacherMembershipIds.has(allocation.teacherMembershipId)) {
        throw new DomainRuleError(
          403,
          'SUBJECT_ALLOCATION_REQUIRED',
          `Only the allocated subject teacher may enter or modify ${allocation.subject.name} marks.`
        );
      }
      if (entry.status === 'PRESENT' && entry.score !== null && entry.score > allocation.subject.maxMark) {
        throw new DomainRuleError(
          400,
          'SCORE_OUT_OF_RANGE',
          `Score for ${allocation.subject.name} cannot exceed ${allocation.subject.maxMark}.`
        );
      }
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const allocation = allocationBySubject.get(entry.subjectId)!;
        const previous = existingMarkMap.get(`${entry.learnerId}:${entry.subjectId}`);
        const enteredAt = entry.status === 'PENDING' ? null : now;
        const enteredByMembershipId =
          entry.status === 'PENDING' ? null : allocation.teacherMembershipId;

        const saved = await tx.subjectMark.upsert({
          where: {
            termResultPackId_learnerId_subjectId: {
              termResultPackId: pack.id,
              learnerId: entry.learnerId,
              subjectId: entry.subjectId
            }
          },
          create: {
            schoolId: scope.schoolId,
            termResultPackId: pack.id,
            learnerId: entry.learnerId,
            subjectId: entry.subjectId,
            status: entry.status,
            score: entry.score,
            teacherComment: entry.teacherComment,
            enteredByMembershipId,
            enteredAt
          },
          update: {
            status: entry.status,
            score: entry.score,
            teacherComment: entry.teacherComment,
            enteredByMembershipId,
            enteredAt
          }
        });

        await tx.auditEvent.create({
          data: {
            schoolId: scope.schoolId,
            actorUserId: access.actorUserId,
            actorMembershipId: allocation.teacherMembershipId,
            action: previous ? 'MARK_UPDATED' : 'MARK_RECORDED',
            entityType: 'SubjectMark',
            entityId: saved.id,
            beforeState: previous
              ? {
                  status: previous.status,
                  score: previous.score,
                  teacherComment: previous.teacherComment
                }
              : Prisma.JsonNull,
            afterState: {
              status: entry.status,
              score: entry.score,
              teacherComment: entry.teacherComment
            },
            metadata: {
              termResultPackId: pack.id,
              learnerId: entry.learnerId,
              subjectCode: allocation.subject.code
            }
          }
        });
      }
    });

    const refreshed = await this.getResultPackDetail(access, packId);
    if (!refreshed) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found.');
    }
    return refreshed;
  }

  async submitResultPack(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto> {
    const scope = schoolScope(access);
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }
    if (detail.status !== 'DRAFT' && detail.status !== 'NEEDS_REVISION') {
      throw new DomainRuleError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot submit a result pack whose status is ${detail.status}.`
      );
    }
    if (!detail.completeness.readyForSubmission) {
      throw new DomainRuleError(
        409,
        'INCOMPLETE_MARKS',
        `Cannot submit results: ${detail.completeness.missingCount} subject mark entry/entries are still missing.`,
        {
          missingCount: detail.completeness.missingCount,
          missingItems: detail.completeness.missingItems.slice(0, 10)
        }
      );
    }

    const previousStatus = detail.status;
    await this.prisma.$transaction(async (tx) => {
      await tx.termResultPack.update({
        where: { id: packId, schoolId: scope.schoolId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          submittedByMembershipId: access.actorMembershipId
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'RESULT_PACK_SUBMITTED',
          entityType: 'TermResultPack',
          entityId: packId,
          beforeState: { status: previousStatus },
          afterState: { status: 'SUBMITTED' },
          metadata: { className: detail.schoolClass.name, term: detail.academicTerm.label }
        }
      });
    });

    return (await this.getResultPackDetail(access, packId))!;
  }

  async requestResultPackRevision(
    access: SchoolAccessContext,
    packId: string,
    reviewNotes: string
  ): Promise<ResultPackDetailDto> {
    if (!hasAnyRole(access.roles, LEADERSHIP_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only school leadership can return a result pack for revision.'
      );
    }
    const scope = schoolScope(access);
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }
    if (detail.status !== 'SUBMITTED' && detail.status !== 'APPROVED') {
      throw new DomainRuleError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot return a ${detail.status} result pack for revision.`
      );
    }

    const previousStatus = detail.status;
    await this.prisma.$transaction(async (tx) => {
      await tx.termResultPack.update({
        where: { id: packId, schoolId: scope.schoolId },
        data: {
          status: 'NEEDS_REVISION',
          reviewNotes: reviewNotes.trim(),
          reviewedAt: new Date(),
          reviewedByMembershipId: access.actorMembershipId,
          approvedAt: null,
          approvedByMembershipId: null
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'RESULT_PACK_RETURNED_FOR_REVISION',
          entityType: 'TermResultPack',
          entityId: packId,
          beforeState: { status: previousStatus },
          afterState: { status: 'NEEDS_REVISION', reviewNotes: reviewNotes.trim() },
          metadata: { className: detail.schoolClass.name }
        }
      });
    });

    return (await this.getResultPackDetail(access, packId))!;
  }

  async approveResultPack(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto> {
    if (!hasAnyRole(access.roles, APPROVAL_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only a Head Teacher or School Administrator may approve term results.'
      );
    }
    const scope = schoolScope(access);
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }
    if (detail.status !== 'SUBMITTED') {
      throw new DomainRuleError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Only SUBMITTED result packs can be approved (current status: ${detail.status}).`
      );
    }
    if (!detail.completeness.readyForSubmission) {
      throw new DomainRuleError(
        409,
        'INCOMPLETE_MARKS',
        `Cannot approve results with ${detail.completeness.missingCount} missing mark entry/entries.`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.termResultPack.update({
        where: { id: packId, schoolId: scope.schoolId },
        data: {
          status: 'APPROVED',
          reviewedAt: now,
          reviewedByMembershipId: access.actorMembershipId,
          approvedAt: now,
          approvedByMembershipId: access.actorMembershipId
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'RESULT_PACK_APPROVED',
          entityType: 'TermResultPack',
          entityId: packId,
          beforeState: { status: 'SUBMITTED' },
          afterState: { status: 'APPROVED' },
          metadata: { className: detail.schoolClass.name, term: detail.academicTerm.label }
        }
      });
    });

    return (await this.getResultPackDetail(access, packId))!;
  }

  async publishResultPack(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto> {
    if (!hasAnyRole(access.roles, APPROVAL_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only a Head Teacher or School Administrator may publish term results.'
      );
    }
    const scope = schoolScope(access);
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }
    if (detail.status !== 'APPROVED') {
      throw new DomainRuleError(
        409,
        'APPROVAL_REQUIRED_BEFORE_PUBLICATION',
        `Results must be explicitly APPROVED before publication (current status: ${detail.status}).`
      );
    }
    if (!detail.completeness.readyForSubmission) {
      throw new DomainRuleError(
        409,
        'INCOMPLETE_MARKS',
        'Cannot publish incomplete results.'
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.termResultPack.update({
        where: { id: packId, schoolId: scope.schoolId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedByMembershipId: access.actorMembershipId
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'RESULT_PACK_PUBLISHED',
          entityType: 'TermResultPack',
          entityId: packId,
          beforeState: { status: 'APPROVED' },
          afterState: { status: 'PUBLISHED' },
          metadata: { className: detail.schoolClass.name, term: detail.academicTerm.label }
        }
      });
    });

    return (await this.getResultPackDetail(access, packId))!;
  }

  async getReportCardForStaff(
    access: SchoolAccessContext,
    packId: string,
    learnerId: string
  ): Promise<ReportCardDto | null> {
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      return null;
    }
    if (detail.status !== 'APPROVED' && detail.status !== 'PUBLISHED') {
      throw new DomainRuleError(
        409,
        'REPORT_CARD_NOT_APPROVED',
        'Printable report cards require explicit approval before generation.'
      );
    }

    const scope = schoolScope(access);
    const [school, learner] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: scope.schoolId } }),
      this.prisma.learner.findFirst({
        where: { id: learnerId, schoolId: scope.schoolId, schoolClassId: detail.schoolClass.id }
      })
    ]);

    if (!school || !learner) {
      return null;
    }

    const markMap = new Map(
      detail.marks
        .filter((m) => m.learnerId === learnerId)
        .map((m) => [m.subjectId, m])
    );

    const subjectLines: ReportCardSubjectLineDto[] = detail.subjects.map((sub) => {
      const mark = markMap.get(sub.subjectId);
      if (!mark || mark.status === 'PENDING') {
        throw new DomainRuleError(
          409,
          'INCOMPLETE_MARKS',
          'Cannot render report card while subject marks remain pending.'
        );
      }
      return {
        subjectId: sub.subjectId,
        subjectCode: sub.code,
        subjectName: sub.name,
        status: mark.status,
        score: mark.score,
        maxMark: sub.maxMark,
        ...computeSubjectGrade(mark.status, mark.score, sub.maxMark),
        teacherComment: mark.teacherComment,
        teacherName: sub.teacherName
      };
    });

    return {
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status,
        phone: school.phone,
        timezone: school.timezone
      },
      publicationState: detail.status === 'PUBLISHED' ? 'PUBLISHED' : 'APPROVED_PREVIEW',
      academicYearLabel: detail.academicYear.label,
      academicTermLabel: detail.academicTerm.label,
      termNumber: detail.academicTerm.termNumber,
      className: detail.schoolClass.name,
      gradeLevel: detail.schoolClass.gradeLevel,
      classTeacherName: detail.schoolClass.classTeacherName,
      approvedByName: detail.approvedByName,
      approvedAt: detail.approvedAt,
      publishedAt: detail.publishedAt,
      learner: {
        id: learner.id,
        admissionNumber: learner.admissionNumber,
        firstName: learner.firstName,
        lastName: learner.lastName,
        guardianName: learner.guardianName,
        preferredChannel: learner.preferredChannel
      },
      subjects: subjectLines,
      summary: computeReportSummary(subjectLines)
    };
  }

  async getGuardianPublishedResults(
    access: SchoolAccessContext
  ): Promise<GuardianResultsOverviewDto | null> {
    if (!access.roles.includes('PARENT_GUARDIAN')) {
      throw new DomainRuleError(403, 'FORBIDDEN', 'Guardian role required.');
    }
    const scope = schoolScope(access);
    const school = await this.prisma.school.findUnique({ where: { id: scope.schoolId } });
    if (!school || school.status === 'SUSPENDED') {
      return null;
    }

    const guardianMembership = await this.prisma.schoolMembership.findFirst({
      where: {
        schoolId: scope.schoolId,
        userId: access.actorUserId,
        role: 'PARENT_GUARDIAN',
        status: 'ACTIVE'
      }
    });
    if (!guardianMembership) {
      return null;
    }

    const links = await this.prisma.learnerGuardianLink.findMany({
      where: {
        schoolId: scope.schoolId,
        membershipId: guardianMembership.id,
        learner: { active: true }
      },
      include: {
        learner: {
          include: {
            schoolClass: { select: { name: true } }
          }
        }
      },
      orderBy: [{ learner: { lastName: 'asc' } }, { learner: { firstName: 'asc' } }]
    });

    const learnerIds = links.map((l) => l.learnerId);

    // STRICT SECURITY INVARIANT: Never query or return non-PUBLISHED TermResultPack rows for parents.
    const publishedPacks =
      learnerIds.length === 0
        ? []
        : await this.prisma.termResultPack.findMany({
            where: {
              schoolId: scope.schoolId,
              status: 'PUBLISHED',
              marks: {
                some: {
                  learnerId: { in: learnerIds },
                  status: { not: 'PENDING' }
                }
              }
            },
            include: {
              academicTerm: { include: { academicYear: true } },
              schoolClass: {
                include: {
                  classTeacher: { include: { user: { select: { name: true } } } },
                  allocations: {
                    where: { subject: { active: true } },
                    include: {
                      subject: true,
                      teacherMembership: { include: { user: { select: { name: true } } } }
                    },
                    orderBy: [{ subject: { isCore: 'desc' } }, { subject: { name: 'asc' } }]
                  }
                }
              },
              approvedBy: { include: { user: { select: { name: true } } } },
              marks: {
                where: { learnerId: { in: learnerIds } }
              }
            },
            orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }]
          });

    const learners: GuardianLearnerResultsDto[] = links.map((link) => {
      const publishedReports: Array<{ packId: string; reportCard: ReportCardDto }> = [];

      for (const pack of publishedPacks) {
        const learnerMarks = pack.marks.filter((m) => m.learnerId === link.learnerId);
        if (learnerMarks.length === 0) {
          continue;
        }
        const markBySubject = new Map(learnerMarks.map((m) => [m.subjectId, m]));
        const subjectLines: ReportCardSubjectLineDto[] = [];
        let complete = true;

        for (const alloc of pack.schoolClass.allocations) {
          const mark = markBySubject.get(alloc.subjectId);
          if (!mark || mark.status === 'PENDING') {
            complete = false;
            break;
          }
          subjectLines.push({
            subjectId: alloc.subject.id,
            subjectCode: alloc.subject.code,
            subjectName: alloc.subject.name,
            status: mark.status,
            score: mark.score,
            maxMark: alloc.subject.maxMark,
            ...computeSubjectGrade(mark.status, mark.score, alloc.subject.maxMark),
            teacherComment: mark.teacherComment,
            teacherName: alloc.teacherMembership.user.name
          });
        }

        if (!complete || subjectLines.length === 0) {
          continue;
        }

        publishedReports.push({
          packId: pack.id,
          reportCard: {
            school: {
              id: school.id,
              code: school.code,
              name: school.name,
              sector: school.sector,
              province: school.province,
              district: school.district,
              isSyntheticDemo: school.isSyntheticDemo,
              status: school.status,
              phone: school.phone,
              timezone: school.timezone
            },
            publicationState: 'PUBLISHED',
            academicYearLabel: pack.academicTerm.academicYear.label,
            academicTermLabel: pack.academicTerm.label,
            termNumber: pack.academicTerm.termNumber,
            className: pack.schoolClass.name,
            gradeLevel: pack.schoolClass.gradeLevel,
            classTeacherName: pack.schoolClass.classTeacher?.user.name ?? null,
            approvedByName: pack.approvedBy?.user.name ?? null,
            approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
            publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
            learner: {
              id: link.learner.id,
              admissionNumber: link.learner.admissionNumber,
              firstName: link.learner.firstName,
              lastName: link.learner.lastName,
              guardianName: link.learner.guardianName,
              preferredChannel: link.learner.preferredChannel
            },
            subjects: subjectLines,
            summary: computeReportSummary(subjectLines)
          }
        });
      }

      return {
        learner: {
          id: link.learner.id,
          admissionNumber: link.learner.admissionNumber,
          firstName: link.learner.firstName,
          lastName: link.learner.lastName,
          currentClassName: link.learner.schoolClass?.name ?? null,
          relationship: link.relationship,
          preferredChannel: link.learner.preferredChannel
        },
        publishedReports
      };
    });

    return {
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status
      },
      learners
    };
  }

  async listSchoolAuditEvents(access: SchoolAccessContext): Promise<AuditEventDto[]> {
    if (!hasAnyRole(access.roles, LEADERSHIP_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only school leadership can view the school audit trail.'
      );
    }
    const scope = schoolScope(access);
    const events = await this.prisma.auditEvent.findMany({
      where: { schoolId: scope.schoolId },
      include: {
        actorUser: { select: { name: true } },
        actorMembership: { select: { role: true } }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100
    });

    return events.map((ev) => ({
      id: ev.id,
      schoolId: ev.schoolId,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      actorName: ev.actorUser?.name ?? null,
      actorRole: ev.actorMembership?.role ?? null,
      beforeState: (ev.beforeState as Record<string, unknown> | null) ?? null,
      afterState: (ev.afterState as Record<string, unknown> | null) ?? null,
      metadata: (ev.metadata as Record<string, unknown> | null) ?? null,
      createdAt: ev.createdAt.toISOString()
    }));
  }

  private toPublicSchoolDto(school: {
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
    academicYears: Array<{ label: string }>;
  }): PublicSchoolProfileDto {
    const canSelfRegister =
      school.status !== 'SUSPENDED' && school.studentPortalEnabled === true;
    return {
      id: school.id,
      code: school.code,
      registrationNumber: school.registrationNumber,
      name: school.name,
      sector: school.sector,
      province: school.province,
      district: school.district,
      levelSummary: school.levelSummary,
      publicDescription: school.publicDescription,
      phone: school.phone,
      email: school.email,
      status: school.status,
      isSyntheticDemo: school.isSyntheticDemo,
      studentPortalEnabled: school.studentPortalEnabled,
      canSelfRegister,
      currentAcademicYearLabel: school.academicYears[0]?.label ?? null
    };
  }

  async listPublicSchools(
    filters: PublicSchoolSearchFilters
  ): Promise<PublicSchoolProfileDto[]> {
    const q = filters.q?.trim();
    const where: Prisma.SchoolWhereInput = {
      status: { not: 'SUSPENDED' },
      ...(filters.province
        ? { province: { equals: filters.province, mode: 'insensitive' } }
        : {}),
      ...(filters.sector ? { sector: filters.sector } : {}),
      ...(filters.portalOnly ? { studentPortalEnabled: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { registrationNumber: { contains: q, mode: 'insensitive' } },
              { province: { contains: q, mode: 'insensitive' } },
              { district: { contains: q, mode: 'insensitive' } },
              { levelSummary: { contains: q, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const schools = await this.prisma.school.findMany({
      where,
      include: {
        academicYears: {
          where: { isCurrent: true },
          select: { label: true },
          take: 1
        }
      },
      orderBy: [{ studentPortalEnabled: 'desc' }, { name: 'asc' }]
    });

    return schools.map((s) => this.toPublicSchoolDto(s));
  }

  async getPublicSchoolProfile(codeOrId: string): Promise<PublicSchoolProfileDto | null> {
    const trimmed = codeOrId.trim();
    const school = await this.prisma.school.findFirst({
      where: {
        status: { not: 'SUSPENDED' },
        OR: [{ code: { equals: trimmed, mode: 'insensitive' } }, { id: trimmed }]
      },
      include: {
        academicYears: {
          where: { isCurrent: true },
          select: { label: true },
          take: 1
        }
      }
    });
    return school ? this.toPublicSchoolDto(school) : null;
  }

  async registerStudentAccount(
    input: RegisterStudentAccountInput
  ): Promise<RegisterStudentAccountResult> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedAdm = normalizeAdmissionNumber(input.admissionNumber);

    const school = await this.prisma.school.findUnique({
      where: { id: input.schoolId }
    });
    if (!school || school.status === 'SUSPENDED' || !school.studentPortalEnabled) {
      throw new DomainRuleError(
        403,
        'STUDENT_PORTAL_NOT_ENABLED',
        'Student portal self-registration is not enabled for this school.'
      );
    }

    const existingEmailUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true }
    });
    if (existingEmailUser) {
      throw new DomainRuleError(
        409,
        'ACCOUNT_EMAIL_CONFLICT',
        'Unable to create a student account with this email address. Sign in if you have already registered, or contact your school office.'
      );
    }

    if (input.verificationMode === 'ENROLMENT_CODE') {
      if (!input.enrolmentCode) {
        throw new DomainRuleError(
          400,
          'INVALID_ENROLMENT_VERIFICATION',
          'Enrolment verification failed. Confirm your school, learner admission number, and active single-use enrolment code with your school office.'
        );
      }
      const codeHash = hashEnrolmentCode(input.enrolmentCode);
      const now = new Date();

      const createdUserId = await this.prisma.$transaction(async (tx) => {
        const codeRecord = await tx.studentEnrolmentCode.findFirst({
          where: { schoolId: school.id, codeHash },
          include: {
            learner: {
              include: { studentLink: { select: { id: true } } }
            }
          }
        });

        // Uniform error for wrong code, wrong admission number, expired, revoked,
        // already used, inactive learner, or already linked learner (anti-enumeration).
        if (
          !codeRecord ||
          !codeRecord.learner.active ||
          normalizeAdmissionNumber(codeRecord.learner.admissionNumber) !== normalizedAdm ||
          codeRecord.revokedAt !== null ||
          codeRecord.usedAt !== null ||
          codeRecord.expiresAt.getTime() <= now.getTime() ||
          codeRecord.learner.studentLink !== null
        ) {
          throw new DomainRuleError(
            400,
            'INVALID_ENROLMENT_VERIFICATION',
            'Enrolment verification failed. Confirm your school, learner admission number, and active single-use enrolment code with your school office.'
          );
        }

        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            name: input.fullName.trim(),
            passwordHash: input.passwordHash,
            platformRole: 'STANDARD',
            status: 'ACTIVE'
          }
        });

        const consumed = await tx.studentEnrolmentCode.updateMany({
          where: {
            id: codeRecord.id,
            schoolId: school.id,
            usedAt: null,
            revokedAt: null
          },
          data: {
            usedAt: now,
            usedByUserId: user.id
          }
        });
        if (consumed.count !== 1) {
          throw new DomainRuleError(
            400,
            'INVALID_ENROLMENT_VERIFICATION',
            'Enrolment verification failed. Confirm your school, learner admission number, and active single-use enrolment code with your school office.'
          );
        }

        const membership = await tx.schoolMembership.create({
          data: {
            schoolId: school.id,
            userId: user.id,
            role: 'STUDENT',
            status: 'ACTIVE'
          }
        });

        const link = await tx.learnerStudentLink.create({
          data: {
            schoolId: school.id,
            membershipId: membership.id,
            learnerId: codeRecord.learner.id,
            verificationMethod: 'ENROLMENT_CODE',
            verifiedByMembershipId: codeRecord.createdByMembershipId
          }
        });

        await tx.auditEvent.create({
          data: {
            schoolId: school.id,
            actorUserId: user.id,
            actorMembershipId: membership.id,
            action: 'STUDENT_REGISTERED_VIA_CODE',
            entityType: 'LearnerStudentLink',
            entityId: link.id,
            afterState: {
              learnerId: codeRecord.learner.id,
              verificationMethod: 'ENROLMENT_CODE'
            },
            metadata: {
              enrolmentCodeId: codeRecord.id,
              codeHint: codeRecord.codeHint
            }
          }
        });

        return user.id;
      });

      const hydrated = await this.findUserById(createdUserId);
      if (!hydrated) {
        throw new Error('Failed to load newly created student user.');
      }

      return {
        outcome: 'VERIFIED',
        user: hydrated,
        schoolCode: school.code,
        requestId: null,
        message: 'Student account verified and linked to your school academic record.'
      };
    }

    // STAFF_APPROVAL mode: never probe or leak whether admissionNumber exists publicly.
    const { createdUserId, requestId } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: input.fullName.trim(),
          passwordHash: input.passwordHash,
          platformRole: 'STANDARD',
          status: 'ACTIVE'
        }
      });

      const membership = await tx.schoolMembership.create({
        data: {
          schoolId: school.id,
          userId: user.id,
          role: 'STUDENT',
          status: 'INACTIVE'
        }
      });

      const reqRecord = await tx.studentRegistrationRequest.create({
        data: {
          schoolId: school.id,
          userId: user.id,
          submittedAdmissionNumber: normalizedAdm,
          applicantName: input.fullName.trim(),
          classHint: input.classHint,
          status: 'PENDING'
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: school.id,
          actorUserId: user.id,
          actorMembershipId: membership.id,
          action: 'STUDENT_REGISTRATION_REQUESTED',
          entityType: 'StudentRegistrationRequest',
          entityId: reqRecord.id,
          afterState: {
            status: 'PENDING',
            claimedAdmissionNo: normalizedAdm
          }
        }
      });

      return { createdUserId: user.id, requestId: reqRecord.id };
    });

    const hydrated = await this.findUserById(createdUserId);
    if (!hydrated) {
      throw new Error('Failed to load newly created pending student user.');
    }

    return {
      outcome: 'PENDING_APPROVAL',
      user: hydrated,
      schoolCode: school.code,
      requestId,
      message:
        'Registration request submitted. Your school administration must verify your learner record before academic results become visible.'
    };
  }

  private assertSchoolLeadership(access: SchoolAccessContext): void {
    if (!hasAnyRole(access.roles, LEADERSHIP_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only school leadership can manage learner enrolment and student portal verification.'
      );
    }
  }

  async getSchoolAdminPortalState(
    access: SchoolAccessContext
  ): Promise<SchoolAdminPortalStateDto | null> {
    this.assertSchoolLeadership(access);
    const scope = schoolScope(access);
    const now = new Date();

    const school = await this.prisma.school.findUnique({
      where: { id: scope.schoolId }
    });
    if (!school) {
      return null;
    }

    const [classes, learners, requests, announcements] = await Promise.all([
      this.prisma.schoolClass.findMany({
        where: { schoolId: scope.schoolId },
        include: { academicYear: { select: { label: true } } },
        orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }]
      }),
      this.prisma.learner.findMany({
        where: { schoolId: scope.schoolId },
        include: {
          schoolClass: { select: { id: true, name: true, gradeLevel: true } },
          studentLink: {
            include: {
              membership: {
                include: { user: { select: { id: true, name: true, email: true } } }
              }
            }
          },
          enrolmentCodes: {
            where: {
              usedAt: null,
              revokedAt: null,
              expiresAt: { gt: now }
            },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      }),
      this.prisma.studentRegistrationRequest.findMany({
        where: { schoolId: scope.schoolId },
        include: {
          user: { select: { email: true } },
          reviewedBy: { include: { user: { select: { name: true } } } }
        },
        orderBy: [{ createdAt: 'desc' }]
      }),
      this.prisma.schoolAnnouncement.findMany({
        where: { schoolId: scope.schoolId },
        include: {
          publishedBy: { include: { user: { select: { name: true } } } }
        },
        orderBy: [{ publishedAt: 'desc' }]
      })
    ]);

    const learnerByAdmission = new Map(
      learners.map((l) => [normalizeAdmissionNumber(l.admissionNumber), l])
    );

    return {
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status,
        registrationNumber: school.registrationNumber,
        levelSummary: school.levelSummary,
        studentPortalEnabled: school.studentPortalEnabled
      },
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        academicYearLabel: c.academicYear.label
      })),
      learners: learners.map((l) => {
        const activeCode = l.enrolmentCodes[0] ?? null;
        return {
          id: l.id,
          admissionNumber: l.admissionNumber,
          firstName: l.firstName,
          lastName: l.lastName,
          schoolClassId: l.schoolClassId,
          currentClassName: l.schoolClass?.name ?? null,
          gradeLevel: l.schoolClass?.gradeLevel ?? null,
          preferredChannel: l.preferredChannel,
          active: l.active,
          linkedStudent: l.studentLink
            ? {
                userId: l.studentLink.membership.user.id,
                name: l.studentLink.membership.user.name,
                email: l.studentLink.membership.user.email,
                verificationMethod: l.studentLink.verificationMethod,
                verifiedAt: l.studentLink.createdAt.toISOString()
              }
            : null,
          activeEnrolmentCode: activeCode
            ? {
                id: activeCode.id,
                codeHint: activeCode.codeHint,
                expiresAt: activeCode.expiresAt.toISOString(),
                createdAt: activeCode.createdAt.toISOString()
              }
            : null
        };
      }),
      registrationRequests: requests.map((r) => {
        const suggested = learnerByAdmission.get(
          normalizeAdmissionNumber(r.submittedAdmissionNumber)
        );
        return {
          id: r.id,
          userId: r.userId,
          applicantEmail: r.user.email,
          claimedName: r.applicantName,
          claimedAdmissionNo: r.submittedAdmissionNumber,
          claimedClassNote: r.classHint,
          status: r.status,
          decisionNotes: r.decisionNotes,
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
          reviewedByName: r.reviewedBy?.user.name ?? null,
          approvedLearnerId: r.linkedLearnerId,
          suggestedLearner: suggested
            ? {
                id: suggested.id,
                admissionNumber: suggested.admissionNumber,
                firstName: suggested.firstName,
                lastName: suggested.lastName,
                currentClassName: suggested.schoolClass?.name ?? null,
                alreadyLinked: suggested.studentLink !== null
              }
            : null
        };
      }),
      announcements: announcements.map((a) => ({
        id: a.id,
        schoolId: a.schoolId,
        title: a.title,
        body: a.body,
        audience: a.audience,
        postedByName: a.publishedBy?.user.name ?? 'School Administration',
        publishedAt: a.publishedAt.toISOString()
      }))
    };
  }

  async createSchoolLearner(
    access: SchoolAccessContext,
    input: {
      admissionNumber: string;
      firstName: string;
      lastName: string;
      schoolClassId: string;
      preferredChannel: CommunicationChannel;
    }
  ): Promise<AdminRosterLearnerDto> {
    this.assertSchoolLeadership(access);
    const scope = schoolScope(access);
    const normalizedAdm = normalizeAdmissionNumber(input.admissionNumber);

    const cls = await this.prisma.schoolClass.findFirst({
      where: { id: input.schoolClassId, schoolId: scope.schoolId }
    });
    if (!cls) {
      throw new DomainRuleError(
        400,
        'INVALID_SCHOOL_CLASS',
        'Selected class does not belong to this school.'
      );
    }

    const duplicate = await this.prisma.learner.findFirst({
      where: {
        schoolId: scope.schoolId,
        admissionNumber: { equals: normalizedAdm, mode: 'insensitive' }
      }
    });
    if (duplicate) {
      throw new DomainRuleError(
        409,
        'DUPLICATE_ADMISSION_NUMBER',
        `A learner with admission number ${normalizedAdm} already exists at this school.`
      );
    }

    const learner = await this.prisma.$transaction(async (tx) => {
      const created = await tx.learner.create({
        data: {
          schoolId: scope.schoolId,
          admissionNumber: normalizedAdm,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          schoolClassId: cls.id,
          preferredChannel: input.preferredChannel,
          active: true
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'LEARNER_CREATED',
          entityType: 'Learner',
          entityId: created.id,
          afterState: {
            admissionNumber: created.admissionNumber,
            schoolClassId: cls.id
          }
        }
      });

      return created;
    });

    return {
      id: learner.id,
      admissionNumber: learner.admissionNumber,
      firstName: learner.firstName,
      lastName: learner.lastName,
      schoolClassId: cls.id,
      currentClassName: cls.name,
      gradeLevel: cls.gradeLevel,
      preferredChannel: learner.preferredChannel,
      active: learner.active,
      linkedStudent: null,
      activeEnrolmentCode: null
    };
  }

  async issueLearnerEnrolmentCode(
    access: SchoolAccessContext,
    learnerId: string,
    expiresInDays: number
  ): Promise<IssuedEnrolmentCodeDto> {
    this.assertSchoolLeadership(access);
    const scope = schoolScope(access);

    const learner = await this.prisma.learner.findFirst({
      where: { id: learnerId, schoolId: scope.schoolId },
      include: { studentLink: { select: { id: true } } }
    });
    if (!learner || !learner.active) {
      throw new DomainRuleError(
        404,
        'LEARNER_NOT_FOUND',
        'Active learner record not found in this school.'
      );
    }
    if (learner.studentLink) {
      throw new DomainRuleError(
        409,
        'LEARNER_ALREADY_LINKED',
        'This learner already has a verified student portal account.'
      );
    }

    const plainCode = generatePlainEnrolmentCode();
    const codeHash = hashEnrolmentCode(plainCode);
    const codeHint = formatEnrolmentCodeHint(plainCode);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    const createdCode = await this.prisma.$transaction(async (tx) => {
      await tx.studentEnrolmentCode.updateMany({
        where: {
          schoolId: scope.schoolId,
          learnerId: learner.id,
          usedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revokedByMembershipId: access.actorMembershipId
        }
      });

      const record = await tx.studentEnrolmentCode.create({
        data: {
          schoolId: scope.schoolId,
          learnerId: learner.id,
          codeHash,
          codeHint,
          expiresAt,
          createdByMembershipId: access.actorMembershipId
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'STUDENT_ENROLMENT_CODE_ISSUED',
          entityType: 'StudentEnrolmentCode',
          entityId: record.id,
          afterState: {
            learnerId: learner.id,
            codeHint,
            expiresAt: expiresAt.toISOString()
          }
        }
      });

      return record;
    });

    return {
      id: createdCode.id,
      learnerId: learner.id,
      admissionNumber: learner.admissionNumber,
      learnerName: `${learner.firstName} ${learner.lastName}`,
      plainCode,
      codeHint,
      expiresAt: expiresAt.toISOString()
    };
  }

  async revokeLearnerEnrolmentCode(
    access: SchoolAccessContext,
    codeId: string
  ): Promise<void> {
    this.assertSchoolLeadership(access);
    const scope = schoolScope(access);
    const now = new Date();

    const codeRecord = await this.prisma.studentEnrolmentCode.findFirst({
      where: { id: codeId, schoolId: scope.schoolId }
    });
    if (!codeRecord) {
      throw new DomainRuleError(
        404,
        'ENROLMENT_CODE_NOT_FOUND',
        'Enrolment code not found in this school.'
      );
    }
    if (codeRecord.usedAt || codeRecord.revokedAt) {
      throw new DomainRuleError(
        409,
        'ENROLMENT_CODE_INACTIVE',
        'Enrolment code has already been used or revoked.'
      );
    }

    await this.prisma.$transaction([
      this.prisma.studentEnrolmentCode.update({
        where: { id: codeRecord.id },
        data: {
          revokedAt: now,
          revokedByMembershipId: access.actorMembershipId
        }
      }),
      this.prisma.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'STUDENT_ENROLMENT_CODE_REVOKED',
          entityType: 'StudentEnrolmentCode',
          entityId: codeRecord.id,
          afterState: { revokedAt: now.toISOString() }
        }
      })
    ]);
  }

  async approveStudentRegistrationRequest(
    access: SchoolAccessContext,
    requestId: string,
    input: { learnerId: string; decisionNotes: string | null }
  ): Promise<AdminRegistrationRequestDto> {
    this.assertSchoolLeadership(access);
    const scope = schoolScope(access);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const reqRecord = await tx.studentRegistrationRequest.findFirst({
        where: { id: requestId, schoolId: scope.schoolId },
        include: { user: { select: { email: true } } }
      });
      if (!reqRecord) {
        throw new DomainRuleError(
          404,
          'REGISTRATION_REQUEST_NOT_FOUND',
          'Student registration request not found in this school.'
        );
      }
      if (reqRecord.status !== 'PENDING') {
        throw new DomainRuleError(
          409,
          'REGISTRATION_REQUEST_ALREADY_DECIDED',
          `Registration request has already been ${reqRecord.status.toLowerCase()}.`
        );
      }
      if (reqRecord.userId === access.actorUserId) {
        throw new DomainRuleError(
          403,
          'SELF_APPROVAL_FORBIDDEN',
          'You cannot approve your own registration request.'
        );
      }

      const learner = await tx.learner.findFirst({
        where: { id: input.learnerId, schoolId: scope.schoolId },
        include: {
          schoolClass: { select: { name: true } },
          studentLink: { select: { id: true } }
        }
      });
      if (!learner || !learner.active) {
        throw new DomainRuleError(
          404,
          'LEARNER_NOT_FOUND',
          'Selected learner record not found or inactive in this school.'
        );
      }
      if (learner.studentLink) {
        throw new DomainRuleError(
          409,
          'LEARNER_ALREADY_LINKED',
          'Selected learner record is already linked to another student account.'
        );
      }

      const studentMembership = await tx.schoolMembership.upsert({
        where: {
          schoolId_userId_role: {
            schoolId: scope.schoolId,
            userId: reqRecord.userId,
            role: 'STUDENT'
          }
        },
        create: {
          schoolId: scope.schoolId,
          userId: reqRecord.userId,
          role: 'STUDENT',
          status: 'ACTIVE'
        },
        update: {
          status: 'ACTIVE'
        }
      });

      const existingMembershipLink = await tx.learnerStudentLink.findUnique({
        where: { membershipId: studentMembership.id }
      });
      if (existingMembershipLink) {
        throw new DomainRuleError(
          409,
          'STUDENT_ALREADY_LINKED',
          'This student account is already linked to a learner record.'
        );
      }

      const link = await tx.learnerStudentLink.create({
        data: {
          schoolId: scope.schoolId,
          membershipId: studentMembership.id,
          learnerId: learner.id,
          verificationMethod: 'STAFF_APPROVAL',
          verifiedByMembershipId: access.actorMembershipId
        }
      });

      await tx.studentEnrolmentCode.updateMany({
        where: {
          schoolId: scope.schoolId,
          learnerId: learner.id,
          usedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revokedByMembershipId: access.actorMembershipId
        }
      });

      const savedReq = await tx.studentRegistrationRequest.update({
        where: { id: reqRecord.id },
        data: {
          status: 'APPROVED',
          linkedLearnerId: learner.id,
          reviewedByMembershipId: access.actorMembershipId,
          reviewedAt: now,
          decisionNotes: input.decisionNotes
        },
        include: {
          user: { select: { email: true } },
          reviewedBy: { include: { user: { select: { name: true } } } }
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'STUDENT_REGISTRATION_APPROVED',
          entityType: 'StudentRegistrationRequest',
          entityId: reqRecord.id,
          beforeState: { status: 'PENDING' },
          afterState: {
            status: 'APPROVED',
            learnerId: learner.id,
            studentLinkId: link.id
          }
        }
      });

      return { savedReq, learner };
    });

    return {
      id: updated.savedReq.id,
      userId: updated.savedReq.userId,
      applicantEmail: updated.savedReq.user.email,
      claimedName: updated.savedReq.applicantName,
      claimedAdmissionNo: updated.savedReq.submittedAdmissionNumber,
      claimedClassNote: updated.savedReq.classHint,
      status: updated.savedReq.status,
      decisionNotes: updated.savedReq.decisionNotes,
      createdAt: updated.savedReq.createdAt.toISOString(),
      reviewedAt: updated.savedReq.reviewedAt?.toISOString() ?? null,
      reviewedByName: updated.savedReq.reviewedBy?.user.name ?? null,
      approvedLearnerId: updated.savedReq.linkedLearnerId,
      suggestedLearner: {
        id: updated.learner.id,
        admissionNumber: updated.learner.admissionNumber,
        firstName: updated.learner.firstName,
        lastName: updated.learner.lastName,
        currentClassName: updated.learner.schoolClass?.name ?? null,
        alreadyLinked: true
      }
    };
  }

  async rejectStudentRegistrationRequest(
    access: SchoolAccessContext,
    requestId: string,
    input: { decisionNotes: string }
  ): Promise<AdminRegistrationRequestDto> {
    this.assertSchoolLeadership(access);
    const scope = schoolScope(access);
    const now = new Date();

    const savedReq = await this.prisma.$transaction(async (tx) => {
      const reqRecord = await tx.studentRegistrationRequest.findFirst({
        where: { id: requestId, schoolId: scope.schoolId }
      });
      if (!reqRecord) {
        throw new DomainRuleError(
          404,
          'REGISTRATION_REQUEST_NOT_FOUND',
          'Student registration request not found in this school.'
        );
      }
      if (reqRecord.status !== 'PENDING') {
        throw new DomainRuleError(
          409,
          'REGISTRATION_REQUEST_ALREADY_DECIDED',
          `Registration request has already been ${reqRecord.status.toLowerCase()}.`
        );
      }

      await tx.schoolMembership.updateMany({
        where: {
          schoolId: scope.schoolId,
          userId: reqRecord.userId,
          role: 'STUDENT'
        },
        data: { status: 'INACTIVE' }
      });

      const updated = await tx.studentRegistrationRequest.update({
        where: { id: reqRecord.id },
        data: {
          status: 'REJECTED',
          reviewedByMembershipId: access.actorMembershipId,
          reviewedAt: now,
          decisionNotes: input.decisionNotes
        },
        include: {
          user: { select: { email: true } },
          reviewedBy: { include: { user: { select: { name: true } } } }
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'STUDENT_REGISTRATION_REJECTED',
          entityType: 'StudentRegistrationRequest',
          entityId: reqRecord.id,
          beforeState: { status: 'PENDING' },
          afterState: {
            status: 'REJECTED',
            decisionNotes: input.decisionNotes
          }
        }
      });

      return updated;
    });

    return {
      id: savedReq.id,
      userId: savedReq.userId,
      applicantEmail: savedReq.user.email,
      claimedName: savedReq.applicantName,
      claimedAdmissionNo: savedReq.submittedAdmissionNumber,
      claimedClassNote: savedReq.classHint,
      status: savedReq.status,
      decisionNotes: savedReq.decisionNotes,
      createdAt: savedReq.createdAt.toISOString(),
      reviewedAt: savedReq.reviewedAt?.toISOString() ?? null,
      reviewedByName: savedReq.reviewedBy?.user.name ?? null,
      approvedLearnerId: null,
      suggestedLearner: null
    };
  }

  async createSchoolAnnouncement(
    access: SchoolAccessContext,
    input: { title: string; body: string; audience: AnnouncementAudience }
  ): Promise<SchoolAnnouncementDto> {
    this.assertSchoolLeadership(access);
    const scope = schoolScope(access);

    const created = await this.prisma.$transaction(async (tx) => {
      const announcement = await tx.schoolAnnouncement.create({
        data: {
          schoolId: scope.schoolId,
          title: input.title.trim(),
          body: input.body.trim(),
          audience: input.audience,
          publishedByMembershipId: access.actorMembershipId
        },
        include: {
          publishedBy: { include: { user: { select: { name: true } } } }
        }
      });

      await tx.auditEvent.create({
        data: {
          schoolId: scope.schoolId,
          actorUserId: access.actorUserId,
          actorMembershipId: access.actorMembershipId,
          action: 'SCHOOL_ANNOUNCEMENT_POSTED',
          entityType: 'SchoolAnnouncement',
          entityId: announcement.id,
          afterState: {
            title: announcement.title,
            audience: announcement.audience
          }
        }
      });

      return announcement;
    });

    return {
      id: created.id,
      schoolId: created.schoolId,
      title: created.title,
      body: created.body,
      audience: created.audience,
      postedByName: created.publishedBy?.user.name ?? 'School Administration',
      publishedAt: created.publishedAt.toISOString()
    };
  }

  async getStudentPortalOverview(userId: string): Promise<StudentPortalOverviewDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });
    if (!user) {
      throw new DomainRuleError(404, 'USER_NOT_FOUND', 'Student user not found.');
    }

    const [memberships, userRequests] = await Promise.all([
      this.prisma.schoolMembership.findMany({
        where: { userId, role: 'STUDENT' },
        include: {
          school: true,
          studentLink: {
            include: {
              learner: {
                include: {
                  schoolClass: {
                    include: { academicYear: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.studentRegistrationRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const accounts: StudentPortalAccountDto[] = [];

    for (const m of memberships) {
      const schoolSummary = {
        id: m.school.id,
        code: m.school.code,
        name: m.school.name,
        sector: m.school.sector,
        province: m.school.province,
        district: m.school.district,
        isSyntheticDemo: m.school.isSyntheticDemo,
        status: m.school.status,
        registrationNumber: m.school.registrationNumber,
        levelSummary: m.school.levelSummary,
        phone: m.school.phone,
        email: m.school.email
      };

      const latestReq = userRequests.find((r) => r.schoolId === m.schoolId) ?? null;

      if (m.status !== 'ACTIVE' || !m.studentLink || !m.studentLink.learner.active) {
        const verificationState =
          latestReq?.status === 'REJECTED' ? 'REJECTED' : 'PENDING_APPROVAL';
        accounts.push({
          membershipId: m.id,
          school: schoolSummary,
          verificationState,
          learner: null,
          pendingRequest: latestReq
            ? {
                id: latestReq.id,
                claimedAdmissionNo: latestReq.submittedAdmissionNumber,
                claimedClassNote: latestReq.classHint,
                status: latestReq.status,
                decisionNotes: latestReq.decisionNotes,
                createdAt: latestReq.createdAt.toISOString(),
                reviewedAt: latestReq.reviewedAt?.toISOString() ?? null
              }
            : null,
          termResults: [],
          announcements: []
        });
        continue;
      }

      const learner = m.studentLink.learner;
      const [currentYear, currentTerm, announcements, packs] = await Promise.all([
        this.prisma.academicYear.findFirst({
          where: { schoolId: m.schoolId, isCurrent: true }
        }),
        this.prisma.academicTerm.findFirst({
          where: { schoolId: m.schoolId, isCurrent: true }
        }),
        this.prisma.schoolAnnouncement.findMany({
          where: {
            schoolId: m.schoolId,
            audience: 'STUDENTS_AND_STAFF'
          },
          include: {
            publishedBy: { include: { user: { select: { name: true } } } }
          },
          orderBy: { publishedAt: 'desc' },
          take: 20
        }),
        learner.schoolClassId
          ? this.prisma.termResultPack.findMany({
              where: {
                schoolId: m.schoolId,
                schoolClassId: learner.schoolClassId
              },
              include: {
                academicTerm: { include: { academicYear: true } },
                schoolClass: {
                  include: {
                    classTeacher: { include: { user: { select: { name: true } } } },
                    allocations: {
                      include: {
                        subject: true,
                        teacherMembership: {
                          include: { user: { select: { name: true } } }
                        }
                      },
                      orderBy: { subject: { code: 'asc' } }
                    }
                  }
                },
                approvedBy: { include: { user: { select: { name: true } } } },
                marks: {
                  where: { learnerId: learner.id }
                }
              },
              orderBy: [
                { academicTerm: { startsOn: 'desc' } },
                { createdAt: 'desc' }
              ]
            })
          : Promise.resolve([])
      ]);

      const termResults: StudentTermResultStatusDto[] = packs.map((pack) => {
        if (pack.status !== 'PUBLISHED') {
          return {
            packId: pack.id,
            academicYearLabel: pack.academicTerm.academicYear.label,
            academicTermLabel: pack.academicTerm.label,
            termNumber: pack.academicTerm.termNumber,
            className: pack.schoolClass.name,
            gradeLevel: pack.schoolClass.gradeLevel,
            publicationState: 'UNPUBLISHED',
            statusMessage: 'Results not yet published by school administration.',
            publishedAt: null,
            reportCard: null
          };
        }

        const markBySubject = new Map(pack.marks.map((sm) => [sm.subjectId, sm]));
        const subjectLines: ReportCardSubjectLineDto[] = [];
        let complete = true;

        for (const alloc of pack.schoolClass.allocations) {
          const mark = markBySubject.get(alloc.subjectId);
          if (!mark || mark.status === 'PENDING') {
            complete = false;
            break;
          }
          subjectLines.push({
            subjectId: alloc.subject.id,
            subjectCode: alloc.subject.code,
            subjectName: alloc.subject.name,
            status: mark.status,
            score: mark.score,
            maxMark: alloc.subject.maxMark,
            ...computeSubjectGrade(mark.status, mark.score, alloc.subject.maxMark),
            teacherComment: mark.teacherComment,
            teacherName: alloc.teacherMembership.user.name
          });
        }

        if (!complete || subjectLines.length === 0) {
          return {
            packId: pack.id,
            academicYearLabel: pack.academicTerm.academicYear.label,
            academicTermLabel: pack.academicTerm.label,
            termNumber: pack.academicTerm.termNumber,
            className: pack.schoolClass.name,
            gradeLevel: pack.schoolClass.gradeLevel,
            publicationState: 'UNPUBLISHED',
            statusMessage: 'Results not yet published by school administration.',
            publishedAt: null,
            reportCard: null
          };
        }

        const reportCard: ReportCardDto = {
          school: {
            id: m.school.id,
            code: m.school.code,
            name: m.school.name,
            sector: m.school.sector,
            province: m.school.province,
            district: m.school.district,
            isSyntheticDemo: m.school.isSyntheticDemo,
            status: m.school.status,
            phone: m.school.phone,
            timezone: m.school.timezone
          },
          publicationState: 'PUBLISHED',
          academicYearLabel: pack.academicTerm.academicYear.label,
          academicTermLabel: pack.academicTerm.label,
          termNumber: pack.academicTerm.termNumber,
          className: pack.schoolClass.name,
          gradeLevel: pack.schoolClass.gradeLevel,
          classTeacherName: pack.schoolClass.classTeacher?.user.name ?? null,
          approvedByName: pack.approvedBy?.user.name ?? null,
          approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
          publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
          learner: {
            id: learner.id,
            admissionNumber: learner.admissionNumber,
            firstName: learner.firstName,
            lastName: learner.lastName,
            guardianName: learner.guardianName,
            preferredChannel: learner.preferredChannel
          },
          subjects: subjectLines,
          summary: computeReportSummary(subjectLines)
        };

        return {
          packId: pack.id,
          academicYearLabel: pack.academicTerm.academicYear.label,
          academicTermLabel: pack.academicTerm.label,
          termNumber: pack.academicTerm.termNumber,
          className: pack.schoolClass.name,
          gradeLevel: pack.schoolClass.gradeLevel,
          publicationState: 'PUBLISHED',
          statusMessage: 'Official term results published.',
          publishedAt: reportCard.publishedAt,
          reportCard
        };
      });

      accounts.push({
        membershipId: m.id,
        school: schoolSummary,
        verificationState: 'VERIFIED',
        learner: {
          id: learner.id,
          admissionNumber: learner.admissionNumber,
          firstName: learner.firstName,
          lastName: learner.lastName,
          currentClassName: learner.schoolClass?.name ?? null,
          gradeLevel: learner.schoolClass?.gradeLevel ?? null,
          currentAcademicYearLabel:
            learner.schoolClass?.academicYear.label ?? currentYear?.label ?? null,
          currentTermLabel: currentTerm?.label ?? null,
          verificationMethod: m.studentLink.verificationMethod,
          verifiedAt: m.studentLink.createdAt.toISOString()
        },
        pendingRequest: null,
        termResults,
        announcements: announcements.map((a) => ({
          id: a.id,
          schoolId: a.schoolId,
          title: a.title,
          body: a.body,
          audience: a.audience,
          postedByName: a.publishedBy?.user.name ?? 'School Administration',
          publishedAt: a.publishedAt.toISOString()
        }))
      });
    }

    return {
      studentUser: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      accounts
    };
  }

  async getReportCardForStudent(
    access: SchoolAccessContext,
    packId: string,
    learnerId: string
  ): Promise<ReportCardDto | null> {
    if (!access.roles.includes('STUDENT')) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Student report card endpoint requires a verified student school membership.'
      );
    }
    const scope = schoolScope(access);

    const studentLink = await this.prisma.learnerStudentLink.findFirst({
      where: {
        schoolId: scope.schoolId,
        membershipId: access.actorMembershipId
      },
      include: { learner: true }
    });

    if (!studentLink || !studentLink.learner.active || studentLink.learnerId !== learnerId) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN_LEARNER_ACCESS',
        'Students may only access their own verified academic record.'
      );
    }

    const [school, pack] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: scope.schoolId } }),
      this.prisma.termResultPack.findFirst({
        where: { id: packId, schoolId: scope.schoolId },
        include: {
          academicTerm: { include: { academicYear: true } },
          schoolClass: {
            include: {
              classTeacher: { include: { user: { select: { name: true } } } },
              allocations: {
                include: {
                  subject: true,
                  teacherMembership: {
                    include: { user: { select: { name: true } } }
                  }
                },
                orderBy: { subject: { code: 'asc' } }
              }
            }
          },
          approvedBy: { include: { user: { select: { name: true } } } },
          marks: { where: { learnerId: studentLink.learnerId } }
        }
      })
    ]);

    if (!school || !pack) {
      return null;
    }

    if (pack.status !== 'PUBLISHED') {
      throw new DomainRuleError(
        403,
        'RESULT_NOT_PUBLISHED',
        'This term result pack has not yet been published by school administration.'
      );
    }

    const markBySubject = new Map(pack.marks.map((m) => [m.subjectId, m]));
    const subjectLines: ReportCardSubjectLineDto[] = [];

    for (const alloc of pack.schoolClass.allocations) {
      const mark = markBySubject.get(alloc.subjectId);
      if (!mark || mark.status === 'PENDING') {
        throw new DomainRuleError(
          403,
          'RESULT_NOT_PUBLISHED',
          'Results for this student record are not complete for publication.'
        );
      }
      subjectLines.push({
        subjectId: alloc.subject.id,
        subjectCode: alloc.subject.code,
        subjectName: alloc.subject.name,
        status: mark.status,
        score: mark.score,
        maxMark: alloc.subject.maxMark,
        ...computeSubjectGrade(mark.status, mark.score, alloc.subject.maxMark),
        teacherComment: mark.teacherComment,
        teacherName: alloc.teacherMembership.user.name
      });
    }

    if (subjectLines.length === 0) {
      return null;
    }

    return {
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status,
        phone: school.phone,
        timezone: school.timezone
      },
      publicationState: 'PUBLISHED',
      academicYearLabel: pack.academicTerm.academicYear.label,
      academicTermLabel: pack.academicTerm.label,
      termNumber: pack.academicTerm.termNumber,
      className: pack.schoolClass.name,
      gradeLevel: pack.schoolClass.gradeLevel,
      classTeacherName: pack.schoolClass.classTeacher?.user.name ?? null,
      approvedByName: pack.approvedBy?.user.name ?? null,
      approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
      publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
      learner: {
        id: studentLink.learner.id,
        admissionNumber: studentLink.learner.admissionNumber,
        firstName: studentLink.learner.firstName,
        lastName: studentLink.learner.lastName,
        guardianName: studentLink.learner.guardianName,
        preferredChannel: studentLink.learner.preferredChannel
      },
      subjects: subjectLines,
      summary: computeReportSummary(subjectLines)
    };
  }
}

// ============================================================================
// In-Memory Implementation (Unit Tests & Non-Production Synthetic Sandbox)
// ============================================================================

interface MemUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  passwordHash: string | null;
  platformRole: PlatformRole;
  status: UserAccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface MemSchool {
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

interface MemMembership {
  id: string;
  schoolId: string;
  userId: string;
  role: SchoolRole;
  status: MembershipStatus;
  staffCode: string | null;
  createdAt: Date;
}

interface MemAcademicYear {
  id: string;
  schoolId: string;
  year: number;
  label: string;
  isCurrent: boolean;
  startsOn: Date;
  endsOn: Date;
}

interface MemAcademicTerm {
  id: string;
  schoolId: string;
  academicYearId: string;
  termNumber: TermNumber;
  label: string;
  isCurrent: boolean;
  startsOn: Date;
  endsOn: Date;
}

interface MemClass {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  gradeLevel: number;
  classTeacherMembershipId: string | null;
}

interface MemSubject {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  isCore: boolean;
  maxMark: number;
  active: boolean;
}

interface MemAllocation {
  id: string;
  schoolId: string;
  schoolClassId: string;
  subjectId: string;
  teacherMembershipId: string;
}

interface MemLearner {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  schoolClassId: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  preferredChannel: CommunicationChannel;
  active: boolean;
}

interface MemGuardianLink {
  id: string;
  schoolId: string;
  membershipId: string;
  learnerId: string;
  relationship: string;
}

interface MemStudentLink {
  id: string;
  schoolId: string;
  membershipId: string;
  learnerId: string;
  verificationMethod: StudentVerificationMethod;
  verifiedByMembershipId: string | null;
  verifiedAt: Date;
}

interface MemEnrolmentCode {
  id: string;
  schoolId: string;
  learnerId: string;
  codeHash: string;
  codeHint: string;
  expiresAt: Date;
  usedAt: Date | null;
  usedByUserId: string | null;
  revokedAt: Date | null;
  revokedByMembershipId: string | null;
  createdByMembershipId: string;
  createdAt: Date;
}

interface MemRegistrationRequest {
  id: string;
  schoolId: string;
  userId: string;
  membershipId: string;
  claimedAdmissionNo: string;
  claimedName: string;
  claimedClassNote: string | null;
  status: StudentRegistrationStatus;
  approvedLearnerId: string | null;
  reviewedByMembershipId: string | null;
  reviewedAt: Date | null;
  decisionNotes: string | null;
  createdAt: Date;
}

interface MemAnnouncement {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  postedByMembershipId: string;
  active: boolean;
  publishedAt: Date;
}

interface MemResultPack {
  id: string;
  schoolId: string;
  academicTermId: string;
  schoolClassId: string;
  status: ResultPackStatus;
  reviewNotes: string | null;
  submittedAt: Date | null;
  submittedByMembershipId: string | null;
  reviewedAt: Date | null;
  reviewedByMembershipId: string | null;
  approvedAt: Date | null;
  approvedByMembershipId: string | null;
  publishedAt: Date | null;
  publishedByMembershipId: string | null;
  createdAt: Date;
}

interface MemSubjectMark {
  id: string;
  schoolId: string;
  termResultPackId: string;
  learnerId: string;
  subjectId: string;
  status: MarkEntryStatus;
  score: number | null;
  teacherComment: string | null;
  enteredByMembershipId: string | null;
  enteredAt: Date | null;
}

interface MemAuditEvent {
  id: string;
  schoolId: string | null;
  actorUserId: string | null;
  actorMembershipId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export class InMemoryEducationRepository implements EducationRepository {
  private readonly users = new Map<string, MemUser>();
  private readonly schools = new Map<string, MemSchool>();
  private readonly memberships = new Map<string, MemMembership>();
  private readonly academicYears = new Map<string, MemAcademicYear>();
  private readonly academicTerms = new Map<string, MemAcademicTerm>();
  private readonly classes = new Map<string, MemClass>();
  private readonly subjects = new Map<string, MemSubject>();
  private readonly allocations = new Map<string, MemAllocation>();
  private readonly learners = new Map<string, MemLearner>();
  private readonly guardianLinks = new Map<string, MemGuardianLink>();
  private readonly studentLinks = new Map<string, MemStudentLink>();
  private readonly enrolmentCodes = new Map<string, MemEnrolmentCode>();
  private readonly registrationRequests = new Map<string, MemRegistrationRequest>();
  private readonly announcements = new Map<string, MemAnnouncement>();
  private readonly resultPacks = new Map<string, MemResultPack>();
  private readonly subjectMarks = new Map<string, MemSubjectMark>();
  private readonly auditEvents: MemAuditEvent[] = [];

  private nextId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  seedUser(input: {
    id?: string;
    email: string | null;
    phone?: string | null;
    name: string;
    passwordHash: string | null;
    platformRole?: PlatformRole;
    status?: UserAccountStatus;
  }): MemUser {
    const now = new Date();
    const id = input.id ?? this.nextId('usr');
    const record: MemUser = {
      id,
      email: input.email ? normalizeEmail(input.email) : null,
      phone: input.phone ?? null,
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      platformRole: input.platformRole ?? 'STANDARD',
      status: input.status ?? 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, record);
    return record;
  }

  seedSchool(input: {
    id?: string;
    code: string;
    registrationNumber?: string | null;
    name: string;
    sector: SchoolSector;
    province: string;
    district: string;
    levelSummary?: string | null;
    publicDescription?: string | null;
    phone?: string | null;
    email?: string | null;
    timezone?: string;
    isSyntheticDemo?: boolean;
    studentPortalEnabled?: boolean;
    status?: SchoolStatus;
  }): MemSchool {
    const id = input.id ?? this.nextId('sch');
    const record: MemSchool = {
      id,
      code: input.code,
      registrationNumber: input.registrationNumber ?? null,
      name: input.name,
      sector: input.sector,
      province: input.province,
      district: input.district,
      levelSummary: input.levelSummary ?? null,
      publicDescription: input.publicDescription ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      timezone: input.timezone ?? 'Africa/Lusaka',
      isSyntheticDemo: input.isSyntheticDemo ?? true,
      studentPortalEnabled: input.studentPortalEnabled ?? false,
      status: input.status ?? 'PILOT_PREP'
    };
    this.schools.set(id, record);
    return record;
  }

  seedStudentLink(input: {
    id?: string;
    schoolId: string;
    membershipId: string;
    learnerId: string;
    verificationMethod: StudentVerificationMethod;
    verifiedByMembershipId?: string | null;
    verifiedAt?: Date;
  }): MemStudentLink {
    const id = input.id ?? this.nextId('slk');
    const record: MemStudentLink = {
      id,
      schoolId: input.schoolId,
      membershipId: input.membershipId,
      learnerId: input.learnerId,
      verificationMethod: input.verificationMethod,
      verifiedByMembershipId: input.verifiedByMembershipId ?? null,
      verifiedAt: input.verifiedAt ?? new Date()
    };
    this.studentLinks.set(id, record);
    return record;
  }

  seedEnrolmentCode(input: {
    id?: string;
    schoolId: string;
    learnerId: string;
    plainCode: string;
    expiresAt: Date;
    createdByMembershipId: string;
    usedAt?: Date | null;
    usedByUserId?: string | null;
    revokedAt?: Date | null;
  }): MemEnrolmentCode {
    const id = input.id ?? this.nextId('ecd');
    const record: MemEnrolmentCode = {
      id,
      schoolId: input.schoolId,
      learnerId: input.learnerId,
      codeHash: hashEnrolmentCode(input.plainCode),
      codeHint: formatEnrolmentCodeHint(input.plainCode),
      expiresAt: input.expiresAt,
      usedAt: input.usedAt ?? null,
      usedByUserId: input.usedByUserId ?? null,
      revokedAt: input.revokedAt ?? null,
      revokedByMembershipId: null,
      createdByMembershipId: input.createdByMembershipId,
      createdAt: new Date()
    };
    this.enrolmentCodes.set(id, record);
    return record;
  }

  seedRegistrationRequest(input: {
    id?: string;
    schoolId: string;
    userId: string;
    membershipId: string;
    claimedAdmissionNo: string;
    claimedName: string;
    claimedClassNote?: string | null;
    status?: StudentRegistrationStatus;
    createdAt?: Date;
  }): MemRegistrationRequest {
    const id = input.id ?? this.nextId('srq');
    const record: MemRegistrationRequest = {
      id,
      schoolId: input.schoolId,
      userId: input.userId,
      membershipId: input.membershipId,
      claimedAdmissionNo: normalizeAdmissionNumber(input.claimedAdmissionNo),
      claimedName: input.claimedName.trim(),
      claimedClassNote: input.claimedClassNote ?? null,
      status: input.status ?? 'PENDING',
      approvedLearnerId: null,
      reviewedByMembershipId: null,
      reviewedAt: null,
      decisionNotes: null,
      createdAt: input.createdAt ?? new Date()
    };
    this.registrationRequests.set(id, record);
    return record;
  }

  seedAnnouncement(input: {
    id?: string;
    schoolId: string;
    title: string;
    body: string;
    audience?: AnnouncementAudience;
    postedByMembershipId: string;
    active?: boolean;
    publishedAt?: Date;
  }): MemAnnouncement {
    const id = input.id ?? this.nextId('ann');
    const record: MemAnnouncement = {
      id,
      schoolId: input.schoolId,
      title: input.title,
      body: input.body,
      audience: input.audience ?? 'STUDENTS_AND_STAFF',
      postedByMembershipId: input.postedByMembershipId,
      active: input.active ?? true,
      publishedAt: input.publishedAt ?? new Date()
    };
    this.announcements.set(id, record);
    return record;
  }

  seedMembership(input: {
    id?: string;
    schoolId: string;
    userId: string;
    role: SchoolRole;
    status?: MembershipStatus;
    staffCode?: string | null;
  }): MemMembership {
    const id = input.id ?? this.nextId('mem');
    const record: MemMembership = {
      id,
      schoolId: input.schoolId,
      userId: input.userId,
      role: input.role,
      status: input.status ?? 'ACTIVE',
      staffCode: input.staffCode ?? null,
      createdAt: new Date()
    };
    this.memberships.set(id, record);
    return record;
  }

  seedAcademicYear(input: {
    id?: string;
    schoolId: string;
    year: number;
    label: string;
    isCurrent?: boolean;
    startsOn: Date;
    endsOn: Date;
  }): MemAcademicYear {
    const id = input.id ?? this.nextId('yr');
    const record: MemAcademicYear = {
      id,
      schoolId: input.schoolId,
      year: input.year,
      label: input.label,
      isCurrent: input.isCurrent ?? false,
      startsOn: input.startsOn,
      endsOn: input.endsOn
    };
    this.academicYears.set(id, record);
    return record;
  }

  seedAcademicTerm(input: {
    id?: string;
    schoolId: string;
    academicYearId: string;
    termNumber: TermNumber;
    label: string;
    isCurrent?: boolean;
    startsOn: Date;
    endsOn: Date;
  }): MemAcademicTerm {
    const id = input.id ?? this.nextId('trm');
    const record: MemAcademicTerm = {
      id,
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      termNumber: input.termNumber,
      label: input.label,
      isCurrent: input.isCurrent ?? false,
      startsOn: input.startsOn,
      endsOn: input.endsOn
    };
    this.academicTerms.set(id, record);
    return record;
  }

  seedClass(input: {
    id?: string;
    schoolId: string;
    academicYearId: string;
    name: string;
    gradeLevel: number;
    classTeacherMembershipId?: string | null;
  }): MemClass {
    const id = input.id ?? this.nextId('cls');
    const record: MemClass = {
      id,
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      name: input.name,
      gradeLevel: input.gradeLevel,
      classTeacherMembershipId: input.classTeacherMembershipId ?? null
    };
    this.classes.set(id, record);
    return record;
  }

  seedSubject(input: {
    id?: string;
    schoolId: string;
    code: string;
    name: string;
    isCore?: boolean;
    maxMark?: number;
    active?: boolean;
  }): MemSubject {
    const id = input.id ?? this.nextId('sub');
    const record: MemSubject = {
      id,
      schoolId: input.schoolId,
      code: input.code,
      name: input.name,
      isCore: input.isCore ?? true,
      maxMark: input.maxMark ?? 100,
      active: input.active ?? true
    };
    this.subjects.set(id, record);
    return record;
  }

  seedAllocation(input: {
    id?: string;
    schoolId: string;
    schoolClassId: string;
    subjectId: string;
    teacherMembershipId: string;
  }): MemAllocation {
    const id = input.id ?? this.nextId('alc');
    const record: MemAllocation = {
      id,
      schoolId: input.schoolId,
      schoolClassId: input.schoolClassId,
      subjectId: input.subjectId,
      teacherMembershipId: input.teacherMembershipId
    };
    this.allocations.set(id, record);
    return record;
  }

  seedLearner(input: {
    id?: string;
    schoolId: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    schoolClassId?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
    preferredChannel?: CommunicationChannel;
    active?: boolean;
  }): MemLearner {
    const id = input.id ?? this.nextId('lrn');
    const record: MemLearner = {
      id,
      schoolId: input.schoolId,
      admissionNumber: input.admissionNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      schoolClassId: input.schoolClassId ?? null,
      guardianName: input.guardianName ?? null,
      guardianPhone: input.guardianPhone ?? null,
      preferredChannel: input.preferredChannel ?? 'PRINT_REPORT',
      active: input.active ?? true
    };
    this.learners.set(id, record);
    return record;
  }

  seedGuardianLink(input: {
    id?: string;
    schoolId: string;
    membershipId: string;
    learnerId: string;
    relationship: string;
  }): MemGuardianLink {
    const id = input.id ?? this.nextId('glk');
    const record: MemGuardianLink = {
      id,
      schoolId: input.schoolId,
      membershipId: input.membershipId,
      learnerId: input.learnerId,
      relationship: input.relationship
    };
    this.guardianLinks.set(id, record);
    return record;
  }

  seedResultPack(input: {
    id?: string;
    schoolId: string;
    academicTermId: string;
    schoolClassId: string;
    status?: ResultPackStatus;
    reviewNotes?: string | null;
    submittedAt?: Date | null;
    submittedByMembershipId?: string | null;
    approvedAt?: Date | null;
    approvedByMembershipId?: string | null;
    publishedAt?: Date | null;
    publishedByMembershipId?: string | null;
  }): MemResultPack {
    const id = input.id ?? this.nextId('pck');
    const record: MemResultPack = {
      id,
      schoolId: input.schoolId,
      academicTermId: input.academicTermId,
      schoolClassId: input.schoolClassId,
      status: input.status ?? 'DRAFT',
      reviewNotes: input.reviewNotes ?? null,
      submittedAt: input.submittedAt ?? null,
      submittedByMembershipId: input.submittedByMembershipId ?? null,
      reviewedAt: input.approvedAt ?? null,
      reviewedByMembershipId: input.approvedByMembershipId ?? null,
      approvedAt: input.approvedAt ?? null,
      approvedByMembershipId: input.approvedByMembershipId ?? null,
      publishedAt: input.publishedAt ?? null,
      publishedByMembershipId: input.publishedByMembershipId ?? null,
      createdAt: new Date()
    };
    this.resultPacks.set(id, record);
    return record;
  }

  seedSubjectMark(input: {
    id?: string;
    schoolId: string;
    termResultPackId: string;
    learnerId: string;
    subjectId: string;
    status: MarkEntryStatus;
    score: number | null;
    teacherComment?: string | null;
    enteredByMembershipId?: string | null;
    enteredAt?: Date | null;
  }): MemSubjectMark {
    const id = input.id ?? this.nextId('mrk');
    const record: MemSubjectMark = {
      id,
      schoolId: input.schoolId,
      termResultPackId: input.termResultPackId,
      learnerId: input.learnerId,
      subjectId: input.subjectId,
      status: input.status,
      score: input.score,
      teacherComment: input.teacherComment ?? null,
      enteredByMembershipId: input.enteredByMembershipId ?? null,
      enteredAt: input.enteredAt ?? (input.status === 'PENDING' ? null : new Date())
    };
    this.subjectMarks.set(`${input.termResultPackId}:${input.learnerId}:${input.subjectId}`, record);
    return record;
  }

  private hydrateUser(user: MemUser): StoredUserWithMemberships {
    const memberships = [...this.memberships.values()]
      .filter((m) => m.userId === user.id)
      .map((m) => {
        const school = this.schools.get(m.schoolId)!;
        return {
          id: m.id,
          schoolId: m.schoolId,
          role: m.role,
          status: m.status,
          staffCode: m.staffCode,
          school: {
            id: school.id,
            code: school.code,
            name: school.name,
            sector: school.sector,
            province: school.province,
            district: school.district,
            isSyntheticDemo: school.isSyntheticDemo,
            status: school.status
          }
        };
      });

    return {
      ...user,
      memberships
    };
  }

  private membershipUserName(membershipId: string | null): string | null {
    if (!membershipId) return null;
    const mem = this.memberships.get(membershipId);
    if (!mem) return null;
    return this.users.get(mem.userId)?.name ?? null;
  }

  private appendAudit(
    event: Omit<MemAuditEvent, 'id' | 'createdAt' | 'beforeState' | 'afterState' | 'metadata'> & {
      beforeState?: Record<string, unknown> | null;
      afterState?: Record<string, unknown> | null;
      metadata?: Record<string, unknown> | null;
    }
  ): void {
    this.auditEvents.push({
      ...event,
      beforeState: event.beforeState ?? null,
      afterState: event.afterState ?? null,
      metadata: event.metadata ?? null,
      id: this.nextId('aud'),
      createdAt: new Date()
    });
  }

  getAllAuditEvents(): MemAuditEvent[] {
    return [...this.auditEvents];
  }

  async findUserByEmail(email: string): Promise<StoredUserWithMemberships | null> {
    const normalized = normalizeEmail(email);
    for (const user of this.users.values()) {
      if (user.email === normalized) {
        return this.hydrateUser(user);
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<StoredUserWithMemberships | null> {
    const user = this.users.get(id);
    return user ? this.hydrateUser(user) : null;
  }

  async recordPlatformAuditEvent(input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.appendAudit({
      schoolId: null,
      actorUserId: input.actorUserId,
      actorMembershipId: null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: null,
      afterState: null,
      metadata: input.metadata ?? null
    });
  }

  async getSchoolOverview(access: SchoolAccessContext): Promise<SchoolOverviewDto | null> {
    const scope = schoolScope(access);
    const school = this.schools.get(scope.schoolId);
    if (!school || school.status === 'SUSPENDED') {
      return null;
    }

    const viewerMemberships = [...this.memberships.values()].filter(
      (m) =>
        m.schoolId === scope.schoolId &&
        m.userId === access.actorUserId &&
        m.status === 'ACTIVE'
    );
    const viewerMembershipIds = new Set(viewerMemberships.map((m) => m.id));
    const isLeadership = hasAnyRole(access.roles, LEADERSHIP_ROLES);

    const currentYear =
      [...this.academicYears.values()].find(
        (y) => y.schoolId === scope.schoolId && y.isCurrent
      ) ?? null;
    const currentTerm =
      [...this.academicTerms.values()].find(
        (t) => t.schoolId === scope.schoolId && t.isCurrent
      ) ?? null;

    const mySubjectAllocations: TeacherAllocationDto[] = [...this.allocations.values()]
      .filter(
        (a) =>
          a.schoolId === scope.schoolId &&
          viewerMembershipIds.has(a.teacherMembershipId) &&
          this.subjects.get(a.subjectId)?.active
      )
      .map((a) => {
        const cls = this.classes.get(a.schoolClassId)!;
        const sub = this.subjects.get(a.subjectId)!;
        return {
          allocationId: a.id,
          schoolClassId: cls.id,
          className: cls.name,
          subjectId: sub.id,
          subjectCode: sub.code,
          subjectName: sub.name
        };
      })
      .sort(
        (a, b) =>
          a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName)
      );

    const packs = [...this.resultPacks.values()]
      .filter((p) => p.schoolId === scope.schoolId)
      .sort((a, b) => {
        const termA = this.academicTerms.get(a.academicTermId)!;
        const termB = this.academicTerms.get(b.academicTermId)!;
        return termB.startsOn.getTime() - termA.startsOn.getTime();
      });

    const resultPacks: ResultPackSummaryDto[] = packs.map((pack) => {
      const cls = this.classes.get(pack.schoolClassId)!;
      const term = this.academicTerms.get(pack.academicTermId)!;
      const year = this.academicYears.get(term.academicYearId)!;

      const classLearners = [...this.learners.values()].filter(
        (l) => l.schoolId === scope.schoolId && l.schoolClassId === cls.id && l.active
      );
      const classAllocations = [...this.allocations.values()].filter(
        (a) =>
          a.schoolId === scope.schoolId &&
          a.schoolClassId === cls.id &&
          this.subjects.get(a.subjectId)?.active
      );

      const expectedEntries = classLearners.length * classAllocations.length;
      let recordedEntries = 0;
      for (const l of classLearners) {
        for (const a of classAllocations) {
          const mark = this.subjectMarks.get(`${pack.id}:${l.id}:${a.subjectId}`);
          if (mark && mark.status !== 'PENDING') {
            recordedEntries += 1;
          }
        }
      }

      const isClassOrSubjectTeacher =
        (cls.classTeacherMembershipId !== null &&
          viewerMembershipIds.has(cls.classTeacherMembershipId)) ||
        classAllocations.some((a) => viewerMembershipIds.has(a.teacherMembershipId));

      return {
        id: pack.id,
        schoolClassId: cls.id,
        className: cls.name,
        gradeLevel: cls.gradeLevel,
        academicTermId: term.id,
        termLabel: term.label,
        termNumber: term.termNumber,
        academicYearLabel: year.label,
        status: pack.status,
        reviewNotes: pack.reviewNotes,
        learnerCount: classLearners.length,
        subjectCount: classAllocations.length,
        expectedEntries,
        recordedEntries,
        missingCount: Math.max(0, expectedEntries - recordedEntries),
        submittedAt: pack.submittedAt ? pack.submittedAt.toISOString() : null,
        approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
        publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
        canOpen: isLeadership || isClassOrSubjectTeacher
      };
    });

    return {
      school: { ...school },
      viewerRoles: access.roles,
      currentAcademicYear: currentYear
        ? { id: currentYear.id, year: currentYear.year, label: currentYear.label }
        : null,
      currentTerm: currentTerm
        ? {
            id: currentTerm.id,
            termNumber: currentTerm.termNumber,
            label: currentTerm.label
          }
        : null,
      mySubjectAllocations,
      resultPacks
    };
  }

  async getResultPackDetail(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto | null> {
    const scope = schoolScope(access);
    const pack = this.resultPacks.get(packId);
    if (!pack || pack.schoolId !== scope.schoolId) {
      return null;
    }
    const school = this.schools.get(scope.schoolId);
    if (!school || school.status === 'SUSPENDED') {
      return null;
    }

    const viewerMemberships = [...this.memberships.values()].filter(
      (m) =>
        m.schoolId === scope.schoolId &&
        m.userId === access.actorUserId &&
        m.status === 'ACTIVE'
    );
    const viewerMembershipIds = new Set(viewerMemberships.map((m) => m.id));
    const isLeadership = hasAnyRole(access.roles, LEADERSHIP_ROLES);
    const isApprovalAuthority = hasAnyRole(access.roles, APPROVAL_ROLES);

    const cls = this.classes.get(pack.schoolClassId)!;
    const term = this.academicTerms.get(pack.academicTermId)!;
    const year = this.academicYears.get(term.academicYearId)!;

    const classAllocations = [...this.allocations.values()]
      .filter(
        (a) =>
          a.schoolId === scope.schoolId &&
          a.schoolClassId === cls.id &&
          this.subjects.get(a.subjectId)?.active
      )
      .sort((a, b) => {
        const subA = this.subjects.get(a.subjectId)!;
        const subB = this.subjects.get(b.subjectId)!;
        return Number(subB.isCore) - Number(subA.isCore) || subA.name.localeCompare(subB.name);
      });

    const isClassTeacher =
      cls.classTeacherMembershipId !== null &&
      viewerMembershipIds.has(cls.classTeacherMembershipId);
    const hasSubjectAllocation = classAllocations.some((a) =>
      viewerMembershipIds.has(a.teacherMembershipId)
    );

    if (!isLeadership && !isClassTeacher && !hasSubjectAllocation) {
      throw new DomainRuleError(
        403,
        'CLASS_ACCESS_DENIED',
        'Teachers may only open result packs for classes to which they are allocated.'
      );
    }

    const packEditableState = pack.status === 'DRAFT' || pack.status === 'NEEDS_REVISION';

    const subjects: PackSubjectColumnDto[] = classAllocations.map((a) => {
      const sub = this.subjects.get(a.subjectId)!;
      return {
        subjectId: sub.id,
        code: sub.code,
        name: sub.name,
        isCore: sub.isCore,
        maxMark: sub.maxMark,
        teacherMembershipId: a.teacherMembershipId,
        teacherName: this.membershipUserName(a.teacherMembershipId) ?? 'Assigned Teacher',
        canEdit: packEditableState && viewerMembershipIds.has(a.teacherMembershipId)
      };
    });

    const learners: PackLearnerRowDto[] = [...this.learners.values()]
      .filter((l) => l.schoolId === scope.schoolId && l.schoolClassId === cls.id && l.active)
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.admissionNumber.localeCompare(b.admissionNumber)
      )
      .map((l) => ({
        learnerId: l.id,
        admissionNumber: l.admissionNumber,
        firstName: l.firstName,
        lastName: l.lastName,
        preferredChannel: l.preferredChannel
      }));

    const marks: PackMarkCellDto[] = [];
    const markLookup = new Map<string, { status: MarkEntryStatus }>();
    for (const learner of learners) {
      for (const subject of subjects) {
        const stored = this.subjectMarks.get(
          `${pack.id}:${learner.learnerId}:${subject.subjectId}`
        );
        if (stored) {
          markLookup.set(`${learner.learnerId}:${subject.subjectId}`, {
            status: stored.status
          });
        }
        marks.push({
          learnerId: learner.learnerId,
          subjectId: subject.subjectId,
          status: stored?.status ?? 'PENDING',
          score: stored?.score ?? null,
          teacherComment: stored?.teacherComment ?? null,
          enteredByName: this.membershipUserName(stored?.enteredByMembershipId ?? null),
          enteredAt: stored?.enteredAt ? stored.enteredAt.toISOString() : null
        });
      }
    }

    const completeness = computeCompleteness(
      learners,
      subjects.map((s) => ({ subjectId: s.subjectId, code: s.code, name: s.name })),
      markLookup
    );

    return {
      id: pack.id,
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status
      },
      academicYear: { id: year.id, year: year.year, label: year.label },
      academicTerm: { id: term.id, termNumber: term.termNumber, label: term.label },
      schoolClass: {
        id: cls.id,
        name: cls.name,
        gradeLevel: cls.gradeLevel,
        classTeacherName: this.membershipUserName(cls.classTeacherMembershipId)
      },
      status: pack.status,
      reviewNotes: pack.reviewNotes,
      submittedAt: pack.submittedAt ? pack.submittedAt.toISOString() : null,
      submittedByName: this.membershipUserName(pack.submittedByMembershipId),
      reviewedAt: pack.reviewedAt ? pack.reviewedAt.toISOString() : null,
      reviewedByName: this.membershipUserName(pack.reviewedByMembershipId),
      approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
      approvedByName: this.membershipUserName(pack.approvedByMembershipId),
      publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
      publishedByName: this.membershipUserName(pack.publishedByMembershipId),
      subjects,
      learners,
      marks,
      completeness,
      permissions: {
        canEditAllocatedMarks: subjects.some((s) => s.canEdit),
        canSubmit:
          packEditableState &&
          completeness.readyForSubmission &&
          (isLeadership || isClassTeacher || hasSubjectAllocation),
        canRequestRevision:
          isLeadership && (pack.status === 'SUBMITTED' || pack.status === 'APPROVED'),
        canApprove:
          isApprovalAuthority &&
          pack.status === 'SUBMITTED' &&
          completeness.readyForSubmission,
        canPublish:
          isApprovalAuthority &&
          pack.status === 'APPROVED' &&
          completeness.readyForSubmission,
        canViewReportCards: pack.status === 'APPROVED' || pack.status === 'PUBLISHED'
      }
    };
  }

  async recordSubjectMarks(
    access: SchoolAccessContext,
    packId: string,
    entries: MarkEntryWriteInput[]
  ): Promise<ResultPackDetailDto> {
    const scope = schoolScope(access);
    const pack = this.resultPacks.get(packId);
    if (!pack || pack.schoolId !== scope.schoolId) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }
    if (pack.status !== 'DRAFT' && pack.status !== 'NEEDS_REVISION') {
      throw new DomainRuleError(
        409,
        'RESULT_PACK_LOCKED',
        `Marks cannot be modified while the result pack is ${pack.status}. Return the pack for revision first.`
      );
    }

    const teacherMemberships = [...this.memberships.values()].filter(
      (m) =>
        m.schoolId === scope.schoolId &&
        m.userId === access.actorUserId &&
        m.role === 'TEACHER' &&
        m.status === 'ACTIVE'
    );
    const teacherMembershipIds = new Set(teacherMemberships.map((m) => m.id));

    const classAllocations = [...this.allocations.values()].filter(
      (a) =>
        a.schoolId === scope.schoolId &&
        a.schoolClassId === pack.schoolClassId &&
        this.subjects.get(a.subjectId)?.active
    );
    const allocationBySubject = new Map(classAllocations.map((a) => [a.subjectId, a]));

    const validLearnerIds = new Set(
      [...this.learners.values()]
        .filter(
          (l) =>
            l.schoolId === scope.schoolId &&
            l.schoolClassId === pack.schoolClassId &&
            l.active
        )
        .map((l) => l.id)
    );

    for (const entry of entries) {
      if (!validLearnerIds.has(entry.learnerId)) {
        throw new DomainRuleError(
          400,
          'INVALID_LEARNER_FOR_CLASS',
          'One or more learners do not belong to this active class.'
        );
      }
      const allocation = allocationBySubject.get(entry.subjectId);
      if (!allocation) {
        throw new DomainRuleError(
          400,
          'INVALID_SUBJECT_FOR_CLASS',
          'Subject is not allocated to this class.'
        );
      }
      const subject = this.subjects.get(entry.subjectId)!;
      if (!teacherMembershipIds.has(allocation.teacherMembershipId)) {
        throw new DomainRuleError(
          403,
          'SUBJECT_ALLOCATION_REQUIRED',
          `Only the allocated subject teacher may enter or modify ${subject.name} marks.`
        );
      }
      if (entry.status === 'PRESENT' && entry.score !== null && entry.score > subject.maxMark) {
        throw new DomainRuleError(
          400,
          'SCORE_OUT_OF_RANGE',
          `Score for ${subject.name} cannot exceed ${subject.maxMark}.`
        );
      }
    }

    const now = new Date();
    for (const entry of entries) {
      const allocation = allocationBySubject.get(entry.subjectId)!;
      const subject = this.subjects.get(entry.subjectId)!;
      const key = `${pack.id}:${entry.learnerId}:${entry.subjectId}`;
      const previous = this.subjectMarks.get(key);
      const id = previous?.id ?? this.nextId('mrk');

      const record: MemSubjectMark = {
        id,
        schoolId: scope.schoolId,
        termResultPackId: pack.id,
        learnerId: entry.learnerId,
        subjectId: entry.subjectId,
        status: entry.status,
        score: entry.score,
        teacherComment: entry.teacherComment,
        enteredByMembershipId:
          entry.status === 'PENDING' ? null : allocation.teacherMembershipId,
        enteredAt: entry.status === 'PENDING' ? null : now
      };
      this.subjectMarks.set(key, record);

      this.appendAudit({
        schoolId: scope.schoolId,
        actorUserId: access.actorUserId,
        actorMembershipId: allocation.teacherMembershipId,
        action: previous ? 'MARK_UPDATED' : 'MARK_RECORDED',
        entityType: 'SubjectMark',
        entityId: id,
        beforeState: previous
          ? {
              status: previous.status,
              score: previous.score,
              teacherComment: previous.teacherComment
            }
          : null,
        afterState: {
          status: entry.status,
          score: entry.score,
          teacherComment: entry.teacherComment
        },
        metadata: {
          termResultPackId: pack.id,
          learnerId: entry.learnerId,
          subjectCode: subject.code
        }
      });
    }

    return (await this.getResultPackDetail(access, packId))!;
  }

  async submitResultPack(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto> {
    const scope = schoolScope(access);
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }
    if (detail.status !== 'DRAFT' && detail.status !== 'NEEDS_REVISION') {
      throw new DomainRuleError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot submit a result pack whose status is ${detail.status}.`
      );
    }
    if (!detail.completeness.readyForSubmission) {
      throw new DomainRuleError(
        409,
        'INCOMPLETE_MARKS',
        `Cannot submit results: ${detail.completeness.missingCount} subject mark entry/entries are still missing.`,
        {
          missingCount: detail.completeness.missingCount,
          missingItems: detail.completeness.missingItems.slice(0, 10)
        }
      );
    }

    const pack = this.resultPacks.get(packId)!;
    const previousStatus = pack.status;
    pack.status = 'SUBMITTED';
    pack.submittedAt = new Date();
    pack.submittedByMembershipId = access.actorMembershipId;

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'RESULT_PACK_SUBMITTED',
      entityType: 'TermResultPack',
      entityId: packId,
      beforeState: { status: previousStatus },
      afterState: { status: 'SUBMITTED' },
      metadata: { className: detail.schoolClass.name, term: detail.academicTerm.label }
    });

    return (await this.getResultPackDetail(access, packId))!;
  }

  async requestResultPackRevision(
    access: SchoolAccessContext,
    packId: string,
    reviewNotes: string
  ): Promise<ResultPackDetailDto> {
    if (!hasAnyRole(access.roles, LEADERSHIP_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only school leadership can return a result pack for revision.'
      );
    }
    const scope = schoolScope(access);
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }
    if (detail.status !== 'SUBMITTED' && detail.status !== 'APPROVED') {
      throw new DomainRuleError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot return a ${detail.status} result pack for revision.`
      );
    }

    const pack = this.resultPacks.get(packId)!;
    const previousStatus = pack.status;
    pack.status = 'NEEDS_REVISION';
    pack.reviewNotes = reviewNotes.trim();
    pack.reviewedAt = new Date();
    pack.reviewedByMembershipId = access.actorMembershipId;
    pack.approvedAt = null;
    pack.approvedByMembershipId = null;

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'RESULT_PACK_RETURNED_FOR_REVISION',
      entityType: 'TermResultPack',
      entityId: packId,
      beforeState: { status: previousStatus },
      afterState: { status: 'NEEDS_REVISION', reviewNotes: pack.reviewNotes },
      metadata: { className: detail.schoolClass.name }
    });

    return (await this.getResultPackDetail(access, packId))!;
  }

  async approveResultPack(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto> {
    if (!hasAnyRole(access.roles, APPROVAL_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only a Head Teacher or School Administrator may approve term results.'
      );
    }
    const scope = schoolScope(access);
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }
    if (detail.status !== 'SUBMITTED') {
      throw new DomainRuleError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Only SUBMITTED result packs can be approved (current status: ${detail.status}).`
      );
    }
    if (!detail.completeness.readyForSubmission) {
      throw new DomainRuleError(
        409,
        'INCOMPLETE_MARKS',
        `Cannot approve results with ${detail.completeness.missingCount} missing mark entry/entries.`
      );
    }

    const pack = this.resultPacks.get(packId)!;
    const now = new Date();
    pack.status = 'APPROVED';
    pack.reviewedAt = now;
    pack.reviewedByMembershipId = access.actorMembershipId;
    pack.approvedAt = now;
    pack.approvedByMembershipId = access.actorMembershipId;

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'RESULT_PACK_APPROVED',
      entityType: 'TermResultPack',
      entityId: packId,
      beforeState: { status: 'SUBMITTED' },
      afterState: { status: 'APPROVED' },
      metadata: { className: detail.schoolClass.name, term: detail.academicTerm.label }
    });

    return (await this.getResultPackDetail(access, packId))!;
  }

  async publishResultPack(
    access: SchoolAccessContext,
    packId: string
  ): Promise<ResultPackDetailDto> {
    if (!hasAnyRole(access.roles, APPROVAL_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only a Head Teacher or School Administrator may publish term results.'
      );
    }
    const scope = schoolScope(access);
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      throw new DomainRuleError(404, 'NOT_FOUND', 'Result pack not found for this school.');
    }
    if (detail.status !== 'APPROVED') {
      throw new DomainRuleError(
        409,
        'APPROVAL_REQUIRED_BEFORE_PUBLICATION',
        `Results must be explicitly APPROVED before publication (current status: ${detail.status}).`
      );
    }
    if (!detail.completeness.readyForSubmission) {
      throw new DomainRuleError(
        409,
        'INCOMPLETE_MARKS',
        'Cannot publish incomplete results.'
      );
    }

    const pack = this.resultPacks.get(packId)!;
    pack.status = 'PUBLISHED';
    pack.publishedAt = new Date();
    pack.publishedByMembershipId = access.actorMembershipId;

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'RESULT_PACK_PUBLISHED',
      entityType: 'TermResultPack',
      entityId: packId,
      beforeState: { status: 'APPROVED' },
      afterState: { status: 'PUBLISHED' },
      metadata: { className: detail.schoolClass.name, term: detail.academicTerm.label }
    });

    return (await this.getResultPackDetail(access, packId))!;
  }

  async getReportCardForStaff(
    access: SchoolAccessContext,
    packId: string,
    learnerId: string
  ): Promise<ReportCardDto | null> {
    const detail = await this.getResultPackDetail(access, packId);
    if (!detail) {
      return null;
    }
    if (detail.status !== 'APPROVED' && detail.status !== 'PUBLISHED') {
      throw new DomainRuleError(
        409,
        'REPORT_CARD_NOT_APPROVED',
        'Printable report cards require explicit approval before generation.'
      );
    }

    const scope = schoolScope(access);
    const school = this.schools.get(scope.schoolId);
    const learner = this.learners.get(learnerId);
    if (
      !school ||
      !learner ||
      learner.schoolId !== scope.schoolId ||
      learner.schoolClassId !== detail.schoolClass.id
    ) {
      return null;
    }

    const subjectLines: ReportCardSubjectLineDto[] = detail.subjects.map((sub) => {
      const mark = this.subjectMarks.get(`${packId}:${learnerId}:${sub.subjectId}`);
      if (!mark || mark.status === 'PENDING') {
        throw new DomainRuleError(
          409,
          'INCOMPLETE_MARKS',
          'Cannot render report card while subject marks remain pending.'
        );
      }
      return {
        subjectId: sub.subjectId,
        subjectCode: sub.code,
        subjectName: sub.name,
        status: mark.status,
        score: mark.score,
        maxMark: sub.maxMark,
        ...computeSubjectGrade(mark.status, mark.score, sub.maxMark),
        teacherComment: mark.teacherComment,
        teacherName: sub.teacherName
      };
    });

    return {
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status,
        phone: school.phone,
        timezone: school.timezone
      },
      publicationState: detail.status === 'PUBLISHED' ? 'PUBLISHED' : 'APPROVED_PREVIEW',
      academicYearLabel: detail.academicYear.label,
      academicTermLabel: detail.academicTerm.label,
      termNumber: detail.academicTerm.termNumber,
      className: detail.schoolClass.name,
      gradeLevel: detail.schoolClass.gradeLevel,
      classTeacherName: detail.schoolClass.classTeacherName,
      approvedByName: detail.approvedByName,
      approvedAt: detail.approvedAt,
      publishedAt: detail.publishedAt,
      learner: {
        id: learner.id,
        admissionNumber: learner.admissionNumber,
        firstName: learner.firstName,
        lastName: learner.lastName,
        guardianName: learner.guardianName,
        preferredChannel: learner.preferredChannel
      },
      subjects: subjectLines,
      summary: computeReportSummary(subjectLines)
    };
  }

  async getGuardianPublishedResults(
    access: SchoolAccessContext
  ): Promise<GuardianResultsOverviewDto | null> {
    if (!access.roles.includes('PARENT_GUARDIAN')) {
      throw new DomainRuleError(403, 'FORBIDDEN', 'Guardian role required.');
    }
    const scope = schoolScope(access);
    const school = this.schools.get(scope.schoolId);
    if (!school || school.status === 'SUSPENDED') {
      return null;
    }

    const guardianMembership = [...this.memberships.values()].find(
      (m) =>
        m.schoolId === scope.schoolId &&
        m.userId === access.actorUserId &&
        m.role === 'PARENT_GUARDIAN' &&
        m.status === 'ACTIVE'
    );
    if (!guardianMembership) {
      return null;
    }

    const links = [...this.guardianLinks.values()]
      .filter((l) => l.schoolId === scope.schoolId && l.membershipId === guardianMembership.id)
      .map((l) => ({ link: l, learner: this.learners.get(l.learnerId)! }))
      .filter(({ learner }) => Boolean(learner) && learner.active);

    // STRICT SECURITY INVARIANT: Only PUBLISHED packs are ever read for guardians.
    const publishedPacks = [...this.resultPacks.values()]
      .filter((p) => p.schoolId === scope.schoolId && p.status === 'PUBLISHED')
      .sort(
        (a, b) =>
          (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
      );

    const learners: GuardianLearnerResultsDto[] = links.map(({ link, learner }) => {
      const currentClass = learner.schoolClassId
        ? this.classes.get(learner.schoolClassId) ?? null
        : null;
      const publishedReports: Array<{ packId: string; reportCard: ReportCardDto }> = [];

      for (const pack of publishedPacks) {
        const cls = this.classes.get(pack.schoolClassId)!;
        const term = this.academicTerms.get(pack.academicTermId)!;
        const year = this.academicYears.get(term.academicYearId)!;

        const classAllocations = [...this.allocations.values()]
          .filter(
            (a) =>
              a.schoolId === scope.schoolId &&
              a.schoolClassId === cls.id &&
              this.subjects.get(a.subjectId)?.active
          )
          .sort((a, b) => {
            const subA = this.subjects.get(a.subjectId)!;
            const subB = this.subjects.get(b.subjectId)!;
            return Number(subB.isCore) - Number(subA.isCore) || subA.name.localeCompare(subB.name);
          });

        const subjectLines: ReportCardSubjectLineDto[] = [];
        let hasAnyMark = false;
        let complete = true;

        for (const alloc of classAllocations) {
          const mark = this.subjectMarks.get(
            `${pack.id}:${learner.id}:${alloc.subjectId}`
          );
          if (!mark) {
            complete = false;
            continue;
          }
          hasAnyMark = true;
          if (mark.status === 'PENDING') {
            complete = false;
            break;
          }
          const sub = this.subjects.get(alloc.subjectId)!;
          subjectLines.push({
            subjectId: sub.id,
            subjectCode: sub.code,
            subjectName: sub.name,
            status: mark.status,
            score: mark.score,
            maxMark: sub.maxMark,
            ...computeSubjectGrade(mark.status, mark.score, sub.maxMark),
            teacherComment: mark.teacherComment,
            teacherName: this.membershipUserName(alloc.teacherMembershipId) ?? 'Assigned Teacher'
          });
        }

        if (!hasAnyMark || !complete || subjectLines.length === 0) {
          continue;
        }

        publishedReports.push({
          packId: pack.id,
          reportCard: {
            school: {
              id: school.id,
              code: school.code,
              name: school.name,
              sector: school.sector,
              province: school.province,
              district: school.district,
              isSyntheticDemo: school.isSyntheticDemo,
              status: school.status,
              phone: school.phone,
              timezone: school.timezone
            },
            publicationState: 'PUBLISHED',
            academicYearLabel: year.label,
            academicTermLabel: term.label,
            termNumber: term.termNumber,
            className: cls.name,
            gradeLevel: cls.gradeLevel,
            classTeacherName: this.membershipUserName(cls.classTeacherMembershipId),
            approvedByName: this.membershipUserName(pack.approvedByMembershipId),
            approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
            publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
            learner: {
              id: learner.id,
              admissionNumber: learner.admissionNumber,
              firstName: learner.firstName,
              lastName: learner.lastName,
              guardianName: learner.guardianName,
              preferredChannel: learner.preferredChannel
            },
            subjects: subjectLines,
            summary: computeReportSummary(subjectLines)
          }
        });
      }

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
    });

    return {
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status
      },
      learners
    };
  }

  async listSchoolAuditEvents(access: SchoolAccessContext): Promise<AuditEventDto[]> {
    if (!hasAnyRole(access.roles, LEADERSHIP_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only school leadership can view the school audit trail.'
      );
    }
    const scope = schoolScope(access);
    return [...this.auditEvents]
      .filter((ev) => ev.schoolId === scope.schoolId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100)
      .map((ev) => ({
        id: ev.id,
        schoolId: ev.schoolId,
        action: ev.action,
        entityType: ev.entityType,
        entityId: ev.entityId,
        actorName: ev.actorUserId ? (this.users.get(ev.actorUserId)?.name ?? null) : null,
        actorRole: ev.actorMembershipId
          ? (this.memberships.get(ev.actorMembershipId)?.role ?? null)
          : null,
        beforeState: ev.beforeState,
        afterState: ev.afterState,
        metadata: ev.metadata,
        createdAt: ev.createdAt.toISOString()
      }));
  }

  private toMemPublicSchoolDto(school: MemSchool): PublicSchoolProfileDto {
    const currentYear = [...this.academicYears.values()].find(
      (yr) => yr.schoolId === school.id && yr.isCurrent
    );
    const canSelfRegister =
      school.status !== 'SUSPENDED' && school.studentPortalEnabled === true;

    return {
      id: school.id,
      code: school.code,
      registrationNumber: school.registrationNumber,
      name: school.name,
      sector: school.sector,
      province: school.province,
      district: school.district,
      levelSummary: school.levelSummary,
      publicDescription: school.publicDescription,
      phone: school.phone,
      email: school.email,
      status: school.status,
      isSyntheticDemo: school.isSyntheticDemo,
      studentPortalEnabled: school.studentPortalEnabled,
      canSelfRegister,
      currentAcademicYearLabel: currentYear?.label ?? null
    };
  }

  async listPublicSchools(
    filters: PublicSchoolSearchFilters
  ): Promise<PublicSchoolProfileDto[]> {
    const q = filters.q?.trim().toLowerCase();
    const prov = filters.province?.trim().toLowerCase();

    return [...this.schools.values()]
      .filter((school) => {
        if (school.status === 'SUSPENDED') return false;
        if (prov && school.province.toLowerCase() !== prov) return false;
        if (filters.sector && school.sector !== filters.sector) return false;
        if (filters.portalOnly && !school.studentPortalEnabled) return false;
        if (q) {
          const haystack = [
            school.name,
            school.code,
            school.registrationNumber ?? '',
            school.province,
            school.district,
            school.levelSummary ?? ''
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.studentPortalEnabled !== b.studentPortalEnabled) {
          return a.studentPortalEnabled ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map((s) => this.toMemPublicSchoolDto(s));
  }

  async getPublicSchoolProfile(codeOrId: string): Promise<PublicSchoolProfileDto | null> {
    const needle = codeOrId.trim().toLowerCase();
    const match = [...this.schools.values()].find(
      (s) =>
        s.status !== 'SUSPENDED' &&
        (s.code.toLowerCase() === needle || s.id.toLowerCase() === needle)
    );
    return match ? this.toMemPublicSchoolDto(match) : null;
  }

  private findMemStudentLinkByLearner(learnerId: string): MemStudentLink | undefined {
    for (const link of this.studentLinks.values()) {
      if (link.learnerId === learnerId) {
        return link;
      }
    }
    return undefined;
  }

  private findMemStudentLinkByMembership(membershipId: string): MemStudentLink | undefined {
    for (const link of this.studentLinks.values()) {
      if (link.membershipId === membershipId) {
        return link;
      }
    }
    return undefined;
  }

  async registerStudentAccount(
    input: RegisterStudentAccountInput
  ): Promise<RegisterStudentAccountResult> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedAdm = normalizeAdmissionNumber(input.admissionNumber);

    const school = this.schools.get(input.schoolId);
    if (!school || school.status === 'SUSPENDED' || !school.studentPortalEnabled) {
      throw new DomainRuleError(
        403,
        'STUDENT_PORTAL_NOT_ENABLED',
        'Student portal self-registration is not enabled for this school.'
      );
    }

    for (const existing of this.users.values()) {
      if (existing.email === normalizedEmail) {
        throw new DomainRuleError(
          409,
          'ACCOUNT_EMAIL_CONFLICT',
          'Unable to create a student account with this email address. Sign in if you have already registered, or contact your school office.'
        );
      }
    }

    if (input.verificationMode === 'ENROLMENT_CODE') {
      if (!input.enrolmentCode) {
        throw new DomainRuleError(
          400,
          'INVALID_ENROLMENT_VERIFICATION',
          'Enrolment verification failed. Confirm your school, learner admission number, and active single-use enrolment code with your school office.'
        );
      }
      const codeHash = hashEnrolmentCode(input.enrolmentCode);
      const now = new Date();

      const codeRecord = [...this.enrolmentCodes.values()].find(
        (c) => c.schoolId === school.id && c.codeHash === codeHash
      );
      const learner = codeRecord ? this.learners.get(codeRecord.learnerId) : undefined;
      const existingLearnerLink = learner
        ? this.findMemStudentLinkByLearner(learner.id)
        : undefined;

      if (
        !codeRecord ||
        !learner ||
        !learner.active ||
        normalizeAdmissionNumber(learner.admissionNumber) !== normalizedAdm ||
        codeRecord.revokedAt !== null ||
        codeRecord.usedAt !== null ||
        codeRecord.expiresAt.getTime() <= now.getTime() ||
        existingLearnerLink !== undefined
      ) {
        throw new DomainRuleError(
          400,
          'INVALID_ENROLMENT_VERIFICATION',
          'Enrolment verification failed. Confirm your school, learner admission number, and active single-use enrolment code with your school office.'
        );
      }

      const user = this.seedUser({
        email: normalizedEmail,
        name: input.fullName,
        passwordHash: input.passwordHash,
        platformRole: 'STANDARD',
        status: 'ACTIVE'
      });

      codeRecord.usedAt = now;
      codeRecord.usedByUserId = user.id;

      const membership = this.seedMembership({
        schoolId: school.id,
        userId: user.id,
        role: 'STUDENT',
        status: 'ACTIVE'
      });

      const link = this.seedStudentLink({
        schoolId: school.id,
        membershipId: membership.id,
        learnerId: learner.id,
        verificationMethod: 'ENROLMENT_CODE',
        verifiedByMembershipId: codeRecord.createdByMembershipId,
        verifiedAt: now
      });

      this.appendAudit({
        schoolId: school.id,
        actorUserId: user.id,
        actorMembershipId: membership.id,
        action: 'STUDENT_REGISTERED_VIA_CODE',
        entityType: 'LearnerStudentLink',
        entityId: link.id,
        afterState: {
          learnerId: learner.id,
          verificationMethod: 'ENROLMENT_CODE'
        },
        metadata: {
          enrolmentCodeId: codeRecord.id,
          codeHint: codeRecord.codeHint
        }
      });

      const hydrated = await this.findUserById(user.id);
      if (!hydrated) {
        throw new Error('Failed to load newly registered student user.');
      }

      return {
        outcome: 'VERIFIED',
        user: hydrated,
        schoolCode: school.code,
        requestId: null,
        message: 'Student account verified and linked to your school academic record.'
      };
    }

    const user = this.seedUser({
      email: normalizedEmail,
      name: input.fullName,
      passwordHash: input.passwordHash,
      platformRole: 'STANDARD',
      status: 'ACTIVE'
    });

    const membership = this.seedMembership({
      schoolId: school.id,
      userId: user.id,
      role: 'STUDENT',
      status: 'INACTIVE'
    });

    const reqRecord = this.seedRegistrationRequest({
      schoolId: school.id,
      userId: user.id,
      membershipId: membership.id,
      claimedAdmissionNo: normalizedAdm,
      claimedName: input.fullName,
      claimedClassNote: input.classHint,
      status: 'PENDING'
    });

    this.appendAudit({
      schoolId: school.id,
      actorUserId: user.id,
      actorMembershipId: membership.id,
      action: 'STUDENT_REGISTRATION_REQUESTED',
      entityType: 'StudentRegistrationRequest',
      entityId: reqRecord.id,
      afterState: {
        status: 'PENDING',
        claimedAdmissionNo: normalizedAdm
      }
    });

    const hydrated = await this.findUserById(user.id);
    if (!hydrated) {
      throw new Error('Failed to load newly created pending student user.');
    }

    return {
      outcome: 'PENDING_APPROVAL',
      user: hydrated,
      schoolCode: school.code,
      requestId: reqRecord.id,
      message:
        'Registration request submitted. Your school administration must verify your learner record before academic results become visible.'
    };
  }

  private assertMemLeadership(access: SchoolAccessContext): void {
    if (!hasAnyRole(access.roles, LEADERSHIP_ROLES)) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Only school leadership can manage learner enrolment and student portal verification.'
      );
    }
  }

  async getSchoolAdminPortalState(
    access: SchoolAccessContext
  ): Promise<SchoolAdminPortalStateDto | null> {
    this.assertMemLeadership(access);
    const scope = schoolScope(access);
    const school = this.schools.get(scope.schoolId);
    if (!school) {
      return null;
    }

    const now = new Date();
    const classes = [...this.classes.values()]
      .filter((c) => c.schoolId === scope.schoolId)
      .sort((a, b) => a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name));

    const schoolLearners = [...this.learners.values()]
      .filter((l) => l.schoolId === scope.schoolId)
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
      );

    const learnerByAdmission = new Map(
      schoolLearners.map((l) => [normalizeAdmissionNumber(l.admissionNumber), l])
    );

    const learnersDto: AdminRosterLearnerDto[] = schoolLearners.map((l) => {
      const cls = l.schoolClassId ? this.classes.get(l.schoolClassId) : undefined;
      const link = this.findMemStudentLinkByLearner(l.id);
      const linkedMem = link ? this.memberships.get(link.membershipId) : undefined;
      const linkedUser = linkedMem ? this.users.get(linkedMem.userId) : undefined;

      const activeCode = [...this.enrolmentCodes.values()]
        .filter(
          (c) =>
            c.schoolId === scope.schoolId &&
            c.learnerId === l.id &&
            c.usedAt === null &&
            c.revokedAt === null &&
            c.expiresAt.getTime() > now.getTime()
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      return {
        id: l.id,
        admissionNumber: l.admissionNumber,
        firstName: l.firstName,
        lastName: l.lastName,
        schoolClassId: l.schoolClassId,
        currentClassName: cls?.name ?? null,
        gradeLevel: cls?.gradeLevel ?? null,
        preferredChannel: l.preferredChannel,
        active: l.active,
        linkedStudent:
          link && linkedUser
            ? {
                userId: linkedUser.id,
                name: linkedUser.name,
                email: linkedUser.email,
                verificationMethod: link.verificationMethod,
                verifiedAt: link.verifiedAt.toISOString()
              }
            : null,
        activeEnrolmentCode: activeCode
          ? {
              id: activeCode.id,
              codeHint: activeCode.codeHint,
              expiresAt: activeCode.expiresAt.toISOString(),
              createdAt: activeCode.createdAt.toISOString()
            }
          : null
      };
    });

    const requestsDto: AdminRegistrationRequestDto[] = [
      ...this.registrationRequests.values()
    ]
      .filter((r) => r.schoolId === scope.schoolId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => {
        const applicant = this.users.get(r.userId);
        const suggested = learnerByAdmission.get(
          normalizeAdmissionNumber(r.claimedAdmissionNo)
        );
        const suggestedCls = suggested?.schoolClassId
          ? this.classes.get(suggested.schoolClassId)
          : undefined;
        return {
          id: r.id,
          userId: r.userId,
          applicantEmail: applicant?.email ?? null,
          claimedName: r.claimedName,
          claimedAdmissionNo: r.claimedAdmissionNo,
          claimedClassNote: r.claimedClassNote,
          status: r.status,
          decisionNotes: r.decisionNotes,
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
          reviewedByName: this.membershipUserName(r.reviewedByMembershipId),
          approvedLearnerId: r.approvedLearnerId,
          suggestedLearner: suggested
            ? {
                id: suggested.id,
                admissionNumber: suggested.admissionNumber,
                firstName: suggested.firstName,
                lastName: suggested.lastName,
                currentClassName: suggestedCls?.name ?? null,
                alreadyLinked: this.findMemStudentLinkByLearner(suggested.id) !== undefined
              }
            : null
        };
      });

    const announcementsDto: SchoolAnnouncementDto[] = [...this.announcements.values()]
      .filter((a) => a.schoolId === scope.schoolId && a.active)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .map((a) => ({
        id: a.id,
        schoolId: a.schoolId,
        title: a.title,
        body: a.body,
        audience: a.audience,
        postedByName: this.membershipUserName(a.postedByMembershipId) ?? 'School Administration',
        publishedAt: a.publishedAt.toISOString()
      }));

    return {
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status,
        registrationNumber: school.registrationNumber,
        levelSummary: school.levelSummary,
        studentPortalEnabled: school.studentPortalEnabled
      },
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        academicYearLabel: this.academicYears.get(c.academicYearId)?.label ?? ''
      })),
      learners: learnersDto,
      registrationRequests: requestsDto,
      announcements: announcementsDto
    };
  }

  async createSchoolLearner(
    access: SchoolAccessContext,
    input: {
      admissionNumber: string;
      firstName: string;
      lastName: string;
      schoolClassId: string;
      preferredChannel: CommunicationChannel;
    }
  ): Promise<AdminRosterLearnerDto> {
    this.assertMemLeadership(access);
    const scope = schoolScope(access);
    const normalizedAdm = normalizeAdmissionNumber(input.admissionNumber);

    const cls = this.classes.get(input.schoolClassId);
    if (!cls || cls.schoolId !== scope.schoolId) {
      throw new DomainRuleError(
        400,
        'INVALID_SCHOOL_CLASS',
        'Selected class does not belong to this school.'
      );
    }

    const duplicate = [...this.learners.values()].find(
      (l) =>
        l.schoolId === scope.schoolId &&
        normalizeAdmissionNumber(l.admissionNumber) === normalizedAdm
    );
    if (duplicate) {
      throw new DomainRuleError(
        409,
        'DUPLICATE_ADMISSION_NUMBER',
        `A learner with admission number ${normalizedAdm} already exists at this school.`
      );
    }

    const created = this.seedLearner({
      schoolId: scope.schoolId,
      admissionNumber: normalizedAdm,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      schoolClassId: cls.id,
      preferredChannel: input.preferredChannel,
      active: true
    });

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'LEARNER_CREATED',
      entityType: 'Learner',
      entityId: created.id,
      afterState: {
        admissionNumber: created.admissionNumber,
        schoolClassId: cls.id
      }
    });

    return {
      id: created.id,
      admissionNumber: created.admissionNumber,
      firstName: created.firstName,
      lastName: created.lastName,
      schoolClassId: cls.id,
      currentClassName: cls.name,
      gradeLevel: cls.gradeLevel,
      preferredChannel: created.preferredChannel,
      active: created.active,
      linkedStudent: null,
      activeEnrolmentCode: null
    };
  }

  async issueLearnerEnrolmentCode(
    access: SchoolAccessContext,
    learnerId: string,
    expiresInDays: number
  ): Promise<IssuedEnrolmentCodeDto> {
    this.assertMemLeadership(access);
    const scope = schoolScope(access);

    const learner = this.learners.get(learnerId);
    if (!learner || learner.schoolId !== scope.schoolId || !learner.active) {
      throw new DomainRuleError(
        404,
        'LEARNER_NOT_FOUND',
        'Active learner record not found in this school.'
      );
    }
    if (this.findMemStudentLinkByLearner(learner.id)) {
      throw new DomainRuleError(
        409,
        'LEARNER_ALREADY_LINKED',
        'This learner already has a verified student portal account.'
      );
    }

    const now = new Date();
    for (const c of this.enrolmentCodes.values()) {
      if (
        c.schoolId === scope.schoolId &&
        c.learnerId === learner.id &&
        c.usedAt === null &&
        c.revokedAt === null
      ) {
        c.revokedAt = now;
        c.revokedByMembershipId = access.actorMembershipId;
      }
    }

    const plainCode = generatePlainEnrolmentCode();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
    const createdCode = this.seedEnrolmentCode({
      schoolId: scope.schoolId,
      learnerId: learner.id,
      plainCode,
      expiresAt,
      createdByMembershipId: access.actorMembershipId
    });

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'STUDENT_ENROLMENT_CODE_ISSUED',
      entityType: 'StudentEnrolmentCode',
      entityId: createdCode.id,
      afterState: {
        learnerId: learner.id,
        codeHint: createdCode.codeHint,
        expiresAt: expiresAt.toISOString()
      }
    });

    return {
      id: createdCode.id,
      learnerId: learner.id,
      admissionNumber: learner.admissionNumber,
      learnerName: `${learner.firstName} ${learner.lastName}`,
      plainCode,
      codeHint: createdCode.codeHint,
      expiresAt: expiresAt.toISOString()
    };
  }

  async revokeLearnerEnrolmentCode(
    access: SchoolAccessContext,
    codeId: string
  ): Promise<void> {
    this.assertMemLeadership(access);
    const scope = schoolScope(access);
    const codeRecord = this.enrolmentCodes.get(codeId);
    if (!codeRecord || codeRecord.schoolId !== scope.schoolId) {
      throw new DomainRuleError(
        404,
        'ENROLMENT_CODE_NOT_FOUND',
        'Enrolment code not found in this school.'
      );
    }
    if (codeRecord.usedAt || codeRecord.revokedAt) {
      throw new DomainRuleError(
        409,
        'ENROLMENT_CODE_INACTIVE',
        'Enrolment code has already been used or revoked.'
      );
    }

    const now = new Date();
    codeRecord.revokedAt = now;
    codeRecord.revokedByMembershipId = access.actorMembershipId;

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'STUDENT_ENROLMENT_CODE_REVOKED',
      entityType: 'StudentEnrolmentCode',
      entityId: codeRecord.id,
      afterState: { revokedAt: now.toISOString() }
    });
  }

  async approveStudentRegistrationRequest(
    access: SchoolAccessContext,
    requestId: string,
    input: { learnerId: string; decisionNotes: string | null }
  ): Promise<AdminRegistrationRequestDto> {
    this.assertMemLeadership(access);
    const scope = schoolScope(access);
    const now = new Date();

    const reqRecord = this.registrationRequests.get(requestId);
    if (!reqRecord || reqRecord.schoolId !== scope.schoolId) {
      throw new DomainRuleError(
        404,
        'REGISTRATION_REQUEST_NOT_FOUND',
        'Student registration request not found in this school.'
      );
    }
    if (reqRecord.status !== 'PENDING') {
      throw new DomainRuleError(
        409,
        'REGISTRATION_REQUEST_ALREADY_DECIDED',
        `Registration request has already been ${reqRecord.status.toLowerCase()}.`
      );
    }
    if (reqRecord.userId === access.actorUserId) {
      throw new DomainRuleError(
        403,
        'SELF_APPROVAL_FORBIDDEN',
        'You cannot approve your own registration request.'
      );
    }

    const learner = this.learners.get(input.learnerId);
    if (!learner || learner.schoolId !== scope.schoolId || !learner.active) {
      throw new DomainRuleError(
        404,
        'LEARNER_NOT_FOUND',
        'Selected learner record not found or inactive in this school.'
      );
    }
    if (this.findMemStudentLinkByLearner(learner.id)) {
      throw new DomainRuleError(
        409,
        'LEARNER_ALREADY_LINKED',
        'Selected learner record is already linked to another student account.'
      );
    }
    if (this.findMemStudentLinkByMembership(reqRecord.membershipId)) {
      throw new DomainRuleError(
        409,
        'STUDENT_ALREADY_LINKED',
        'This student account is already linked to a learner record.'
      );
    }

    const membership = this.memberships.get(reqRecord.membershipId);
    if (membership) {
      membership.role = 'STUDENT';
      membership.status = 'ACTIVE';
    }

    const link = this.seedStudentLink({
      schoolId: scope.schoolId,
      membershipId: reqRecord.membershipId,
      learnerId: learner.id,
      verificationMethod: 'STAFF_APPROVAL',
      verifiedByMembershipId: access.actorMembershipId,
      verifiedAt: now
    });

    for (const c of this.enrolmentCodes.values()) {
      if (
        c.schoolId === scope.schoolId &&
        c.learnerId === learner.id &&
        c.usedAt === null &&
        c.revokedAt === null
      ) {
        c.revokedAt = now;
        c.revokedByMembershipId = access.actorMembershipId;
      }
    }

    reqRecord.status = 'APPROVED';
    reqRecord.approvedLearnerId = learner.id;
    reqRecord.reviewedByMembershipId = access.actorMembershipId;
    reqRecord.reviewedAt = now;
    reqRecord.decisionNotes = input.decisionNotes;

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'STUDENT_REGISTRATION_APPROVED',
      entityType: 'StudentRegistrationRequest',
      entityId: reqRecord.id,
      beforeState: { status: 'PENDING' },
      afterState: {
        status: 'APPROVED',
        learnerId: learner.id,
        studentLinkId: link.id
      }
    });

    const applicant = this.users.get(reqRecord.userId);
    const cls = learner.schoolClassId ? this.classes.get(learner.schoolClassId) : undefined;

    return {
      id: reqRecord.id,
      userId: reqRecord.userId,
      applicantEmail: applicant?.email ?? null,
      claimedName: reqRecord.claimedName,
      claimedAdmissionNo: reqRecord.claimedAdmissionNo,
      claimedClassNote: reqRecord.claimedClassNote,
      status: reqRecord.status,
      decisionNotes: reqRecord.decisionNotes,
      createdAt: reqRecord.createdAt.toISOString(),
      reviewedAt: reqRecord.reviewedAt.toISOString(),
      reviewedByName: this.membershipUserName(access.actorMembershipId),
      approvedLearnerId: learner.id,
      suggestedLearner: {
        id: learner.id,
        admissionNumber: learner.admissionNumber,
        firstName: learner.firstName,
        lastName: learner.lastName,
        currentClassName: cls?.name ?? null,
        alreadyLinked: true
      }
    };
  }

  async rejectStudentRegistrationRequest(
    access: SchoolAccessContext,
    requestId: string,
    input: { decisionNotes: string }
  ): Promise<AdminRegistrationRequestDto> {
    this.assertMemLeadership(access);
    const scope = schoolScope(access);
    const now = new Date();

    const reqRecord = this.registrationRequests.get(requestId);
    if (!reqRecord || reqRecord.schoolId !== scope.schoolId) {
      throw new DomainRuleError(
        404,
        'REGISTRATION_REQUEST_NOT_FOUND',
        'Student registration request not found in this school.'
      );
    }
    if (reqRecord.status !== 'PENDING') {
      throw new DomainRuleError(
        409,
        'REGISTRATION_REQUEST_ALREADY_DECIDED',
        `Registration request has already been ${reqRecord.status.toLowerCase()}.`
      );
    }

    const membership = this.memberships.get(reqRecord.membershipId);
    if (membership) {
      membership.status = 'INACTIVE';
    }

    reqRecord.status = 'REJECTED';
    reqRecord.reviewedByMembershipId = access.actorMembershipId;
    reqRecord.reviewedAt = now;
    reqRecord.decisionNotes = input.decisionNotes;

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'STUDENT_REGISTRATION_REJECTED',
      entityType: 'StudentRegistrationRequest',
      entityId: reqRecord.id,
      beforeState: { status: 'PENDING' },
      afterState: {
        status: 'REJECTED',
        decisionNotes: input.decisionNotes
      }
    });

    const applicant = this.users.get(reqRecord.userId);
    return {
      id: reqRecord.id,
      userId: reqRecord.userId,
      applicantEmail: applicant?.email ?? null,
      claimedName: reqRecord.claimedName,
      claimedAdmissionNo: reqRecord.claimedAdmissionNo,
      claimedClassNote: reqRecord.claimedClassNote,
      status: reqRecord.status,
      decisionNotes: reqRecord.decisionNotes,
      createdAt: reqRecord.createdAt.toISOString(),
      reviewedAt: reqRecord.reviewedAt.toISOString(),
      reviewedByName: this.membershipUserName(access.actorMembershipId),
      approvedLearnerId: null,
      suggestedLearner: null
    };
  }

  async createSchoolAnnouncement(
    access: SchoolAccessContext,
    input: { title: string; body: string; audience: AnnouncementAudience }
  ): Promise<SchoolAnnouncementDto> {
    this.assertMemLeadership(access);
    const scope = schoolScope(access);

    const created = this.seedAnnouncement({
      schoolId: scope.schoolId,
      title: input.title.trim(),
      body: input.body.trim(),
      audience: input.audience,
      postedByMembershipId: access.actorMembershipId,
      active: true
    });

    this.appendAudit({
      schoolId: scope.schoolId,
      actorUserId: access.actorUserId,
      actorMembershipId: access.actorMembershipId,
      action: 'SCHOOL_ANNOUNCEMENT_POSTED',
      entityType: 'SchoolAnnouncement',
      entityId: created.id,
      afterState: {
        title: created.title,
        audience: created.audience
      }
    });

    return {
      id: created.id,
      schoolId: created.schoolId,
      title: created.title,
      body: created.body,
      audience: created.audience,
      postedByName:
        this.membershipUserName(created.postedByMembershipId) ?? 'School Administration',
      publishedAt: created.publishedAt.toISOString()
    };
  }

  async getStudentPortalOverview(userId: string): Promise<StudentPortalOverviewDto> {
    const user = this.users.get(userId);
    if (!user) {
      throw new DomainRuleError(404, 'USER_NOT_FOUND', 'Student user not found.');
    }

    const memberships = [...this.memberships.values()]
      .filter((m) => m.userId === userId && m.role === 'STUDENT')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const accounts: StudentPortalAccountDto[] = [];

    for (const m of memberships) {
      const school = this.schools.get(m.schoolId);
      if (!school) continue;

      const schoolSummary = {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status,
        registrationNumber: school.registrationNumber,
        levelSummary: school.levelSummary,
        phone: school.phone,
        email: school.email
      };

      const latestReq = [...this.registrationRequests.values()]
        .filter((r) => r.membershipId === m.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      const studentLink = this.findMemStudentLinkByMembership(m.id);
      const learner = studentLink ? this.learners.get(studentLink.learnerId) : undefined;

      if (m.status !== 'ACTIVE' || !studentLink || !learner || !learner.active) {
        const verificationState =
          latestReq?.status === 'REJECTED' ? 'REJECTED' : 'PENDING_APPROVAL';
        accounts.push({
          membershipId: m.id,
          school: schoolSummary,
          verificationState,
          learner: null,
          pendingRequest: latestReq
            ? {
                id: latestReq.id,
                claimedAdmissionNo: latestReq.claimedAdmissionNo,
                claimedClassNote: latestReq.claimedClassNote,
                status: latestReq.status,
                decisionNotes: latestReq.decisionNotes,
                createdAt: latestReq.createdAt.toISOString(),
                reviewedAt: latestReq.reviewedAt?.toISOString() ?? null
              }
            : null,
          termResults: [],
          announcements: []
        });
        continue;
      }

      const currentClass = learner.schoolClassId
        ? this.classes.get(learner.schoolClassId)
        : undefined;
      const classYear = currentClass
        ? this.academicYears.get(currentClass.academicYearId)
        : undefined;
      const currentYear = [...this.academicYears.values()].find(
        (yr) => yr.schoolId === school.id && yr.isCurrent
      );
      const currentTerm = [...this.academicTerms.values()].find(
        (trm) => trm.schoolId === school.id && trm.isCurrent
      );

      const classPacks = learner.schoolClassId
        ? [...this.resultPacks.values()]
            .filter(
              (p) =>
                p.schoolId === school.id && p.schoolClassId === learner.schoolClassId
            )
            .sort((a, b) => {
              const termA = this.academicTerms.get(a.academicTermId)?.startsOn.getTime() ?? 0;
              const termB = this.academicTerms.get(b.academicTermId)?.startsOn.getTime() ?? 0;
              return termB - termA;
            })
        : [];

      const termResults: StudentTermResultStatusDto[] = [];
      for (const pack of classPacks) {
        const term = this.academicTerms.get(pack.academicTermId);
        const year = term ? this.academicYears.get(term.academicYearId) : undefined;
        const cls = this.classes.get(pack.schoolClassId);
        if (!term || !year || !cls) continue;

        if (pack.status !== 'PUBLISHED') {
          termResults.push({
            packId: pack.id,
            academicYearLabel: year.label,
            academicTermLabel: term.label,
            termNumber: term.termNumber,
            className: cls.name,
            gradeLevel: cls.gradeLevel,
            publicationState: 'UNPUBLISHED',
            statusMessage: 'Results not yet published by school administration.',
            publishedAt: null,
            reportCard: null
          });
          continue;
        }

        const classAllocations = [...this.allocations.values()]
          .filter((a) => a.schoolId === school.id && a.schoolClassId === cls.id)
          .sort((a, b) => {
            const codeA = this.subjects.get(a.subjectId)?.code ?? '';
            const codeB = this.subjects.get(b.subjectId)?.code ?? '';
            return codeA.localeCompare(codeB);
          });

        const subjectLines: ReportCardSubjectLineDto[] = [];
        let complete = true;

        for (const alloc of classAllocations) {
          const mark = this.subjectMarks.get(
            `${pack.id}:${learner.id}:${alloc.subjectId}`
          );
          if (!mark || mark.status === 'PENDING') {
            complete = false;
            break;
          }
          const sub = this.subjects.get(alloc.subjectId)!;
          subjectLines.push({
            subjectId: sub.id,
            subjectCode: sub.code,
            subjectName: sub.name,
            status: mark.status,
            score: mark.score,
            maxMark: sub.maxMark,
            ...computeSubjectGrade(mark.status, mark.score, sub.maxMark),
            teacherComment: mark.teacherComment,
            teacherName:
              this.membershipUserName(alloc.teacherMembershipId) ?? 'Assigned Teacher'
          });
        }

        if (!complete || subjectLines.length === 0) {
          termResults.push({
            packId: pack.id,
            academicYearLabel: year.label,
            academicTermLabel: term.label,
            termNumber: term.termNumber,
            className: cls.name,
            gradeLevel: cls.gradeLevel,
            publicationState: 'UNPUBLISHED',
            statusMessage: 'Results not yet published by school administration.',
            publishedAt: null,
            reportCard: null
          });
          continue;
        }

        const reportCard: ReportCardDto = {
          school: {
            id: school.id,
            code: school.code,
            name: school.name,
            sector: school.sector,
            province: school.province,
            district: school.district,
            isSyntheticDemo: school.isSyntheticDemo,
            status: school.status,
            phone: school.phone,
            timezone: school.timezone
          },
          publicationState: 'PUBLISHED',
          academicYearLabel: year.label,
          academicTermLabel: term.label,
          termNumber: term.termNumber,
          className: cls.name,
          gradeLevel: cls.gradeLevel,
          classTeacherName: this.membershipUserName(cls.classTeacherMembershipId),
          approvedByName: this.membershipUserName(pack.approvedByMembershipId),
          approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
          publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
          learner: {
            id: learner.id,
            admissionNumber: learner.admissionNumber,
            firstName: learner.firstName,
            lastName: learner.lastName,
            guardianName: learner.guardianName,
            preferredChannel: learner.preferredChannel
          },
          subjects: subjectLines,
          summary: computeReportSummary(subjectLines)
        };

        termResults.push({
          packId: pack.id,
          academicYearLabel: year.label,
          academicTermLabel: term.label,
          termNumber: term.termNumber,
          className: cls.name,
          gradeLevel: cls.gradeLevel,
          publicationState: 'PUBLISHED',
          statusMessage: 'Official term results published.',
          publishedAt: reportCard.publishedAt,
          reportCard
        });
      }

      const schoolAnnouncements: SchoolAnnouncementDto[] = [...this.announcements.values()]
        .filter(
          (a) =>
            a.schoolId === school.id &&
            a.active &&
            a.audience === 'STUDENTS_AND_STAFF'
        )
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, 20)
        .map((a) => ({
          id: a.id,
          schoolId: a.schoolId,
          title: a.title,
          body: a.body,
          audience: a.audience,
          postedByName:
            this.membershipUserName(a.postedByMembershipId) ?? 'School Administration',
          publishedAt: a.publishedAt.toISOString()
        }));

      accounts.push({
        membershipId: m.id,
        school: schoolSummary,
        verificationState: 'VERIFIED',
        learner: {
          id: learner.id,
          admissionNumber: learner.admissionNumber,
          firstName: learner.firstName,
          lastName: learner.lastName,
          currentClassName: currentClass?.name ?? null,
          gradeLevel: currentClass?.gradeLevel ?? null,
          currentAcademicYearLabel: classYear?.label ?? currentYear?.label ?? null,
          currentTermLabel: currentTerm?.label ?? null,
          verificationMethod: studentLink.verificationMethod,
          verifiedAt: studentLink.verifiedAt.toISOString()
        },
        pendingRequest: null,
        termResults,
        announcements: schoolAnnouncements
      });
    }

    return {
      studentUser: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      accounts
    };
  }

  async getReportCardForStudent(
    access: SchoolAccessContext,
    packId: string,
    learnerId: string
  ): Promise<ReportCardDto | null> {
    if (!access.roles.includes('STUDENT')) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN',
        'Student report card endpoint requires a verified student school membership.'
      );
    }
    const scope = schoolScope(access);

    const studentLink = this.findMemStudentLinkByMembership(access.actorMembershipId);
    const learner = studentLink ? this.learners.get(studentLink.learnerId) : undefined;

    if (
      !studentLink ||
      studentLink.schoolId !== scope.schoolId ||
      !learner ||
      !learner.active ||
      learner.id !== learnerId
    ) {
      throw new DomainRuleError(
        403,
        'FORBIDDEN_LEARNER_ACCESS',
        'Students may only access their own verified academic record.'
      );
    }

    const school = this.schools.get(scope.schoolId);
    const pack = this.resultPacks.get(packId);
    if (!school || !pack || pack.schoolId !== scope.schoolId) {
      return null;
    }

    if (pack.status !== 'PUBLISHED') {
      throw new DomainRuleError(
        403,
        'RESULT_NOT_PUBLISHED',
        'This term result pack has not yet been published by school administration.'
      );
    }

    const term = this.academicTerms.get(pack.academicTermId);
    const year = term ? this.academicYears.get(term.academicYearId) : undefined;
    const cls = this.classes.get(pack.schoolClassId);
    if (!term || !year || !cls) {
      return null;
    }

    const classAllocations = [...this.allocations.values()]
      .filter((a) => a.schoolId === scope.schoolId && a.schoolClassId === cls.id)
      .sort((a, b) => {
        const codeA = this.subjects.get(a.subjectId)?.code ?? '';
        const codeB = this.subjects.get(b.subjectId)?.code ?? '';
        return codeA.localeCompare(codeB);
      });

    const subjectLines: ReportCardSubjectLineDto[] = [];
    for (const alloc of classAllocations) {
      const mark = this.subjectMarks.get(`${pack.id}:${learner.id}:${alloc.subjectId}`);
      if (!mark || mark.status === 'PENDING') {
        throw new DomainRuleError(
          403,
          'RESULT_NOT_PUBLISHED',
          'Results for this student record are not complete for publication.'
        );
      }
      const sub = this.subjects.get(alloc.subjectId)!;
      subjectLines.push({
        subjectId: sub.id,
        subjectCode: sub.code,
        subjectName: sub.name,
        status: mark.status,
        score: mark.score,
        maxMark: sub.maxMark,
        ...computeSubjectGrade(mark.status, mark.score, sub.maxMark),
        teacherComment: mark.teacherComment,
        teacherName:
          this.membershipUserName(alloc.teacherMembershipId) ?? 'Assigned Teacher'
      });
    }

    if (subjectLines.length === 0) {
      return null;
    }

    return {
      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        sector: school.sector,
        province: school.province,
        district: school.district,
        isSyntheticDemo: school.isSyntheticDemo,
        status: school.status,
        phone: school.phone,
        timezone: school.timezone
      },
      publicationState: 'PUBLISHED',
      academicYearLabel: year.label,
      academicTermLabel: term.label,
      termNumber: term.termNumber,
      className: cls.name,
      gradeLevel: cls.gradeLevel,
      classTeacherName: this.membershipUserName(cls.classTeacherMembershipId),
      approvedByName: this.membershipUserName(pack.approvedByMembershipId),
      approvedAt: pack.approvedAt ? pack.approvedAt.toISOString() : null,
      publishedAt: pack.publishedAt ? pack.publishedAt.toISOString() : null,
      learner: {
        id: learner.id,
        admissionNumber: learner.admissionNumber,
        firstName: learner.firstName,
        lastName: learner.lastName,
        guardianName: learner.guardianName,
        preferredChannel: learner.preferredChannel
      },
      subjects: subjectLines,
      summary: computeReportSummary(subjectLines)
    };
  }
}
