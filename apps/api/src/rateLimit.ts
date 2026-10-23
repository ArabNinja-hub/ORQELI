import type { Request, RequestHandler } from 'express';

/**
 * Small fixed-window rate limiter for the unauthenticated authentication
 * endpoints (`/api/auth/login`, `/api/auth/register`).
 *
 * The limiter is intentionally dependency-free and in-process. That is enough
 * to stop single-process credential stuffing / brute force and Argon2 CPU
 * exhaustion, but counters are per API instance: a multi-instance deployment
 * must put a shared limiter (for example a Redis-backed one) or a gateway rate
 * limit in front of these routes as well. See docs/architecture.md.
 */

export interface RateLimitRule {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum permitted requests per key per window. */
  max: number;
}

export interface RateLimiterOptions extends RateLimitRule {
  /** Namespace so that separate limiters never share counters. */
  name: string;
  /** Derives the counter key. Return an empty string to skip limiting. */
  keyGenerator: (req: Request) => string;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
  /** Upper bound on tracked keys so a spray of distinct keys cannot grow memory without limit. */
  maxEntries?: number;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimiter extends RequestHandler {
  /** Clears every counter (used by tests). */
  reset(): void;
  /** Current number of tracked keys (used by tests). */
  size(): number;
}

const DEFAULT_MAX_ENTRIES = 10_000;

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const now = options.now ?? Date.now;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const entries = new Map<string, RateLimitEntry>();

  function prune(nowMs: number): void {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= nowMs) {
        entries.delete(key);
      }
    }
    // Map preserves insertion order, so the first keys are the oldest.
    while (entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      entries.delete(oldestKey);
    }
  }

  const middleware = ((req, res, next) => {
    const rawKey = options.keyGenerator(req);
    if (!rawKey) {
      next();
      return;
    }
    const key = `${options.name}:${rawKey}`;
    const nowMs = now();

    if (entries.size >= maxEntries) {
      prune(nowMs);
    }

    let entry = entries.get(key);
    if (!entry || entry.resetAt <= nowMs) {
      entry = { count: 0, resetAt: nowMs + options.windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, options.max - entry.count);
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.resetAt - nowMs) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('Cache-Control', 'no-store');
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait and try again.'
        }
      });
      return;
    }

    next();
  }) as RateLimiter;

  middleware.reset = () => entries.clear();
  middleware.size = () => entries.size;

  return middleware;
}

export interface AuthRateLimitSettings {
  /** Window for the login limiters. */
  loginWindowMs: number;
  /** Failed or successful login attempts allowed per (IP address + email address). */
  loginMaxPerIdentity: number;
  /** Login attempts allowed per IP address across all email addresses. */
  loginMaxPerIp: number;
  /** Window for the registration limiter. */
  registerWindowMs: number;
  /** Registrations allowed per IP address per window. */
  registerMaxPerIp: number;
}

export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimitSettings = {
  loginWindowMs: 15 * 60 * 1000,
  loginMaxPerIdentity: 10,
  loginMaxPerIp: 50,
  registerWindowMs: 60 * 60 * 1000,
  registerMaxPerIp: 20
};

export function clientIp(req: Request): string {
  // `req.ip` honours Express' `trust proxy` setting; without that setting it is
  // the socket address and cannot be spoofed through X-Forwarded-For.
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

export function loginIdentityKey(req: Request): string {
  const body: unknown = req.body;
  const email =
    body && typeof body === 'object' && 'email' in body
      ? (body as { email?: unknown }).email
      : undefined;
  const normalizedEmail =
    typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';
  return `${clientIp(req)}|${normalizedEmail || 'unknown'}`;
}

export interface AuthRateLimiters {
  loginPerIp: RateLimiter;
  loginPerIdentity: RateLimiter;
  registerPerIp: RateLimiter;
}

export function createAuthRateLimiters(
  overrides: Partial<AuthRateLimitSettings> = {}
): AuthRateLimiters {
  const settings = { ...DEFAULT_AUTH_RATE_LIMITS, ...overrides };

  return {
    loginPerIp: createRateLimiter({
      name: 'login-ip',
      windowMs: settings.loginWindowMs,
      max: settings.loginMaxPerIp,
      keyGenerator: clientIp
    }),
    loginPerIdentity: createRateLimiter({
      name: 'login-identity',
      windowMs: settings.loginWindowMs,
      max: settings.loginMaxPerIdentity,
      keyGenerator: loginIdentityKey
    }),
    registerPerIp: createRateLimiter({
      name: 'register-ip',
      windowMs: settings.registerWindowMs,
      max: settings.registerMaxPerIp,
      keyGenerator: clientIp
    })
  };
}
