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
import { normalizeEmail } from './schemas.js';

export type TermNumber = 'TERM_1' | 'TERM_2' | 'TERM_3';
export type ResultPackStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'PUBLISHED';
export type MarkEntryStatus = 'PENDING' | 'PRESENT' | 'ABSENT' | 'EXEMPT';
export type CommunicationChannel = 'PRINT_REPORT' | 'SMS_SUMMARY' | 'GUARDIAN_PORTAL';

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
    name: string;
    sector: SchoolSector;
    province: string;
    district: string;
    phone?: string | null;
    email?: string | null;
    timezone?: string;
    isSyntheticDemo?: boolean;
    status?: SchoolStatus;
  }): MemSchool {
    const id = input.id ?? this.nextId('sch');
    const record: MemSchool = {
      id,
      code: input.code,
      name: input.name,
      sector: input.sector,
      province: input.province,
      district: input.district,
      phone: input.phone ?? null,
      email: input.email ?? null,
      timezone: input.timezone ?? 'Africa/Lusaka',
      isSyntheticDemo: input.isSyntheticDemo ?? true,
      status: input.status ?? 'PILOT_PREP'
    };
    this.schools.set(id, record);
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

  private appendAudit(event: Omit<MemAuditEvent, 'id' | 'createdAt'>): void {
    this.auditEvents.push({
      ...event,
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
}
