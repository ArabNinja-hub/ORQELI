import React, { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  X
} from 'lucide-react';
import { ApiRequestError, AuthProvider, useAuth } from './auth';
import { BrandMark } from './BrandMark';
import { LandingPage } from './LandingPage';
import {
  PublicSchoolProfilePage,
  SchoolDiscoveryPage
} from './SchoolDiscoveryPage';
import { StudentRegistrationPage } from './StudentRegistrationPage';
import { StudentPortalPage } from './StudentPortalPage';
import { WorkspacePage } from './WorkspacePage';
import {
  GuardianReportCardPage,
  StaffReportCardPage,
  StudentReportCardPage
} from './ReportCardPage';
import { getBaseUrl, isStaticPagesSandbox, transportFetch } from './runtimeEnv';
import type { SandboxPersonasResponse } from './types';
import { formatSchoolRole } from './workflowRules';

function RequireAuthentication({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <section className="workspace-shell">
        <div className="state-card">
          <h1>Checking session…</h1>
          <p>Verifying your ORQELI Education session with the API.</p>
        </div>
      </section>
    );
  }

  if (status === 'unauthenticated') {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}

function LoginPage() {
  const { status, memberships, login, health } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sandboxData, setSandboxData] = useState<SandboxPersonasResponse | null>(null);

  const rawReturnTo = new URLSearchParams(location.search).get('returnTo');
  const explicitReturnTo =
    rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//')
      ? rawReturnTo
      : null;

  useEffect(() => {
    if (!health?.sandboxMode) {
      setSandboxData(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await transportFetch('/api/sandbox/personas', { cache: 'no-store' });
        if (!res.ok) return;
        const payload = (await res.json()) as SandboxPersonasResponse;
        if (active) setSandboxData(payload);
      } catch {
        // Ignore optional sandbox helper failure
      }
    })();
    return () => {
      active = false;
    };
  }, [health?.sandboxMode]);

  if (status === 'loading') {
    return (
      <section className="workspace-shell">
        <div className="state-card">
          <h1>Checking session…</h1>
          <p>Preparing sign-in.</p>
        </div>
      </section>
    );
  }

  if (status === 'authenticated') {
    const isStudentOnly =
      memberships.some((m) => m.role === 'STUDENT') &&
      !memberships.some((m) => m.role !== 'STUDENT');
    const target = explicitReturnTo ?? (isStudentOnly ? '/student' : '/workspace');
    return <Navigate to={target} replace />;
  }

  const performLogin = async (targetEmail: string, targetPassword: string) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await login(targetEmail, targetPassword);
      const isStudentOnly =
        result.memberships.some((m) => m.role === 'STUDENT') &&
        !result.memberships.some((m) => m.role !== 'STUDENT');
      navigate(explicitReturnTo ?? (isStudentOnly ? '/student' : '/workspace'), {
        replace: true
      });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Sign-in could not be completed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performLogin(email, password);
  };

  return (
    <section className="auth-layout" aria-labelledby="signin-heading">
      <div className="auth-card">
        <span className="eyebrow">STUDENT &amp; SCHOOL STAFF SIGN IN</span>
        <h1 id="signin-heading">Sign in to ORQELI Education</h1>
        <p className="auth-lead">
          Sign in with your verified school staff or student account. Need a student account?{' '}
          <Link to="/schools">Find your school</Link> and{' '}
          <Link to="/student/register">register with your learner admission ID</Link>.
        </p>

        {errorMessage ? (
          <div className="callout callout-error" role="alert">
            <AlertCircle size={18} />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="login-email">Student or School Staff Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.example.zm"
            />
          </div>

          <div className="field-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            <LogIn size={16} />
            <span>{submitting ? 'Signing in…' : 'Sign in'}</span>
          </button>
        </form>

        <div className="auth-footnote">
          <ShieldCheck size={16} />
          <p>
            Sessions use server-verified <code>HttpOnly</code> cookies and CSRF protection. Every
            action is restricted to your verified school(s), role, and learner link.
          </p>
        </div>
      </div>

      {sandboxData ? (
        <aside className="sandbox-personas-card" aria-labelledby="personas-heading">
          <span className="eyebrow">SYNTHETIC SANDBOX MODE (NON-PRODUCTION)</span>
          <h2 id="personas-heading">Inspect roles with synthetic accounts</h2>
          <p className="muted-line">
            This instance is running with synthetic demonstration data. Select a student or school
            staff persona below to sign in directly.
          </p>
          <div className="persona-list">
            {sandboxData.personas.map((persona) => (
              <div key={persona.email} className="persona-item">
                <div>
                  <div className="persona-top">
                    <strong>{persona.label}</strong>
                    <code className="mono">{persona.schoolCode}</code>
                  </div>
                  <p className="persona-name">
                    {persona.name} · <span>{persona.schoolName}</span>
                  </p>
                  <p className="persona-purpose">{persona.purpose}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={submitting}
                  onClick={() => {
                    setEmail(persona.email);
                    setPassword(sandboxData.credentialHint);
                    void performLogin(persona.email, sandboxData.credentialHint);
                  }}
                >
                  <span>Sign in as {persona.role.replace('_', ' ').toLowerCase()}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </aside>
      ) : (
        <aside className="sandbox-personas-card" aria-labelledby="local-setup-heading">
          <span className="eyebrow">LOCAL EVALUATION</span>
          <h2 id="local-setup-heading">Testing with synthetic accounts</h2>
          <p className="muted-line">
            In PostgreSQL mode, you can optionally populate synthetic demonstration schools,
            student portals, and staff accounts in a non-production database:
          </p>
          <pre className="code-snippet">npm run db:seed-synthetic</pre>
          <p className="muted-line">
            Or run the zero-database synthetic sandbox during early exploration:
          </p>
          <pre className="code-snippet">npm run dev:sandbox</pre>
        </aside>
      )}
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="workspace-shell">
      <div className="state-card">
        <span className="eyebrow">404 · PAGE NOT FOUND</span>
        <h1>That page does not exist in ORQELI Education</h1>
        <p>Return to the project overview, search public schools, or open your portal.</p>
        <div className="inline-actions">
          <Link to="/" className="btn btn-primary">
            Project overview
          </Link>
          <Link to="/schools" className="btn btn-secondary">
            Find school
          </Link>
        </div>
      </div>
    </section>
  );
}

function ShellContent() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { status, user, memberships, logout } = useAuth();
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      closeMenu();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const primaryRoleLabel = memberships[0]
    ? formatSchoolRole(memberships[0].role)
    : 'Authenticated';
  const isStudentOnly =
    memberships.some((m) => m.role === 'STUDENT') &&
    !memberships.some((m) => m.role !== 'STUDENT');
  const homePortalHref = isStudentOnly ? '/student' : '/workspace';
  const baseUrl = getBaseUrl();
  const staticPagesMode = isStaticPagesSandbox();

  const handleResetStaticDemo = async () => {
    const { resetStaticSandboxState } = await import('./staticSandboxApi');
    resetStaticSandboxState();
    window.location.href = `${baseUrl}login`;
  };

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {staticPagesMode ? (
        <div
          className="static-preview-banner no-print"
          role="region"
          aria-label="Static sandbox notice"
        >
          <div className="static-preview-inner">
            <span>
              <strong>GitHub Pages Interactive Preview:</strong> Browser-only synthetic sandbox
              (data stays in this tab; real authentication, server-side RBAC, and IDOR security
              require the backend server).
            </span>
            <button
              type="button"
              className="static-reset-btn"
              onClick={() => void handleResetStaticDemo()}
            >
              Reset synthetic demo
            </button>
          </div>
        </div>
      ) : null}

      <header className="site-header no-print">
        <div className="header-inner">
          <Link
            to="/"
            className="brand-link"
            onClick={closeMenu}
            aria-label="ORQELI Education home"
          >
            <BrandMark />
          </Link>

          <nav
            id="main-navigation"
            aria-label="Main navigation"
            className={menuOpen ? 'site-nav open' : 'site-nav'}
          >
            <Link to="/schools" onClick={closeMenu}>
              Find school
            </Link>
            <Link to="/student/register" onClick={closeMenu}>
              Student registration
            </Link>
            <Link to="/student" onClick={closeMenu}>
              Student portal
            </Link>
            <Link to="/workspace" onClick={closeMenu}>
              School workspace
            </Link>
          </nav>

          <div className="header-actions">
            {status === 'authenticated' && user ? (
              <>
                <Link to={homePortalHref} className="user-badge" onClick={closeMenu}>
                  <UserRound size={14} />
                  <span className="user-badge-name">{user.name}</span>
                  <span className="user-role-tag">{primaryRoleLabel}</span>
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                >
                  <LogOut size={14} />
                  <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm" onClick={closeMenu}>
                <span>Sign in</span>
                <ArrowRight size={14} />
              </Link>
            )}

            <button
              type="button"
              className="menu-toggle"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="main-navigation"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="site-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/schools" element={<SchoolDiscoveryPage />} />
          <Route path="/schools/:schoolCode" element={<PublicSchoolProfilePage />} />
          <Route path="/student/register" element={<StudentRegistrationPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/student"
            element={
              <RequireAuthentication>
                <StudentPortalPage />
              </RequireAuthentication>
            }
          />
          <Route
            path="/student/schools/:schoolId/learners/:learnerId/report-cards/:packId"
            element={
              <RequireAuthentication>
                <StudentReportCardPage />
              </RequireAuthentication>
            }
          />
          <Route
            path="/workspace"
            element={
              <RequireAuthentication>
                <WorkspacePage />
              </RequireAuthentication>
            }
          />
          <Route
            path="/workspace/schools/:schoolId/packs/:packId/report-card/:learnerId"
            element={
              <RequireAuthentication>
                <StaffReportCardPage />
              </RequireAuthentication>
            }
          />
          <Route
            path="/workspace/schools/:schoolId/guardian/report-card/:packId/:learnerId"
            element={
              <RequireAuthentication>
                <GuardianReportCardPage />
              </RequireAuthentication>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="site-footer no-print">
        <div className="footer-inner">
          <div className="footer-brand-col">
            <BrandMark compact />
            <p>
              Early-stage education technology foundation investigating academic record-keeping,
              examination marks verification, and verified student &amp; printed report-card access
              for schools in Zambia.
            </p>
          </div>
          <div className="footer-links-col">
            <strong>Portals &amp; Directory</strong>
            <Link to="/schools">Public school directory</Link>
            <Link to="/student/register">Student registration</Link>
            <Link to="/student">Student portal</Link>
            <Link to="/workspace">School staff workspace</Link>
          </div>
          <div className="footer-notice-col">
            <strong>Research &amp; Data Notice</strong>
            <p>
              Synthetic data only. Do not enter real learner records. Independent early-stage
              project; not endorsed by or affiliated with the Ministry of Education or ECZ.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ShellContent />
    </AuthProvider>
  );
}
