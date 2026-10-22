import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from './config.js';

let prisma: PrismaClient | undefined;
// Create lazily so the health route can run without opening a database connection.
export function getPrismaClient(): PrismaClient { return prisma ??= new PrismaClient(); }
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
// Phase 1 intentionally exposes no account, owner, or administrator operations.
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: error.issues.map(({ path, message }) => ({ path, message })) } });
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' } });
  console.error('Unhandled request error', error);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
});

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(env.PORT, '0.0.0.0', () => console.info(`ORQELI API listening on ${env.PORT}`));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
    server.close(() => { void prisma?.$disconnect(); });
  });
}
