import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  History,
  Printer,
  RefreshCw,
  ShieldAlert,
  UserRound
} from 'lucide-react';
import { ApiRequestError, useAuth } from './auth';
import type { StudentPortalAccount, StudentPortalOverview } from './types';

type PortalTab = 'results' | 'history' | 'notices' | 'profile';

export function StudentPortalPage() {
  const { apiFetch, memberships } = useAuth();
  const [overview, setOverview] = useState<StudentPortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>('results');

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiFetch<StudentPortalOverview>('/api/student/portal');
      setOverview(data);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiRequestError
          ? err.message
          : 'Unable to load your student portal.'
      );
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  // Staff/non-student users who accidentally navigate to /student go to /workspace
  const hasStudentMembership = memberships.some((m) => m.role === 'STUDENT');
  if (!loading && memberships.length > 0 && !hasStudentMembership) {
    return <Navigate to="/workspace" replace />;
  }

  if (loading) {
    return (
      <section className="workspace-shell">
        <div className="state-card">
          <h1>Loading student portal…</h1>
          <p>Retrieving your verified academic record and published statements.</p>
        </div>
      </section>
    );
  }

  if (errorMessage || !overview) {
    return (
      <section className="workspace-shell">
        <div className="callout callout-error" role="alert">
          <AlertCircle size={18} />
          <div>
            <strong>Student portal unavailable</strong>
            <p>{errorMessage ?? 'Could not load student portal.'}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadPortal()}
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const primaryAccount: StudentPortalAccount | undefined = overview.accounts[0];

  if (!primaryAccount) {
    return (
      <section className="workspace-shell">
        <div className="state-card">
          <h1>No student school enrolment found</h1>
          <p>Your account is not yet enrolled under a school student portal.</p>
          <div className="inline-actions">
            <Link to="/schools" className="btn btn-primary">
              Find your school
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (primaryAccount.verificationState !== 'VERIFIED' || !primaryAccount.learner) {
    const isRejected = primaryAccount.verificationState === 'REJECTED';
    return (
      <section className="workspace-shell" aria-labelledby="pending-student-heading">
        <article className="opus-banner-card">
          <div className="pack-badges">
            <span className={isRejected ? 'pill pill-warning' : 'pill pill-info'}>
              {isRejected
                ? 'Verification Declined'
                : 'Verification Pending · Awaiting School Office'}
            </span>
            {primaryAccount.school.isSyntheticDemo ? (
              <span className="pill pill-neutral">Synthetic Demo</span>
            ) : null}
          </div>
          <h1 id="pending-student-heading">{overview.studentUser.name}</h1>
          <p className="muted-line">
            {primaryAccount.school.name} (<code>{primaryAccount.school.code}</code>) ·{' '}
            {primaryAccount.school.district}, {primaryAccount.school.province}
          </p>
        </article>

        <div className="state-card">
          {isRejected ? <ShieldAlert size={28} /> : <Clock size={28} />}
          <h2>
            {isRejected
              ? 'Your student registration request was declined by school administration'
              : 'Your student account is awaiting school verification'}
          </h2>
          <p>
            {isRejected
              ? 'Contact your school administration office to confirm your official admission record.'
              : 'Your registration request has been received. Academic records, class assignments, and published term results remain hidden until school leadership verifies and links your admission record.'}
          </p>

          {primaryAccount.pendingRequest ? (
            <dl className="profile-detail-grid">
              <div>
                <dt>Submitted Admission Number</dt>
                <dd className="mono">{primaryAccount.pendingRequest.claimedAdmissionNo}</dd>
              </div>
              <div>
                <dt>Class Note</dt>
                <dd>{primaryAccount.pendingRequest.claimedClassNote ?? 'Not specified'}</dd>
              </div>
              <div>
                <dt>Submitted On</dt>
                <dd>{new Date(primaryAccount.pendingRequest.createdAt).toLocaleDateString()}</dd>
              </div>
              {primaryAccount.pendingRequest.decisionNotes ? (
                <div>
                  <dt>School Office Note</dt>
                  <dd>{primaryAccount.pendingRequest.decisionNotes}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="inline-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadPortal()}
            >
              <RefreshCw size={14} />
              <span>Check verification status</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const { school, learner, termResults, announcements } = primaryAccount;
  const publishedCount = termResults.filter(
    (t) => t.publicationState === 'PUBLISHED'
  ).length;

  return (
    <section className="workspace-shell opus-portal-shell" aria-labelledby="opus-student-heading">
      {/* CBU OPUS-inspired Academic Identity Banner */}
      <header className="opus-banner-card">
        <div className="opus-banner-top">
          <div>
            <span className="eyebrow">
              ORQELI STUDENT ACADEMIC PORTAL · {school.code}
            </span>
            <h1 id="opus-student-heading">
              {learner.firstName} {learner.lastName}
            </h1>
            <p className="opus-school-line">{school.name}</p>
          </div>
          <div className="pack-badges">
            <span className="pill pill-published">
              <CheckCircle2 size={12} /> Verified Student Record
            </span>
            {school.isSyntheticDemo ? (
              <span className="pill pill-info">Synthetic Demo</span>
            ) : null}
          </div>
        </div>

        <dl className="opus-identity-strip">
          <div>
            <dt>Student / Admission ID</dt>
            <dd className="mono">{learner.admissionNumber}</dd>
          </div>
          <div>
            <dt>Current Class</dt>
            <dd>{learner.currentClassName ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt>Academic Session</dt>
            <dd>{learner.currentAcademicYearLabel ?? 'Current Session'}</dd>
          </div>
          <div>
            <dt>Active Term</dt>
            <dd>{learner.currentTermLabel ?? 'In Progress'}</dd>
          </div>
        </dl>
      </header>

      {/* Low-bandwidth mobile-friendly OPUS section tabs */}
      <nav className="opus-tab-bar" aria-label="Student portal sections">
        <button
          type="button"
          className={activeTab === 'results' ? 'opus-tab active' : 'opus-tab'}
          onClick={() => setActiveTab('results')}
        >
          <GraduationCap size={15} />
          <span>Term Results ({publishedCount})</span>
        </button>
        <button
          type="button"
          className={activeTab === 'history' ? 'opus-tab active' : 'opus-tab'}
          onClick={() => setActiveTab('history')}
        >
          <History size={15} />
          <span>Academic History</span>
        </button>
        <button
          type="button"
          className={activeTab === 'notices' ? 'opus-tab active' : 'opus-tab'}
          onClick={() => setActiveTab('notices')}
        >
          <Bell size={15} />
          <span>Notices ({announcements.length})</span>
        </button>
        <button
          type="button"
          className={activeTab === 'profile' ? 'opus-tab active' : 'opus-tab'}
          onClick={() => setActiveTab('profile')}
        >
          <UserRound size={15} />
          <span>Student Profile</span>
        </button>
      </nav>

      {activeTab === 'results' ? (
        <div className="opus-section-stack">
          {termResults.length === 0 ? (
            <div className="state-card">
              <BookOpen size={24} />
              <h2>No term result records yet</h2>
              <p>
                Official term results will appear here once approved and published by{' '}
                {school.name}.
              </p>
            </div>
          ) : (
            termResults.map((termItem) => {
              if (termItem.publicationState !== 'PUBLISHED' || !termItem.reportCard) {
                return (
                  <article
                    key={termItem.packId}
                    className="opus-term-card opus-term-unpublished"
                  >
                    <div className="opus-term-header">
                      <div>
                        <span className="eyebrow">{termItem.academicYearLabel}</span>
                        <h2>
                          {termItem.academicTermLabel} · {termItem.className}
                        </h2>
                      </div>
                      <span className="pill pill-warning">Not Yet Published</span>
                    </div>
                    <p className="muted-line">{termItem.statusMessage}</p>
                  </article>
                );
              }

              const rc = termItem.reportCard;
              return (
                <article key={termItem.packId} className="opus-term-card">
                  <div className="opus-term-header">
                    <div>
                      <span className="eyebrow">{termItem.academicYearLabel}</span>
                      <h2>
                        {termItem.academicTermLabel} · {termItem.className}
                      </h2>
                      <p className="muted-line">
                        Published{' '}
                        {rc.publishedAt
                          ? new Date(rc.publishedAt).toLocaleDateString()
                          : 'officially'}{' '}
                        · Approved by {rc.approvedByName ?? 'School Administration'}
                      </p>
                    </div>
                    <div className="inline-actions">
                      <span className="pill pill-published">Official Published Statement</span>
                      <Link
                        to={`/student/schools/${school.id}/learners/${learner.id}/report-cards/${termItem.packId}`}
                        className="btn btn-primary btn-sm"
                      >
                        <Printer size={14} />
                        <span>Printable A4 Report Card</span>
                      </Link>
                    </div>
                  </div>

                  <div className="opus-summary-metrics">
                    <div className="opus-metric-box">
                      <span>Overall Average</span>
                      <strong>
                        {rc.summary.averagePercentage !== null
                          ? `${rc.summary.averagePercentage.toFixed(1)}%`
                          : '—'}
                      </strong>
                    </div>
                    <div className="opus-metric-box">
                      <span>Aggregate Marks</span>
                      <strong className="mono">
                        {rc.summary.totalScore} / {rc.summary.totalPossible}
                      </strong>
                    </div>
                    <div className="opus-metric-box">
                      <span>Graded Subjects</span>
                      <strong>{rc.summary.gradedSubjectsCount}</strong>
                    </div>
                  </div>

                  <div className="table-scroll">
                    <table className="data-table opus-results-table">
                      <thead>
                        <tr>
                          <th scope="col">Code</th>
                          <th scope="col">Subject</th>
                          <th scope="col">Mark</th>
                          <th scope="col">Grade</th>
                          <th scope="col">Teacher Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rc.subjects.map((sub) => (
                          <tr key={sub.subjectId}>
                            <td className="mono">{sub.subjectCode}</td>
                            <td>
                              <strong>{sub.subjectName}</strong>
                            </td>
                            <td className="mono">
                              {sub.status === 'PRESENT' && sub.score !== null
                                ? `${sub.score} / ${sub.maxMark} (${sub.percentage?.toFixed(0)}%)`
                                : sub.status}
                            </td>
                            <td>
                              <span className="grade-chip">{sub.grade}</span>
                            </td>
                            <td>{sub.teacherComment ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : null}

      {activeTab === 'history' ? (
        <article className="opus-term-card">
          <h2>Academic Session &amp; Term Progression</h2>
          <p className="muted-line">
            Chronological record of your term registrations and result publication status at{' '}
            {school.name}.
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Academic Year</th>
                  <th scope="col">Term</th>
                  <th scope="col">Class</th>
                  <th scope="col">Publication Status</th>
                  <th scope="col">Average</th>
                  <th scope="col">Statement</th>
                </tr>
              </thead>
              <tbody>
                {termResults.map((item) => (
                  <tr key={item.packId}>
                    <td>{item.academicYearLabel}</td>
                    <td>{item.academicTermLabel}</td>
                    <td>{item.className}</td>
                    <td>
                      {item.publicationState === 'PUBLISHED' ? (
                        <span className="pill pill-published">Published</span>
                      ) : (
                        <span className="pill pill-warning">Unpublished</span>
                      )}
                    </td>
                    <td className="mono">
                      {item.reportCard?.summary.averagePercentage !== null &&
                      item.reportCard?.summary.averagePercentage !== undefined
                        ? `${item.reportCard.summary.averagePercentage.toFixed(1)}%`
                        : '—'}
                    </td>
                    <td>
                      {item.publicationState === 'PUBLISHED' ? (
                        <Link
                          to={`/student/schools/${school.id}/learners/${learner.id}/report-cards/${item.packId}`}
                          className="btn btn-secondary btn-sm"
                        >
                          <FileText size={14} />
                          <span>View statement</span>
                        </Link>
                      ) : (
                        <span className="muted-line">Pending publication</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {activeTab === 'notices' ? (
        <div className="opus-section-stack">
          {announcements.length === 0 ? (
            <div className="state-card">
              <Bell size={24} />
              <h2>No active school notices</h2>
              <p>Official school and result publication notices will be posted here.</p>
            </div>
          ) : (
            announcements.map((notice) => (
              <article key={notice.id} className="opus-term-card">
                <div className="opus-term-header">
                  <div>
                    <span className="eyebrow">
                      POSTED {new Date(notice.publishedAt).toLocaleDateString()} ·{' '}
                      {notice.postedByName}
                    </span>
                    <h2>{notice.title}</h2>
                  </div>
                </div>
                <p>{notice.body}</p>
              </article>
            ))
          )}
        </div>
      ) : null}

      {activeTab === 'profile' ? (
        <article className="opus-term-card">
          <h2>Verified Student Record &amp; Account Profile</h2>
          <dl className="profile-detail-grid">
            <div>
              <dt>Student Name</dt>
              <dd>
                {learner.firstName} {learner.lastName}
              </dd>
            </div>
            <div>
              <dt>Admission Number</dt>
              <dd className="mono">{learner.admissionNumber}</dd>
            </div>
            <div>
              <dt>Login Email</dt>
              <dd>{overview.studentUser.email ?? '—'}</dd>
            </div>
            <div>
              <dt>Verified School</dt>
              <dd>
                {school.name} ({school.code})
              </dd>
            </div>
            <div>
              <dt>Verification Method</dt>
              <dd>
                {learner.verificationMethod === 'ENROLMENT_CODE'
                  ? 'Single-use school enrolment code'
                  : 'School administration approval'}
              </dd>
            </div>
            <div>
              <dt>Verified Date</dt>
              <dd>{new Date(learner.verifiedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </article>
      ) : null}
    </section>
  );
}
