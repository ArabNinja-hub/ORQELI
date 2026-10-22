import 'dotenv/config';
import { z } from 'zod';
export const envSchema = z.object({ NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), PORT: z.coerce.number().int().min(1).max(65535).default(4000), DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//, 'DATABASE_URL must be a PostgreSQL connection URL'), WEB_ORIGIN: z.string().url().default('http://localhost:5173'), SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters') });
export const env = envSchema.parse(process.env);
