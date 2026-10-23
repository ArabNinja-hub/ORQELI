import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig, type Plugin } from 'vite';
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

/**
 * Injects a Content-Security-Policy into the production HTML only.
 *
 * A <meta http-equiv> policy is the only CSP lever the static build has, because
 * this repository does not own the production hosting configuration. It is
 * applied at build time so the Vite dev server (which needs inline HMR scripts
 * and eval) keeps working. `frame-ancestors` and HSTS cannot be set from a meta
 * tag; they must be configured as HTTP response headers at the host/proxy.
 */
function buildOnlyContentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    // React 19 + Vite emit an external module bundle only; no inline scripts are needed.
    "script-src 'self'",
    // Google Fonts stylesheet plus the single inline React style attribute in App.tsx.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data:",
    "media-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');

  return {
    name: 'orqeli-build-csp',
    apply: 'build',
    transformIndexHtml(html) {
      // Insert immediately after <head> so the policy is in force before any
      // script, stylesheet or font request is parsed.
      return html.replace(
        '<head>',
        '<head>\n' +
          `    <meta http-equiv="Content-Security-Policy" content="${policy}"/>\n` +
          '    <meta name="referrer" content="strict-origin-when-cross-origin"/>'
      );
    }
  };
}

export default defineConfig(() => ({
  plugins: [react(), buildOnlyContentSecurityPolicy()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: resolveApiProxyTarget({ fileValues: readWorkspaceEnvFileValues() }),
        changeOrigin: true
      }
    }
  }
}));
