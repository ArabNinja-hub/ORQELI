import React, { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Scissors,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  X
} from 'lucide-react';
import {
  ApiRequestError,
  AuthProvider,
  getDefaultRouteForRole,
  useAuth,
  type BusinessReviewStatus,
  type BusinessSummary,
  type UserAccountStatus
} from './auth';

function roleLabel(role: 'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN'): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';
    case 'BUSINESS_OWNER':
      return 'Business Owner';
    case 'CUSTOMER':
    default:
      return 'Customer';
  }
}

function ShellContent() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-mark">
            <Scissors size={19} />
          </span>
          orqeli<span className="brand-dot">.</span>
        </Link>

        <nav className={menuOpen ? 'nav open' : 'nav'}>
          <a href="/#how" onClick={closeMenu}>
            How it works
          </a>
          <Link to="/business" onClick={closeMenu}>
            For businesses
          </Link>
          {status === 'authenticated' && user ? (
            <>
              <Link to="/account" onClick={closeMenu}>
                My account
              </Link>
              {user.role === 'ADMIN' && (
                <Link to="/admin" onClick={closeMenu}>
                  Admin
                </Link>
              )}
            </>
          ) : (
            <Link to="/login" onClick={closeMenu}>
              Sign in
            </Link>
          )}
        </nav>

        <div className="top-actions">
          {status === 'authenticated' && user ? (
            <>
              <Link
                to={getDefaultRouteForRole(user.role)}
                className="user-pill"
                onClick={closeMenu}
              >
                <UserRound size={14} />
                <span className="user-pill-name">{user.name}</span>
                <span className="role-chip">{roleLabel(user.role)}</span>
              </Link>
              <button
                type="button"
                className="logout-button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
              >
                <LogOut size={14} />
                <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="signin-link" onClick={closeMenu}>
                Sign in
              </Link>
              <Link
                to="/register?role=BUSINESS_OWNER"
                className="owner-link"
                onClick={closeMenu}
              >
                List your business <ArrowRight size={14} />
              </Link>
            </>
          )}
          <button
            className="menu-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/business" element={<BusinessWorkspacePage />} />
          <Route path="/admin" element={<AdminWorkspacePage />} />
          <Route
            path="*"
            element={
              <Portal
                title="Page not found"
                eyebrow="404"
                text="We couldn't find that page."
                icon={<Sparkles />}
                note="Head back to discover local businesses."
              />
            }
          />
        </Routes>
      </main>

      <footer className="footer">
        <Link to="/" className="brand footer-brand">
          <span className="brand-mark">
            <Scissors size={16} />
          </span>
          orqeli<span className="brand-dot">.</span>
        </Link>
        <span>Local care, booked simply.</span>
        <div>
          <a href="/#how">How it works</a>
          <Link to="/business">For businesses</Link>
          <span>Kitwe · Ndola, Zambia</span>
        </div>
      </footer>
    </div>
  );
}

