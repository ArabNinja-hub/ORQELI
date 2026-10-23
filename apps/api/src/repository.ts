import { DISCOVERY_PAGE_SIZE, discoveryWhere, publicBusinessSelect, publicBusinessWhere,
  type DiscoveryQuery, type DiscoveryResult, type PublicBusiness, type PublicService } from './discovery.js';
import crypto from 'node:crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import {
  ownerScope,
  type AuthenticatedUser,
  type BusinessReviewStatus,
  type Role,
  type SafeBusinessSummary,
  type SafeUserProfile,
  type UserAccountStatus
} from './authz.js';

export interface StoredBusinessRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  city: string;
  location: string;
  phone: string;
  email: string | null;
  status: BusinessReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredUserRecord {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  passwordHash: string | null;
  role: Role;
  status: UserAccountStatus;
  // Version stored in the session at login; a mismatch means the credentials changed.
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
  ownedBusinesses: StoredBusinessRecord[];
}

export interface StoredPasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface SafeBookingSummary {
  id: string;
  reference: string;
  businessId: string;
  serviceId: string;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  startsAt: string;
  endsAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
}

export interface AdminBusinessItem extends SafeBusinessSummary {
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: UserAccountStatus;
  };
}

export interface StoredAuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface BusinessInput {
  name: string;
  description: string | null;
  city: string;
  location: string;
  phone: string;
  email: string | null;
}

export interface BusinessUpdateInput {
  name?: string;
  description?: string | null;
  city?: string;
  location?: string;
  phone?: string;
  email?: string | null;
}

export class DuplicateFieldError extends Error {
  readonly field: 'email' | 'phone';

  constructor(field: 'email' | 'phone') {
    super(`A user with this ${field} already exists.`);
    this.name = 'DuplicateFieldError';
    this.field = field;
  }
}

