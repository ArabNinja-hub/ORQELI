import type { Request, Response, NextFunction } from 'express';

export type Role = 'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN';
export type UserAccountStatus = 'ACTIVE' | 'DISABLED' | 'SUSPENDED';
export type BusinessReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

export interface SafeBusinessSummary {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  city: string;
  location: string;
  phone: string;
  email: string | null;
  status: BusinessReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SafeUserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: Role;
  status: UserAccountStatus;
  createdAt: string;
  updatedAt: string;
  ownedBusinesses?: SafeBusinessSummary[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authUser?: SafeUserProfile;
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

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.'
        }
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.'
        }
      });
    }
    next();
  };
}

// Business-owned records must always be queried with both their ID and the authenticated owner's ID.
export function ownerScope(user: AuthenticatedUser): { ownerId: string } {
  if (user.role !== 'BUSINESS_OWNER') {
    throw new Error('Owner scope requires a business owner');
  }
  return { ownerId: user.id };
}
