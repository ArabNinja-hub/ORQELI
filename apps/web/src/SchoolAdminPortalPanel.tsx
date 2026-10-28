import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  XCircle
} from 'lucide-react';
import { ApiRequestError, useAuth } from './auth';
import type {
  AdminRegistrationRequest,
  AdminRosterLearner,
  AnnouncementAudience,
  IssuedEnrolmentCode,
  SchoolAdminPortalState,
  SchoolAnnouncementItem
} from './types';

interface Props {
  schoolId: string;
  onMutated?: () => void;
}

export function SchoolAdminPortalPanel({ schoolId, onMutated }: Props) {
  const { apiFetch } = useAuth();
  const [state, setState] = useState<SchoolAdminPortalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [freshIssuedCode, setFreshIssuedCode] = useState<IssuedEnrolmentCode | null>(
    null
  );

  // Add learner form
  const [admInput, setAdmInput] = useState('');
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [classIdInput, setClassIdInput] = useState('');

  // Pending request learner selection overrides + reject note inputs
  const [selectedLearnerByReq, setSelectedLearnerByReq] = useState<
    Record<string, string>
  >({});
  const [rejectReasonByReq, setRejectReasonByReq] = useState<Record<string, string>>({});

  // Announcement form
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeAudience, setNoticeAudience] =
    useState<AnnouncementAudience>('STUDENTS_AND_STAFF');

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SchoolAdminPortalState>(
        `/api/schools/${encodeURIComponent(schoolId)}/admin/student-portal`
      );
      setState(res);
      if (res.classes[0] && !classIdInput) {
        setClassIdInput(res.classes[0].id);
      }
      const nextSelections: Record<string, string> = {};
      for (const req of res.registrationRequests) {
        if (req.status === 'PENDING' && req.suggestedLearner && !req.suggestedLearner.alreadyLinked) {
          nextSelections[req.id] = req.suggestedLearner.id;
        }
      }
      setSelectedLearnerByReq((prev) => ({ ...nextSelections, ...prev }));
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Unable to load student portal administration.'
      );
    } finally {
      setLoading(false);
    }
  }, [apiFetch, schoolId, classIdInput]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleCreateLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch<{ learner: AdminRosterLearner }>(
        `/api/schools/${encodeURIComponent(schoolId)}/admin/learners`,
        {
          method: 'POST',
          body: JSON.stringify({
            admissionNumber: admInput,
            firstName: firstNameInput,
            lastName: lastNameInput,
            schoolClassId: classIdInput,
            preferredChannel: 'PRINT_REPORT'
          })
        }
      );
      setAdmInput('');
      setFirstNameInput('');
      setLastNameInput('');
      setFeedback({ tone: 'success', text: 'Learner added to school roster.' });
      await loadState();
      onMutated?.();
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err instanceof ApiRequestError ? err.message : 'Could not create learner.'
      });
    } finally {
      setBusy(false);
    }
  };

  const handleIssueCode = async (learnerId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ enrolmentCode: IssuedEnrolmentCode }>(
        `/api/schools/${encodeURIComponent(
          schoolId
        )}/admin/learners/${encodeURIComponent(learnerId)}/enrolment-codes`,
        {
          method: 'POST',
          body: JSON.stringify({ expiresInDays: 14 })
        }
      );
      setFreshIssuedCode(res.enrolmentCode);
      setFeedback({
        tone: 'success',
        text: `Issued single-use enrolment code for ${res.enrolmentCode.learnerName}. Copy it now; only its hash is stored.`
      });
      await loadState();
      onMutated?.();
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err instanceof ApiRequestError ? err.message : 'Could not issue code.'
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeCode = async (codeId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch<{ status: string }>(
        `/api/schools/${encodeURIComponent(
          schoolId
        )}/admin/enrolment-codes/${encodeURIComponent(codeId)}/revoke`,
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );
      if (freshIssuedCode?.id === codeId) {
        setFreshIssuedCode(null);
      }
      setFeedback({ tone: 'success', text: 'Enrolment code revoked.' });
      await loadState();
      onMutated?.();
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err instanceof ApiRequestError ? err.message : 'Could not revoke code.'
      });
    } finally {
      setBusy(false);
    }
  };

  const handleApproveRequest = async (req: AdminRegistrationRequest) => {
    const targetLearnerId = selectedLearnerByReq[req.id] ?? '';
    if (!targetLearnerId) {
      setFeedback({
        tone: 'error',
        text: 'Select an unlinked school learner record before approving.'
      });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch<{ request: AdminRegistrationRequest }>(
        `/api/schools/${encodeURIComponent(
          schoolId
        )}/admin/student-requests/${encodeURIComponent(req.id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({
            learnerId: targetLearnerId,
            decisionNotes: 'Verified against official school admission register.'
          })
        }
      );
      setFeedback({
        tone: 'success',
        text: `Approved and linked student account for ${req.claimedName}.`
      });
      await loadState();
      onMutated?.();
    } catch (err) {
      setFeedback({
        tone: 'error',
        text:
          err instanceof ApiRequestError
            ? err.message
            : 'Could not approve registration request.'
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRejectRequest = async (req: AdminRegistrationRequest) => {
    const reason = (rejectReasonByReq[req.id] ?? '').trim();
    if (reason.length < 5) {
      setFeedback({
        tone: 'error',
        text: 'Enter a clear decline reason of at least 5 characters.'
      });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch<{ request: AdminRegistrationRequest }>(
        `/api/schools/${encodeURIComponent(
          schoolId
        )}/admin/student-requests/${encodeURIComponent(req.id)}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ decisionNotes: reason })
        }
      );
      setFeedback({
        tone: 'success',
        text: `Declined student registration request from ${req.claimedName}.`
      });
      await loadState();
      onMutated?.();
    } catch (err) {
      setFeedback({
        tone: 'error',
        text:
          err instanceof ApiRequestError
            ? err.message
            : 'Could not decline registration request.'
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch<{ announcement: SchoolAnnouncementItem }>(
        `/api/schools/${encodeURIComponent(schoolId)}/admin/announcements`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: noticeTitle,
            body: noticeBody,
            audience: noticeAudience
          })
        }
      );
      setNoticeTitle('');
      setNoticeBody('');
      setFeedback({
        tone: 'success',
        text: 'School announcement published.'
      });
      await loadState();
      onMutated?.();
    } catch (err) {
      setFeedback({
        tone: 'error',
        text:
          err instanceof ApiRequestError
            ? err.message
            : 'Could not publish announcement.'
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="workspace-panel">
        <p className="muted-line">Loading student portal &amp; roster administration…</p>
      </section>
    );
  }

  if (error || !state) {
    return (
      <section className="workspace-panel">
        <div className="callout callout-error">
          <AlertCircle size={18} />
          <p>{error ?? 'Unable to load student portal administration.'}</p>
        </div>
      </section>
    );
  }

  const unlinkedLearners = state.learners.filter((l) => !l.linkedStudent && l.active);
  const pendingRequests = state.registrationRequests.filter(
    (r) => r.status === 'PENDING'
  );

  return (
    <section
      className="workspace-panel admin-student-portal-section"
      aria-labelledby="admin-student-portal-heading"
    >
      <div className="panel-head-row">
        <div className="panel-title-group">
          <ShieldCheck size={18} />
          <h2 id="admin-student-portal-heading">
            Student Portal Verification, Roster &amp; Notices
          </h2>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void loadState()}
          disabled={busy}
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      <p className="muted-line">
        Manage school learner admission records, issue single-use enrolment codes, verify
        pending student registration requests ({pendingRequests.length} pending), and post
        official publication notices.
      </p>

      {feedback ? (
        <div
          className={
            feedback.tone === 'success'
              ? 'callout callout-success'
              : 'callout callout-error'
          }
          role="status"
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <p>{feedback.text}</p>
        </div>
      ) : null}

      {freshIssuedCode ? (
        <div className="issued-code-banner" role="region" aria-label="Newly issued single-use enrolment code">
          <div>
            <span className="eyebrow">SINGLE-USE ENROLMENT SLIP (DISPLAYED ONCE)</span>
            <p>
              <strong>{freshIssuedCode.learnerName}</strong> (
              <code className="mono">{freshIssuedCode.admissionNumber}</code>) · Expires{' '}
              {new Date(freshIssuedCode.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <code className="issued-code-value">{freshIssuedCode.plainCode}</code>
        </div>
      ) : null}

      {/* 1. Pending Student Registration Verification Queue */}
      <div className="admin-subpanel">
        <h3>
          <UserCheck size={16} /> Pending Student Registration Requests (
          {pendingRequests.length})
        </h3>
        {pendingRequests.length === 0 ? (
          <p className="empty-inline">
            No pending student verification requests awaiting review.
          </p>
        ) : (
          <div className="admin-request-list">
            {pendingRequests.map((req) => (
              <div key={req.id} className="admin-request-card">
                <div>
                  <strong>{req.claimedName}</strong>{' '}
                  <span className="muted-inline">({req.applicantEmail ?? 'no email'})</span>
                  <p className="muted-line">
                    Submitted Admission ID:{' '}
                    <code className="mono">{req.claimedAdmissionNo}</code>
                    {req.claimedClassNote ? ` · Class note: ${req.claimedClassNote}` : ''}
                  </p>
                </div>

                <div className="admin-request-controls">
                  <label className="sr-only" htmlFor={`link-learner-${req.id}`}>
                    Link to school learner record
                  </label>
                  <select
                    id={`link-learner-${req.id}`}
                    value={selectedLearnerByReq[req.id] ?? ''}
                    onChange={(e) =>
                      setSelectedLearnerByReq((prev) => ({
                        ...prev,
                        [req.id]: e.target.value
                      }))
                    }
                  >
                    <option value="">Select school learner to link…</option>
                    {unlinkedLearners.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.admissionNumber} — {l.firstName} {l.lastName} (
                        {l.currentClassName ?? 'Unassigned'})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => void handleApproveRequest(req)}
                  >
                    <CheckCircle2 size={14} />
                    <span>Approve &amp; link</span>
                  </button>

                  <input
                    type="text"
                    placeholder="Reason if declining…"
                    aria-label={`Decline reason for ${req.claimedName}`}
                    value={rejectReasonByReq[req.id] ?? ''}
                    onChange={(e) =>
                      setRejectReasonByReq((prev) => ({
                        ...prev,
                        [req.id]: e.target.value
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void handleRejectRequest(req)}
                  >
                    <XCircle size={14} />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Learner Roster & Single-Use Enrolment Codes */}
      <div className="admin-subpanel">
        <h3>
          <KeyRound size={16} /> Learner Roster &amp; Enrolment Codes
        </h3>

        <form className="admin-inline-form" onSubmit={handleCreateLearner}>
          <input
            type="text"
            required
            placeholder="Admission No (e.g. SYN-2026-0910)"
            aria-label="New learner admission number"
            value={admInput}
            onChange={(e) => setAdmInput(e.target.value.toUpperCase())}
          />
          <input
            type="text"
            required
            placeholder="First name"
            aria-label="New learner first name"
            value={firstNameInput}
            onChange={(e) => setFirstNameInput(e.target.value)}
          />
          <input
            type="text"
            required
            placeholder="Last name"
            aria-label="New learner last name"
            value={lastNameInput}
            onChange={(e) => setLastNameInput(e.target.value)}
          />
          <select
            required
            aria-label="Assign class"
            value={classIdInput}
            onChange={(e) => setClassIdInput(e.target.value)}
          >
            {state.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
            <Plus size={14} />
            <span>Add learner</span>
          </button>
        </form>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Admission ID</th>
                <th scope="col">Learner</th>
                <th scope="col">Class</th>
                <th scope="col">Student Portal Link / Code</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.learners.map((learner) => (
                <tr key={learner.id}>
                  <td className="mono">{learner.admissionNumber}</td>
                  <td>
                    <strong>
                      {learner.firstName} {learner.lastName}
                    </strong>
                  </td>
                  <td>{learner.currentClassName ?? '—'}</td>
                  <td>
                    {learner.linkedStudent ? (
                      <span className="pill pill-published">
                        Linked: {learner.linkedStudent.email ?? learner.linkedStudent.name}
                      </span>
                    ) : learner.activeEnrolmentCode ? (
                      <span className="pill pill-info mono">
                        Active {learner.activeEnrolmentCode.codeHint}
                      </span>
                    ) : (
                      <span className="muted-line">Not linked</span>
                    )}
                  </td>
                  <td>
                    {learner.linkedStudent ? (
                      <span className="muted-line">Verified</span>
                    ) : (
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => void handleIssueCode(learner.id)}
                        >
                          <span>
                            {learner.activeEnrolmentCode
                              ? 'Reissue code'
                              : 'Generate code'}
                          </span>
                        </button>
                        {learner.activeEnrolmentCode ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() =>
                              void handleRevokeCode(learner.activeEnrolmentCode!.id)
                            }
                          >
                            <span>Revoke</span>
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. School Announcements & Publication Notices */}
      <div className="admin-subpanel">
        <h3>
          <Bell size={16} /> Post School or Result Publication Notice
        </h3>
        <form className="admin-notice-form" onSubmit={handlePostAnnouncement}>
          <div className="admin-notice-top-row">
            <input
              type="text"
              required
              minLength={3}
              maxLength={140}
              placeholder="Notice title (e.g. Term 3 Grade 9A Results Published)"
              aria-label="Announcement title"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
            />
            <select
              aria-label="Announcement audience"
              value={noticeAudience}
              onChange={(e) =>
                setNoticeAudience(e.target.value as AnnouncementAudience)
              }
            >
              <option value="STUDENTS_AND_STAFF">Students &amp; Staff</option>
              <option value="STAFF_ONLY">Staff Only (Internal)</option>
            </select>
          </div>
          <textarea
            rows={2}
            required
            minLength={5}
            maxLength={1200}
            placeholder="Write a concise notice for students or staff…"
            aria-label="Announcement message"
            value={noticeBody}
            onChange={(e) => setNoticeBody(e.target.value)}
          />
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              <span>Publish notice</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
