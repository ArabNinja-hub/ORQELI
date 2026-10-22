import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Reads the API port from the same repository-root .env files the API uses, so the
 * dev proxy cannot drift from the port the API actually listens on.
 *
 * This deliberately does not use Vite's loadEnv(): loadEnv() copies NODE_ENV from
 * .env into process.env, which would turn `vite build` into a development React
 * bundle whenever .env contains NODE_ENV="development".
 */
function resolveApiProxyTarget(): string {
  const fileValues: Record<string, string> = {};

  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(workspaceRoot, fileName);
    if (fs.existsSync(filePath)) {
      Object.assign(fileValues, dotenv.parse(fs.readFileSync(filePath)));
    }
  }

  // Real environment variables win over .env values, matching the API's dotenv use.
  const read = (key: string): string => (process.env[key] ?? fileValues[key] ?? '').trim();
  const apiPort = read('PORT') || '4000';

  // 127.0.0.1 keeps the proxy on IPv4, which is the address the API binds
  // (`app.listen(port, '0.0.0.0')`). "localhost" can resolve to IPv6 first.
  return read('VITE_API_PROXY_TARGET') || `http://127.0.0.1:${apiPort}`;
}

export default defineConfig(() => ({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: resolveApiProxyTarget(),
        changeOrigin: true
      }
    }
  }
}));
