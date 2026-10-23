import { discoveryQuerySchema, profileQuerySchema, publicBusinessIdSchema } from './discovery.js';
import express from 'express';
import type session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { env, type AppEnv } from './config.js';
import { requireAuth, requireRole } from './authz.js';
import {
  createPgSessionStore,
  createSessionMiddleware,
  createSimulatedPgPool,
  destroyAuthenticatedSession,
  regenerateAuthenticatedSession
} from './session.js';
import { createCsrfProtectionMiddleware, createCsrfToken } from './csrf.js';
import {
  createAuthRateLimiters,
  type AuthRateLimitSettings
} from './rateLimit.js';
import {
  BusinessSuspendedError,
  DuplicateFieldError,
  InMemoryDataRepository,
  PrismaDataRepository,
  toSafeUser,
  type DataRepository,
  type StoredUserRecord
} from './repository.js';
import {
  adminBusinessStatusFilterSchema,
  adminUpdateBusinessStatusSchema,
  adminUpdateUserStatusSchema,
  businessOnboardingSchema,
  loginSchema,
  ownerBusinessUpdateSchema,
  registerSchema
} from './schemas.js';

let prisma: PrismaClient | undefined;

// Create lazily so the health route can run without opening a database connection.
export function getPrismaClient(): PrismaClient {
  return (prisma ??= new PrismaClient());
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

let dummyPasswordHashPromise: Promise<string> | undefined;

function getDummyPasswordHash(): Promise<string> {
  return (dummyPasswordHashPromise ??= hashPassword(
    'orqeli-constant-time-fallback-password'
  ));
}

export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

function checkAccountEligibility(
  user: StoredUserRecord
): { eligible: true } | { eligible: false; code: string; message: string } {
  if (user.status === 'DISABLED' || user.status === 'SUSPENDED') {
    return {
      eligible: false,
      code: 'ACCOUNT_INACTIVE',
      message: 'This account has been disabled or suspended.'
    };
  }
  if (
    user.role === 'BUSINESS_OWNER' &&
    user.ownedBusinesses.length > 0 &&
    user.ownedBusinesses.every((business) => business.status === 'SUSPENDED')
  ) {
    return {
      eligible: false,
      code: 'ACCOUNT_SUSPENDED',
      message: 'This business account is currently suspended.'
    };
  }
  return { eligible: true };
}

export interface CreateAppOptions {
  config?: AppEnv;
  repository?: DataRepository;
  sessionStore?: session.Store;
  /** Overrides for the built-in authentication rate limits (primarily for tests). */
  authRateLimits?: Partial<AuthRateLimitSettings>;
}

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? env;
  const repository: DataRepository =
    options.repository ??
    (config.NODE_ENV === 'test'
      ? new InMemoryDataRepository()
      : new PrismaDataRepository(getPrismaClient()));

  const sessionStore: session.Store =
    options.sessionStore ??
    (config.NODE_ENV === 'test'
      ? createPgSessionStore(config, { pool: createSimulatedPgPool() })
      : createPgSessionStore(config));

  const instance = express();
  instance.disable('x-powered-by');
  if (config.NODE_ENV === 'production' || config.TRUST_PROXY) {
    instance.set('trust proxy', 1);
  }

  instance.use(helmet());
  instance.use(
    cors({
      origin: config.WEB_ORIGIN,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token']
    })
  );
  instance.use(express.json({ limit: '32kb' }));

  instance.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Public reads have no session dependency and never grant a role-based approval bypass.
  // Avoid cached listings/profiles remaining visible after suspension or rejection.
  instance.get('/api/businesses', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      const query = discoveryQuerySchema.parse(req.query);
      return res.json(await repository.discoverBusinesses(query));
    } catch (error) { return next(error); }
  });

  instance.get('/api/businesses/:businessId', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      const id = publicBusinessIdSchema.parse(req.params.businessId);
      const { city } = profileQuerySchema.parse(req.query);
      const business = await repository.getPublicBusiness(id, city);
      if (!business) return res.status(404).json({ error: {
        code: 'NOT_FOUND', message: 'The requested business is not available.'
      } });
      return res.json({ business });
    } catch (error) { return next(error); }
  });

  const sessionMiddleware = createSessionMiddleware(config, sessionStore);
  const csrfMiddleware = createCsrfProtectionMiddleware(config);
  const authRateLimiters = createAuthRateLimiters(options.authRateLimits);

  instance.use('/api', sessionMiddleware);
  instance.use('/api', csrfMiddleware);

  // Resolve the authenticated user strictly from the verified server-side session.
  instance.use('/api', async (req, res, next) => {
    try {
      const sessionUserId = req.session?.userId;
      if (!sessionUserId) {
        next();
        return;
      }

      const storedUser = await repository.findUserById(sessionUserId);
      if (!storedUser || ! checkAccountEligibility(storedUser).eligible) {
        await destroyAuthenticatedSession(req, res, config);
        next();
        return;
      }

      req.user = { id: storedUser.id, role: storedUser.role };
      req.authUser = toSafeUser(storedUser);
      next();
    } catch (error) {
      next(error);
    }
  });

  // Authenticated surfaces may contain personal data and CSRF tokens; never let a
  // browser or shared proxy store them.
  instance.use(
    ['/api/auth', '/api/account', '/api/owner', '/api/admin'],
    (_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    }
  );

  instance.get('/api/auth/csrf', (req, res) => {
    const csrfToken = createCsrfToken(config.SESSION_SECRET, req.session?.csrfSecret);
    res.set('Cache-Control', 'no-store');
    return res.json({ csrfToken });
  });

  instance.post('/api/auth/register', authRateLimiters.registerPerIp, async (req, res, next) => {
    try {
      const rawBody =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : {};

      if (
        typeof rawBody.role === 'string' &&
        rawBody.role.trim().toUpperCase() === 'ADMIN'
      ) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Administrator accounts cannot be created through public registration.'
          }
        });
      }

      const parsed = registerSchema.parse(rawBody);
      const passwordHash = await hashPassword(parsed.password);

      const createdUser =
        parsed.role === 'BUSINESS_OWNER' && parsed.business
          ? await repository.createBusinessOwnerWithBusiness({
              name: parsed.name,
              email: parsed.email,
              phone: parsed.phone,
              passwordHash,
              business: parsed.business
            })
          : await repository.createCustomerUser({
              name: parsed.name,
              email: parsed.email,
              phone: parsed.phone,
              passwordHash
            });

      const csrfSecret = await regenerateAuthenticatedSession(req, createdUser.id);
      const csrfToken = createCsrfToken(config.SESSION_SECRET, csrfSecret);

      return res.status(201).json({
        user: createdUser,
        csrfToken
      });
    } catch (error) {
      return next(error);
    }
  });

  instance.post('/api/auth/login', authRateLimiters.loginPerIp, authRateLimiters.loginPerIdentity, async (req, res, next) => {
    try {
      const parsed = loginSchema.parse(req.body ?? {});
      const user = await repository.findUserByEmail(parsed.email);

      if (!user || !user.passwordHash) {
        const dummyHash = await getDummyPasswordHash();
        await verifyPassword(dummyHash, parsed.password);
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.'
          }
        });
      }

      const passwordMatches = await verifyPassword(user.passwordHash, parsed.password);
      if (!passwordMatches) {
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.'
          }
        });
      }

      const eligibility = checkAccountEligibility(user);
      if (!eligibility.eligible) {
        return res.status(403).json({
          error: {
            code: eligibility.code,
            message: eligibility.message
          }
        });
      }

      const csrfSecret = await regenerateAuthenticatedSession(req, user.id);
      await repository.recordAuditEvent({
        actorId: user.id,
        action: 'USER_LOGGED_IN',
        entityType: 'User',
        entityId: user.id,
        metadata: { role: user.role }
      });

      const csrfToken = createCsrfToken(config.SESSION_SECRET, csrfSecret);
      return res.status(200).json({
        user: toSafeUser(user),
        csrfToken
      });
    } catch (error) {
      return next(error);
    }
  });

  instance.post('/api/auth/logout', async (req, res, next) => {
    try {
      const actorId = req.user?.id ?? req.session?.userId ?? null;
      if (actorId) {
        await repository.recordAuditEvent({
          actorId,
          action: 'USER_LOGGED_OUT',
          entityType: 'User',
          entityId: actorId
        });
      }
      await destroyAuthenticatedSession(req, res, config);
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      return next(error);
    }
  });

  instance.get('/api/auth/me', requireAuth(), (req, res) => {
    const csrfToken = createCsrfToken(config.SESSION_SECRET, req.session?.csrfSecret);
    return res.status(200).json({
      user: req.authUser,
      csrfToken
    });
  });

  // Customer & authenticated account profile endpoint (always scoped to req.user.id)
  instance.get(
    '/api/account',
    requireRole('CUSTOMER', 'BUSINESS_OWNER', 'ADMIN'),
    async (req, res, next) => {
      try {
        const bookings = await repository.listBookingsForCustomer(req.user!.id);
        return res.status(200).json({
          user: req.authUser,
          bookings
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  // Business owner endpoints — strictly scoped via ownerScope(req.user!)
  instance.get(
    '/api/owner/businesses',
    requireRole('BUSINESS_OWNER'),
    async (req, res, next) => {
      try {
        const businesses = await repository.listBusinessesForOwner(req.user!);
        return res.status(200).json({ businesses });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.post(
    '/api/owner/businesses',
    requireRole('BUSINESS_OWNER'),
    async (req, res, next) => {
      try {
        const rawBody =
          req.body && typeof req.body === 'object'
            ? (req.body as Record<string, unknown>)
            : {};

        if (
          rawBody.status !== undefined &&
          String(rawBody.status).toUpperCase() !== 'PENDING'
        ) {
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'New business applications must undergo manual review and cannot bypass approval.'
            }
          });
        }

        const parsed = businessOnboardingSchema.parse(rawBody);
        const business = await repository.createBusinessForOwner(req.user!, parsed);
        return res.status(201).json({ business });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.get(
    '/api/owner/businesses/:businessId',
    requireRole('BUSINESS_OWNER'),
    async (req, res, next) => {
      try {
        const business = await repository.getBusinessForOwner(
          req.user!,
          String(req.params.businessId)
        );
        if (!business) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'The requested resource was not found.'
            }
          });
        }
        return res.status(200).json({ business });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.patch(
    '/api/owner/businesses/:businessId',
    requireRole('BUSINESS_OWNER'),
    async (req, res, next) => {
      try {
        const rawBody =
          req.body && typeof req.body === 'object'
            ? (req.body as Record<string, unknown>)
            : {};

        if ('status' in rawBody || 'ownerId' in rawBody) {
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Business owners cannot modify verification status or ownership.'
            }
          });
        }

        const parsed = ownerBusinessUpdateSchema.parse(rawBody);
        const updated = await repository.updateBusinessForOwner(
          req.user!,
          String(req.params.businessId),
          parsed
        );
        if (!updated) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'The requested resource was not found.'
            }
          });
        }
        return res.status(200).json({ business: updated });
      } catch (error) {
        return next(error);
      }
    }
  );

  // Administrator endpoints — strictly restricted to ADMIN role
  instance.get(
    '/api/admin/businesses',
    requireRole('ADMIN'),
    async (req, res, next) => {
      try {
        const filter = adminBusinessStatusFilterSchema.parse({
          status:
            typeof req.query.status === 'string' && req.query.status.length > 0
              ? req.query.status
              : undefined
        });
        const businesses = await repository.listAllBusinessesForAdmin(filter);
        return res.status(200).json({ businesses });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.patch(
    '/api/admin/businesses/:businessId/status',
    requireRole('ADMIN'),
    async (req, res, next) => {
      try {
        const parsed = adminUpdateBusinessStatusSchema.parse(req.body ?? {});
        const updated = await repository.updateBusinessStatusForAdmin(
          req.user!,
          String(req.params.businessId),
          parsed.status
        );
        if (!updated) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'The requested resource was not found.'
            }
          });
        }
        return res.status(200).json({ business: updated });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.get('/api/admin/users', requireRole('ADMIN'), async (_req, res, next) => {
    try {
      const users = await repository.listAllUsersForAdmin();
      return res.status(200).json({ users });
    } catch (error) {
      return next(error);
    }
  });

  instance.patch(
    '/api/admin/users/:userId/status',
    requireRole('ADMIN'),
    async (req, res, next) => {
      try {
        const targetUserId = String(req.params.userId);
        const parsed = adminUpdateUserStatusSchema.parse(req.body ?? {});
        if (targetUserId === req.user!.id && parsed.status !== 'ACTIVE') {
          return res.status(400).json({
            error: {
              code: 'SELF_STATUS_CHANGE_FORBIDDEN',
              message: 'Administrators cannot disable or suspend their own active account.'
            }
          });
        }
        const updated = await repository.updateUserStatusForAdmin(
          req.user!,
          targetUserId,
          parsed.status
        );
        if (!updated) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'The requested resource was not found.'
            }
          });
        }
        return res.status(200).json({ user: updated });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.use((_req, res) =>
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.'
      }
    })
  );

  instance.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: error.issues.map(({ path, message }) => ({ path, message }))
          }
        });
      }
      if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must contain valid JSON.'
          }
        });
      }
      if (error instanceof DuplicateFieldError) {
        return res.status(409).json({
          error: {
            code:
              error.field === 'phone'
                ? 'PHONE_ALREADY_IN_USE'
                : 'EMAIL_ALREADY_IN_USE',
            message:
              error.field === 'phone'
                ? 'An account with this phone number already exists.'
                : 'An account with this email address already exists.'
          }
        });
      }
      if (error instanceof BusinessSuspendedError) {
        return res.status(403).json({
          error: {
            code: 'BUSINESS_SUSPENDED',
            message: error.message
          }
        });
      }
      console.error('Unhandled request error', error);
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.'
        }
      });
    }
  );

  return instance;
}

export const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(env.PORT, '0.0.0.0', () =>
    console.info(`ORQELI API listening on ${env.PORT}`)
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      server.close(() => {
        void prisma?.$disconnect();
      });
    });
  }
}
