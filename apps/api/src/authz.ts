import type { Request, Response, NextFunction } from 'express';
export type Role = 'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN';
export interface AuthenticatedUser { id: string; role: Role }
declare global { namespace Express { interface Request { user?: AuthenticatedUser } } }
export function requireRole(...roles: Role[]) { return (req: Request, res: Response, next: NextFunction) => { if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } }); if (!roles.includes(req.user.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } }); next(); }; }
// Business-owned records must always be queried with both their ID and the authenticated owner's ID.
export function ownerScope(user: AuthenticatedUser) { if (user.role !== 'BUSINESS_OWNER') throw new Error('Owner scope requires a business owner'); return { ownerId: user.id }; }
