import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveApiProxyTarget } from './src/apiProxy.js';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Reads the same repository-root `.env` files the API reads so the dev proxy can
 * never point at a different port than the API listens on.
 *
 * This deliberately does not use Vite's loadEnv(): loadEnv() copies NODE_ENV from
 * .env into process.env, which would turn `vite build` into a development React
 * bundle whenever .env contains NODE_ENV="development".
 */
function readWorkspaceEnvFileValues(): Record<string, string> {
  const fileValues: Record<string, string> = {};

  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(workspaceRoot, fileName);
    if (fs.existsSync(filePath)) {
      Object.assign(fileValues, dotenv.parse(fs.readFileSync(filePath)));
    }
  }

  return fileValues;
}

export default defineConfig(() => ({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: resolveApiProxyTarget({ fileValues: readWorkspaceEnvFileValues() }),
        changeOrigin: false
      }
    }
  }
}));