function Home() {
  const [city, setCity] = useState('Kitwe');
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-line" /> MADE FOR YOUR EVERYDAY
          </div>
          <h1>
            Good days
            <br />
            start <em>right here.</em>
          </h1>
          <p className="hero-copy">
            Find your next favourite barber or salon in Copperbelt. Discover local care,
            all in one place.
          </p>
          <form className="search-panel" onSubmit={(e) => e.preventDefault()}>
            <label className="city-field">
              <MapPin size={18} />
              <span className="field-copy">
                <span className="field-label">YOUR CITY</span>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  aria-label="Select city"
                >
                  <option>Kitwe</option>
                  <option>Ndola</option>
                </select>
              </span>
              <ChevronDown className="select-chevron" size={16} />
            </label>
            <button className="search-button" type="submit">
              Explore businesses <ArrowRight size={17} />
            </button>
          </form>
          <p className="availability-note">
            <span className="note-dot" /> Starting in Kitwe and Ndola
          </p>
        </div>
        <div className="hero-art" aria-label="Illustration of a calm salon interior">
          <div className="sun-disc" />
          <div className="plant plant-a">
            <i />
            <i />
            <i />
            <b />
          </div>
          <div className="arch">
            <div className="arch-inner">
              <div className="mirror">
                <span />
              </div>
              <div className="counter">
                <div className="bottle" />
                <div className="bottle small" />
              </div>
            </div>
          </div>
          <div className="chair">
            <div className="chair-back" />
            <div className="chair-seat" />
            <div className="chair-post" />
            <div className="chair-foot" />
          </div>
          <div className="plant plant-b">
            <i />
            <i />
            <i />
            <b />
          </div>
          <div className="art-caption">
            <span>YOUR NEXT SELF-CARE MOMENT</span>
            <b>Just around the corner.</b>
          </div>
          <div className="art-sparkle">
            <Sparkles size={16} />
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <div>
          <span className="strip-icon">
            <MapPin size={19} />
          </span>
          <span>
            <b>Rooted in Copperbelt</b>
            <small>Starting with Kitwe &amp; Ndola</small>
          </span>
        </div>
        <div>
          <span className="strip-icon">
            <CalendarDays size={19} />
          </span>
          <span>
            <b>Booking, made simple</b>
            <small>Your time, your choice</small>
          </span>
        </div>
        <div>
          <span className="strip-icon">
            <Check size={19} />
          </span>
          <span>
            <b>Local businesses first</b>
            <small>Discover care close to you</small>
          </span>
        </div>
      </section>

      <section className="intro" id="how">
        <div className="intro-heading">
          <div className="eyebrow">
            <span className="eyebrow-line" /> A BETTER WAY TO BOOK
          </div>
          <h2>
            Your time is yours.
            <br />
            <em>Spend it well.</em>
          </h2>
        </div>
        <div className="intro-copy">
          <p>
            Finding the right barber or salon shouldn't take all afternoon. ORQELI is
            being built to make discovering local businesses and booking a little easier.
          </p>
          <Link className="text-link" to="/business">
            Own a local business? <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="steps">
        <article>
          <span className="step-number">01</span>
          <div className="step-icon">
            <MapPin />
          </div>
          <h3>Find your place</h3>
          <p>Explore businesses in your city and see what feels right for you.</p>
        </article>
        <article>
          <span className="step-number">02</span>
          <div className="step-icon">
            <Scissors />
          </div>
          <h3>Choose your service</h3>
          <p>Get to know the services on offer, at a glance.</p>
        </article>
        <article>
          <span className="step-number">03</span>
          <div className="step-icon">
            <Clock3 />
          </div>
          <h3>Make time for you</h3>
          <p>Booking is on the way. We're laying the right foundations first.</p>
        </article>
      </section>

      <section className="coming">
        <div className="coming-icon">
          <CalendarDays size={21} />
        </div>
        <div>
          <span className="eyebrow">A LITTLE PATIENCE, A BETTER START</span>
          <h2>We're getting the foundations right.</h2>
          <p>
            Business listings and online appointments are coming in a future release. No
            pretend bookings—just a thoughtful start.
          </p>
        </div>
        <Link to="/business" className="coming-link">
          For local businesses <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}