export class BusinessSuspendedError extends Error {
  constructor() {
    super('Suspended businesses cannot be modified by the business owner.');
    this.name = 'BusinessSuspendedError';
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) {
    return null;
  }
  const trimmed = phone.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

export function toSafeBusiness(record: StoredBusinessRecord): SafeBusinessSummary {
  return {
    id: record.id,
    ownerId: record.ownerId,
    name: record.name,
    description: record.description,
    city: record.city,
    location: record.location,
    phone: record.phone,
    email: record.email,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function toSafeUser(record: StoredUserRecord): SafeUserProfile {
  const safe: SafeUserProfile = {
    id: record.id,
    email: record.email,
    phone: record.phone,
    name: record.name,
    role: record.role,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
  if (record.role === 'BUSINESS_OWNER' || record.ownedBusinesses.length > 0) {
    safe.ownedBusinesses = record.ownedBusinesses.map(toSafeBusiness);
  }
  return safe;
}

export interface DataRepository {
  discoverBusinesses(query: DiscoveryQuery): Promise<DiscoveryResult>;
  getPublicBusiness(id: string, city: string): Promise<PublicBusiness | null>;
  findUserByEmail(email: string): Promise<StoredUserRecord | null>;
  findUserById(id: string): Promise<StoredUserRecord | null>;
  createCustomerUser(input: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<SafeUserProfile>;
  createBusinessOwnerWithBusiness(input: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
    business: BusinessInput;
  }): Promise<SafeUserProfile>;
  createAdminUser(input: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<SafeUserProfile>;
  createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findPasswordResetToken(tokenHash: string): Promise<StoredPasswordResetToken | null>;
  consumePasswordResetToken(input: {
    tokenId: string;
    userId: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean>;
  changePassword(input: { userId: string; passwordHash: string }): Promise<number>;
  /**
   * Deletes at most `limit` reset-token rows that are already unusable: expired
   * (`expiresAt < now`) or consumed (`usedAt` set). Returns the number of rows
   * deleted, so callers can loop until a bounded cleanup is complete.
   */
  deleteExpiredPasswordResetTokens(now: Date, limit: number): Promise<number>;
  /** Cheap dependency check used by the readiness endpoint. */
  ping(): Promise<boolean>;
  recordAuditEvent(input: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  listBookingsForCustomer(customerUserId: string): Promise<SafeBookingSummary[]>;
  listBusinessesForOwner(user: AuthenticatedUser): Promise<SafeBusinessSummary[]>;
  getBusinessForOwner(
    user: AuthenticatedUser,
    businessId: string
  ): Promise<SafeBusinessSummary | null>;
  createBusinessForOwner(
    user: AuthenticatedUser,
    input: BusinessInput
  ): Promise<SafeBusinessSummary>;
  updateBusinessForOwner(
    user: AuthenticatedUser,
    businessId: string,
    input: BusinessUpdateInput
  ): Promise<SafeBusinessSummary | null>;
  listAllBusinessesForAdmin(filter?: {
    status?: BusinessReviewStatus;
  }): Promise<AdminBusinessItem[]>;
  updateBusinessStatusForAdmin(
    adminUser: AuthenticatedUser,
    businessId: string,
    status: BusinessReviewStatus
  ): Promise<AdminBusinessItem | null>;
  listAllUsersForAdmin(): Promise<SafeUserProfile[]>;
  updateUserStatusForAdmin(
    adminUser: AuthenticatedUser,
    targetUserId: string,
    status: UserAccountStatus
  ): Promise<SafeUserProfile | null>;
}

function mapPrismaUnknownDuplicate(error: unknown): never {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  ) {
    const meta = (error as { meta?: { target?: unknown } }).meta;
    const target = Array.isArray(meta?.target)
      ? meta.target.map(String)
      : typeof meta?.target === 'string'
        ? [meta.target]
        : [];
    if (target.some((item) => item.toLowerCase().includes('phone'))) {
      throw new DuplicateFieldError('phone');
    }
    throw new DuplicateFieldError('email');
  }
  throw error;
}

export class PrismaDataRepository implements DataRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async discoverBusinesses(query: DiscoveryQuery): Promise<DiscoveryResult> {
    const rows = await this.prisma.business.findMany({
      where: discoveryWhere(query), select: publicBusinessSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * DISCOVERY_PAGE_SIZE, take: DISCOVERY_PAGE_SIZE + 1
    });
    return { businesses: rows.slice(0, DISCOVERY_PAGE_SIZE), page: query.page,
      hasMore: rows.length > DISCOVERY_PAGE_SIZE };
  }

  async getPublicBusiness(id: string, city: string): Promise<PublicBusiness | null> {
    return this.prisma.business.findFirst({
      where: { ...publicBusinessWhere(city), id }, select: publicBusinessSelect
    });
  }

  async findUserByEmail(email: string): Promise<StoredUserRecord | null> {
    const normalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: {
        ownedBusinesses: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    return user as StoredUserRecord | null;
  }

  async findUserById(id: string): Promise<StoredUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ownedBusinesses: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    return user as StoredUserRecord | null;
  }

  async createCustomerUser(input: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<SafeUserProfile> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedPhone = normalizePhone(input.phone);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: input.name.trim(),
            email: normalizedEmail,
            phone: normalizedPhone,
            passwordHash: input.passwordHash,
            role: 'CUSTOMER',
            status: 'ACTIVE'
          },
          include: {
            ownedBusinesses: true
          }
        });

        await tx.auditEvent.create({
          data: {
            actorId: user.id,
            action: 'USER_REGISTERED',
            entityType: 'User',
            entityId: user.id,
            metadata: { role: 'CUSTOMER' }
          }
        });

        return user;
      });

      return toSafeUser(created as StoredUserRecord);
    } catch (error) {
      mapPrismaUnknownDuplicate(error);
    }
  }

