import crypto from 'node:crypto';

/**
 * Password-reset token handling.
 *
 * Tokens are 256 bits of CSPRNG output, delivered to the user out of band. Only a
 * SHA-256 digest is persisted; the plaintext token exists solely in the response
 * of the delivery channel (e-mail), never in API responses, logs or audit
 * metadata. A fast digest is appropriate here because the token already has full
 * 256-bit entropy and guessing is infeasible; it is not a user-chosen password.
 */

export const PASSWORD_RESET_TOKEN_BYTES = 32;
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generatePasswordResetToken(): string {
  return crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('base64url');
}

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Shape check so malformed tokens are rejected before any database lookup. */
export function isPasswordResetTokenFormat(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

/**
 * Delivery seam. The repository has no e-mail provider, credentials or template
 * infrastructure, so the default implementation intentionally does nothing.
 * A deployment must inject a real implementation (SMTP/API provider) and must
 * never write the token to application logs.
 */
export interface PasswordResetDelivery {
  sendPasswordReset(input: {
    userId: string;
    email: string;
    name: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}

export const noopPasswordResetDelivery: PasswordResetDelivery = {
  async sendPasswordReset() {
    // Intentionally empty: no e-mail infrastructure is configured in this repository.
  }
};

/** One-way pseudonym for an e-mail address, used in audit metadata instead of PII. */
export function deriveEmailPseudonym(secret: string, email: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex')
    .slice(0, 32);
}
