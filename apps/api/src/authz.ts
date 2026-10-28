import type { Request, Response, NextFunction } from 'express';

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

export const STAFF_ROLES: readonly SchoolRole[] = [
  'SCHOOL_ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD',
  'TEACHER'
];

export const LEADERSHIP_ROLES: readonly SchoolRole[] = [
  'SCHOOL_ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD'
];

export const APPROVAL_ROLES: readonly SchoolRole[] = ['SCHOOL_ADMIN', 'HEAD_TEACHER'];

export interface SafeSchoolSummary {
  id: string;
  code: string;
  name: string;
  sector: SchoolSector;
  province: string;
  district: string;
  isSyntheticDemo: boolean;
  status: SchoolStatus;
}

export interface SafeMembershipSummary {
  id: string;
  schoolId: string;
  role: SchoolRole;
  status: MembershipStatus;
  staffCode: string | null;
  school: SafeSchoolSummary;
}

export interface SafeUserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  platformRole: PlatformRole;
  status: UserAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedUser {
  id: string;
  platformRole: PlatformRole;
}

export interface SchoolAccessContext {
  schoolId: string;
  actorUserId: string;
  actorMembershipId: string;
  roles: SchoolRole[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authUser?: SafeUserProfile;
      memberships?: SafeMembershipSummary[];
      schoolAccess?: SchoolAccessContext;
    }
  }
}

export function requireAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.'
        }
      });
    }
    next();
  };
}

export function requirePlatformRole(...roles: PlatformRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.'
        }
      });
    }
    if (!roles.includes(req.user.platformRole)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this platform action.'
        }
      });
    }
    next();
  };
}

/**
 * Enforces strict school-level tenant isolation and role-based access control on the server.
 * A user must hold an ACTIVE membership in the exact target `schoolId` (whose school is not
 * SUSPENDED) with at least one of `allowedRoles` before any school handler runs.
 */
export function requireSchoolRole(...allowedRoles: SchoolRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.'
        }
      });
    }

    const schoolId = typeof req.params.schoolId === 'string' ? req.params.schoolId.trim() : '';
    if (!schoolId || !/^[a-zA-Z0-9_-]{1,128}$/.test(schoolId)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid school identifier is required.'
        }
      });
    }

    const activeSchoolMemberships = (req.memberships ?? []).filter(
      (membership) =>
        membership.schoolId === schoolId &&
        membership.status === 'ACTIVE' &&
        membership.school.status !== 'SUSPENDED'
    );

    if (activeSchoolMemberships.length === 0) {
      return res.status(403).json({
        error: {
          code: 'SCHOOL_ACCESS_DENIED',
          message: 'You do not have active access to this school.'
        }
      });
    }

    const matchingMemberships =
      allowedRoles.length === 0
        ? activeSchoolMemberships
        : activeSchoolMemberships.filter((membership) => allowedRoles.includes(membership.role));

    if (matchingMemberships.length === 0) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Your role at this school does not permit this action.'
        }
      });
    }

    // Prefer the highest-authority matching membership as the primary actor membership ID.
    const rolePriority: Record<SchoolRole, number> = {
      SCHOOL_ADMIN: 1,
      HEAD_TEACHER: 2,
      DEPUTY_HEAD: 3,
      TEACHER: 4,
      PARENT_GUARDIAN: 5,
      STUDENT: 6
    };
    const sorted = [...matchingMemberships].sort(
      (a, b) => rolePriority[a.role] - rolePriority[b.role]
    );

    req.schoolAccess = {
      schoolId,
      actorUserId: req.user.id,
      actorMembershipId: sorted[0].id,
      roles: activeSchoolMemberships.map((m) => m.role)
    };

    next();
  };
}

/**
 * Mandatory tenant predicate helper for repository queries so school-scoped records are
 * never queried by record ID alone.
 */
export function schoolScope(access: SchoolAccessContext): { schoolId: string } {
  if (!access.schoolId || access.schoolId.trim().length === 0) {
    throw new Error('School scope requires a non-empty schoolId.');
  }
  return { schoolId: access.schoolId };
}
