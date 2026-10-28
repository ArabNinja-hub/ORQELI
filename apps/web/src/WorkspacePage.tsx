import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  History,
  Lock,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Send
} from 'lucide-react';
import { ApiRequestError, useAuth } from './auth';
import type {
  AuditEventItem,
  GuardianResultsOverview,
  MarkEntryStatus,
  MembershipSummary,
  PackSubjectColumn,
  ResultPackDetail,
  SchoolOverview
} from './types';
import {
  formatChannelLabel,
  formatCompletenessRatio,
  formatPackStatus,
  formatSchoolRole,
  formatSchoolSector,
  validateDraftMarkInput
} from './workflowRules';
import { SchoolAdminPortalPanel } from './SchoolAdminPortalPanel';

const STAFF_ROLE_SET = new Set([
  'SCHOOL_ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD',
  'TEACHER'
]);

const LEADERSHIP_ROLE_SET = new Set([
  'SCHOOL_ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD'
]);

interface DraftRowState {
  status: MarkEntryStatus;
  rawScore: string;
  teacherComment: string;
}

export function WorkspacePage() {
  const { memberships } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // If the signed-in user holds a student membership (including pending INACTIVE)
  // and no staff/guardian memberships, route directly to the Student Portal.
  const isStudentOnly = useMemo(() => {
    const hasStudent = memberships.some((m) => m.role === 'STUDENT');
    const hasNonStudent = memberships.some((m) => m.role !== 'STUDENT');
    return hasStudent && !hasNonStudent;
  }, [memberships]);

  const activeMemberships = useMemo(
    () =>
      memberships.filter(
        (m) =>
          m.status === 'ACTIVE' &&
          m.school.status !== 'SUSPENDED' &&
          m.role !== 'STUDENT'
      ),
    [memberships]
  );

  const uniqueSchools = useMemo(() => {
    const bySchool = new Map<
      string,
      { school: MembershipSummary['school']; roles: MembershipSummary['role'][] }
    >();
    for (const m of activeMemberships) {
      const existing = bySchool.get(m.schoolId);
      if (existing) {
        if (!existing.roles.includes(m.role)) {
          existing.roles.push(m.role);
        }
      } else {
        bySchool.set(m.schoolId, { school: m.school, roles: [m.role] });
      }
    }
    return [...bySchool.values()];
  }, [activeMemberships]);

  if (isStudentOnly) {
    return <Navigate to="/student" replace />;
  }

  if (uniqueSchools.length === 0) {
    return (
      <section className="workspace-shell">
        <div className="state-card">
          <h1>No active school assignment</h1>
          <p>
            Your account is authenticated, but it is not currently assigned to an active school
            membership. School memberships are provisioned by school or platform administrators.
          </p>
        </div>
      </section>
    );
  }

  const requestedSchoolId = searchParams.get('schoolId');
  const selectedEntry =
    uniqueSchools.find((entry) => entry.school.id === requestedSchoolId) ??
    uniqueSchools[0];

  const isStaff = selectedEntry.roles.some((r) => STAFF_ROLE_SET.has(r));

  const handleSchoolChange = (nextSchoolId: string) => {
    setSearchParams({ schoolId: nextSchoolId });
  };

  return (
    <div className="workspace-shell">
      {uniqueSchools.length > 1 ? (
        <div className="school-switcher-bar">
          <label htmlFor="school-selector">Active school context:</label>
          <select
            id="school-selector"
            value={selectedEntry.school.id}
            onChange={(e) => handleSchoolChange(e.target.value)}
          >
            {uniqueSchools.map((s) => (
              <option key={s.school.id} value={s.school.id}>
                {s.school.name} ({s.school.code})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {isStaff ? (
        <StaffSchoolWorkspace
          key={selectedEntry.school.id}
          schoolId={selectedEntry.school.id}
        />
      ) : (
        <GuardianSchoolWorkspace
          key={selectedEntry.school.id}
          schoolId={selectedEntry.school.id}
        />
      )}
    </div>
  );
}

function GuardianSchoolWorkspace({ schoolId }: { schoolId: string }) {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<GuardianResultsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGuardianView = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<GuardianResultsOverview>(
        `/api/schools/${encodeURIComponent(schoolId)}/guardian/results`
      );
      setData(response);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not load published learner results.'
      );
    } finally {
      setLoading(false);
    }
  }, [apiFetch, schoolId]);

  useEffect(() => {
    void loadGuardianView();
  }, [loadGuardianView]);

  if (loading) {
    return (
      <div className="state-card">
        <h1>Loading guardian results…</h1>
        <p>Checking published term report cards for your linked learners.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="state-card error" role="alert">
        <AlertCircle size={20} />
        <div>
          <h1>Unable to load guardian results</h1>
          <p>{error ?? 'No guardian record was returned.'}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadGuardianView()}
          >
            <RefreshCw size={14} />
            <span>Try again</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="guardian-heading">
      {data.school.isSyntheticDemo ? (
        <div className="synthetic-banner">
          <strong>Synthetic Demonstration Data:</strong> All learner names, admission numbers, and
          scores shown here are synthetic records for ORQELI Education evaluation.
        </div>
      ) : null}

      <header className="workspace-header">
        <div>
          <span className="eyebrow">PARENT / GUARDIAN ACCESS · PUBLISHED RECORDS ONLY</span>
          <h1 id="guardian-heading">{data.school.name}</h1>
          <p className="workspace-subtitle">
            {formatSchoolSector(data.school.sector)} · {data.school.district},{' '}
            {data.school.province} Province · Code <code>{data.school.code}</code>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void loadGuardianView()}
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </header>

      <div className="guardian-policy-notice">
        <Lock size={16} />
        <p>
          <strong>Publication privacy rule:</strong> Only results explicitly approved and published
          by the Head Teacher appear here. Draft, submitted, or unapproved marks are never exposed,
          and paper report cards remain available directly from the school office for families
          without internet access.
        </p>
      </div>

      {data.learners.length === 0 ? (
        <div className="state-card">
          <h2>No linked learners yet</h2>
          <p>Contact the school office to link your guardian record to enrolled learners.</p>
        </div>
      ) : (
        <div className="guardian-learners-stack">
          {data.learners.map(({ learner, publishedReports }) => (
            <article key={learner.id} className="workspace-panel">
              <div className="learner-card-head">
                <div>
                  <h2>
                    {learner.firstName} {learner.lastName}
                  </h2>
                  <p className="muted-line">
                    Admission <code className="mono">{learner.admissionNumber}</code>
                    {learner.currentClassName ? ` · ${learner.currentClassName}` : ''} ·{' '}
                    {learner.relationship}
                  </p>
                </div>
                <span className="badge badge-neutral">
                  {formatChannelLabel(learner.preferredChannel)}
                </span>
              </div>

              {publishedReports.length === 0 ? (
                <div className="empty-inline">
                  <p>
                    <strong>No published term report cards yet for {learner.firstName}.</strong>{' '}
                    Current-term assessments remain restricted until teacher entry, verification,
                    Head Teacher approval, and official publication are completed.
                  </p>
                </div>
              ) : (
                <div className="published-reports-list">
                  {publishedReports.map(({ packId, reportCard }) => (
                    <div key={packId} className="published-report-row">
                      <div>
                        <strong>
                          {reportCard.academicTermLabel} · {reportCard.className}
                        </strong>
                        <p className="muted-line">
                          {reportCard.summary.gradedSubjectsCount} subjects · Aggregate{' '}
                          <span className="mono">
                            {reportCard.summary.totalScore}/{reportCard.summary.totalPossible}
                          </span>
                          {reportCard.summary.averagePercentage !== null
                            ? ` (${reportCard.summary.averagePercentage}%)`
                            : ''}
                        </p>
                      </div>
                      <Link
                        to={`/workspace/schools/${encodeURIComponent(
                          schoolId
                        )}/guardian/report-card/${encodeURIComponent(
                          packId
                        )}/${encodeURIComponent(learner.id)}`}
                        className="btn btn-primary btn-sm"
                      >
                        <Printer size={14} />
                        <span>View &amp; print report card</span>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StaffSchoolWorkspace({ schoolId }: { schoolId: string }) {
  const { apiFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPackId = searchParams.get('packId');

  const [overview, setOverview] = useState<SchoolOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [packDetail, setPackDetail] = useState<ResultPackDetail | null>(null);
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);

  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('MATRIX');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionBanner, setActionBanner] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');

  const isLeadership = useMemo(
    () => (overview?.viewerRoles ?? []).some((r) => LEADERSHIP_ROLE_SET.has(r)),
    [overview]
  );

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await apiFetch<{ events: AuditEventItem[] }>(
        `/api/schools/${encodeURIComponent(schoolId)}/audit-events`
      );
      setAuditEvents(res.events);
    } catch {
      // Non-blocking audit fetch
    } finally {
      setAuditLoading(false);
    }
  }, [apiFetch, schoolId]);

  const loadPackDetail = useCallback(
    async (packId: string) => {
      setPackLoading(true);
      setPackError(null);
      try {
        const res = await apiFetch<{ pack: ResultPackDetail }>(
          `/api/schools/${encodeURIComponent(schoolId)}/result-packs/${encodeURIComponent(
            packId
          )}`
        );
        setPackDetail(res.pack);
      } catch (err) {
        setPackDetail(null);
        setPackError(
          err instanceof ApiRequestError ? err.message : 'Unable to load result pack.'
        );
      } finally {
        setPackLoading(false);
      }
    },
    [apiFetch, schoolId]
  );

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await apiFetch<SchoolOverview>(
        `/api/schools/${encodeURIComponent(schoolId)}/overview`
      );
      setOverview(res);

      const accessiblePacks = res.resultPacks.filter((p) => p.canOpen);
      const chosen =
        accessiblePacks.find((p) => p.id === requestedPackId) ?? accessiblePacks[0];

      if (chosen) {
        await loadPackDetail(chosen.id);
      } else {
        setPackDetail(null);
      }

      if (res.viewerRoles.some((r) => LEADERSHIP_ROLE_SET.has(r))) {
        void loadAudit();
      }
    } catch (err) {
      setOverviewError(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not load school workspace overview.'
      );
    } finally {
      setOverviewLoading(false);
    }
  }, [apiFetch, schoolId, requestedPackId, loadPackDetail, loadAudit]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const selectPack = (packId: string) => {
    setActionBanner(null);
    setShowRevisionForm(false);
    setActiveTab('MATRIX');
    setSearchParams({ schoolId, packId });
  };

  const runPackTransition = async (
    endpointSuffix: 'submit' | 'approve' | 'publish' | 'request-revision',
    body: Record<string, unknown> = {},
    successText: string
  ) => {
    if (!packDetail) return;
    setActionBusy(true);
    setActionBanner(null);
    try {
      const res = await apiFetch<{ pack: ResultPackDetail }>(
        `/api/schools/${encodeURIComponent(schoolId)}/result-packs/${encodeURIComponent(
          packDetail.id
        )}/${endpointSuffix}`,
        {
          method: 'POST',
          body: JSON.stringify(body)
        }
      );
      setPackDetail(res.pack);
      setShowRevisionForm(false);
      setRevisionNotes('');
      setActionBanner({ tone: 'success', text: successText });
      // Refresh pack summaries & audit log
      const refreshedOverview = await apiFetch<SchoolOverview>(
        `/api/schools/${encodeURIComponent(schoolId)}/overview`
      );
      setOverview(refreshedOverview);
      if (isLeadership) {
        void loadAudit();
      }
    } catch (err) {
      setActionBanner({
        tone: 'error',
        text:
          err instanceof ApiRequestError
            ? err.message
            : 'The workflow action could not be completed.'
      });
    } finally {
      setActionBusy(false);
    }
  };

  if (overviewLoading) {
    return (
      <div className="state-card">
        <h1>Loading school academic workspace…</h1>
        <p>Retrieving term result packs, allocations, and completeness status.</p>
      </div>
    );
  }

  if (overviewError || !overview) {
    return (
      <div className="state-card error" role="alert">
        <AlertCircle size={20} />
        <div>
          <h1>Workspace unavailable</h1>
          <p>{overviewError ?? 'School overview could not be loaded.'}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadOverview()}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const totalMissingAcrossSchool = overview.resultPacks.reduce(
    (sum, p) => sum + p.missingCount,
    0
  );
  const publishedCount = overview.resultPacks.filter(
    (p) => p.status === 'PUBLISHED'
  ).length;

  return (
    <section aria-labelledby="workspace-school-heading">
      {overview.school.isSyntheticDemo ? (
        <div className="synthetic-banner">
          <strong>Synthetic Demonstration Data:</strong> All school, staff, and learner records in
          this workspace are synthetic test fixtures. Do not enter real learner PII.
        </div>
      ) : null}

      <header className="workspace-header">
        <div>
          <span className="eyebrow">
            {formatSchoolSector(overview.school.sector).toUpperCase()} ·{' '}
            {overview.school.district.toUpperCase()}, {overview.school.province.toUpperCase()}
          </span>
          <h1 id="workspace-school-heading">{overview.school.name}</h1>
          <p className="workspace-subtitle">
            School Code <code>{overview.school.code}</code> · Your Role(s):{' '}
            <strong>{overview.viewerRoles.map(formatSchoolRole).join(', ')}</strong>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void loadOverview()}
        >
          <RefreshCw size={14} />
          <span>Refresh data</span>
        </button>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Active Academic Period</span>
          <strong>{overview.currentTerm?.label ?? 'Not configured'}</strong>
          <span>{overview.currentAcademicYear?.label ?? '—'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Term Result Packs</span>
          <strong>{overview.resultPacks.length}</strong>
          <span>Class-term compilation packs</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Missing Mark Entries</span>
          <strong className={totalMissingAcrossSchool > 0 ? 'text-warn' : 'text-ok'}>
            {totalMissingAcrossSchool}
          </strong>
          <span>
            {totalMissingAcrossSchool === 0
              ? 'All expected entries accounted for'
              : 'Blocks submission & approval until entered'}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Published Packs</span>
          <strong>
            {publishedCount} / {overview.resultPacks.length}
          </strong>
          <span>Released for printing &amp; guardian access</span>
        </div>
      </div>

      {overview.mySubjectAllocations.length > 0 ? (
        <div className="allocations-strip" aria-label="Your subject mark entry allocations">
          <strong>Your authorised mark-entry allocations:</strong>
          <div className="chip-row">
            {overview.mySubjectAllocations.map((a) => (
              <span key={a.allocationId} className="alloc-chip">
                {a.className} · {a.subjectName} (<code>{a.subjectCode}</code>)
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="packs-layout">
        <aside className="packs-sidebar" aria-label="Class result packs">
          <h2 className="sidebar-heading">Class Result Packs</h2>
          {overview.resultPacks.length === 0 ? (
            <p className="muted-line">No result packs configured for this school yet.</p>
          ) : (
            <div className="pack-list">
              {overview.resultPacks.map((pack) => {
                const statusInfo = formatPackStatus(pack.status);
                const ratio = formatCompletenessRatio(
                  pack.recordedEntries,
                  pack.expectedEntries
                );
                const isSelected = packDetail?.id === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    disabled={!pack.canOpen}
                    onClick={() => selectPack(pack.id)}
                    className={
                      isSelected ? 'pack-select-card selected' : 'pack-select-card'
                    }
                  >
                    <div className="pack-card-top">
                      <strong>{pack.className}</strong>
                      <span className={`badge badge-${statusInfo.tone}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <span className="pack-card-term">{pack.termLabel}</span>
                    <div className="progress-track" aria-hidden="true">
                      <div
                        className={
                          pack.missingCount > 0 ? 'progress-fill warn' : 'progress-fill ok'
                        }
                        style={{ width: `${ratio.percent}%` }}
                      />
                    </div>
                    <span className="pack-card-ratio">{ratio.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="pack-main">
          {packLoading ? (
            <div className="state-card">
              <h2>Loading result pack…</h2>
              <p>Fetching class mark matrix and validation summary.</p>
            </div>
          ) : packError ? (
            <div className="state-card error" role="alert">
              <AlertCircle size={18} />
              <div>
                <h2>Could not open result pack</h2>
                <p>{packError}</p>
              </div>
            </div>
          ) : packDetail ? (
            <PackWorkspacePanel
              schoolId={schoolId}
              pack={packDetail}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              actionBusy={actionBusy}
              actionBanner={actionBanner}
              showRevisionForm={showRevisionForm}
              onToggleRevisionForm={() => setShowRevisionForm((v) => !v)}
              revisionNotes={revisionNotes}
              onRevisionNotesChange={setRevisionNotes}
              onSubmitPack={() =>
                void runPackTransition(
                  'submit',
                  {},
                  `${packDetail.schoolClass.name} results submitted for leadership review.`
                )
              }
              onApprovePack={() =>
                void runPackTransition(
                  'approve',
                  {},
                  `${packDetail.schoolClass.name} results approved. Printable previews are unlocked; guardian access remains closed until published.`
                )
              }
              onPublishPack={() =>
                void runPackTransition(
                  'publish',
                  {},
                  `${packDetail.schoolClass.name} results officially published for printable report cards and linked guardians.`
                )
              }
              onRequestRevision={(e) => {
                e.preventDefault();
                void runPackTransition(
                  'request-revision',
                  { reviewNotes: revisionNotes },
                  `${packDetail.schoolClass.name} returned to teachers for revision.`
                );
              }}
              onMarksSaved={async (updatedPack) => {
                setPackDetail(updatedPack);
                const refreshedOverview = await apiFetch<SchoolOverview>(
                  `/api/schools/${encodeURIComponent(schoolId)}/overview`
                );
                setOverview(refreshedOverview);
                if (isLeadership) {
                  void loadAudit();
                }
              }}
            />
          ) : (
            <div className="state-card">
              <h2>Select an assigned result pack</h2>
              <p>Choose a class result pack from the left to inspect or enter marks.</p>
            </div>
          )}
        </div>
      </div>

      {isLeadership ? (
        <SchoolAdminPortalPanel
          schoolId={schoolId}
          onMutated={() => void loadAudit()}
        />
      ) : null}

      {isLeadership ? (
        <section className="audit-section workspace-panel" aria-labelledby="audit-heading">
          <div className="panel-head-row">
            <div className="panel-title-group">
              <History size={18} />
              <h2 id="audit-heading">School Audit Trail</h2>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void loadAudit()}
              disabled={auditLoading}
            >
              <RefreshCw size={14} />
              <span>{auditLoading ? 'Refreshing…' : 'Refresh log'}</span>
            </button>
          </div>
          <p className="muted-line">
            Server-recorded history of mark entries, score corrections (with before/after states),
            submissions, revision requests, approvals, and publications for this school.
          </p>

          {auditEvents.length === 0 ? (
            <p className="empty-inline">
              No school workflow mutations recorded in this session yet. Enter a mark or advance a
              result pack to inspect audit entries.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Action</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Before → After</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.slice(0, 20).map((ev) => (
                    <tr key={ev.id}>
                      <td className="mono">
                        {new Date(ev.createdAt).toLocaleTimeString('en-ZM', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td>
                        <code>{ev.action}</code>
                        {ev.metadata?.subjectCode ? (
                          <span className="muted-inline">
                            {' '}
                            ({String(ev.metadata.subjectCode)})
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {ev.actorName ?? 'System'}
                        {ev.actorRole ? ` · ${formatSchoolRole(ev.actorRole)}` : ''}
                      </td>
                      <td className="mono small-mono">
                        {ev.beforeState ? JSON.stringify(ev.beforeState) : '∅'} →{' '}
                        {ev.afterState ? JSON.stringify(ev.afterState) : '∅'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}

function PackWorkspacePanel({
  schoolId,
  pack,
  activeTab,
  onTabChange,
  actionBusy,
  actionBanner,
  showRevisionForm,
  onToggleRevisionForm,
  revisionNotes,
  onRevisionNotesChange,
  onSubmitPack,
  onApprovePack,
  onPublishPack,
  onRequestRevision,
  onMarksSaved
}: {
  schoolId: string;
  pack: ResultPackDetail;
  activeTab: string;
  onTabChange: (tab: string) => void;
  actionBusy: boolean;
  actionBanner: { tone: 'success' | 'error'; text: string } | null;
  showRevisionForm: boolean;
  onToggleRevisionForm: () => void;
  revisionNotes: string;
  onRevisionNotesChange: (val: string) => void;
  onSubmitPack: () => void;
  onApprovePack: () => void;
  onPublishPack: () => void;
  onRequestRevision: (e: React.FormEvent) => void;
  onMarksSaved: (updated: ResultPackDetail) => Promise<void>;
}) {
  const statusInfo = formatPackStatus(pack.status);
  const markMap = useMemo(() => {
    const map = new Map<string, ResultPackDetail['marks'][number]>();
    for (const m of pack.marks) {
      map.set(`${m.learnerId}:${m.subjectId}`, m);
    }
    return map;
  }, [pack.marks]);

  const selectedSubject =
    pack.subjects.find((s) => s.subjectId === activeTab) ?? null;

  return (
    <div className="workspace-panel">
      <div className="pack-detail-header">
        <div>
          <div className="pack-title-row">
            <h2>
              {pack.schoolClass.name} · {pack.academicTerm.label}
            </h2>
            <span className={`badge badge-${statusInfo.tone}`}>{statusInfo.label}</span>
          </div>
          <p className="muted-line">{statusInfo.summary}</p>
        </div>
      </div>

      {pack.reviewNotes && pack.status === 'NEEDS_REVISION' ? (
        <div className="callout callout-warn" role="status">
          <RotateCcw size={18} />
          <div>
            <strong>Revision requested by {pack.reviewedByName ?? 'Reviewer'}:</strong>
            <p>{pack.reviewNotes}</p>
          </div>
        </div>
      ) : null}

      {pack.completeness.missingCount > 0 ? (
        <div className="callout callout-warn" role="status">
          <AlertTriangle size={18} />
          <div>
            <strong>
              {pack.completeness.missingCount} missing subject mark{' '}
              {pack.completeness.missingCount === 1 ? 'entry' : 'entries'} detected:
            </strong>
            <ul className="missing-inline-list">
              {pack.completeness.missingItems.slice(0, 6).map((item) => (
                <li key={`${item.learnerId}:${item.subjectId}`}>
                  <strong>{item.learnerName}</strong> (<code>{item.admissionNumber}</code>) —{' '}
                  {item.subjectName}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="callout callout-ok" role="status">
          <CheckCircle2 size={18} />
          <div>
            <strong>
              Completeness verified: all {pack.completeness.expectedEntries} learner-subject entries
              recorded.
            </strong>
          </div>
        </div>
      )}

      {actionBanner ? (
        <div
          className={
            actionBanner.tone === 'error' ? 'callout callout-error' : 'callout callout-ok'
          }
          role="alert"
        >
          {actionBanner.tone === 'error' ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <p>{actionBanner.text}</p>
        </div>
      ) : null}

      <div className="workflow-actions-bar">
        {pack.permissions.canSubmit ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={actionBusy}
            onClick={onSubmitPack}
          >
            <Send size={15} />
            <span>Submit for review</span>
          </button>
        ) : null}

        {pack.permissions.canApprove ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={actionBusy}
            onClick={onApprovePack}
          >
            <FileCheck2 size={15} />
            <span>Approve results</span>
          </button>
        ) : null}

        {pack.permissions.canPublish ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={actionBusy}
            onClick={onPublishPack}
          >
            <CheckCircle2 size={15} />
            <span>Publish report cards</span>
          </button>
        ) : null}

        {pack.permissions.canRequestRevision ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={actionBusy}
            onClick={onToggleRevisionForm}
          >
            <RotateCcw size={15} />
            <span>{showRevisionForm ? 'Cancel revision' : 'Return for revision'}</span>
          </button>
        ) : null}
      </div>

      {showRevisionForm ? (
        <form className="revision-form" onSubmit={onRequestRevision}>
          <label htmlFor="revision-notes-input">
            Revision instructions for subject teachers (required):
          </label>
          <textarea
            id="revision-notes-input"
            rows={2}
            required
            minLength={5}
            maxLength={500}
            value={revisionNotes}
            onChange={(e) => onRevisionNotesChange(e.target.value)}
            placeholder="Describe which subject or learner score needs verification…"
          />
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={actionBusy}>
              Confirm return for revision
            </button>
          </div>
        </form>
      ) : null}

      <div className="subject-tabs" role="tablist" aria-label="Mark sheet views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'MATRIX'}
          className={activeTab === 'MATRIX' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => onTabChange('MATRIX')}
        >
          <ClipboardList size={14} />
          <span>Class Matrix Overview</span>
        </button>
        {pack.subjects.map((sub) => (
          <button
            key={sub.subjectId}
            type="button"
            role="tab"
            aria-selected={activeTab === sub.subjectId}
            className={activeTab === sub.subjectId ? 'tab-btn active' : 'tab-btn'}
            onClick={() => onTabChange(sub.subjectId)}
          >
            <span>{sub.name}</span>
            {sub.canEdit ? <span className="edit-dot">Editable</span> : null}
          </button>
        ))}
      </div>

      {selectedSubject ? (
        <SubjectMarkSheetEditor
          key={`${pack.id}:${selectedSubject.subjectId}:${pack.status}`}
          schoolId={schoolId}
          pack={pack}
          subject={selectedSubject}
          onMarksSaved={onMarksSaved}
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table matrix-table">
            <thead>
              <tr>
                <th scope="col">Admission</th>
                <th scope="col">Learner</th>
                {pack.subjects.map((sub) => (
                  <th key={sub.subjectId} scope="col" className="num-col">
                    <div>{sub.code}</div>
                    <small className="th-sub">/{sub.maxMark}</small>
                  </th>
                ))}
                <th scope="col">Report Card</th>
              </tr>
            </thead>
            <tbody>
              {pack.learners.map((learner) => (
                <tr key={learner.learnerId}>
                  <td className="mono">{learner.admissionNumber}</td>
                  <td>
                    <strong>
                      {learner.lastName}, {learner.firstName}
                    </strong>
                  </td>
                  {pack.subjects.map((sub) => {
                    const cell = markMap.get(`${learner.learnerId}:${sub.subjectId}`);
                    const status = cell?.status ?? 'PENDING';
                    return (
                      <td
                        key={sub.subjectId}
                        className={
                          status === 'PENDING' ? 'num-col mono missing-cell' : 'num-col mono'
                        }
                      >
                        {status === 'PRESENT'
                          ? cell?.score
                          : status === 'PENDING'
                            ? 'MISSING'
                            : status}
                      </td>
                    );
                  })}
                  <td>
                    {pack.permissions.canViewReportCards ? (
                      <Link
                        to={`/workspace/schools/${encodeURIComponent(
                          schoolId
                        )}/packs/${encodeURIComponent(
                          pack.id
                        )}/report-card/${encodeURIComponent(learner.learnerId)}`}
                        className="btn btn-secondary btn-xs"
                      >
                        <Printer size={13} />
                        <span>
                          {pack.status === 'PUBLISHED' ? 'Print card' : 'Preview card'}
                        </span>
                      </Link>
                    ) : (
                      <span className="muted-inline">Requires approval</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubjectMarkSheetEditor({
  schoolId,
  pack,
  subject,
  onMarksSaved
}: {
  schoolId: string;
  pack: ResultPackDetail;
  subject: PackSubjectColumn;
  onMarksSaved: (updated: ResultPackDetail) => Promise<void>;
}) {
  const { apiFetch } = useAuth();

  const initialRows = useMemo(() => {
    const record: Record<string, DraftRowState> = {};
    for (const learner of pack.learners) {
      const existing = pack.marks.find(
        (m) => m.learnerId === learner.learnerId && m.subjectId === subject.subjectId
      );
      record[learner.learnerId] = {
        status: existing?.status ?? 'PENDING',
        rawScore:
          existing?.score !== null && existing?.score !== undefined
            ? String(existing.score)
            : '',
        teacherComment: existing?.teacherComment ?? ''
      };
    }
    return record;
  }, [pack.learners, pack.marks, subject.subjectId]);

  const [rows, setRows] = useState<Record<string, DraftRowState>>(initialRows);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'ok' | 'error';
    message: string;
  } | null>(null);

  const updateRow = (learnerId: string, patch: Partial<DraftRowState>) => {
    setRows((prev) => {
      const current = prev[learnerId]!;
      const next = { ...current, ...patch };
      if (patch.status && patch.status !== 'PRESENT') {
        next.rawScore = '';
      }
      return { ...prev, [learnerId]: next };
    });
  };

  const handleSaveMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const entries: Array<{
      learnerId: string;
      subjectId: string;
      status: MarkEntryStatus;
      score: number | null;
      teacherComment: string | null;
    }> = [];

    for (const learner of pack.learners) {
      const draft = rows[learner.learnerId]!;
      const validation = validateDraftMarkInput(
        draft.status,
        draft.rawScore,
        subject.maxMark
      );
      if (!validation.valid) {
        setFeedback({
          tone: 'error',
          message: `${learner.firstName} ${learner.lastName}: ${validation.error}`
        });
        return;
      }
      entries.push({
        learnerId: learner.learnerId,
        subjectId: subject.subjectId,
        status: draft.status,
        score: validation.score,
        teacherComment: draft.teacherComment.trim() || null
      });
    }

    setSaving(true);
    try {
      const res = await apiFetch<{ pack: ResultPackDetail }>(
        `/api/schools/${encodeURIComponent(schoolId)}/result-packs/${encodeURIComponent(
          pack.id
        )}/marks`,
        {
          method: 'PUT',
          body: JSON.stringify({ entries })
        }
      );
      await onMarksSaved(res.pack);
      setFeedback({
        tone: 'ok',
        message: `Saved ${subject.name} marks and updated completeness & audit log.`
      });
    } catch (err) {
      setFeedback({
        tone: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Failed to save subject marks.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="subject-sheet" onSubmit={(e) => void handleSaveMarks(e)}>
      <div className="subject-sheet-meta">
        <div>
          <h3>
            {subject.name} (<code>{subject.code}</code>) · Max Mark: {subject.maxMark}
          </h3>
          <p className="muted-line">
            Allocated Teacher: <strong>{subject.teacherName}</strong>
            {!subject.canEdit
              ? ' · Read-only (only the allocated teacher can edit while the pack is open)'
              : ' · Authorised for mark entry'}
          </p>
        </div>
        {subject.canEdit ? (
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={15} />
            <span>{saving ? 'Saving marks…' : `Save ${subject.name} marks`}</span>
          </button>
        ) : null}
      </div>

      {feedback ? (
        <div
          className={
            feedback.tone === 'error' ? 'callout callout-error' : 'callout callout-ok'
          }
          role="alert"
        >
          <p>{feedback.message}</p>
        </div>
      ) : null}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Learner</th>
              <th scope="col">Entry Status</th>
              <th scope="col">Score (0–{subject.maxMark})</th>
              <th scope="col">Teacher Remark (Optional)</th>
            </tr>
          </thead>
          <tbody>
            {pack.learners.map((learner) => {
              const row = rows[learner.learnerId]!;
              const statusId = `status-${learner.learnerId}`;
              const scoreId = `score-${learner.learnerId}`;
              const commentId = `comment-${learner.learnerId}`;
              return (
                <tr
                  key={learner.learnerId}
                  className={row.status === 'PENDING' ? 'row-missing' : undefined}
                >
                  <td>
                    <strong>
                      {learner.lastName}, {learner.firstName}
                    </strong>
                    <div className="mono muted-inline">{learner.admissionNumber}</div>
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={statusId}>
                      Mark status for {learner.firstName} {learner.lastName}
                    </label>
                    <select
                      id={statusId}
                      disabled={!subject.canEdit || saving}
                      value={row.status}
                      onChange={(e) =>
                        updateRow(learner.learnerId, {
                          status: e.target.value as MarkEntryStatus
                        })
                      }
                    >
                      <option value="PENDING">Pending (Missing)</option>
                      <option value="PRESENT">Present (Scored)</option>
                      <option value="ABSENT">Absent</option>
                      <option value="EXEMPT">Exempt</option>
                    </select>
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={scoreId}>
                      Score for {learner.firstName} {learner.lastName}
                    </label>
                    <input
                      id={scoreId}
                      type="number"
                      min={0}
                      max={subject.maxMark}
                      step={1}
                      inputMode="numeric"
                      className="score-input mono"
                      disabled={!subject.canEdit || saving || row.status !== 'PRESENT'}
                      placeholder={row.status === 'PRESENT' ? '0–100' : '—'}
                      value={row.rawScore}
                      onChange={(e) =>
                        updateRow(learner.learnerId, { rawScore: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={commentId}>
                      Remark for {learner.firstName} {learner.lastName}
                    </label>
                    <input
                      id={commentId}
                      type="text"
                      maxLength={240}
                      className="comment-input"
                      disabled={!subject.canEdit || saving}
                      placeholder="Concise academic observation…"
                      value={row.teacherComment}
                      onChange={(e) =>
                        updateRow(learner.learnerId, {
                          teacherComment: e.target.value
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
