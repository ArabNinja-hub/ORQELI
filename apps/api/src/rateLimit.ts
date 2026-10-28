import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
}

export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const hitsByKey = new Map<string, number[]>();
  const message =
    options.message ??
    'Too many attempts from this network. Please wait briefly before trying again.';

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const cutoff = now - options.windowMs;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${clientIp}`;

    const recentHits = (hitsByKey.get(key) ?? []).filter((ts) => ts > cutoff);
    if (recentHits.length >= options.maxRequests) {
      const oldestInWindow = recentHits[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + options.windowMs - now) / 1000));
      res.set('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message
        }
      });
      return;
    }

    recentHits.push(now);
    hitsByKey.set(key, recentHits);

    // Opportunistic cleanup so memory remains bounded.
    if (hitsByKey.size > 1024) {
      for (const [entryKey, timestamps] of hitsByKey.entries()) {
        const filtered = timestamps.filter((ts) => ts > cutoff);
        if (filtered.length === 0) {
          hitsByKey.delete(entryKey);
        } else {
          hitsByKey.set(entryKey, filtered);
        }
      }
    }

    next();
  };
}
