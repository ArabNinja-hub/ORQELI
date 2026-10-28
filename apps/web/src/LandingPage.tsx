import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Lock,
  Printer,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Users
} from 'lucide-react';
import { useAuth } from './auth';

const PROBLEM_AREAS = [
  {
    number: '01',
    icon: FileSpreadsheet,
    title: 'Examination marks & academic records',
    description:
      'Structuring termly subject scores, exemptions, and teacher remarks by academic year, term, class, and subject allocation rather than scattered spreadsheets or loose paper sheets.'
  },
  {
    number: '02',
    icon: AlertTriangle,
    title: 'Missing, late, or misplaced marks',
    description:
      'Detecting unrecorded learner-subject entries early before end-of-term compilation stalls, and preventing incomplete result packs from advancing silently.'
  },
  {
    number: '03',
    icon: ClipboardCheck,
    title: 'Structured review & correction',
    description:
      'Supporting departmental or Deputy Head verification where discrepancies can be returned to the allocated subject teacher with recorded revision notes.'
  },
  {
    number: '04',
    icon: CheckCircle2,
    title: 'Explicit approval before publication',
    description:
      'Requiring deliberate Head Teacher or School Administrator sign-off before report cards are finalised or exposed outside internal staff review.'
  },
  {
    number: '05',
    icon: Printer,
    title: 'Parent access without requiring smartphones',
    description:
      'Treating clean, low-ink A4 printed report cards as a first-class output alongside ongoing research into SMS and USSD channels for households without smartphones or reliable data.'
  }
];

const WORKFLOW_STAGES = [
  {
    step: 'Stage 1',
    state: 'DRAFT',
    title: 'Allocated teacher mark entry',
    detail:
      'Only teachers explicitly allocated to a class and subject can enter scores (0–max) or mark an authorised absence/exemption.'
  },
  {
    step: 'Stage 2',
    state: 'VALIDATION',
    title: 'Completeness & missing-entry check',
    detail:
      'Every active learner × allocated subject cell is verified. Any pending entry blocks submission and highlights the exact missing record.'
  },
  {
    step: 'Stage 3',
    state: 'SUBMITTED / NEEDS_REVISION',
    title: 'Internal review & correction loop',
    detail:
      'Submitted marks lock against silent edits. Reviewers either advance the pack or return it with traceable revision notes.'
  },
  {
    step: 'Stage 4',
    state: 'APPROVED',
    title: 'Explicit Head Teacher approval',
    detail:
      'Head Teacher or School Admin approves complete packs. Printable staff verification copies unlock while parent views remain closed.'
  },
  {
    step: 'Stage 5',
    state: 'PUBLISHED',
    title: 'Publication & family distribution',
    detail:
      'Final report cards are published for A4 printing and authorised guardian access, with every transition recorded in the school audit trail.'
  }
];

