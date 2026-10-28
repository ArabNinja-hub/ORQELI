import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { env, type AppEnv } from './config.js';
import {
  APPROVAL_ROLES,
  LEADERSHIP_ROLES,
  STAFF_ROLES,
  requireAuth,
  requireSchoolRole
} from './authz.js';
import {
  createPgSessionStore,
  createSandboxSessionToken,
  createSessionMiddleware,
  createSimulatedPgPool,
  destroyAuthenticatedSession,
  regenerateAuthenticatedSession,
  verifySandboxSessionToken
} from './session.js';
import { createCsrfProtectionMiddleware, createCsrfToken } from './csrf.js';
import {
  DomainRuleError,
  InMemoryEducationRepository,
  PrismaEducationRepository,
  toSafeMemberships,
  toSafeUser,
  type EducationRepository,
  type StoredUserWithMemberships
} from './repository.js';
import {
  loginSchema,
  recordMarksSchema,
  requestRevisionSchema,
  resourceIdSchema
} from './schemas.js';
import {
  SANDBOX_PERSONAS,
  SYNTHETIC_SANDBOX_CREDENTIAL,
  populateSyntheticInMemoryDataset
} from './syntheticData.js';

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
    'orqeli-education-constant-time-fallback-password'
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
  user: StoredUserWithMemberships
): { eligible: true } | { eligible: false; code: string; message: string } {
  if (user.status === 'DISABLED' || user.status === 'SUSPENDED') {
    return {
      eligible: false,
      code: 'ACCOUNT_INACTIVE',
      message: 'This account has been disabled or suspended.'
    };
  }
  return { eligible: true };
}