  async createBusinessOwnerWithBusiness(input: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
    business: BusinessInput;
  }): Promise<SafeUserProfile> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedPhone = normalizePhone(input.phone);
    const businessEmail = input.business.email ? normalizeEmail(input.business.email) : null;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: input.name.trim(),
            email: normalizedEmail,
            phone: normalizedPhone,
            passwordHash: input.passwordHash,
            role: 'BUSINESS_OWNER',
            status: 'ACTIVE',
            ownedBusinesses: {
              create: {
                name: input.business.name.trim(),
                description: input.business.description?.trim() || null,
                city: input.business.city.trim(),
                location: input.business.location.trim(),
                phone: input.business.phone.trim(),
                email: businessEmail,
                status: 'PENDING'
              }
            }
          },
          include: {
            ownedBusinesses: {
              orderBy: { createdAt: 'desc' }
            }
          }
        });

        const primaryBusiness = user.ownedBusinesses[0];
        if (primaryBusiness) {
          await tx.auditEvent.create({
            data: {
              actorId: user.id,
              action: 'BUSINESS_SUBMITTED',
              entityType: 'Business',
              entityId: primaryBusiness.id,
              metadata: {
                status: 'PENDING',
                city: primaryBusiness.city
              }
            }
          });
        }

        return user;
      });

      return toSafeUser(created as StoredUserRecord);
    } catch (error) {
      mapPrismaUnknownDuplicate(error);
    }
  }

  async createAdminUser(input: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<SafeUserProfile> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedPhone = normalizePhone(input.phone);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: input.name.trim(),
            email: normalizedEmail,
            phone: normalizedPhone,
            passwordHash: input.passwordHash,
            role: 'ADMIN',
            status: 'ACTIVE'
          },
          include: { ownedBusinesses: true }
        });

        // actorId is null: provisioning happens outside an authenticated request.
        await tx.auditEvent.create({
          data: {
            actorId: null,
            action: 'ADMIN_PROVISIONED',
            entityType: 'User',
            entityId: user.id,
            metadata: { source: 'cli', role: 'ADMIN' }
          }
        });

        return user;
      });

      return toSafeUser(created as StoredUserRecord);
    } catch (error) {
      mapPrismaUnknownDuplicate(error);
    }
  }

  /**
   * Serialises every credential-related write for one account by taking a row lock
   * on its `User` record. Without it, two concurrent reset requests can each miss
   * the other's uncommitted token (READ COMMITTED) and both stay valid, and a token
   * inserted by an in-flight request survives a concurrent password change.
   *
   * Every caller takes this lock first, so the lock order is consistent and
   * deadlock-free.
   */
  private async lockUserRow(
    tx: { $queryRaw: PrismaClient['$queryRaw'] },
    userId: string
  ): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUserRow(tx, input.userId);

      // Issuing a new token invalidates every outstanding one for this account.
      await tx.passwordResetToken.updateMany({
        where: { userId: input.userId, usedAt: null },
        data: { usedAt: new Date() }
      });
      await tx.passwordResetToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt
        }
      });
    });
  }

  async findPasswordResetToken(tokenHash: string): Promise<StoredPasswordResetToken | null> {
    const token = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    return (token as StoredPasswordResetToken | null) ?? null;
  }

  async consumePasswordResetToken(input: {
    tokenId: string;
    userId: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Same lock order as issuance and password change: user row first.
      await this.lockUserRow(tx, input.userId);

      // Conditional update: only one concurrent request can flip usedAt from null,
      // which makes the token strictly single-use even under a request race.
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: input.tokenId,
          userId: input.userId,
          usedAt: null,
          expiresAt: { gt: input.now }
        },
        data: { usedAt: input.now }
      });
      if (consumed.count !== 1) {
        return false;
      }

      const user = await tx.user.update({
        where: { id: input.userId },
        data: {
          passwordHash: input.passwordHash,
          sessionVersion: { increment: 1 }
        }
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: input.userId, usedAt: null },
        data: { usedAt: input.now }
      });

      await tx.auditEvent.create({
        data: {
          actorId: null,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: input.userId,
          metadata: { sessionVersion: user.sessionVersion }
        }
      });

      return true;
    });
  }

  async changePassword(input: { userId: string; passwordHash: string }): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      // Serialise against concurrent reset-token issuance: any token created after
      // this transaction commits is legitimately newer than the new password, and
      // any token already committed is revoked below.
      await this.lockUserRow(tx, input.userId);

      const user = await tx.user.update({
        where: { id: input.userId },
        data: {
          passwordHash: input.passwordHash,
          sessionVersion: { increment: 1 }
        }
      });

      // A password change also voids any outstanding reset token.
      await tx.passwordResetToken.updateMany({
        where: { userId: input.userId, usedAt: null },
        data: { usedAt: new Date() }
      });

      await tx.auditEvent.create({
        data: {
          actorId: input.userId,
          action: 'PASSWORD_CHANGED',
          entityType: 'User',
          entityId: input.userId,
          metadata: { sessionVersion: user.sessionVersion }
        }
      });

      return user.sessionVersion;
    });
  }

  async deleteExpiredPasswordResetTokens(now: Date, limit: number): Promise<number> {
    // Bounded delete: the sub-select caps the work per statement so housekeeping can
    // never lock the table for an unbounded amount of time.
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 1000));
    return this.prisma.$executeRaw`
      DELETE FROM "PasswordResetToken"
      WHERE "id" IN (
        SELECT "id" FROM "PasswordResetToken"
        WHERE "expiresAt" < ${now} OR "usedAt" IS NOT NULL
        ORDER BY "createdAt"
        LIMIT ${boundedLimit}
      )`;
  }

  async ping(): Promise<boolean> {
    await this.prisma.$queryRaw`SELECT 1`;
    return true;
  }

  async recordAuditEvent(input: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  }

  async listBookingsForCustomer(customerUserId: string): Promise<SafeBookingSummary[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { customerUserId },
      orderBy: { startsAt: 'desc' }
    });
    return bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      businessId: b.businessId,
      serviceId: b.serviceId,
      customerUserId: b.customerUserId,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      customerEmail: b.customerEmail,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString()
    }));
  }

  async listBusinessesForOwner(user: AuthenticatedUser): Promise<SafeBusinessSummary[]> {
    const scope = ownerScope(user);
    const businesses = await this.prisma.business.findMany({
      where: { ownerId: scope.ownerId },
      orderBy: { createdAt: 'desc' }
    });
    return businesses.map((b) => toSafeBusiness(b as StoredBusinessRecord));
  }

  async getBusinessForOwner(
    user: AuthenticatedUser,
    businessId: string
  ): Promise<SafeBusinessSummary | null> {
    const scope = ownerScope(user);
    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId: scope.ownerId
      }
    });
    return business ? toSafeBusiness(business as StoredBusinessRecord) : null;
  }

  async createBusinessForOwner(
    user: AuthenticatedUser,
    input: BusinessInput
  ): Promise<SafeBusinessSummary> {
    const scope = ownerScope(user);
    const businessEmail = input.email ? normalizeEmail(input.email) : null;

    const business = await this.prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: {
          ownerId: scope.ownerId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          city: input.city.trim(),
          location: input.location.trim(),
          phone: input.phone.trim(),
          email: businessEmail,
          status: 'PENDING'
        }
      });

      await tx.auditEvent.create({
        data: {
          actorId: scope.ownerId,
          action: 'BUSINESS_SUBMITTED',
          entityType: 'Business',
          entityId: created.id,
          metadata: { status: 'PENDING', city: created.city }
        }
      });

      return created;
    });

    return toSafeBusiness(business as StoredBusinessRecord);
  }

  async updateBusinessForOwner(
    user: AuthenticatedUser,
    businessId: string,
    input: BusinessUpdateInput
  ): Promise<SafeBusinessSummary | null> {
    const scope = ownerScope(user);
    const existing = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId: scope.ownerId
      }
    });
    if (!existing) {
      return null;
    }
    if (existing.status === 'SUSPENDED') {
      throw new BusinessSuspendedError();
    }

    const updated = await this.prisma.business.update({
      where: {
        id: existing.id,
        ownerId: scope.ownerId
      },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.city !== undefined ? { city: input.city.trim() } : {}),
        ...(input.location !== undefined ? { location: input.location.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        ...(input.email !== undefined
          ? { email: input.email ? normalizeEmail(input.email) : null }
          : {})
      }
    });

    return toSafeBusiness(updated as StoredBusinessRecord);
  }

  async listAllBusinessesForAdmin(filter?: {
    status?: BusinessReviewStatus;
  }): Promise<AdminBusinessItem[]> {
    const businesses = await this.prisma.business.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true
          }
        }
      }
    });

    return businesses.map((b) => ({
      ...toSafeBusiness(b as StoredBusinessRecord),
      owner: {
        id: b.owner.id,
        name: b.owner.name,
        email: b.owner.email,
        phone: b.owner.phone,
        status: b.owner.status
      }
    }));
  }

  async updateBusinessStatusForAdmin(
    adminUser: AuthenticatedUser,
    businessId: string,
    status: BusinessReviewStatus
  ): Promise<AdminBusinessItem | null> {
    if (adminUser.role !== 'ADMIN') {
      throw new Error('Administrator role required.');
    }

    const existing = await this.prisma.business.findUnique({
      where: { id: businessId }
    });
    if (!existing) {
      return null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.business.update({
        where: { id: businessId },
        data: { status },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true
            }
          }
        }
      });

      await tx.auditEvent.create({
        data: {
          actorId: adminUser.id,
          action: 'BUSINESS_STATUS_UPDATED',
          entityType: 'Business',
          entityId: businessId,
          metadata: {
            previousStatus: existing.status,
            status
          }
        }
      });

      return record;
    });

    return {
      ...toSafeBusiness(updated as StoredBusinessRecord),
      owner: {
        id: updated.owner.id,
        name: updated.owner.name,
        email: updated.owner.email,
        phone: updated.owner.phone,
        status: updated.owner.status
      }
    };
  }

  async listAllUsersForAdmin(): Promise<SafeUserProfile[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        ownedBusinesses: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    return users.map((u) => toSafeUser(u as StoredUserRecord));
  }

  async updateUserStatusForAdmin(
    adminUser: AuthenticatedUser,
    targetUserId: string,
    status: UserAccountStatus
  ): Promise<SafeUserProfile | null> {
    if (adminUser.role !== 'ADMIN') {
      throw new Error('Administrator role required.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: targetUserId }
    });
    if (!existing) {
      return null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: { status },
        include: {
          ownedBusinesses: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      await tx.auditEvent.create({
        data: {
          actorId: adminUser.id,
          action: 'USER_STATUS_UPDATED',
          entityType: 'User',
          entityId: targetUserId,
          metadata: {
            previousStatus: existing.status,
            status
          }
        }
      });

      return user;
    });

    return toSafeUser(updated as StoredUserRecord);
  }
}

