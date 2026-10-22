import crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AppEnv } from './config.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const FORBIDDEN_FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain'
];

function computeHmac(secret: string, scope: string, nonce: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${scope}:${nonce}`)
    .digest('base64url');
}

export function createCsrfToken(sessionSecret: string, csrfSecret?: string): string {
  const nonce = crypto.randomBytes(16).toString('base64url');
  const scope = csrfSecret ?? 'anon';
  const signature = computeHmac(sessionSecret, scope, nonce);
  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(
  token: string,
  sessionSecret: string,
  csrfSecret?: string
): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }
  const [nonce, providedSignature] = parts;
  if (!nonce || !providedSignature || nonce.length < 8) {
    return false;
  }

  // A token bound to the current session is required once a session has a CSRF
  // secret. Anonymous tokens are only accepted for requests that are not yet
  // bound to an authenticated session (registration, login, csrf bootstrap).
  const candidateScopes = csrfSecret ? [csrfSecret] : ['anon'];
  for (const scope of candidateScopes) {
    const expectedSignature = computeHmac(sessionSecret, scope, nonce);
    const providedBuf = Buffer.from(providedSignature, 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    if (
      providedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return true;
    }
  }
  return false;
}

function normalizeOrigin(urlString: string): string | null {
  try {
    return new URL(urlString).origin.toLowerCase();
  } catch {
    return null;
  }
}

export function createCsrfProtectionMiddleware(config: AppEnv): RequestHandler {
  const configuredWebOrigin = normalizeOrigin(config.WEB_ORIGIN);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const secFetchSite = req.headers['sec-fetch-site'];
    if (typeof secFetchSite === 'string' && secFetchSite.toLowerCase() === 'cross-site') {
      res.status(403).json({
        error: {
          code: 'CSRF_REJECTED',
          message: 'Cross-site state-changing requests are not permitted.'
        }
      });
      return;
    }

    const allowedOrigins = new Set<string>();
    if (configuredWebOrigin) {
      allowedOrigins.add(configuredWebOrigin);
    }
    const hostHeader = req.headers.host;
    if (typeof hostHeader === 'string' && hostHeader.length > 0) {
      allowedOrigins.add(`http://${hostHeader.toLowerCase()}`);
      allowedOrigins.add(`https://${hostHeader.toLowerCase()}`);
    }

    const originHeader = req.headers.origin;
    if (typeof originHeader === 'string') {
      const normalizedOrigin = normalizeOrigin(originHeader);
      if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
        res.status(403).json({
          error: {
            code: 'CSRF_REJECTED',
            message: 'Request origin is not permitted.'
          }
        });
        return;
      }
    } else if (typeof req.headers.referer === 'string') {
      const normalizedRefererOrigin = normalizeOrigin(req.headers.referer);
      if (!normalizedRefererOrigin || !allowedOrigins.has(normalizedRefererOrigin)) {
        res.status(403).json({
          error: {
            code: 'CSRF_REJECTED',
            message: 'Request referer origin is not permitted.'
          }
        });
        return;
      }
    }

    const contentType = (req.headers['content-type'] ?? '').toLowerCase();
    if (
      FORBIDDEN_FORM_CONTENT_TYPES.some((forbiddenType) =>
        contentType.startsWith(forbiddenType)
      )
    ) {
      res.status(403).json({
        error: {
          code: 'CSRF_REJECTED',
          message: 'Form-encoded state-changing requests are not permitted.'
        }
      });
      return;
    }

    // A state-changing request must present a valid token. The previous
    // implementation only verified the header when it was present, which made the
    // token optional for any client (curl, another origin that omits Origin, ...)
    // and left only the Origin/Referer checks as real protection.
    const csrfHeader = req.headers['x-csrf-token'];
    const tokenValue = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
    if (typeof tokenValue !== 'string' || tokenValue.length === 0) {
      res.status(403).json({
        error: {
          code: 'CSRF_MISSING',
          message: 'A CSRF token is required for this request.'
        }
      });
      return;
    }

    const valid = verifyCsrfToken(
      tokenValue,
      config.SESSION_SECRET,
      req.session?.csrfSecret
    );
    if (!valid) {
      res.status(403).json({
        error: {
          code: 'CSRF_INVALID',
          message: 'Invalid or expired CSRF token.'
        }
      });
      return;
    }

    next();
  };
}
