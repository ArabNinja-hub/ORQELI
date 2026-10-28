import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Printer } from 'lucide-react';
import { ApiRequestError, useAuth } from './auth';
import type { GuardianResultsOverview, ReportCard } from './types';
import { formatChannelLabel, formatSchoolSector } from './workflowRules';

export function StaffReportCardPage() {
  const { schoolId = '', packId = '', learnerId = '' } = useParams();
  const { apiFetch } = useAuth();
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await apiFetch<{ reportCard: ReportCard }>(
          `/api/schools/${encodeURIComponent(schoolId)}/result-packs/${encodeURIComponent(
            packId
          )}/report-cards/${encodeURIComponent(learnerId)}`
        );
        if (active) {
          setReportCard(res.reportCard);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not load printable report card.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [apiFetch, schoolId, packId, learnerId]);

  return (
    <ReportCardDocumentView
      loading={loading}
      error={error}
      reportCard={reportCard}
      backHref={`/workspace?schoolId=${encodeURIComponent(schoolId)}&packId=${encodeURIComponent(
        packId
      )}`}
      backLabel="Back to class result pack"
    />
  );
}

export function GuardianReportCardPage() {
  const { schoolId = '', packId = '', learnerId = '' } = useParams();
  const { apiFetch } = useAuth();
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await apiFetch<GuardianResultsOverview>(
          `/api/schools/${encodeURIComponent(schoolId)}/guardian/results`
        );
        const learnerEntry = res.learners.find((l) => l.learner.id === learnerId);
        const published = learnerEntry?.publishedReports.find((r) => r.packId === packId);
        if (!published) {
          if (active) {
            setError(
              'This report card is either unavailable or has not been published by the school.'
            );
          }
          return;
        }
        if (active) {
          setReportCard(published.reportCard);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not load published report card.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [apiFetch, schoolId, packId, learnerId]);

  return (
    <ReportCardDocumentView
      loading={loading}
      error={error}
      reportCard={reportCard}
      backHref={`/workspace?schoolId=${encodeURIComponent(schoolId)}`}
      backLabel="Back to guardian results"
    />
  );
}

export function StudentReportCardPage() {
  const { schoolId = '', learnerId = '', packId = '' } = useParams();
  const { apiFetch } = useAuth();
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await apiFetch<{ reportCard: ReportCard }>(
          `/api/student/schools/${encodeURIComponent(
            schoolId
          )}/learners/${encodeURIComponent(learnerId)}/report-cards/${encodeURIComponent(
            packId
          )}`
        );
        if (active) {
          setReportCard(res.reportCard);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not load your published report card.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [apiFetch, schoolId, learnerId, packId]);

  return (
    <ReportCardDocumentView
      loading={loading}
      error={error}
      reportCard={reportCard}
      backHref="/student"
      backLabel="Back to student portal"
    />
  );
}

