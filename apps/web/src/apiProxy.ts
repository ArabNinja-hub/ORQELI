/**
 * Resolution of the Vite development proxy target for `/api`.
 *
 * Kept in its own module (no Vite or Node imports) so the rule that caused the
 * "The request could not be completed." registration failure stays unit tested:
 * the proxy must follow the same `PORT` the API reads, never a hard-coded port.
 */

export const DEFAULT_API_PORT = '4000';

export interface ApiProxyTargetInputs {
  /** Values parsed from the repository-root `.env` files (`.env`, then `.env.local`). */
  fileValues: Record<string, string>;
  /** Real environment variables; they win over `.env` values, as with dotenv. */
  processEnv?: Record<string, string | undefined>;
}

/**
 * Returns the URL the dev server proxies `/api` to.
 *
 * `VITE_API_PROXY_TARGET` wins so a non-local API host can be used; otherwise the
 * target is `http://127.0.0.1:$PORT`. `127.0.0.1` is used because the API binds
 * `0.0.0.0` (IPv4) and `localhost` can resolve to IPv6 first.
 */
export function resolveApiProxyTarget({
  fileValues,
  processEnv = process.env as Record<string, string | undefined>
}: ApiProxyTargetInputs): string {
  const read = (key: string): string => (processEnv[key] ?? fileValues[key] ?? '').trim();

  const override = read('VITE_API_PROXY_TARGET');
  if (override) {
    return override;
  }

  const apiPort = read('PORT') || DEFAULT_API_PORT;
  return `http://127.0.0.1:${apiPort}`;
}
