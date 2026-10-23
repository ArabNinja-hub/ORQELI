import { discoveryQuerySchema, profileQuerySchema, publicBusinessIdSchema } from './discovery.js';
import express from 'express';
import type session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { env, type AppEnv } from './config.js';
import { requireAuth, requireRole } from './authz.js';
import {
  createPgSessionStore,
  createSessionMiddleware,
  createSimulatedPgPool,
  destroyAuthenticatedSession,
  isAbsoluteSessionExpired,
  regenerateAuthenticatedSession
} from './session.js';
import {
  hashPassword,
  verifyPassword
} from './passwords.js';
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  deriveEmailPseudonym,
  generatePasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetTokenFormat,
  noopPasswordResetDelivery,
  type PasswordResetDelivery
} from './passwordReset.js';
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
  passwordChangeSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema
} from './schemas.js';

export { hashPassword, verifyPassword };

let prisma: PrismaClient | undefined;

// Create lazily so the health route can run without opening a database connection.
export function getPrismaClient(): PrismaClient {
  return (prisma ??= new PrismaClient());
}

let dummyPasswordHashPromise: Promise<string> | undefined;

function getDummyPasswordHash(): Promise<string> {
  return (dummyPasswordHashPromise ??= hashPassword(
    'orqeli-constant-time-fallback-password'
  ));
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
  /**
   * Out-of-band delivery for password-reset tokens. No e-mail provider is
   * configured in this repository, so the default is a no-op.
   */
  passwordResetDelivery?: PasswordResetDelivery;
  /** Overrides the reset-token lifetime (primarily for tests). */
  passwordResetTokenTtlMs?: number;
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
  if (config.NODE_ENV === 'production') {
    // The hosting topology is not part of this repository, so this assumption is
    // documented and warned about rather than guessed at in code.
    console.warn(
      'Production enables Express "trust proxy" (1 hop). Terminate TLS at a trusted ' +
        'reverse proxy that overwrites X-Forwarded-For; a directly internet-facing API ' +
        'would let clients spoof req.ip and bypass IP-based rate limits. ' +
        'See docs/deployment-checklist.md.'
    );
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
  const passwordResetDelivery = options.passwordResetDelivery ?? noopPasswordResetDelivery;
  const passwordResetTokenTtlMs = options.passwordResetTokenTtlMs ?? PASSWORD_RESET_TOKEN_TTL_MS;

  if (!options.passwordResetDelivery && config.NODE_ENV === 'production') {
    console.warn(
      'Password reset delivery is not configured: reset tokens are created but never sent. ' +
        'Inject a PasswordResetDelivery implementation before launch.'
    );
  }

  /**
   * Records a failed/blocked login without ever storing the password, the raw
   * e-mail address or a reset token. The e-mail is replaced by an HMAC pseudonym.
   * Audit write failures are swallowed so an unauthenticated caller cannot turn a
   * database problem into a different login response.
   */
  async function recordLoginAudit(
    action: 'USER_LOGIN_FAILED' | 'USER_LOGIN_BLOCKED',
    actorId: string | null,
    email: string,
    metadata: Record<string, unknown> = { reason: 'INVALID_CREDENTIALS' }
  ): Promise<void> {
    try {
      await repository.recordAuditEvent({
        actorId,
        action,
        entityType: 'Auth',
        entityId: deriveEmailPseudonym(config.SESSION_SECRET, email),
        metadata
      });
    } catch {
      console.warn(`Failed to record ${action} audit event`);
    }
  }

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
      if (!storedUser || !checkAccountEligibility(storedUser).eligible) {
        await destroyAuthenticatedSession(req, res, config);
        next();
        return;
      }

      // Reject sessions issued before the credentials changed (password reset or
      // change from any device) and sessions beyond the absolute lifetime.
      const sessionIsStale =
        req.session.sessionVersion !== storedUser.sessionVersion ||
        isAbsoluteSessionExpired(req.session.authenticatedAt);
      if (sessionIsStale) {
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

      const csrfSecret = await regenerateAuthenticatedSession(req, createdUser.id, 0);
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
        await recordLoginAudit('USER_LOGIN_FAILED', null, parsed.email);
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.'
          }
        });
      }

      const passwordMatches = await verifyPassword(user.passwordHash, parsed.password);
      if (!passwordMatches) {
        await recordLoginAudit('USER_LOGIN_FAILED', null, parsed.email);
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.'
          }
        });
      }

      const eligibility = checkAccountEligibility(user);
      if (!eligibility.eligible) {
        await recordLoginAudit('USER_LOGIN_BLOCKED', user.id, parsed.email, {
          reason: eligibility.code
        });
        return res.status(403).json({
          error: {
            code: eligibility.code,
            message: eligibility.message
          }
        });
      }

      const csrfSecret = await regenerateAuthenticatedSession(req, user.id, user.sessionVersion);
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

  // Password reset request. The response is identical whether or not the account
  // exists, and the token is only ever handed to the delivery implementation.
  instance.post(
    '/api/auth/password-reset/request',
    authRateLimiters.passwordResetRequestPerIp,
    async (req, res, next) => {
      try {
        const parsed = passwordResetRequestSchema.parse(req.body ?? {});
        const user = await repository.findUserByEmail(parsed.email);

        if (user && user.passwordHash && checkAccountEligibility(user).eligible) {
          const token = generatePasswordResetToken();
          const expiresAt = new Date(Date.now() + passwordResetTokenTtlMs);

          await repository.createPasswordResetToken({
            userId: user.id,
            tokenHash: hashPasswordResetToken(token),
            expiresAt
          });

          await repository.recordAuditEvent({
            actorId: null,
            action: 'PASSWORD_RESET_REQUESTED',
            entityType: 'User',
            entityId: user.id,
            metadata: { expiresAt: expiresAt.toISOString() }
          });

          try {
            await passwordResetDelivery.sendPasswordReset({
              userId: user.id,
              email: user.email ?? parsed.email,
              name: user.name,
              token,
              expiresAt
            });
          } catch {
            // Never surface delivery errors: they would reveal the account exists,
            // and the token must not be logged.
            console.error('Password reset delivery failed for user', user.id);
          }
        }

        return res.status(200).json({ status: 'ok' });
      } catch (error) {
        return next(error);
      }
    }
  );

  // Password reset confirmation. Tokens are single-use, expiring and stored only
  // as a SHA-256 digest; every failure mode returns the same generic error.
  instance.post(
    '/api/auth/password-reset/confirm',
    authRateLimiters.passwordResetConfirmPerIp,
    async (req, res, next) => {
      try {
        const parsed = passwordResetConfirmSchema.parse(req.body ?? {});
        const genericFailure = () =>
          res.status(400).json({
            error: {
              code: 'INVALID_RESET_TOKEN',
              message: 'This password reset link is invalid or has expired.'
            }
          });

        if (!isPasswordResetTokenFormat(parsed.token)) {
          return genericFailure();
        }

        const record = await repository.findPasswordResetToken(
          hashPasswordResetToken(parsed.token)
        );
        if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
          return genericFailure();
        }

        const passwordHash = await hashPassword(parsed.password);
        const consumed = await repository.consumePasswordResetToken({
          tokenId: record.id,
          userId: record.userId,
          passwordHash,
          now: new Date()
        });
        if (!consumed) {
          return genericFailure();
        }

        // Any session in this browser belonged to the old credentials.
        await destroyAuthenticatedSession(req, res, config);
        return res.status(200).json({ status: 'ok' });
      } catch (error) {
        return next(error);
      }
    }
  );

  // Authenticated password change. Requires the current password and invalidates
  // every other session by bumping the user's session version.
  instance.post(
    '/api/auth/password/change',
    requireAuth(),
    authRateLimiters.passwordChangePerUser,
    async (req, res, next) => {
      try {
        const parsed = passwordChangeSchema.parse(req.body ?? {});
        const stored = await repository.findUserById(req.user!.id);
        if (!stored || !stored.passwordHash) {
          return res.status(401).json({
            error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' }
          });
        }

        const currentPasswordMatches = await verifyPassword(
          stored.passwordHash,
          parsed.currentPassword
        );
        if (!currentPasswordMatches) {
          // 403 rather than 401: the caller is authenticated, and returning 401
          // would make clients treat the still-valid session as expired.
          return res.status(403).json({
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'The current password is incorrect.'
            }
          });
        }

        const passwordHash = await hashPassword(parsed.newPassword);
        const sessionVersion = await repository.changePassword({
          userId: stored.id,
          passwordHash
        });

        // Rotate this device's session onto the new version so the operator who
        // changed the password stays signed in while every other session dies.
        const csrfSecret = await regenerateAuthenticatedSession(req, stored.id, sessionVersion);
        return res.status(200).json({
          status: 'ok',
          csrfToken: createCsrfToken(config.SESSION_SECRET, csrfSecret)
        });
      } catch (error) {
        return next(error);
      }
    }
  );

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
      // Log only the error type, message and stack. Passing the whole error object
      // can serialise ORM `meta`/driver details that may include query parameters
      // (for example a submitted password hash or reset-token hash).
      console.error(
        'Unhandled request error:',
        error instanceof Error ? `${error.name}: ${error.message}` : typeof error,
        error instanceof Error ? error.stack : ''
      );
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
