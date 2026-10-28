import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { ApiRequestError, parseApiResponse, useAuth } from './auth';
import { transportFetch } from './runtimeEnv';
import type {
  PublicSchoolProfile,
  SandboxPersonasResponse,
  StudentVerificationMethod
} from './types';

export function StudentRegistrationPage() {
  const { status, memberships, registerStudent, health } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSchoolCode = searchParams.get('schoolCode') ?? '';

  const [schools, setSchools] = useState<PublicSchoolProfile[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [fullName, setFullName] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [verificationMode, setVerificationMode] =
    useState<StudentVerificationMethod>('ENROLMENT_CODE');
  const [enrolmentCode, setEnrolmentCode] = useState('');
  const [classHint, setClassHint] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sandboxHint, setSandboxHint] =
    useState<SandboxPersonasResponse['demoEnrolmentWalkthrough']>(undefined);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await transportFetch('/api/public/schools', {
          cache: 'no-store'
        });
        const body = await parseApiResponse<{ schools: PublicSchoolProfile[] }>(res);
        if (!active) return;
        setSchools(body.schools);

        const eligible = body.schools.filter((s) => s.canSelfRegister);
        const preselected = initialSchoolCode
          ? eligible.find(
              (s) => s.code.toLowerCase() === initialSchoolCode.toLowerCase()
            )
          : eligible[0];
        if (preselected) {
          setSelectedSchoolId(preselected.id);
        }
      } catch {
        // Handled via empty schools fallback UI
      } finally {
        if (active) setLoadingSchools(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [initialSchoolCode]);

  useEffect(() => {
    if (!health?.sandboxMode) {
      setSandboxHint(undefined);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await transportFetch('/api/sandbox/personas', {
          cache: 'no-store'
        });
        if (!res.ok) return;
        const body = (await res.json()) as SandboxPersonasResponse;
        if (active) setSandboxHint(body.demoEnrolmentWalkthrough);
      } catch {
        // Ignore optional sandbox walkthrough helper
      }
    })();
    return () => {
      active = false;
    };
  }, [health?.sandboxMode]);

  const eligibleSchools = useMemo(
    () => schools.filter((s) => s.canSelfRegister),
    [schools]
  );

  if (status === 'authenticated') {
    const hasStudentRole = memberships.some((m) => m.role === 'STUDENT');
    return <Navigate to={hasStudentRole ? '/student' : '/workspace'} replace />;
  }

  const handlePopulateSyntheticWalkthrough = () => {
    if (!sandboxHint) return;
    const match = eligibleSchools.find(
      (s) => s.code.toLowerCase() === sandboxHint.schoolCode.toLowerCase()
    );
    if (match) setSelectedSchoolId(match.id);
    setFullName('Chisomo Banda');
    setAdmissionNumber(sandboxHint.admissionNumber);
    setVerificationMode('ENROLMENT_CODE');
    setEnrolmentCode(sandboxHint.enrolmentCode);
    setEmail(`chisomo.${Date.now().toString().slice(-4)}@synthetic.orqeli.invalid`);
    setPassword('SyntheticDemo!2026');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await registerStudent({
        schoolId: selectedSchoolId,
        fullName,
        admissionNumber,
        email,
        password,
        verificationMode,
        enrolmentCode: verificationMode === 'ENROLMENT_CODE' ? enrolmentCode : null,
        classHint: verificationMode === 'STAFF_APPROVAL' ? classHint : null
      });
      navigate('/student', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const detailLine = err.details[0]?.message;
        setErrorMessage(detailLine ? `${err.message} ${detailLine}` : err.message);
      } else {
        setErrorMessage('Registration could not be completed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-layout" aria-labelledby="student-reg-heading">
      <div className="auth-card">
        <div className="breadcrumb-row">
          <Link to="/schools" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} />
            <span>Browse schools</span>
          </Link>
        </div>

        <span className="eyebrow">STUDENT ACADEMIC PORTAL ENROLMENT</span>
        <h1 id="student-reg-heading">Register Your Student Account</h1>
        <p className="auth-lead">
          Select your verified school and enter your official learner admission number. Accounts
          are never linked by name or class alone.
        </p>

        {errorMessage ? (
          <div className="callout callout-error" role="alert">
            <AlertCircle size={18} />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {loadingSchools ? (
          <p className="muted-line">Loading participating schools…</p>
        ) : eligibleSchools.length === 0 ? (
          <div className="callout callout-warning">
            <p>
              No schools currently have online student registration enabled. Check the{' '}
              <Link to="/schools">public school directory</Link>.
            </p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="reg-school">1. Select Your School</label>
              <select
                id="reg-school"
                required
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
              >
                {eligibleSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code} · {s.district})
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="reg-fullname">2. Student Full Name</label>
              <input
                id="reg-fullname"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Chisomo Banda"
              />
            </div>

            <div className="field-group">
              <label htmlFor="reg-admission">3. School Learner Admission Number</label>
              <input
                id="reg-admission"
                type="text"
                required
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value.toUpperCase())}
                placeholder="e.g. SYN-2026-0802"
              />
            </div>

            <fieldset className="verification-mode-fieldset">
              <legend>4. School Verification Method</legend>
              <div className="verification-mode-grid">
                <label
                  className={
                    verificationMode === 'ENROLMENT_CODE'
                      ? 'mode-option active'
                      : 'mode-option'
                  }
                >
                  <input
                    type="radio"
                    name="verificationMode"
                    value="ENROLMENT_CODE"
                    checked={verificationMode === 'ENROLMENT_CODE'}
                    onChange={() => setVerificationMode('ENROLMENT_CODE')}
                  />
                  <div>
                    <strong>
                      <KeyRound size={14} /> Single-Use Enrolment Code
                    </strong>
                    <span>Immediate link using a code slip issued by your school.</span>
                  </div>
                </label>

                <label
                  className={
                    verificationMode === 'STAFF_APPROVAL'
                      ? 'mode-option active'
                      : 'mode-option'
                  }
                >
                  <input
                    type="radio"
                    name="verificationMode"
                    value="STAFF_APPROVAL"
                    checked={verificationMode === 'STAFF_APPROVAL'}
                    onChange={() => setVerificationMode('STAFF_APPROVAL')}
                  />
                  <div>
                    <strong>
                      <UserCheck size={14} /> School Office Approval
                    </strong>
                    <span>Submit a pending verification request to school staff.</span>
                  </div>
                </label>
              </div>
            </fieldset>

            {verificationMode === 'ENROLMENT_CODE' ? (
              <div className="field-group">
                <label htmlFor="reg-enrolment-code">Single-Use Enrolment Code</label>
                <input
                  id="reg-enrolment-code"
                  type="text"
                  required
                  value={enrolmentCode}
                  onChange={(e) => setEnrolmentCode(e.target.value.toUpperCase())}
                  placeholder="ORQ-XXXX-XXXX"
                  className="mono"
                />
              </div>
            ) : (
              <div className="field-group">
                <label htmlFor="reg-class-hint">Current Grade / Class (Optional Note)</label>
                <input
                  id="reg-class-hint"
                  type="text"
                  maxLength={64}
                  value={classHint}
                  onChange={(e) => setClassHint(e.target.value)}
                  placeholder="e.g. Grade 9A"
                />
              </div>
            )}

            <div className="field-group">
              <label htmlFor="reg-email">5. Student Login Email</label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student.name@example.zm"
              />
            </div>

            <div className="field-group">
              <label htmlFor="reg-password">6. Create Password (8+ chars, letter &amp; number/symbol)</label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={submitting || !selectedSchoolId}
            >
              <span>
                {submitting
                  ? 'Submitting registration…'
                  : verificationMode === 'ENROLMENT_CODE'
                    ? 'Verify & open student portal'
                    : 'Submit verification request'}
              </span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        <div className="auth-footnote">
          <ShieldCheck size={16} />
          <p>
            Already registered? <Link to="/login?returnTo=%2Fstudent">Sign in to your student portal</Link>.
          </p>
        </div>
      </div>

      <aside className="sandbox-personas-card" aria-labelledby="enrolment-rules-heading">
        <span className="eyebrow">HOW VERIFICATION WORKS</span>
        <h2 id="enrolment-rules-heading">Protecting Student Academic Privacy</h2>
        <ul className="compact-check-list">
          <li>
            <strong>School-bound codes:</strong> Single-use enrolment codes are cryptographically
            hashed, expire automatically, and bind strictly to one school admission record.
          </li>
          <li>
            <strong>Office review fallback:</strong> Without a code, your request enters the school
            administration queue and shows zero academic data until approved.
          </li>
          <li>
            <strong>Published results only:</strong> Draft, submitted, and unapproved marks are
            never visible in the student portal.
          </li>
        </ul>

        {sandboxHint ? (
          <div className="sandbox-walkthrough-box">
            <span className="eyebrow">SYNTHETIC SANDBOX WALKTHROUGH</span>
            <p className="muted-line">
              Test immediate enrolment-code verification using the pre-issued synthetic learner
              slip for <strong>Chisomo Banda</strong> at <code>{sandboxHint.schoolCode}</code>:
            </p>
            <p className="mono">
              Admission: {sandboxHint.admissionNumber} · Code: {sandboxHint.enrolmentCode}
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePopulateSyntheticWalkthrough}
            >
              <span>Fill synthetic code example</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : null}
      </aside>
    </section>
  );
}