export class InMemoryDataRepository implements DataRepository {
  private readonly publicServices = new Map<string, PublicService & { businessId: string; active: boolean }>();

  // Test-only fixtures. Production always uses PrismaDataRepository.
  seedService(service: PublicService & { businessId: string; active: boolean }): void {
    this.publicServices.set(service.id, service);
  }

  private publicRecord(record: StoredBusinessRecord): PublicBusiness | null {
    if (record.status !== 'APPROVED' || this.users.get(record.ownerId)?.status !== 'ACTIVE') return null;
    const services = [...this.publicServices.values()]
      .filter(service => service.businessId === record.id && service.active)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map(({ id, name, description, durationMinutes, priceMinorUnits, currency }) =>
        ({ id, name, description, durationMinutes, priceMinorUnits, currency }));
    const { id, name, description, city, location, phone, email } = record;
    return { id, name, description, city, location, phone, email, services };
  }

  async discoverBusinesses(query: DiscoveryQuery): Promise<DiscoveryResult> {
    const term = query.q.toLowerCase();
    const rows = [...this.businesses.values()]
      .filter(business => business.city.toLowerCase() === query.city.toLowerCase())
      .map(business => this.publicRecord(business))
      .filter((business): business is PublicBusiness => business !== null)
      .filter(business => !query.hasServices || business.services.length > 0)
      .filter(business => !term || [business.name, business.description ?? '', ...business.services.map(s => s.name)]
        .some(value => value.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const offset = (query.page - 1) * DISCOVERY_PAGE_SIZE;
    return { businesses: rows.slice(offset, offset + DISCOVERY_PAGE_SIZE), page: query.page,
      hasMore: rows.length > offset + DISCOVERY_PAGE_SIZE };
  }

  async getPublicBusiness(id: string, city: string): Promise<PublicBusiness | null> {
    const record = this.businesses.get(id);
    return record && record.city.toLowerCase() === city.toLowerCase() ? this.publicRecord(record) : null;
  }

  private readonly users = new Map<string, Omit<StoredUserRecord, 'ownedBusinesses'>>();
  private readonly businesses = new Map<string, StoredBusinessRecord>();
  private readonly bookings = new Map<string, SafeBookingSummary>();
  private readonly auditEvents: StoredAuditEvent[] = [];
  private readonly passwordResetTokens = new Map<string, StoredPasswordResetToken>();

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
  }

  private hydrateUser(
    user: Omit<StoredUserRecord, 'ownedBusinesses'>
  ): StoredUserRecord {
    const ownedBusinesses = Array.from(this.businesses.values())
      .filter((b) => b.ownerId === user.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      ...user,
      ownedBusinesses
    };
  }

  private assertUniqueEmailAndPhone(
    email: string | null,
    phone: string | null,
    excludeUserId?: string
  ): void {
    for (const existing of this.users.values()) {
      if (excludeUserId && existing.id === excludeUserId) {
        continue;
      }
      if (email && existing.email === email) {
        throw new DuplicateFieldError('email');
      }
      if (phone && existing.phone === phone) {
        throw new DuplicateFieldError('phone');
      }
    }
  }

  /**
   * Trusted server-side seeding helper for tests and administrative provisioning.
   */
  seedUser(input: {
    id?: string;
    name: string;
    email: string | null;
    phone?: string | null;
    passwordHash: string | null;
    role: Role;
    status?: UserAccountStatus;
    sessionVersion?: number;
  }): StoredUserRecord {
    const normalizedEmail = input.email ? normalizeEmail(input.email) : null;
    const normalizedPhone = normalizePhone(input.phone ?? null);
    this.assertUniqueEmailAndPhone(normalizedEmail, normalizedPhone);

    const now = new Date();
    const id = input.id ?? this.generateId('usr');
    const record: Omit<StoredUserRecord, 'ownedBusinesses'> = {
      id,
      email: normalizedEmail,
      phone: normalizedPhone,
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: input.role,
      status: input.status ?? 'ACTIVE',
      sessionVersion: input.sessionVersion ?? 0,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, record);
    return this.hydrateUser(record);
  }

  seedBusiness(input: {
    id?: string;
    ownerId: string;
    name: string;
    description?: string | null;
    city: string;
    location: string;
    phone: string;
    email?: string | null;
    status?: BusinessReviewStatus;
  }): StoredBusinessRecord {
    if (!this.users.has(input.ownerId)) {
      throw new Error(`Owner ${input.ownerId} does not exist.`);
    }
    const now = new Date();
    const id = input.id ?? this.generateId('biz');
    const record: StoredBusinessRecord = {
      id,
      ownerId: input.ownerId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      city: input.city.trim(),
      location: input.location.trim(),
      phone: input.phone.trim(),
      email: input.email ? normalizeEmail(input.email) : null,
      status: input.status ?? 'PENDING',
      createdAt: now,
      updatedAt: now
    };
    this.businesses.set(id, record);
    return record;
  }

  getAuditEvents(): StoredAuditEvent[] {
    return [...this.auditEvents];
  }

  async findUserByEmail(email: string): Promise<StoredUserRecord | null> {
    const normalized = normalizeEmail(email);
    for (const user of this.users.values()) {
      if (user.email === normalized) {
        return this.hydrateUser(user);
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<StoredUserRecord | null> {
    const user = this.users.get(id);
    return user ? this.hydrateUser(user) : null;
  }

  async createCustomerUser(input: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<SafeUserProfile> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedPhone = normalizePhone(input.phone);
    this.assertUniqueEmailAndPhone(normalizedEmail, normalizedPhone);

    const now = new Date();
    const id = this.generateId('usr');
    const record: Omit<StoredUserRecord, 'ownedBusinesses'> = {
      id,
      email: normalizedEmail,
      phone: normalizedPhone,
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      sessionVersion: 0,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, record);

    await this.recordAuditEvent({
      actorId: id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: id,
      metadata: { role: 'CUSTOMER' }
    });

    return toSafeUser(this.hydrateUser(record));
  }

  async createBusinessOwnerWithBusiness(input: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
    business: BusinessInput;
  }): Promise<SafeUserProfile> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedPhone = normalizePhone(input.phone);
    this.assertUniqueEmailAndPhone(normalizedEmail, normalizedPhone);

    const now = new Date();
    const userId = this.generateId('usr');
    const userRecord: Omit<StoredUserRecord, 'ownedBusinesses'> = {
      id: userId,
      email: normalizedEmail,
      phone: normalizedPhone,
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: 'BUSINESS_OWNER',
      status: 'ACTIVE',
      sessionVersion: 0,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(userId, userRecord);

    const businessId = this.generateId('biz');
    const businessRecord: StoredBusinessRecord = {
      id: businessId,
      ownerId: userId,
      name: input.business.name.trim(),
      description: input.business.description?.trim() || null,
      city: input.business.city.trim(),
      location: input.business.location.trim(),
      phone: input.business.phone.trim(),
      email: input.business.email ? normalizeEmail(input.business.email) : null,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now
    };
    this.businesses.set(businessId, businessRecord);

    await this.recordAuditEvent({
      actorId: userId,
      action: 'BUSINESS_SUBMITTED',
      entityType: 'Business',
      entityId: businessId,
      metadata: { status: 'PENDING', city: businessRecord.city }
    });

    return toSafeUser(this.hydrateUser(userRecord));
  }

  async recordAuditEvent(input: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.auditEvents.push({
      id: this.generateId('aud'),
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? null,
      createdAt: new Date()
    });
  }

  async listBookingsForCustomer(customerUserId: string): Promise<SafeBookingSummary[]> {
    return Array.from(this.bookings.values()).filter(
      (b) => b.customerUserId === customerUserId
    );
  }

  async listBusinessesForOwner(user: AuthenticatedUser): Promise<SafeBusinessSummary[]> {
    const scope = ownerScope(user);
    return Array.from(this.businesses.values())
      .filter((b) => b.ownerId === scope.ownerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toSafeBusiness);
  }

  async getBusinessForOwner(
    user: AuthenticatedUser,
    businessId: string
  ): Promise<SafeBusinessSummary | null> {
    const scope = ownerScope(user);
    const business = this.businesses.get(businessId);
    if (!business || business.ownerId !== scope.ownerId) {
      return null;
    }
    return toSafeBusiness(business);
  }

  async createBusinessForOwner(
    user: AuthenticatedUser,
    input: BusinessInput
  ): Promise<SafeBusinessSummary> {
    const scope = ownerScope(user);
    const now = new Date();
    const businessId = this.generateId('biz');
    const businessRecord: StoredBusinessRecord = {
      id: businessId,
      ownerId: scope.ownerId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      city: input.city.trim(),
      location: input.location.trim(),
      phone: input.phone.trim(),
      email: input.email ? normalizeEmail(input.email) : null,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now
    };
    this.businesses.set(businessId, businessRecord);

    await this.recordAuditEvent({
      actorId: scope.ownerId,
      action: 'BUSINESS_SUBMITTED',
      entityType: 'Business',
      entityId: businessId,
      metadata: { status: 'PENDING', city: businessRecord.city }
    });

    return toSafeBusiness(businessRecord);
  }

  async updateBusinessForOwner(
    user: AuthenticatedUser,
    businessId: string,
    input: BusinessUpdateInput
  ): Promise<SafeBusinessSummary | null> {
    const scope = ownerScope(user);
    const existing = this.businesses.get(businessId);
    if (!existing || existing.ownerId !== scope.ownerId) {
      return null;
    }
    if (existing.status === 'SUSPENDED') {
      throw new BusinessSuspendedError();
    }

    const updated: StoredBusinessRecord = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : existing.description,
      city: input.city !== undefined ? input.city.trim() : existing.city,
      location: input.location !== undefined ? input.location.trim() : existing.location,
      phone: input.phone !== undefined ? input.phone.trim() : existing.phone,
      email:
        input.email !== undefined
          ? input.email
            ? normalizeEmail(input.email)
            : null
          : existing.email,
      updatedAt: new Date()
    };
    this.businesses.set(businessId, updated);
    return toSafeBusiness(updated);
  }

  async listAllBusinessesForAdmin(filter?: {
    status?: BusinessReviewStatus;
  }): Promise<AdminBusinessItem[]> {
    const items = Array.from(this.businesses.values())
      .filter((b) => (filter?.status ? b.status === filter.status : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return items.map((b) => {
      const owner = this.users.get(b.ownerId);
      return {
        ...toSafeBusiness(b),
        owner: {
          id: owner?.id ?? b.ownerId,
          name: owner?.name ?? 'Unknown Owner',
          email: owner?.email ?? null,
          phone: owner?.phone ?? null,
          status: owner?.status ?? 'ACTIVE'
        }
      };
    });
  }

  async updateBusinessStatusForAdmin(
    adminUser: AuthenticatedUser,
    businessId: string,
    status: BusinessReviewStatus
  ): Promise<AdminBusinessItem | null> {
    if (adminUser.role !== 'ADMIN') {
      throw new Error('Administrator role required.');
    }
    const existing = this.businesses.get(businessId);
    if (!existing) {
      return null;
    }
    const previousStatus = existing.status;
    const updated: StoredBusinessRecord = {
      ...existing,
      status,
      updatedAt: new Date()
    };
    this.businesses.set(businessId, updated);

    await this.recordAuditEvent({
      actorId: adminUser.id,
      action: 'BUSINESS_STATUS_UPDATED',
      entityType: 'Business',
      entityId: businessId,
      metadata: { previousStatus, status }
    });

    const owner = this.users.get(updated.ownerId);
    return {
      ...toSafeBusiness(updated),
      owner: {
        id: owner?.id ?? updated.ownerId,
        name: owner?.name ?? 'Unknown Owner',
        email: owner?.email ?? null,
        phone: owner?.phone ?? null,
        status: owner?.status ?? 'ACTIVE'
      }
    };
  }

  async listAllUsersForAdmin(): Promise<SafeUserProfile[]> {
    return Array.from(this.users.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((u) => toSafeUser(this.hydrateUser(u)));
  }

  async updateUserStatusForAdmin(
    adminUser: AuthenticatedUser,
    targetUserId: string,
    status: UserAccountStatus
  ): Promise<SafeUserProfile | null> {
    if (adminUser.role !== 'ADMIN') {
      throw new Error('Administrator role required.');
    }
    const existing = this.users.get(targetUserId);
    if (!existing) {
      return null;
    }
    const previousStatus = existing.status;
    const updated: Omit<StoredUserRecord, 'ownedBusinesses'> = {
      ...existing,
      status,
      updatedAt: new Date()
    };
    this.users.set(targetUserId, updated);

    await this.recordAuditEvent({
      actorId: adminUser.id,
      action: 'USER_STATUS_UPDATED',
      entityType: 'User',
      entityId: targetUserId,
      metadata: { previousStatus, status }
    });

    return toSafeUser(this.hydrateUser(updated));
  }

  async createAdminUser(input: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<SafeUserProfile> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedPhone = normalizePhone(input.phone);
    this.assertUniqueEmailAndPhone(normalizedEmail, normalizedPhone);

    const now = new Date();
    const id = this.generateId('usr');
    const record: Omit<StoredUserRecord, 'ownedBusinesses'> = {
      id,
      email: normalizedEmail,
      phone: normalizedPhone,
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      sessionVersion: 0,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, record);

    await this.recordAuditEvent({
      actorId: null,
      action: 'ADMIN_PROVISIONED',
      entityType: 'User',
      entityId: id,
      metadata: { source: 'cli', role: 'ADMIN' }
    });

    return toSafeUser(this.hydrateUser(record));
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const now = new Date();
    for (const [id, token] of this.passwordResetTokens) {
      if (token.userId === input.userId && token.usedAt === null) {
        this.passwordResetTokens.set(id, { ...token, usedAt: now });
      }
    }
    const id = this.generateId('prt');
    this.passwordResetTokens.set(id, {
      id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: now
    });
  }

  async findPasswordResetToken(tokenHash: string): Promise<StoredPasswordResetToken | null> {
    for (const token of this.passwordResetTokens.values()) {
      if (token.tokenHash === tokenHash) {
        return { ...token };
      }
    }
    return null;
  }

  async consumePasswordResetToken(input: {
    tokenId: string;
    userId: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean> {
    const token = this.passwordResetTokens.get(input.tokenId);
    if (
      !token ||
      token.userId !== input.userId ||
      token.usedAt !== null ||
      token.expiresAt.getTime() <= input.now.getTime()
    ) {
      return false;
    }

    this.passwordResetTokens.set(token.id, { ...token, usedAt: input.now });

    const user = this.users.get(input.userId);
    if (!user) {
      return false;
    }
    const updatedUser: Omit<StoredUserRecord, 'ownedBusinesses'> = {
      ...user,
      passwordHash: input.passwordHash,
      sessionVersion: user.sessionVersion + 1,
      updatedAt: input.now
    };
    this.users.set(input.userId, updatedUser);

    for (const [id, other] of this.passwordResetTokens) {
      if (other.userId === input.userId && other.usedAt === null) {
        this.passwordResetTokens.set(id, { ...other, usedAt: input.now });
      }
    }

    await this.recordAuditEvent({
      actorId: null,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: input.userId,
      metadata: { sessionVersion: updatedUser.sessionVersion }
    });

    return true;
  }

  async changePassword(input: { userId: string; passwordHash: string }): Promise<number> {
    const user = this.users.get(input.userId);
    if (!user) {
      throw new Error('User not found.');
    }
    const updated: Omit<StoredUserRecord, 'ownedBusinesses'> = {
      ...user,
      passwordHash: input.passwordHash,
      sessionVersion: user.sessionVersion + 1,
      updatedAt: new Date()
    };
    this.users.set(input.userId, updated);

    const now = new Date();
    for (const [id, token] of this.passwordResetTokens) {
      if (token.userId === input.userId && token.usedAt === null) {
        this.passwordResetTokens.set(id, { ...token, usedAt: now });
      }
    }

    await this.recordAuditEvent({
      actorId: input.userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: input.userId,
      metadata: { sessionVersion: updated.sessionVersion }
    });

    return updated.sessionVersion;
  }

  async deleteExpiredPasswordResetTokens(now: Date, limit: number): Promise<number> {
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 1000));
    let deleted = 0;
    for (const [id, token] of this.passwordResetTokens) {
      if (deleted >= boundedLimit) {
        break;
      }
      if (token.expiresAt.getTime() < now.getTime() || token.usedAt !== null) {
        this.passwordResetTokens.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  /** Test-only inspection helper: stored reset tokens including their hashes. */
  getPasswordResetTokens(): StoredPasswordResetToken[] {
    return [...this.passwordResetTokens.values()].map((token) => ({ ...token }));
  }
}
