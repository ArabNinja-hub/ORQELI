import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert
} from 'lucide-react';
import { parseApiResponse, ApiRequestError } from './auth';
import { transportFetch } from './runtimeEnv';
import type { PublicSchoolProfile, SchoolSector } from './types';
import { formatSchoolSector } from './workflowRules';

const ZAMBIAN_PROVINCES = [
  'Central',
  'Copperbelt',
  'Eastern',
  'Luapula',
  'Lusaka',
  'Muchinga',
  'Northern',
  'North-Western',
  'Southern',
  'Western'
];

export function SchoolDiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryInput, setQueryInput] = useState(searchParams.get('q') ?? '');
  const [province, setProvince] = useState(searchParams.get('province') ?? '');
  const [sector, setSector] = useState<string>(searchParams.get('sector') ?? '');
  const [portalOnly, setPortalOnly] = useState(
    searchParams.get('portalOnly') === 'true'
  );

  const [schools, setSchools] = useState<PublicSchoolProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSchools = useCallback(
    async (filters: {
      q: string;
      province: string;
      sector: string;
      portalOnly: boolean;
    }) => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams();
        if (filters.q.trim()) params.set('q', filters.q.trim());
        if (filters.province) params.set('province', filters.province);
        if (filters.sector) params.set('sector', filters.sector);
        if (filters.portalOnly) params.set('portalOnly', 'true');

        const qs = params.toString();
        const res = await transportFetch(
          `/api/public/schools${qs ? `?${qs}` : ''}`,
          { cache: 'no-store' }
        );
        const body = await parseApiResponse<{ schools: PublicSchoolProfile[] }>(res);
        setSchools(body.schools);
      } catch (err) {
        setErrorMessage(
          err instanceof ApiRequestError
            ? err.message
            : 'Unable to load the public school directory right now.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadSchools({
      q: searchParams.get('q') ?? '',
      province: searchParams.get('province') ?? '',
      sector: searchParams.get('sector') ?? '',
      portalOnly: searchParams.get('portalOnly') === 'true'
    });
  }, [loadSchools, searchParams]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (queryInput.trim()) next.set('q', queryInput.trim());
    if (province) next.set('province', province);
    if (sector) next.set('sector', sector);
    if (portalOnly) next.set('portalOnly', 'true');
    setSearchParams(next);
  };

  const clearFilters = () => {
    setQueryInput('');
    setProvince('');
    setSector('');
    setPortalOnly(false);
    setSearchParams(new URLSearchParams());
  };

  return (
    <section className="workspace-shell" aria-labelledby="directory-heading">
      <header className="workspace-header-card">
        <div className="workspace-header-top">
          <div>
            <span className="eyebrow">PUBLIC SCHOOL DISCOVERY · ZAMBIA</span>
            <h1 id="directory-heading">Find Your School on ORQELI Education</h1>
            <p className="muted-line">
              Search participating primary, secondary, and community schools by name, province,
              district, or school code before registering or signing in to the student portal.
            </p>
          </div>
          <div className="inline-actions">
            <Link to="/student/register" className="btn btn-primary btn-sm">
              <span>Student registration</span>
              <ArrowRight size={14} />
            </Link>
            <Link to="/login?returnTo=%2Fstudent" className="btn btn-secondary btn-sm">
              <span>Student sign in</span>
            </Link>
          </div>
        </div>

        <form className="directory-filter-bar" onSubmit={applyFilters}>
          <div className="field-group directory-search-field">
            <label htmlFor="school-search-q">School Name, Code, or District</label>
            <input
              id="school-search-q"
              type="search"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="e.g. Lukanga, Chilanga, SYN-ZM-LUS-01, or SYN-REG-LUS-0101"
            />
          </div>

          <div className="field-group">
            <label htmlFor="school-filter-province">Province</label>
            <select
              id="school-filter-province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">All provinces</option>
              {ZAMBIAN_PROVINCES.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="school-filter-sector">School Sector</label>
            <select
              id="school-filter-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value as SchoolSector | '')}
            >
              <option value="">All sectors</option>
              <option value="GOVERNMENT">Government</option>
              <option value="PRIVATE">Private</option>
              <option value="COMMUNITY">Community</option>
            </select>
          </div>

          <label className="directory-checkbox-label" htmlFor="school-filter-portal">
            <input
              id="school-filter-portal"
              type="checkbox"
              checked={portalOnly}
              onChange={(e) => setPortalOnly(e.target.checked)}
            />
            <span>Active student portal only</span>
          </label>

          <div className="directory-filter-actions">
            <button type="submit" className="btn btn-primary btn-sm">
              <Search size={14} />
              <span>Search</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </form>
      </header>

      {loading ? (
        <div className="state-card" role="status">
          <h2>Loading schools…</h2>
          <p>Fetching verified public school profiles.</p>
        </div>
      ) : errorMessage ? (
        <div className="callout callout-error" role="alert">
          <AlertCircle size={18} />
          <div>
            <strong>Could not load schools</strong>
            <p>{errorMessage}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                void loadSchools({
                  q: queryInput,
                  province,
                  sector,
                  portalOnly
                })
              }
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : schools.length === 0 ? (
        <div className="state-card">
          <h2>No matching schools found</h2>
          <p>
            No listed schools matched your search criteria. Check your school code or district
            spelling, or clear your filters to browse all listed schools.
          </p>
          <div className="inline-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={clearFilters}>
              Show all listed schools
            </button>
          </div>
        </div>
      ) : (
        <div className="school-directory-grid">
          {schools.map((school) => (
            <article key={school.id} className="school-directory-card">
              <div className="school-directory-card-top">
                <div>
                  <div className="pack-badges">
                    <span className="pill pill-neutral">
                      {formatSchoolSector(school.sector)}
                    </span>
                    {school.canSelfRegister ? (
                      <span className="pill pill-published">
                        <CheckCircle2 size={12} /> Student Portal Active
                      </span>
                    ) : (
                      <span className="pill pill-warning">Portal Not Yet Enabled</span>
                    )}
                    {school.isSyntheticDemo ? (
                      <span className="pill pill-info">Synthetic Demo</span>
                    ) : null}
                  </div>
                  <h2>{school.name}</h2>
                </div>
                <code className="mono school-code-chip">{school.code}</code>
              </div>

              <p className="school-location-line">
                <MapPin size={14} />
                <span>
                  {school.district}, {school.province} Province
                  {school.levelSummary ? ` · ${school.levelSummary}` : ''}
                </span>
              </p>

              {school.publicDescription ? (
                <p className="muted-line">{school.publicDescription}</p>
              ) : null}

              <dl className="school-meta-strip">
                <div>
                  <dt>Registration Ref</dt>
                  <dd className="mono">{school.registrationNumber ?? 'Not listed'}</dd>
                </div>
                <div>
                  <dt>Academic Session</dt>
                  <dd>{school.currentAcademicYearLabel ?? 'In preparation'}</dd>
                </div>
              </dl>

              <div className="inline-actions">
                <Link
                  to={`/schools/${encodeURIComponent(school.code)}`}
                  className="btn btn-secondary btn-sm"
                >
                  <Building2 size={14} />
                  <span>School profile</span>
                </Link>
                {school.canSelfRegister ? (
                  <Link
                    to={`/student/register?schoolCode=${encodeURIComponent(school.code)}`}
                    className="btn btn-primary btn-sm"
                  >
                    <span>Enrol as student</span>
                    <ArrowRight size={14} />
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function PublicSchoolProfilePage() {
  const { schoolCode } = useParams<{ schoolCode: string }>();
  const [school, setSchool] = useState<PublicSchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolCode) return;
    let active = true;
    setLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const res = await transportFetch(
          `/api/public/schools/${encodeURIComponent(schoolCode)}`,
          { cache: 'no-store' }
        );
        const body = await parseApiResponse<{ school: PublicSchoolProfile }>(res);
        if (active) setSchool(body.school);
      } catch (err) {
        if (active) {
          setErrorMessage(
            err instanceof ApiRequestError
              ? err.message
              : 'Unable to load school profile.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [schoolCode]);

  if (loading) {
    return (
      <section className="workspace-shell">
        <div className="state-card">
          <h1>Loading school profile…</h1>
          <p>Retrieving public school details.</p>
        </div>
      </section>
    );
  }

  if (errorMessage || !school) {
    return (
      <section className="workspace-shell">
        <div className="state-card">
          <span className="eyebrow">SCHOOL PROFILE UNAVAILABLE</span>
          <h1>School not found</h1>
          <p>{errorMessage ?? 'The requested school profile does not exist.'}</p>
          <div className="inline-actions">
            <Link to="/schools" className="btn btn-primary">
              <ArrowLeft size={14} />
              <span>Back to school directory</span>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-shell" aria-labelledby="school-profile-heading">
      <div className="breadcrumb-row">
        <Link to="/schools" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} />
          <span>All schools</span>
        </Link>
      </div>

      <article className="workspace-header-card">
        <div className="pack-badges">
          <span className="pill pill-neutral">{formatSchoolSector(school.sector)}</span>
          {school.canSelfRegister ? (
            <span className="pill pill-published">
              <CheckCircle2 size={12} /> ORQELI Student Portal Active
            </span>
          ) : (
            <span className="pill pill-warning">Student Portal Not Yet Enabled</span>
          )}
          {school.isSyntheticDemo ? (
            <span className="pill pill-info">Synthetic Demonstration School</span>
          ) : null}
        </div>

        <h1 id="school-profile-heading">{school.name}</h1>
        <p className="muted-line">
          {school.publicDescription ??
            'Approved public school directory profile on ORQELI Education.'}
        </p>

        <dl className="profile-detail-grid">
          <div>
            <dt>ORQELI School Code</dt>
            <dd className="mono">{school.code}</dd>
          </div>
          <div>
            <dt>Registration Number</dt>
            <dd className="mono">{school.registrationNumber ?? 'Not listed'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>
              {school.district}, {school.province} Province
            </dd>
          </div>
          <div>
            <dt>Academic Levels</dt>
            <dd>{school.levelSummary ?? 'General Education'}</dd>
          </div>
          <div>
            <dt>Current Academic Session</dt>
            <dd>{school.currentAcademicYearLabel ?? 'In preparation'}</dd>
          </div>
          <div>
            <dt>School Office Contact</dt>
            <dd>{school.phone ?? school.email ?? 'Contact via school office'}</dd>
          </div>
        </dl>

        {school.canSelfRegister ? (
          <div className="portal-cta-box">
            <div>
              <h2>Student Academic Portal Access</h2>
              <p className="muted-line">
                Enrolled learners at {school.name} can register with a single-use enrolment code
                from the school office or submit an admission verification request.
              </p>
            </div>
            <div className="inline-actions">
              <Link
                to={`/student/register?schoolCode=${encodeURIComponent(school.code)}`}
                className="btn btn-primary"
              >
                <span>Register student account</span>
                <ArrowRight size={15} />
              </Link>
              <Link to="/login?returnTo=%2Fstudent" className="btn btn-secondary">
                <span>Student sign in</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="callout callout-warning">
            <ShieldAlert size={18} />
            <div>
              <strong>Student portal not yet enabled at this school</strong>
              <p>
                {school.name} has not enabled online student self-enrolment on ORQELI Education.
                Official term results continue to be distributed directly by the school office.
              </p>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