function ReportCardDocumentView({
  loading,
  error,
  reportCard,
  backHref,
  backLabel
}: {
  loading: boolean;
  error: string | null;
  reportCard: ReportCard | null;
  backHref: string;
  backLabel: string;
}) {
  if (loading) {
    return (
      <section className="workspace-shell">
        <div className="state-card">
          <h1>Preparing printable report card…</h1>
          <p>Loading verified academic marks and approval records.</p>
        </div>
      </section>
    );
  }

  if (error || !reportCard) {
    return (
      <section className="workspace-shell">
        <div className="state-card error" role="alert">
          <AlertCircle size={22} />
          <div>
            <h1>Report card unavailable</h1>
            <p>{error ?? 'The requested report card could not be found.'}</p>
            <div className="inline-actions">
              <Link to={backHref} className="btn btn-secondary">
                <ArrowLeft size={15} />
                <span>{backLabel}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="report-page-wrapper">
      <div className="report-toolbar no-print">
        <Link to={backHref} className="btn btn-secondary">
          <ArrowLeft size={15} />
          <span>{backLabel}</span>
        </Link>
        <div className="report-toolbar-right">
          <span
            className={
              reportCard.publicationState === 'PUBLISHED'
                ? 'badge badge-published'
                : 'badge badge-approved'
            }
          >
            {reportCard.publicationState === 'PUBLISHED'
              ? 'Published Report Card'
              : 'Staff Approval Preview (Not Yet Visible to Parents)'}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            <Printer size={15} />
            <span>Print A4 report card</span>
          </button>
        </div>
      </div>

      <article className="report-sheet" aria-label="Learner term report card">
        {reportCard.school.isSyntheticDemo ? (
          <div className="report-synthetic-banner">
            SYNTHETIC DEMONSTRATION RECORD — FOR ORQELI EDUCATION PROTOTYPE EVALUATION ONLY (NO REAL
            LEARNER OR SCHOOL DATA)
          </div>
        ) : null}

        <header className="report-header">
          <div>
            <p className="report-kicker">
              {formatSchoolSector(reportCard.school.sector).toUpperCase()} ·{' '}
              {reportCard.school.district.toUpperCase()}, {reportCard.school.province.toUpperCase()}{' '}
              PROVINCE
            </p>
            <h1>{reportCard.school.name}</h1>
            <p className="report-submeta">
              School Code: <code>{reportCard.school.code}</code>
              {reportCard.school.phone ? ` · Office Tel: ${reportCard.school.phone}` : ''}
            </p>
          </div>
          <div className="report-term-box">
            <strong>LEARNER TERM REPORT</strong>
            <span>{reportCard.academicTermLabel}</span>
            <span>{reportCard.academicYearLabel}</span>
            <span className="report-pub-tag">
              {reportCard.publicationState === 'PUBLISHED'
                ? 'OFFICIAL PUBLISHED COPY'
                : 'INTERNAL APPROVAL PREVIEW'}
            </span>
          </div>
        </header>

        <dl className="report-learner-grid">
          <div>
            <dt>Learner Name</dt>
            <dd>
              {reportCard.learner.firstName} {reportCard.learner.lastName}
            </dd>
          </div>
          <div>
            <dt>Admission Number</dt>
            <dd className="mono">{reportCard.learner.admissionNumber}</dd>
          </div>
          <div>
            <dt>Class / Grade</dt>
            <dd>
              {reportCard.className} (Grade {reportCard.gradeLevel})
            </dd>
          </div>
          <div>
            <dt>Class Teacher</dt>
            <dd>{reportCard.classTeacherName ?? 'Not assigned'}</dd>
          </div>
          <div>
            <dt>Parent / Guardian</dt>
            <dd>{reportCard.learner.guardianName ?? 'Recorded at school office'}</dd>
          </div>
          <div>
            <dt>Primary Delivery Channel</dt>
            <dd>{formatChannelLabel(reportCard.learner.preferredChannel)}</dd>
          </div>
        </dl>

        <table className="report-marks-table">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Subject</th>
              <th scope="col" className="num-col">
                Score
              </th>
              <th scope="col" className="num-col">
                Max
              </th>
              <th scope="col">Grade</th>
              <th scope="col">Subject Teacher &amp; Remark</th>
            </tr>
          </thead>
          <tbody>
            {reportCard.subjects.map((sub) => (
              <tr key={sub.subjectId}>
                <td className="mono">{sub.subjectCode}</td>
                <td>
                  <strong>{sub.subjectName}</strong>
                </td>
                <td className="num-col mono">
                  {sub.status === 'PRESENT' && sub.score !== null ? sub.score : '—'}
                </td>
                <td className="num-col mono">{sub.maxMark}</td>
                <td>{sub.grade}</td>
                <td>
                  <span className="report-remark">
                    {sub.teacherComment ?? 'No written comment recorded.'}
                  </span>
                  <span className="report-teacher-by">({sub.teacherName})</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Aggregate ({reportCard.summary.gradedSubjectsCount} graded subject
                {reportCard.summary.gradedSubjectsCount === 1 ? '' : 's'})
              </th>
              <td className="num-col mono">
                <strong>{reportCard.summary.totalScore}</strong>
              </td>
              <td className="num-col mono">
                <strong>{reportCard.summary.totalPossible}</strong>
              </td>
              <td colSpan={2}>
                <strong>
                  Mean:{' '}
                  {reportCard.summary.averagePercentage !== null
                    ? `${reportCard.summary.averagePercentage}%`
                    : 'N/A'}
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>

        <section className="report-signatures" aria-label="Verification and approval block">
          <div>
            <span className="sig-label">Approved By (Head Teacher / Admin)</span>
            <strong>{reportCard.approvedByName ?? 'Approved in system'}</strong>
            <span className="sig-date">
              {reportCard.approvedAt
                ? `Approved ${new Date(reportCard.approvedAt).toLocaleDateString('en-ZM')}`
                : ''}
            </span>
          </div>
          <div>
            <span className="sig-label">School Stamp &amp; Signature</span>
            <div className="sig-line" />
            <span className="sig-date">Verify physical stamp for paper distribution</span>
          </div>
        </section>

        <section
          className="report-tearoff"
          aria-label="Paper return slip for families without smartphones"
        >
          <p className="tearoff-title">
            ✂ GUARDIAN PAPER ACKNOWLEDGMENT SLIP (FOR HOUSEHOLDS WITHOUT SMARTPHONE OR INTERNET
            ACCESS)
          </p>
          <p className="tearoff-body">
            I confirm receipt of the {reportCard.academicTermLabel} report card for{' '}
            <strong>
              {reportCard.learner.firstName} {reportCard.learner.lastName}
            </strong>{' '}
            (Admission No. <span className="mono">{reportCard.learner.admissionNumber}</span>,{' '}
            {reportCard.className}).
          </p>
          <div className="tearoff-fields">
            <span>Guardian Signature: ___________________________</span>
            <span>Date: _______________</span>
            <span>Contact Tel (Optional): ___________________</span>
          </div>
        </section>
      </article>
    </section>
  );
}