export interface CreateAppOptions {
  config?: AppEnv;
  repository?: EducationRepository;
  sessionStore?: session.Store;
}

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? env;
  const isMemorySandbox =
    config.NODE_ENV !== 'production' && config.DATA_STORE_MODE === 'memory-sandbox';

  let sandboxBootstrapPromise: Promise<void> | undefined;
  let repository: EducationRepository;

  if (options.repository) {
    repository = options.repository;
  } else if (config.NODE_ENV === 'test') {
    repository = new InMemoryEducationRepository();
  } else if (isMemorySandbox) {
    const memRepo = new InMemoryEducationRepository();
    sandboxBootstrapPromise = hashPassword(SYNTHETIC_SANDBOX_CREDENTIAL).then((hash) => {
      populateSyntheticInMemoryDataset(memRepo, hash);
    });
    repository = memRepo;
  } else {
    repository = new PrismaEducationRepository(getPrismaClient());
  }

  const sessionStore: session.Store =
    options.sessionStore ??
    (config.NODE_ENV === 'test' || isMemorySandbox
      ? createPgSessionStore(config, { pool: createSimulatedPgPool() })
      : createPgSessionStore(config));

  const instance = express();
  instance.disable('x-powered-by');
  if (config.NODE_ENV === 'production' || config.TRUST_PROXY) {
    instance.set('trust proxy', 1);
  }

  instance.use(
    config.NODE_ENV === 'production'
      ? helmet()
      : helmet({ frameguard: false, contentSecurityPolicy: false })
  );
  instance.use(
    cors({
      origin: config.WEB_ORIGIN,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Sandbox-Session']
    })
  );
  instance.use(express.json({ limit: '32kb' }));

  instance.get('/api/health', (_req, res) =>
    res.json({
      status: 'ok',
      service: 'orqeli-education-api',
      stage: 'early-stage-foundation',
      sandboxMode: isMemorySandbox
    })
  );

  if (sandboxBootstrapPromise) {
    instance.use('/api', async (_req, _res, next) => {
      try {
        await sandboxBootstrapPromise;
        next();
      } catch (err) {
        next(err);
      }
    });
  }

  if (isMemorySandbox) {
    instance.get('/api/sandbox/personas', (_req, res) => {
      res.set('Cache-Control', 'no-store');
      return res.json({
        syntheticOnly: true,
        credentialHint: SYNTHETIC_SANDBOX_CREDENTIAL,
        personas: SANDBOX_PERSONAS
      });
    });
  }

  const sessionMiddleware = createSessionMiddleware(config, sessionStore);
  const csrfMiddleware = createCsrfProtectionMiddleware(config);

  instance.use('/api', sessionMiddleware);

  // In non-production `memory-sandbox` mode only, support an HMAC-signed
  // `X-Sandbox-Session` header fallback when third-party cookies are blocked
  // inside cross-site preview iframes.
  if (isMemorySandbox) {
    instance.use('/api', (req, _res, next) => {
      if (!req.session?.userId) {
        const rawHeader = req.headers['x-sandbox-session'];
        const tokenValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
        if (typeof tokenValue === 'string' && tokenValue.length > 0) {
          const verified = verifySandboxSessionToken(config.SESSION_SECRET, tokenValue);
          if (verified) {
            req.sandboxAuth = verified;
          }
        }
      }
      next();
    });
  }

  instance.use('/api', csrfMiddleware);

  // Resolve the authenticated user strictly from the verified server-side session
  // (or verified HMAC sandbox session in non-production memory-sandbox mode).
  instance.use('/api', async (req, res, next) => {
    try {
      const sessionUserId =
        req.session?.userId ?? (isMemorySandbox ? req.sandboxAuth?.userId : undefined);
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

      req.user = { id: storedUser.id, platformRole: storedUser.platformRole };
      req.authUser = toSafeUser(storedUser);
      req.memberships = toSafeMemberships(storedUser);
      next();
    } catch (error) {
      next(error);
    }
  });

  instance.get('/api/auth/csrf', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const csrfToken = createCsrfToken(
      config.SESSION_SECRET,
      req.session?.csrfSecret ?? req.sandboxAuth?.csrfSecret
    );
    return res.json({ csrfToken });
  });

  instance.post('/api/auth/login', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
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
      await repository.recordPlatformAuditEvent({
        actorUserId: user.id,
        action: 'USER_LOGGED_IN',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          schoolCount: user.memberships.length
        }
      });

      const csrfToken = createCsrfToken(config.SESSION_SECRET, csrfSecret);
      const sandboxSessionToken = isMemorySandbox
        ? createSandboxSessionToken(config.SESSION_SECRET, {
            userId: user.id,
            csrfSecret,
            ttlHours: config.SESSION_TTL_HOURS
          })
        : undefined;
      return res.status(200).json({
        user: toSafeUser(user),
        memberships: toSafeMemberships(user),
        csrfToken,
        ...(sandboxSessionToken ? { sandboxSessionToken } : {})
      });
    } catch (error) {
      return next(error);
    }
  });

  instance.post('/api/auth/logout', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      const actorUserId = req.user?.id ?? req.session?.userId ?? null;
      if (actorUserId) {
        await repository.recordPlatformAuditEvent({
          actorUserId,
          action: 'USER_LOGGED_OUT',
          entityType: 'User',
          entityId: actorUserId
        });
      }
      await destroyAuthenticatedSession(req, res, config);
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      return next(error);
    }
  });

  instance.get('/api/auth/me', requireAuth(), (req, res) => {
    res.set('Cache-Control', 'no-store');
    const activeCsrfSecret = req.session?.csrfSecret ?? req.sandboxAuth?.csrfSecret;
    const csrfToken = createCsrfToken(config.SESSION_SECRET, activeCsrfSecret);
    const sandboxSessionToken =
      isMemorySandbox && req.user && activeCsrfSecret
        ? createSandboxSessionToken(config.SESSION_SECRET, {
            userId: req.user.id,
            csrfSecret: activeCsrfSecret,
            ttlHours: config.SESSION_TTL_HOURS
          })
        : undefined;
    return res.status(200).json({
      user: req.authUser,
      memberships: req.memberships ?? [],
      csrfToken,
      ...(sandboxSessionToken ? { sandboxSessionToken } : {})
    });
  });

  // ==========================================================================
  // School-Scoped Academic & Results Workflow Routes
  // ==========================================================================

  instance.get(
    '/api/schools/:schoolId/overview',
    requireSchoolRole(...STAFF_ROLES),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const overview = await repository.getSchoolOverview(req.schoolAccess!);
        if (!overview) {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'School overview was not found.' }
          });
        }
        return res.json(overview);
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.get(
    '/api/schools/:schoolId/result-packs/:packId',
    requireSchoolRole(...STAFF_ROLES),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const packId = resourceIdSchema.parse(req.params.packId);
        const pack = await repository.getResultPackDetail(req.schoolAccess!, packId);
        if (!pack) {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Result pack was not found.' }
          });
        }
        return res.json({ pack });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.put(
    '/api/schools/:schoolId/result-packs/:packId/marks',
    requireSchoolRole('TEACHER'),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const packId = resourceIdSchema.parse(req.params.packId);
        const parsed = recordMarksSchema.parse(req.body ?? {});
        const pack = await repository.recordSubjectMarks(
          req.schoolAccess!,
          packId,
          parsed.entries
        );
        return res.json({ pack });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.post(
    '/api/schools/:schoolId/result-packs/:packId/submit',
    requireSchoolRole(...STAFF_ROLES),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const packId = resourceIdSchema.parse(req.params.packId);
        const pack = await repository.submitResultPack(req.schoolAccess!, packId);
        return res.json({ pack });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.post(
    '/api/schools/:schoolId/result-packs/:packId/request-revision',
    requireSchoolRole(...LEADERSHIP_ROLES),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const packId = resourceIdSchema.parse(req.params.packId);
        const parsed = requestRevisionSchema.parse(req.body ?? {});
        const pack = await repository.requestResultPackRevision(
          req.schoolAccess!,
          packId,
          parsed.reviewNotes
        );
        return res.json({ pack });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.post(
    '/api/schools/:schoolId/result-packs/:packId/approve',
    requireSchoolRole(...APPROVAL_ROLES),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const packId = resourceIdSchema.parse(req.params.packId);
        const pack = await repository.approveResultPack(req.schoolAccess!, packId);
        return res.json({ pack });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.post(
    '/api/schools/:schoolId/result-packs/:packId/publish',
    requireSchoolRole(...APPROVAL_ROLES),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const packId = resourceIdSchema.parse(req.params.packId);
        const pack = await repository.publishResultPack(req.schoolAccess!, packId);
        return res.json({ pack });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.get(
    '/api/schools/:schoolId/result-packs/:packId/report-cards/:learnerId',
    requireSchoolRole(...STAFF_ROLES),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const packId = resourceIdSchema.parse(req.params.packId);
        const learnerId = resourceIdSchema.parse(req.params.learnerId);
        const reportCard = await repository.getReportCardForStaff(
          req.schoolAccess!,
          packId,
          learnerId
        );
        if (!reportCard) {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Report card was not found.' }
          });
        }
        return res.json({ reportCard });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.get(
    '/api/schools/:schoolId/guardian/results',
    requireSchoolRole('PARENT_GUARDIAN'),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const guardianOverview = await repository.getGuardianPublishedResults(
          req.schoolAccess!
        );
        if (!guardianOverview) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'Guardian school access record was not found.'
            }
          });
        }
        return res.json(guardianOverview);
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.get(
    '/api/schools/:schoolId/audit-events',
    requireSchoolRole(...LEADERSHIP_ROLES),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try {
        const events = await repository.listSchoolAuditEvents(req.schoolAccess!);
        return res.json({ events });
      } catch (error) {
        return next(error);
      }
    }
  );

  instance.use('/api', (_req, res) =>
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.'
      }
    })
  );

  // When the web bundle has been built (`apps/web/dist/index.html`), serve static
  // assets and SPA fallback for non-API GET requests so single-port deployments
  // and direct API-port previews render the web client instead of a JSON 404.
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const webDistDir = path.resolve(moduleDir, '../../web/dist');
  const webIndexHtml = path.join(webDistDir, 'index.html');
  if (config.NODE_ENV !== 'test' && fs.existsSync(webIndexHtml)) {
    instance.use(express.static(webDistDir));
    instance.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(webIndexHtml);
    });
  }

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
      if (error instanceof DomainRuleError) {
        return res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            ...(error.details ? { details: error.details } : {})
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
  const server = app.listen(env.PORT, env.HOST, () =>
    console.info(
      `ORQELI Education API listening on ${env.HOST}:${env.PORT} (${env.DATA_STORE_MODE})`
    )
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      server.close(() => {
        void prisma?.$disconnect();
      });
    });
  }
}
