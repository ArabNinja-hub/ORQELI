/**
 * Safe runtime environment helpers that work both inside Vite browser bundles
 * and inside Node `tsx --test` unit/SSR suites where `import.meta.env` may be undefined.
 */

interface ViteMetaEnv {
  BASE_URL?: string;
  VITE_STATIC_SANDBOX?: string;
}

function readMetaEnv(): ViteMetaEnv {
  const meta = import.meta as { env?: ViteMetaEnv };
  return meta.env ?? {};
}

export function getBaseUrl(): string {
  const raw = readMetaEnv().BASE_URL;
  if (!raw || raw.trim() === '') {
    return '/';
  }
  return raw.endsWith('/') ? raw : `${raw}/`;
}

export function getRouterBasename(): string | undefined {
  const base = getBaseUrl();
  if (base === '/') {
    return undefined;
  }
  return base.replace(/\/+$/, '');
}

export function isStaticPagesSandbox(): boolean {
  return readMetaEnv().VITE_STATIC_SANDBOX === 'true';
}

export async function transportFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (isStaticPagesSandbox()) {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname + input.search
          : input.url;
    if (urlStr.startsWith('/api/') || urlStr.includes('/api/')) {
      const { handleStaticSandboxRequest } = await import('./staticSandboxApi');
      return handleStaticSandboxRequest(urlStr, init);
    }
  }
  return fetch(input, init);
}