function Portal({
  title,
  eyebrow,
  text,
  icon,
  note,
  children
}: {
  title: string;
  eyebrow: string;
  text: string;
  icon: React.ReactNode;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="portal">
      <div className="portal-card">
        <div className="step-icon">{icon}</div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
        {note && (
          <div className="portal-note">
            <ShieldCheck size={18} />
            <span>{note}</span>
          </div>
        )}
        {children}
        <Link to="/" className="text-link">
          Back to ORQELI <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function LoginPage() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fromState = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    if (status === 'authenticated' && user) {
      const target =
        fromState && fromState.startsWith('/') && fromState !== '/login'
          ? fromState
          : getDefaultRouteForRole(user.role);
      navigate(target, { replace: true });
    }
  }, [status, user, fromState, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedInUser = await login(normalizedEmail, password);
      const target =
        fromState && fromState.startsWith('/') && fromState !== '/login'
          ? fromState
          : getDefaultRouteForRole(loggedInUser.role);
      navigate(target, { replace: true });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to sign in right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <Portal
        title="Checking session…"
        eyebrow="AUTHENTICATION"
        text="Verifying your server session."
        icon={<LogIn />}
      />
    );
  }

  return (
    <section className="portal">
      <div className="portal-card auth-card">
        <div className="step-icon">
          <LogIn />
        </div>
        <span className="eyebrow">WELCOME BACK</span>
        <h1>Sign in to ORQELI</h1>
        <p>Access your customer account, business workspace, or administrator review tools.</p>

        {errorMessage && (
          <div className="form-alert error" role="alert">
            <AlertCircle size={17} />
            <div>{errorMessage}</div>
          </div>
        )}

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <label className="form-field">
            <span>EMAIL ADDRESS</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </label>

          <label className="form-field">
            <span>PASSWORD</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </label>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-footer-links">
          <span>New to ORQELI?</span>
          <Link to="/register" className="text-link">
            Create customer account <ArrowRight size={14} />
          </Link>
          <Link to="/register?role=BUSINESS_OWNER" className="text-link">
            Register a business <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function RegisterPage() {
  const { status, user, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialRole =
    searchParams.get('role') === 'BUSINESS_OWNER' ? 'BUSINESS_OWNER' : 'CUSTOMER';
  const [role, setRole] = useState<'CUSTOMER' | 'BUSINESS_OWNER'>(initialRole);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('Kitwe');
  const [location, setLocation] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'authenticated' && user) {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, [status, user, navigate]);

  const handleRoleChange = (nextRole: 'CUSTOMER' | 'BUSINESS_OWNER') => {
    setRole(nextRole);
    setErrorMessage(null);
    setFieldErrors([]);
    if (nextRole === 'BUSINESS_OWNER') {
      setSearchParams({ role: 'BUSINESS_OWNER' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setFieldErrors([]);

    const clientIssues: string[] = [];
    if (name.trim().length < 2) {
      clientIssues.push('Full name must be at least 2 characters.');
    }
    if (!email.trim().includes('@')) {
      clientIssues.push('Please enter a valid email address.');
    }
    if (password.trim().length < 8) {
      clientIssues.push('Password must be at least 8 characters.');
    }
    if (role === 'BUSINESS_OWNER') {
      if (businessName.trim().length < 2) {
        clientIssues.push('Business name must be at least 2 characters.');
      }
      if (city.trim().length < 2) {
        clientIssues.push('City is required.');
      }
      if (location.trim().length < 2) {
        clientIssues.push('Business neighbourhood or street location is required.');
      }
      const effectiveBizPhone = (businessPhone || phone).trim();
      if (effectiveBizPhone.length < 7) {
        clientIssues.push('Business phone number must be at least 7 characters.');
      }
    }

    if (clientIssues.length > 0) {
      setErrorMessage('Please review the highlighted registration fields.');
      setFieldErrors(clientIssues);
      return;
    }

    setSubmitting(true);
    try {
      const createdUser = await register({
        role,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        ...(role === 'BUSINESS_OWNER'
          ? {
              business: {
                name: businessName.trim(),
                city: city.trim(),
                location: location.trim(),
                phone: (businessPhone || phone).trim(),
                email: businessEmail.trim() || undefined,
                description: businessDescription.trim() || undefined
              }
            }
          : {})
      });
      navigate(getDefaultRouteForRole(createdUser.role), { replace: true });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrorMessage(error.message);
        if (error.details.length > 0) {
          setFieldErrors(error.details.map((d) => d.message));
        }
      } else {
        setErrorMessage('Could not complete registration. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <Portal
        title="Checking session…"
        eyebrow="AUTHENTICATION"
        text="Verifying your server session."
        icon={<UserRound />}
      />
    );
  }

  return (
    <section className="portal">
      <div className="portal-card auth-card">
        <div className="step-icon">
          {role === 'BUSINESS_OWNER' ? <Store /> : <UserRound />}
        </div>
        <span className="eyebrow">CREATE YOUR ACCOUNT</span>
        <h1>
          {role === 'BUSINESS_OWNER'
            ? 'Register your business'
            : 'Join ORQELI'}
        </h1>
        <p>
          {role === 'BUSINESS_OWNER'
            ? 'Create your business owner account and submit your barbershop or salon for ORQELI verification.'
            : 'Create a customer account to manage your profile and upcoming Copperbelt bookings.'}
        </p>

        <div className="role-tabs" role="tablist" aria-label="Account type">
          <button
            type="button"
            role="tab"
            aria-selected={role === 'CUSTOMER'}
            className={role === 'CUSTOMER' ? 'role-tab active' : 'role-tab'}
            onClick={() => handleRoleChange('CUSTOMER')}
          >
            <UserRound size={15} />
            Customer account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'BUSINESS_OWNER'}
            className={role === 'BUSINESS_OWNER' ? 'role-tab active' : 'role-tab'}
            onClick={() => handleRoleChange('BUSINESS_OWNER')}
          >
            <Store size={15} />
            Business owner
          </button>
        </div>

        {role === 'BUSINESS_OWNER' && (
          <div className="portal-note">
            <ShieldCheck size={18} />
            <span>
              New business applications are created with <b>PENDING</b> status and remain
              subject to manual verification and approval by an ORQELI administrator before
              going live.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="form-alert error" role="alert">
            <AlertCircle size={17} />
            <div>
              <b>{errorMessage}</b>
              {fieldErrors.length > 0 && (
                <ul className="error-list">
                  {fieldErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="form-grid">
            <label className="form-field">
              <span>YOUR FULL NAME</span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                placeholder="e.g. Chanda Mwale"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
            </label>

            <label className="form-field">
              <span>PHONE NUMBER {role === 'CUSTOMER' ? '(OPTIONAL)' : ''}</span>
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder="+260 977 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
              />
            </label>
          </div>

          <label className="form-field">
            <span>EMAIL ADDRESS</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </label>

          <label className="form-field">
            <span>PASSWORD (AT LEAST 8 CHARACTERS)</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </label>

          {role === 'BUSINESS_OWNER' && (
            <div className="business-onboarding-section">
              <div className="section-Subhead">BUSINESS ONBOARDING DETAILS</div>

              <label className="form-field">
                <span>BUSINESS NAME</span>
                <input
                  type="text"
                  name="businessName"
                  placeholder="e.g. Nkana Grooming Studio"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  disabled={submitting}
                />
              </label>

              <div className="form-grid">
                <label className="form-field">
                  <span>CITY</span>
                  <select
                    name="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="Kitwe">Kitwe</option>
                    <option value="Ndola">Ndola</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>BUSINESS PHONE</span>
                  <input
                    type="tel"
                    name="businessPhone"
                    placeholder="+260 966 000 000"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    disabled={submitting}
                  />
                </label>
              </div>

              <label className="form-field">
                <span>LOCATION / STREET ADDRESS</span>
                <input
                  type="text"
                  name="location"
                  placeholder="e.g. Parklands, Plot 42, Kitwe"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  disabled={submitting}
                />
              </label>

              <label className="form-field">
                <span>BUSINESS EMAIL (OPTIONAL)</span>
                <input
                  type="email"
                  name="businessEmail"
                  placeholder="bookings@yourbusiness.zm"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  disabled={submitting}
                />
              </label>

              <label className="form-field">
                <span>DESCRIPTION (OPTIONAL)</span>
                <textarea
                  name="businessDescription"
                  rows={3}
                  placeholder="Tell customers about your barbershop or salon services…"
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>
          )}

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting
              ? 'Creating account…'
              : role === 'BUSINESS_OWNER'
                ? 'Submit business & create account'
                : 'Create customer account'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-footer-links">
          <span>Already have an account?</span>
          <Link to="/login" className="text-link">
            Sign in <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function AccountPage() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <Portal
        title="Loading your account…"
        eyebrow="CUSTOMER ACCOUNT"
        text="Restoring your authenticated session."
        icon={<UserRound />}
      />
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return (
    <section className="portal">
      <div className="portal-card workspace-card">
        <div className="step-icon">
          <UserRound />
        </div>
        <span className="eyebrow">AUTHENTICATED ACCOUNT</span>
        <h1>Hello, {user.name}</h1>
        <p>
          Your ORQELI account is active and verified via server-side session authentication.
        </p>

        <div className="profile-summary-grid">
          <div className="summary-item">
            <span className="summary-label">EMAIL</span>
            <b>{user.email ?? '—'}</b>
          </div>
          <div className="summary-item">
            <span className="summary-label">PHONE</span>
            <b>{user.phone ?? 'Not provided'}</b>
          </div>
          <div className="summary-item">
            <span className="summary-label">ROLE</span>
            <b>{roleLabel(user.role)}</b>
          </div>
          <div className="summary-item">
            <span className="summary-label">ACCOUNT STATUS</span>
            <div>
              <span className={`status-badge status-${user.status.toLowerCase()}`}>
                {user.status}
              </span>
            </div>
          </div>
        </div>

        <div className="portal-note">
          <ShieldCheck size={18} />
          <span>
            Online appointment scheduling and guest booking lookup are planned for a future
            phase. Your account bookings will appear here automatically.
          </span>
        </div>

        <div className="workspace-actions">
          {user.role === 'BUSINESS_OWNER' && (
            <Link to="/business" className="primary-button inline-button">
              Open Business Workspace <ArrowRight size={15} />
            </Link>
          )}
          {user.role === 'ADMIN' && (
            <Link to="/admin" className="primary-button inline-button">
              Open Admin Review <ArrowRight size={15} />
            </Link>
          )}
          <Link to="/" className="text-link">
            Back to ORQELI <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function BusinessWorkspacePage() {
  const { status, user, apiFetch } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [editingBusinessId, setEditingBusinessId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('Kitwe');
  const [editLocation, setEditLocation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('Kitwe');
  const [newLocation, setNewLocation] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creatingBusiness, setCreatingBusiness] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && user?.role === 'BUSINESS_OWNER') {
      setLoadingBusinesses(true);
      setErrorMessage(null);
      apiFetch<{ businesses: BusinessSummary[] }>('/api/owner/businesses')
        .then((data) => {
          setBusinesses(data.businesses);
        })
        .catch((err: unknown) => {
          setErrorMessage(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not load your businesses.'
          );
        })
        .finally(() => {
          setLoadingBusinesses(false);
        });
    }
  }, [status, user, apiFetch]);

  const startEditing = (biz: BusinessSummary) => {
    setEditingBusinessId(biz.id);
    setEditName(biz.name);
    setEditCity(biz.city);
    setEditLocation(biz.location);
    setEditPhone(biz.phone);
    setEditDescription(biz.description ?? '');
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSaveEdit = async (event: React.FormEvent, businessId: string) => {
    event.preventDefault();
    setSavingEdit(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await apiFetch<{ business: BusinessSummary }>(
        `/api/owner/businesses/${businessId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: editName.trim(),
            city: editCity.trim(),
            location: editLocation.trim(),
            phone: editPhone.trim(),
            description: editDescription.trim() || null
          })
        }
      );
      setBusinesses((prev) =>
        prev.map((b) => (b.id === businessId ? data.business : b))
      );
      setEditingBusinessId(null);
      setSuccessMessage('Business profile updated.');
    } catch (err) {
      setErrorMessage(
        err instanceof ApiRequestError
          ? err.message
          : 'Failed to update business profile.'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingBusiness(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await apiFetch<{ business: BusinessSummary }>('/api/owner/businesses', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          city: newCity.trim(),
          location: newLocation.trim(),
          phone: newPhone.trim(),
          description: newDescription.trim() || null
        })
      });
      setBusinesses((prev) => [data.business, ...prev]);
      setShowNewForm(false);
      setNewName('');
      setNewLocation('');
      setNewPhone('');
      setNewDescription('');
      setSuccessMessage(
        'New business application submitted with PENDING status for ORQELI manual review.'
      );
    } catch (err) {
      setErrorMessage(
        err instanceof ApiRequestError
          ? err.message
          : 'Failed to submit business application.'
      );
    } finally {
      setCreatingBusiness(false);
    }
  };

  if (status === 'loading') {
    return (
      <Portal
        title="Loading workspace…"
        eyebrow="FOR LOCAL BUSINESSES"
        text="Verifying your business owner session."
        icon={<Store />}
      />
    );
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <Portal
        title="Business workspace"
        eyebrow="FOR LOCAL BUSINESSES"
        text="A dedicated space for business owners to manage their profile, services and appointments—once approved by ORQELI."
        icon={<Store />}
        note="New business applications are reviewed manually by ORQELI before appearing in public discovery."
      >
        <div className="workspace-actions" style={{ marginBottom: 18 }}>
          <Link
            to="/register?role=BUSINESS_OWNER"
            className="primary-button inline-button"
          >
            Register your business <ArrowRight size={15} />
          </Link>
          <Link to="/login" className="secondary-button inline-button">
            Sign in to owner workspace
          </Link>
        </div>
      </Portal>
    );
  }

  if (user.role !== 'BUSINESS_OWNER') {
    return (
      <Portal
        title="Business owner access required"
        eyebrow="ROLE RESTRICTED"
        text={`You are currently signed in as ${user.name} (${roleLabel(user.role)}). Only verified Business Owner accounts can manage business listings here.`}
        icon={<Store />}
        note="Server endpoints under /api/owner/* enforce BUSINESS_OWNER role and ownerScope isolation."
      />
    );
  }

  return (
    <section className="portal">
      <div className="portal-card workspace-card">
        <div className="workspace-header">
          <div>
            <div className="step-icon">
              <Store />
            </div>
            <span className="eyebrow">BUSINESS OWNER WORKSPACE</span>
            <h1>Your businesses</h1>
            <p>
              Manage your Copperbelt business listings. Pending applications become publicly
              discoverable once approved by an ORQELI administrator.
            </p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowNewForm(!showNewForm)}
          >
            <Plus size={15} />
            <span>{showNewForm ? 'Cancel' : 'Add business'}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="form-alert error" role="alert">
            <AlertCircle size={17} />
            <div>{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="form-alert success" role="status">
            <Check size={17} />
            <div>{successMessage}</div>
          </div>
        )}

        {showNewForm && (
          <form
            className="auth-form nested-card"
            onSubmit={(e) => void handleCreateBusiness(e)}
          >
            <div className="section-Subhead">SUBMIT NEW BUSINESS APPLICATION</div>
            <label className="form-field">
              <span>BUSINESS NAME</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Copperbelt Classic Barber"
                required
              />
            </label>
            <div className="form-grid">
              <label className="form-field">
                <span>CITY</span>
                <select value={newCity} onChange={(e) => setNewCity(e.target.value)}>
                  <option value="Kitwe">Kitwe</option>
                  <option value="Ndola">Ndola</option>
                </select>
              </label>
              <label className="form-field">
                <span>PHONE</span>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+260 977 000 000"
                  required
                />
              </label>
            </div>
            <label className="form-field">
              <span>LOCATION</span>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g. Riverside, Kitwe"
                required
              />
            </label>
            <label className="form-field">
              <span>DESCRIPTION (OPTIONAL)</span>
              <textarea
                rows={2}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </label>
            <button type="submit" className="primary-button" disabled={creatingBusiness}>
              {creatingBusiness ? 'Submitting…' : 'Submit for manual verification'}
            </button>
          </form>
        )}

        {loadingBusinesses ? (
          <p>Loading your businesses…</p>
        ) : businesses.length === 0 ? (
          <div className="portal-note">
            <ShieldCheck size={18} />
            <span>You have not submitted a business listing yet.</span>
          </div>
        ) : (
          <div className="business-list">
            {businesses.map((biz) => (
              <div key={biz.id} className="business-item-card">
                <div className="business-item-header">
                  <div>
                    <h3>{biz.name}</h3>
                    <span className="business-meta">
                      {biz.city} · {biz.location} · {biz.phone}
                    </span>
                  </div>
                  <span className={`status-badge status-${biz.status.toLowerCase()}`}>
                    {biz.status}
                  </span>
                </div>

                {biz.description && <p className="business-desc">{biz.description}</p>}

                {biz.status === 'PENDING' && (
                  <div className="portal-note compact">
                    <ShieldCheck size={16} />
                    <span>
                      Pending manual verification by ORQELI. Not yet visible in public
                      discovery.
                    </span>
                  </div>
                )}

                {editingBusinessId === biz.id ? (
                  <form
                    className="auth-form"
                    onSubmit={(e) => void handleSaveEdit(e, biz.id)}
                  >
                    <div className="form-grid">
                      <label className="form-field">
                        <span>BUSINESS NAME</span>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span>CITY</span>
                        <select
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                        >
                          <option value="Kitwe">Kitwe</option>
                          <option value="Ndola">Ndola</option>
                        </select>
                      </label>
                    </div>
                    <div className="form-grid">
                      <label className="form-field">
                        <span>LOCATION</span>
                        <input
                          type="text"
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span>PHONE</span>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          required
                        />
                      </label>
                    </div>
                    <label className="form-field">
                      <span>DESCRIPTION</span>
                      <textarea
                        rows={2}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </label>
                    <div className="workspace-actions">
                      <button
                        type="submit"
                        className="primary-button inline-button"
                        disabled={savingEdit}
                      >
                        {savingEdit ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        className="secondary-button inline-button"
                        onClick={() => setEditingBusinessId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  biz.status !== 'SUSPENDED' && (
                    <button
                      type="button"
                      className="text-link button-link"
                      onClick={() => startEditing(biz)}
                    >
                      Edit business details <ArrowRight size={14} />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface AdminBusinessRecord extends BusinessSummary {
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: UserAccountStatus;
  };
}

function AdminWorkspacePage() {
  const { status, user, apiFetch } = useAuth();
  const location = useLocation();
  const [businesses, setBusinesses] = useState<AdminBusinessRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | BusinessReviewStatus>('ALL');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && user?.role === 'ADMIN') {
      setLoading(true);
      setErrorMessage(null);
      const query = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
      apiFetch<{ businesses: AdminBusinessRecord[] }>(`/api/admin/businesses${query}`)
        .then((data) => {
          setBusinesses(data.businesses);
        })
        .catch((err: unknown) => {
          setErrorMessage(
            err instanceof ApiRequestError
              ? err.message
              : 'Failed to load business applications.'
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [status, user, statusFilter, apiFetch]);

  const handleStatusChange = async (
    businessId: string,
    nextStatus: BusinessReviewStatus
  ) => {
    setUpdatingId(businessId);
    setErrorMessage(null);
    try {
      const data = await apiFetch<{ business: AdminBusinessRecord }>(
        `/api/admin/businesses/${businessId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus })
        }
      );
      setBusinesses((prev) =>
        prev.map((item) => (item.id === businessId ? data.business : item))
      );
    } catch (err) {
      setErrorMessage(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not update business status.'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (status === 'loading') {
    return (
      <Portal
        title="Checking administrator session…"
        eyebrow="PLATFORM ADMINISTRATION"
        text="Verifying server-side administrator permissions."
        icon={<ShieldCheck />}
      />
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.role !== 'ADMIN') {
    return (
      <Portal
        title="Administrator access required"
        eyebrow="403 FORBIDDEN"
        text="Your account does not have permission to access platform administration."
        icon={<ShieldCheck />}
        note="Administrator actions require a server-verified ADMIN role."
      />
    );
  }

  return (
    <section className="portal">
      <div className="portal-card workspace-card">
        <div className="step-icon">
          <ShieldCheck />
        </div>
        <span className="eyebrow">PLATFORM ADMINISTRATION</span>
        <h1>Business verification review</h1>
        <p>
          Review, approve, reject, or suspend Copperbelt business listings. Every status
          change is recorded as an audit event.
        </p>

        <div className="filter-pills" role="group" aria-label="Filter businesses by status">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map(
            (item) => (
              <button
                key={item}
                type="button"
                className={statusFilter === item ? 'filter-pill active' : 'filter-pill'}
                onClick={() => setStatusFilter(item)}
              >
                {item}
              </button>
            )
          )}
        </div>

        {errorMessage && (
          <div className="form-alert error" role="alert">
            <AlertCircle size={17} />
            <div>{errorMessage}</div>
          </div>
        )}

        {loading ? (
          <p>Loading business applications…</p>
        ) : businesses.length === 0 ? (
          <div className="portal-note">
            <ShieldCheck size={18} />
            <span>No business listings match the selected filter.</span>
          </div>
        ) : (
          <div className="business-list">
            {businesses.map((biz) => (
              <div key={biz.id} className="business-item-card">
                <div className="business-item-header">
                  <div>
                    <h3>{biz.name}</h3>
                    <span className="business-meta">
                      {biz.city} · {biz.location} · {biz.phone}
                    </span>
                    <div className="owner-meta">
                      Owner: {biz.owner.name} ({biz.owner.email ?? 'No email'})
                    </div>
                  </div>
                  <span className={`status-badge status-${biz.status.toLowerCase()}`}>
                    {biz.status}
                  </span>
                </div>

                {biz.description && <p className="business-desc">{biz.description}</p>}

                <div className="admin-action-bar">
                  <button
                    type="button"
                    className="admin-btn approve"
                    disabled={updatingId === biz.id || biz.status === 'APPROVED'}
                    onClick={() => void handleStatusChange(biz.id, 'APPROVED')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="admin-btn reject"
                    disabled={updatingId === biz.id || biz.status === 'REJECTED'}
                    onClick={() => void handleStatusChange(biz.id, 'REJECTED')}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="admin-btn suspend"
                    disabled={updatingId === biz.id || biz.status === 'SUSPENDED'}
                    onClick={() => void handleStatusChange(biz.id, 'SUSPENDED')}
                  >
                    Suspend
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Shell() {
  return (
    <AuthProvider>
      <ShellContent />
    </AuthProvider>
  );
}
