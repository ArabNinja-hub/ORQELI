import crypto from 'node:crypto';
import type { Request, Response, RequestHandler } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { Pool } from 'pg';
import type { AppEnv } from './config.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrfSecret?: string;
    authenticatedAt?: string;
  }
}

export const SESSION_TABLE_NAME = 'session';

const PgSessionStore = connectPgSimple(session);

export interface PgPoolLike {
  query(
    queryText: string,
    values?: unknown[]
  ): Promise<{ rows: Record<string, unknown>[] }>;
  end?(): Promise<void>;
}

export interface SimulatedSessionRecord {
  sid: string;
  sess: session.SessionData;
  expireEpochSeconds: number;
}

/**
 * Provides a pg.Pool-compatible query adapter for connect-pg-simple in test environments
 * where a live PostgreSQL server is not running, allowing tests to exercise the real
 * connect-pg-simple PGStore class and its SQL statements against the "session" table contract.
 */
export function createSimulatedPgPool() {
  const rowsBySid = new Map<string, SimulatedSessionRecord>();

  const pool: PgPoolLike & {
    inspectSessions(): Map<string, SimulatedSessionRecord>;
  } = {
    inspectSessions() {
      return rowsBySid;
    },
    async query(queryText: string, values: unknown[] = []) {
      const normalized = queryText.replace(/\s+/g, ' ').trim();

      if (normalized.startsWith(`SELECT sess FROM "${SESSION_TABLE_NAME}"`)) {
        const sid = String(values[0] ?? '');
        const nowSeconds = Number(values[1] ?? Math.ceil(Date.now() / 1000));
        const record = rowsBySid.get(sid);
        if (!record || record.expireEpochSeconds < nowSeconds) {
          return { rows: [] };
        }
        return {
          rows: [{ sess: JSON.parse(JSON.stringify(record.sess)) as Record<string, unknown> }]
        };
      }

      if (normalized.startsWith(`INSERT INTO "${SESSION_TABLE_NAME}"`)) {
        const rawSess = values[0];
        const parsedSess = (
          typeof rawSess === 'string' ? JSON.parse(rawSess) : JSON.parse(JSON.stringify(rawSess))
        ) as session.SessionData;
        const expireEpochSeconds = Number(values[1] ?? 0);
        const sid = String(values[2] ?? '');
        rowsBySid.set(sid, { sid, sess: parsedSess, expireEpochSeconds });
        return { rows: [{ sid }] };
      }

      if (normalized.startsWith(`DELETE FROM "${SESSION_TABLE_NAME}" WHERE sid =`)) {
        const sid = String(values[0] ?? '');
        rowsBySid.delete(sid);
        return { rows: [] };
      }

      if (normalized.startsWith(`DELETE FROM "${SESSION_TABLE_NAME}" WHERE expire <`)) {
        const cutoff = Number(values[0] ?? Math.ceil(Date.now() / 1000));
        for (const [sid, record] of rowsBySid.entries()) {
          if (record.expireEpochSeconds < cutoff) {
            rowsBySid.delete(sid);
          }
        }
        return { rows: [] };
      }

      if (normalized.startsWith(`UPDATE "${SESSION_TABLE_NAME}" SET expire =`)) {
        const expireEpochSeconds = Number(values[0] ?? 0);
        const sid = String(values[1] ?? '');
        const existing = rowsBySid.get(sid);
        if (!existing) {
          return { rows: [] };
        }
        existing.expireEpochSeconds = expireEpochSeconds;
        return { rows: [{ sid }] };
      }

      throw new Error(`Unsupported session store query: ${normalized}`);
    },
    async end() {
      rowsBySid.clear();
    }
  };

  return pool;
}

export function createPgSessionStore(
  config: AppEnv,
  options?: { pool?: PgPoolLike }
): connectPgSimple.PGStore {
  const ttlSeconds = config.SESSION_TTL_HOURS * 60 * 60;
  return new PgSessionStore({
    tableName: SESSION_TABLE_NAME,
    ttl: ttlSeconds,
    createTableIfMissing: false,
    pruneSessionInterval: config.NODE_ENV === 'test' ? false : 60 * 15,
    ...(options?.pool
      ? { pool: options.pool as unknown as Pool }
      : { conString: config.DATABASE_URL })
  });
}

export function getSessionCookieOptions(config: AppEnv): session.CookieOptions & {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: config.SESSION_COOKIE_SAMESITE,
    maxAge: config.SESSION_TTL_HOURS * 60 * 60 * 1000,
    path: '/'
  };
}

export function createSessionMiddleware(
  config: AppEnv,
  store: session.Store
): RequestHandler {
  if (config.NODE_ENV === 'production' && store instanceof session.MemoryStore) {
    throw new Error('In-memory session store is prohibited in production.');
  }

  return session({
    name: config.SESSION_COOKIE_NAME,
    secret: config.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    unset: 'destroy',
    proxy: config.NODE_ENV === 'production' || config.TRUST_PROXY,
    cookie: getSessionCookieOptions(config)
  });
}

export async function regenerateAuthenticatedSession(
  req: Request,
  userId: string
): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  const csrfSecret = crypto.randomBytes(24).toString('base64url');
  req.session.userId = userId;
  req.session.csrfSecret = csrfSecret;
  req.session.authenticatedAt = new Date().toISOString();

  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  return csrfSecret;
}

export async function destroyAuthenticatedSession(
  req: Request,
  res: Response,
  config: AppEnv
): Promise<void> {
  if (req.session) {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  const cookieOptions = getSessionCookieOptions(config);
  res.clearCookie(config.SESSION_COOKIE_NAME, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path
  });
}
