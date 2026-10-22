import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type UserRole = 'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN';
export type UserAccountStatus = 'ACTIVE' | 'DISABLED' | 'SUSPENDED';
export type BusinessReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface BusinessSummary {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  city: string;
  location: string;
  phone: string;
  email: string | null;
  status: BusinessReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedUserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: UserRole;
  status: UserAccountStatus;
  createdAt: string;
  updatedAt: string;
  ownedBusinesses?: BusinessSummary[];
}

export interface ApiErrorDetail {
  path: Array<string | number>;
  message: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RegisterPayload {
  role: 'CUSTOMER' | 'BUSINESS_OWNER';
  name: string;
  email: string;
  phone?: string;
  password: string;
  business?: {
    name: string;
    description?: string;
    city: string;
    location: string;
    phone: string;
    email?: string;
  };
}

interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: AuthenticatedUserProfile | null;
  csrfToken: string | null;
  login: (email: string, password: string) => Promise<AuthenticatedUserProfile>;
  register: (payload: RegisterPayload) => Promise<AuthenticatedUserProfile>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthenticatedUserProfile | null>;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorObj =
      body && typeof body === 'object' && 'error' in body
        ? (body as {
            error?: {
              code?: string;
              message?: string;
              details?: ApiErrorDetail[];
            };
          }).error
        : undefined;

    throw new ApiRequestError(
      response.status,
      errorObj?.code ?? 'REQUEST_FAILED',
      errorObj?.message ?? 'The request could not be completed.',
      Array.isArray(errorObj?.details) ? errorObj.details : []
    );
  }

  return body as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [user, setUser] = useState<AuthenticatedUserProfile | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const ensureCsrfToken = useCallback(async (currentToken: string | null): Promise<string> => {
    if (currentToken) {
      return currentToken;
    }
    const response = await fetch('/api/auth/csrf', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await parseApiResponse<{ csrfToken: string }>(response);
    setCsrfToken(data.csrfToken);
    return data.csrfToken;
  }, []);

  const apiFetch = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const method = (init.method ?? 'GET').toUpperCase();
      const headers = new Headers(init.headers);

      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const token = await ensureCsrfToken(csrfToken);
        headers.set('X-CSRF-Token', token);
      }

      const response = await fetch(path, {
        ...init,
        method,
        headers,
        credentials: 'include'
      });

      if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/me') {
        setUser(null);
        setStatus('unauthenticated');
      }

      return parseApiResponse<T>(response);
    },
    [csrfToken, ensureCsrfToken]
  );

  const refreshSession = useCallback(async (): Promise<AuthenticatedUserProfile | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include'
      });
      if (response.status === 401) {
        setUser(null);
        setStatus('unauthenticated');
        return null;
      }
      const data = await parseApiResponse<{
        user: AuthenticatedUserProfile;
        csrfToken: string;
      }>(response);
      setUser(data.user);
      setCsrfToken(data.csrfToken);
      setStatus('authenticated');
      return data.user;
    } catch {
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthenticatedUserProfile> => {
      const data = await apiFetch<{
        user: AuthenticatedUserProfile;
        csrfToken: string;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setUser(data.user);
      setCsrfToken(data.csrfToken);
      setStatus('authenticated');
      return data.user;
    },
    [apiFetch]
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<AuthenticatedUserProfile> => {
      const data = await apiFetch<{
        user: AuthenticatedUserProfile;
        csrfToken: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setUser(data.user);
      setCsrfToken(data.csrfToken);
      setStatus('authenticated');
      return data.user;
    },
    [apiFetch]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch<{ status: string }>('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({})
      });
    } finally {
      setUser(null);
      setCsrfToken(null);
      setStatus('unauthenticated');
    }
  }, [apiFetch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      csrfToken,
      login,
      register,
      logout,
      refreshSession,
      apiFetch
    }),
    [status, user, csrfToken, login, register, logout, refreshSession, apiFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'BUSINESS_OWNER':
      return '/business';
    case 'CUSTOMER':
    default:
      return '/account';
  }
}
