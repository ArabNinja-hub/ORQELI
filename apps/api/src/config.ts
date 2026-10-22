import 'dotenv/config';
import { z } from 'zod';

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
