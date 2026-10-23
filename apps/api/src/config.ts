import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// npm runs workspace scripts with the workspace directory as the current working
// directory, so `dotenv/config` (cwd/.env) misses the repository-root `.env` that
// the setup instructions ask developers to create. Resolve both locations
// explicitly, from this file's own path, so the API loads the same configuration
// whether it is started from the repository root, from apps/api, or from dist/.
export function resolveEnvFilePaths(moduleDirectory: string): string[] {
  const packageDirectory = path.resolve(moduleDirectory, '..'); // apps/api (from src/ or dist/)
  const workspaceRoot = path.resolve(packageDirectory, '..', '..'); // repository root
  return [path.join(packageDirectory, '.env'), path.join(workspaceRoot, '.env')];
}

for (const envFilePath of resolveEnvFilePaths(path.dirname(fileURLToPath(import.meta.url)))) {
  // dotenv never overrides variables that are already set, so real environment
  // variables (CI, deployment, tests) always win over file values.
  dotenv.config({ path: envFilePath });
}

const INSECURE_PLACEHOLDER_SECRETS = new Set([
  'replace_with_a_random_secret_of_at_least_32_characters',
  'changeme_changeme_changeme_changeme'
]);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(?:ql)?:\/\//, 'DATABASE_URL must be a PostgreSQL connection URL'),
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_COOKIE_NAME: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9._-]+$/, 'SESSION_COOKIE_NAME must be a valid cookie token')
      .default('orqeli.sid'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    SESSION_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    /**
     * Whether the password-reset endpoints are servable.
     *
     * Defaults to "disabled" because this repository ships no e-mail/SMS provider:
     * a token that cannot be delivered must never be reported as a successful
     * recovery. A deployment that injects a real `PasswordResetDelivery`
     * implementation must set this to "enabled" explicitly; doing so without a
     * delivery configured fails at startup instead of silently discarding tokens.
     */
    PASSWORD_RESET_MODE: z.enum(['enabled', 'disabled']).default('disabled'),
    TRUST_PROXY: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .default(false)
      .transform((value) => value === true || value === 'true' || value === '1')
  })
  .superRefine((config, ctx) => {
    if (
      config.NODE_ENV === 'production' &&
      INSECURE_PLACEHOLDER_SECRETS.has(config.SESSION_SECRET.trim().toLowerCase())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SESSION_SECRET'],
        message: 'SESSION_SECRET must not use an example placeholder in production'
      });
    }
    if (config.SESSION_COOKIE_SAMESITE === 'none' && config.NODE_ENV !== 'production') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SESSION_COOKIE_SAMESITE'],
        message: 'SESSION_COOKIE_SAMESITE="none" requires NODE_ENV="production" (Secure cookie)'
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;
export const env: AppEnv = envSchema.parse(process.env);