export function LandingPage() {
  const { status, health, healthError, refreshHealth } = useAuth();

  return (
    <div className="landing">
      <section className="hero-panel" aria-labelledby="hero-heading">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="stage-pill">
              <span className="stage-dot" aria-hidden="true" />
              <span>EARLY-STAGE CONCEPT &amp; FOUNDATION · ZAMBIA</span>
            </div>
            <h1 id="hero-heading">
              Dependable examination records and term report cards for schools in Zambia.
            </h1>
            <p className="hero-lead">
              ORQELI Education is investigating how government, private, and community schools
              collect subject marks, catch missing entries before end-of-term deadlines, review and
              approve results, and reach parents reliably — including households without smartphones
              or home internet.
            </p>
            <div className="hero-actions">
              <Link
                to={status === 'authenticated' ? '/workspace' : '/login'}
                className="btn btn-primary"
              >
                <span>
                  {status === 'authenticated'
                    ? 'Open school workspace'
                    : 'Sign in to school workspace'}
                </span>
                <ArrowRight size={16} />
              </Link>
              <a href="#workflow" className="btn btn-secondary">
                Inspect results workflow
              </a>
            </div>
            <p className="hero-disclaimer">
              Research is ongoing. This repository contains foundational engineering and{' '}
              <strong>100% synthetic demonstration data</strong> — no real learner information,
              school endorsements, or Ministry of Education / ECZ approvals are claimed.
            </p>
          </div>

          <aside
            className="hero-ledger-card"
            aria-label="Illustrative synthetic term-results workflow card"
          >
            <div className="ledger-header">
              <div>
                <span className="ledger-tag">ILLUSTRATIVE SYNTHETIC WORKFLOW</span>
                <h2>Grade 9A · Term 3 Results Pack</h2>
              </div>
              <span className="badge badge-warning">1 Missing Entry</span>
            </div>

            <div className="ledger-rows">
              <div className="ledger-row">
                <div>
                  <strong>Mathematics (Core)</strong>
                  <span>Allocated: Subject Teacher</span>
                </div>
                <span className="mono-pill warn">2 / 3 recorded</span>
              </div>
              <div className="ledger-row">
                <div>
                  <strong>Integrated Science (Core)</strong>
                  <span>Allocated: Subject Teacher</span>
                </div>
                <span className="mono-pill ok">3 / 3 recorded</span>
              </div>
              <div className="ledger-row">
                <div>
                  <strong>English Language (Core)</strong>
                  <span>Allocated: Subject Teacher</span>
                </div>
                <span className="mono-pill ok">3 / 3 recorded</span>
              </div>
            </div>

            <div className="ledger-gate-list">
              <div className="ledger-gate">
                <Lock size={15} />
                <span>Approval blocked automatically until missing Mathematics mark is resolved</span>
              </div>
              <div className="ledger-gate">
                <ShieldAlert size={15} />
                <span>Unpublished marks never exposed to parent/guardian endpoints</span>
              </div>
              <div className="ledger-gate">
                <Printer size={15} />
                <span>Monochrome A4 printable report card + guardian acknowledgment slip</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="health-strip" aria-label="API runtime status">
        <div className="health-status-group">
          <span
            className={
              health
                ? 'status-indicator online'
                : healthError
                  ? 'status-indicator offline'
                  : 'status-indicator checking'
            }
            aria-hidden="true"
          />
          <div>
            <strong>
              {health
                ? 'API Health: Operational (/api/health)'
                : healthError
                  ? 'API Health: Unreachable'
                  : 'Checking API health…'}
            </strong>
            <span>
              {health
                ? `Mode: ${
                    health.sandboxMode
                      ? 'Synthetic In-Memory Sandbox (non-production)'
                      : 'PostgreSQL Relational Store'
                  } · Stage: ${health.stage}`
                : healthError ?? 'Verifying connection between web client and API service.'}
            </span>
          </div>
        </div>
        {healthError ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void refreshHealth()}
          >
            <RefreshCw size={14} />
            <span>Retry check</span>
          </button>
        ) : null}
      </section>

      <section id="problems" className="section-block" aria-labelledby="problems-heading">
        <div className="section-intro">
          <div>
            <span className="eyebrow">PROBLEM SPACE UNDER INVESTIGATION</span>
            <h2 id="problems-heading">Focused on end-of-term academic records first</h2>
          </div>
          <p>
            Rather than building an oversized school ERP before field validation is complete, ORQELI
            Education starts with the fragile journey from classroom mark sheets to approved parent
            report cards.
          </p>
        </div>

        <div className="card-grid-five">
          {PROBLEM_AREAS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.number} className="info-card">
                <div className="info-card-top">
                  <span className="step-index">{item.number}</span>
                  <Icon size={20} className="card-icon" />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="section-block surface-muted" aria-labelledby="workflow-heading">
        <div className="section-intro">
          <div>
            <span className="eyebrow">RESULTS WORKFLOW ARCHITECTURE</span>
            <h2 id="workflow-heading">Five controlled stages from mark entry to publication</h2>
          </div>
          <p>
            Permissions, school-level isolation, completeness checks, and publication gates are
            enforced directly in the Node/TypeScript API — not merely hidden in the browser.
          </p>
        </div>

        <ol className="pipeline-list">
          {WORKFLOW_STAGES.map((stage) => (
            <li key={stage.step} className="pipeline-card">
              <div className="pipeline-meta">
                <span className="pipeline-step">{stage.step}</span>
                <code className="pipeline-code">{stage.state}</code>
              </div>
              <h3>{stage.title}</h3>
              <p>{stage.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="access" className="section-block" aria-labelledby="access-heading">
        <div className="section-intro">
          <div>
            <span className="eyebrow">INCLUSIVE COMMUNICATION &amp; SECURITY BOUNDARIES</span>
            <h2 id="access-heading">Designed for real school constraints in Zambia</h2>
          </div>
          <p>
            Clear distinction between controls enforced in code today and capabilities still under
            research and engineering design.
          </p>
        </div>

        <div className="split-panels">
          <article className="boundary-panel">
            <div className="panel-header">
              <BookOpenCheck size={20} />
              <h3>Implemented in this foundation</h3>
            </div>
            <ul className="check-list">
              <li>
                <strong>Strict school-level tenant isolation:</strong> every academic table carries{' '}
                <code>schoolId</code>, and API middleware verifies active school membership before
                any read or write.
              </li>
              <li>
                <strong>Allocated-teacher mark entry &amp; validation:</strong> teachers can only
                record marks for their assigned class-subjects while a result pack is open.
              </li>
              <li>
                <strong>Missing-entry detection &amp; approval gates:</strong> incomplete packs
                cannot be submitted, approved, or published; publication strictly requires prior
                Head Teacher / School Admin approval.
              </li>
              <li>
                <strong>Unpublished parent protection:</strong> guardian endpoints query{' '}
                <code>PUBLISHED</code> packs exclusively — draft, submitted, and approved-preview
                marks are never exposed.
              </li>
              <li>
                <strong>Audit trail &amp; monochrome A4 print layout:</strong> mark edits record
                before/after values, and approved/published report cards render cleanly for low-ink
                paper printing with a tear-off guardian acknowledgment slip.
              </li>
            </ul>
          </article>

          <article className="boundary-panel planned">
            <div className="panel-header">
              <Smartphone size={20} />
              <h3>Planned &amp; under ongoing validation</h3>
            </div>
            <ul className="check-list">
              <li>
                <strong>Feature-phone SMS &amp; USSD delivery:</strong> concise term summaries and
                school-verified lookup codes so families without smartphones or mobile data can
                confirm published results.
              </li>
              <li>
                <strong>Intermittent-connectivity mark capture:</strong> offline-tolerant teacher
                entry queues and structured CSV/register import for schools with unreliable power or
                connectivity.
              </li>
              <li>
                <strong>Grading scales &amp; curriculum variants:</strong> configurable primary,
                junior secondary, and senior secondary grading bands (e.g., ECZ division/point
                conventions) once validated with partner educators.
              </li>
              <li>
                <strong>Database-level RLS &amp; production hardening:</strong> PostgreSQL
                Row-Level Security policies, login rate limiting, MFA for school administrators, and
                institutional onboarding workflows.
              </li>
            </ul>
          </article>
        </div>

        <div className="cta-banner">
          <div className="cta-copy">
            <Users size={22} />
            <div>
              <h3>Inspect the working foundation with synthetic school accounts</h3>
              <p>
                Explore teacher mark entry, missing-mark validation, Deputy review, Head Teacher
                approval, printable report cards, and guardian isolation using synthetic records.
              </p>
            </div>
          </div>
          <Link
            to={status === 'authenticated' ? '/workspace' : '/login'}
            className="btn btn-primary"
          >
            <span>{status === 'authenticated' ? 'Go to workspace' : 'Sign in'}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
