import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type {
  AuthenticatedUserProfile,
  HealthResponse,
  MembershipSummary,
  StudentRegistrationPayload,
  StudentRegistrationResponse
} from './types';
import { transportFetch } from './runtimeEnv';

export interface ApiErrorDetail {
  path: Array<string | number>;
  message: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(
    status: number,
    code: string,
    message: string,
    details: ApiErrorDetail[] = []
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface LoginResult {
  user: AuthenticatedUserProfile;
  memberships: MembershipSummary[];
}

interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: AuthenticatedUserProfile | null;
  memberships: MembershipSummary[];
  csrfToken: string | null;
  health: HealthResponse | null;
  healthError: string | null;
  refreshHealth: () => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  registerStudent: (
    payload: StudentRegistrationPayload
  ) => Promise<StudentRegistrationResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<LoginResult | null>;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const NETWORK_ERROR_MESSAGE =
  'The ORQELI Education API could not be reached. Check that the API is running and that the web server proxies /api to the API port.';

const SANDBOX_TOKEN_STORAGE_KEY = 'orqeli.sandbox_session_token.v1';

function readStoredSandboxToken(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(SANDBOX_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access restrictions inside strict iframes.
  }
  return null;
}

function writeStoredSandboxToken(token: string | null): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (token) {
        sessionStorage.setItem(SANDBOX_TOKEN_STORAGE_KEY, token);
      } else {
        sessionStorage.removeItem(SANDBOX_TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage access restrictions inside strict iframes.
  }
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await transportFetch(input, init);
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
  }
}

async function readApiErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { code?: string } } | null;
    return body?.error?.code ?? null;
  } catch {
    return null;
  }
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorObj =
      body && typeof body === 'object' && 'error' in body
        ? (
            body as {
              error?: {
                code?: string;
                message?: string;
                details?: unknown;
              };
            }
          ).error
        : undefined;

    if (!isJson) {
      throw new ApiRequestError(
        response.status,
        'UNEXPECTED_RESPONSE',
        `The ORQELI Education API returned an unexpected response (HTTP ${response.status}). Check that the API is running on the configured port.`
      );
    }

    throw new ApiRequestError(
      response.status,
      errorObj?.code ?? 'REQUEST_FAILED',
      errorObj?.message ?? 'The request could not be completed.',
      Array.isArray(errorObj?.details) ? (errorObj.details as ApiErrorDetail[]) : []
    );
  }

  if (!isJson) {
    throw new ApiRequestError(
      response.status,
      'UNEXPECTED_RESPONSE',
      `The ORQELI Education API returned an unexpected response (HTTP ${response.status}).`
    );
  }

  return body as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    'loading'
  );
  const [user, setUser] = useState<AuthenticatedUserProfile | null>(null);
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const sandboxTokenRef = useRef<string | null>(readStoredSandboxToken());

  const setSandboxToken = useCallback((token: string | null) => {
    sandboxTokenRef.current = token;
    writeStoredSandboxToken(token);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const response = await safeFetch('/api/health', { cache: 'no-store' });
      const data = await parseApiResponse<HealthResponse>(response);
      setHealth(data);
      setHealthError(null);
    } catch (err) {
      setHealth(null);
      setHealthError(
        err instanceof Error ? err.message : 'Unable to reach /api/health.'
      );
    }
  }, []);

  const ensureCsrfToken = useCallback(
    async (forceRefresh = false): Promise<string> => {
      if (csrfToken && !forceRefresh) {
        return csrfToken;
      }
      const headers = new Headers({ Accept: 'application/json' });
      if (sandboxTokenRef.current) {
        headers.set('X-Sandbox-Session', sandboxTokenRef.current);
      }
      const response = await safeFetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'include',
        headers
      });
      const data = await parseApiResponse<{ csrfToken: string }>(response);
      setCsrfToken(data.csrfToken);
      return data.csrfToken;
    },
    [csrfToken]
  );

  const refreshSession = useCallback(async (): Promise<LoginResult | null> => {
    try {
      const headers = new Headers({ Accept: 'application/json' });
      if (sandboxTokenRef.current) {
        headers.set('X-Sandbox-Session', sandboxTokenRef.current);
      }
      const response = await safeFetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers
      });

      if (response.status === 401) {
        setSandboxToken(null);
        setUser(null);
        setMemberships([]);
        setCsrfToken(null);
        setStatus('unauthenticated');
        return null;
      }

      const data = await parseApiResponse<{
        user: AuthenticatedUserProfile;
        memberships: MembershipSummary[];
        csrfToken: string;
        sandboxSessionToken?: string;
      }>(response);
      if (data.sandboxSessionToken) {
        setSandboxToken(data.sandboxSessionToken);
      }
      setUser(data.user);
      setMemberships(data.memberships);
      setCsrfToken(data.csrfToken);
      setStatus('authenticated');
      return { user: data.user, memberships: data.memberships };
    } catch {
      setUser(null);
      setMemberships([]);
      setCsrfToken(null);
      setStatus('unauthenticated');
      return null;
    }
  }, [setSandboxToken]);

  useEffect(() => {
    void refreshHealth();
    void refreshSession();
  }, [refreshHealth, refreshSession]);

  const apiFetch = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const method = (init.method ?? 'GET').toUpperCase();
      const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      const performRequest = async (tokenOverride?: string) => {
        const headers = new Headers(init.headers ?? {});
        headers.set('Accept', 'application/json');
        if (sandboxTokenRef.current) {
          headers.set('X-Sandbox-Session', sandboxTokenRef.current);
        }
        if (init.body && !headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
        if (isMutating) {
          const activeToken = tokenOverride ?? (await ensureCsrfToken());
          headers.set('X-CSRF-Token', activeToken);
        }
        return safeFetch(path, {
          ...init,
          method,
          credentials: 'include',
          headers
        });
      };

      let response = await performRequest();

      if (isMutating && response.status === 403) {
        const errorCode = await readApiErrorCode(response.clone());
        if (errorCode === 'CSRF_INVALID' || errorCode === 'CSRF_MISSING') {
          const freshToken = await ensureCsrfToken(true);
          response = await performRequest(freshToken);
        }
      }

      if (response.status === 401) {
        setSandboxToken(null);
        setUser(null);
        setMemberships([]);
        setCsrfToken(null);
        setStatus('unauthenticated');
      }

      return parseApiResponse<T>(response);
    },
    [ensureCsrfToken, setSandboxToken]
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const data = await apiFetch<{
        user: AuthenticatedUserProfile;
        memberships: MembershipSummary[];
        csrfToken: string;
        sandboxSessionToken?: string;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data.sandboxSessionToken) {
        setSandboxToken(data.sandboxSessionToken);
      }
      setUser(data.user);
      setMemberships(data.memberships);
      setCsrfToken(data.csrfToken);
      setStatus('authenticated');
      return { user: data.user, memberships: data.memberships };
    },
    [apiFetch, setSandboxToken]
  );

  const registerStudent = useCallback(
    async (
      payload: StudentRegistrationPayload
    ): Promise<StudentRegistrationResponse> => {
      const data = await apiFetch<StudentRegistrationResponse>(
        '/api/student/register',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      );
      if (data.sandboxSessionToken) {
        setSandboxToken(data.sandboxSessionToken);
      }
      setUser(data.user);
      setMemberships(data.memberships);
      setCsrfToken(data.csrfToken);
      setStatus('authenticated');
      return data;
    },
    [apiFetch, setSandboxToken]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch<{ status: string }>('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({})
      });
    } finally {
      setSandboxToken(null);
      setUser(null);
      setMemberships([]);
      setCsrfToken(null);
      setStatus('unauthenticated');
    }
  }, [apiFetch, setSandboxToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      memberships,
      csrfToken,
      health,
      healthError,
      refreshHealth,
      login,
      registerStudent,
      logout,
      refreshSession,
      apiFetch
    }),
    [
      status,
      user,
      memberships,
      csrfToken,
      health,
      healthError,
      refreshHealth,
      login,
      registerStudent,
      logout,
      refreshSession,
      apiFetch
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
