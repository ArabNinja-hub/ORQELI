# ORQELI Education

ORQELI Education is an early-stage education technology foundation for government, private, and community schools in Zambia.

The initial problem space under active investigation is **academic records and end-of-term examination results**:

- Recording subject marks and structured academic records by academic year, term, class, and subject.
- Detecting missing, late, or unrecorded marks before report-card compilation stalls.
- Supporting structured review, revision requests, and correction of results.
- Enforcing explicit Head Teacher / School Administrator approval prior to publication.
- Generating clean, low-ink A4 printable report cards and designing parent access that does **not** require smartphone ownership or reliable home internet.

> **Project Stage & Honesty Notice:** ORQELI Education is in early-stage research and foundational engineering. All demonstration schools, staff accounts, learners, and marks in this repository are **100% synthetic** (`@synthetic.orqeli.invalid` / `SYN-` identifiers). Never store real learner personally identifiable information (PII) or production secrets in this repository. ORQELI Education makes no claim of school endorsements, adoption statistics, or Ministry of Education / Examinations Council of Zambia (ECZ) approval.

---

## Repository Structure

This repository uses an npm workspace monorepo separating the browser client and the backend API:

```text
ORQELI/
├── apps/
│   ├── web/                 # React 19, Vite 7, TypeScript single-page client
│   └── api/                 # Node.js, Express 5, TypeScript, Prisma, PostgreSQL API
├── docs/
│   ├── architecture.md      # Deployment boundary, tenant isolation, RBAC, session/CSRF, limits
│   └── results-workflow.md  # Domain & workflow design for the 8 candidate academic requirements
├── .env.example             # Documented environment template (no real secrets)
└── package.json             # Workspace scripts for dev, typecheck, test, build, and Prisma
```

> The pre-pivot business marketplace source code is preserved untouched on the `backup/pre-education-pivot-2026-10-28` branch and in Git history.

---

## Quick Start & Local Setup

### Prerequisites

- **Node.js 20+** (verified on Node.js 22) and **npm 10+**
- **PostgreSQL 16+** for standard relational persistence (or use `npm run dev:sandbox` for zero-database synthetic evaluation during early exploration)

### Option A: Standard Setup with PostgreSQL

1. **Install workspace dependencies:**
   ```bash
   npm install
   ```

2. **Create a fresh PostgreSQL database:**
   *(If you previously ran pre-pivot ORQELI migrations locally, create a new database such as `orqeli_education` rather than applying education migrations onto old tables.)*
   ```sql
   CREATE ROLE orqeli LOGIN PASSWORD 'replace_with_local_password';
   CREATE DATABASE orqeli_education OWNER orqeli;
   ```

3. **Configure `.env` at the repository root:**
   ```bash
   cp .env.example .env
   ```
   Update `DATABASE_URL` and set `SESSION_SECRET` to a random value of at least 32 characters (for example `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).

4. **Validate Prisma, generate the client, and apply migrations:**
   ```bash
   npm run db:validate
   npm run db:generate
   npm run db:deploy
   ```

5. **(Optional) Seed synthetic demonstration schools & roles into local PostgreSQL:**
   ```bash
   npm run db:seed-synthetic
   ```
   *(Refuses to run when `NODE_ENV=production`.)*

6. **Start both the web client and API:**
   ```bash
   npm run dev
   ```
   - Web application: `http://localhost:5173`
   - API health endpoint: `http://localhost:4000/api/health` (proxied at `http://localhost:5173/api/health`)

### Option B: Zero-Database Synthetic Sandbox Mode (Development Only)

To inspect the landing page, multi-role school workspace, mark-entry validation, approval pipeline, printable A4 report cards, and guardian isolation without running PostgreSQL locally:

```bash
npm run dev:sandbox
```

This starts `@orqeli/api` with `DATA_STORE_MODE=memory-sandbox` (pre-loaded with clearly marked `[Synthetic Demo]` records) alongside `@orqeli/web`. Note that `DATA_STORE_MODE=memory-sandbox` is strictly rejected by runtime configuration validation when `NODE_ENV=production`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite (`apps/web`) and Express (`apps/api`, PostgreSQL mode) concurrently |
| `npm run dev:sandbox` | Starts Vite and Express in non-production in-memory synthetic sandbox mode |
| `npm run typecheck` | Runs TypeScript `--noEmit` checks across `@orqeli/api` and `@orqeli/web` |
| `npm test` | Runs automated API and web unit/integration test suites (no live DB required) |
| `npm run build` | Compiles `@orqeli/api` and builds the production `@orqeli/web` bundle |
| `npm run db:validate` | Validates `apps/api/prisma/schema.prisma` |
| `npm run db:generate` | Generates the typed Prisma Client |
| `npm run db:deploy` | Applies committed Prisma migrations to PostgreSQL |
| `npm run db:migrate -- --name <name>` | Creates and applies a new Prisma migration during schema changes |
| `npm run db:status` | Checks PostgreSQL migration status |
| `npm run db:seed-synthetic` | Populates synthetic demo schools/users into local PostgreSQL (blocked in production) |
| `npm run db:verify-flow -w @orqeli/api` | Runs end-to-end verification against a live PostgreSQL database |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---:|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection URL (`postgresql://...`) |
| `SESSION_SECRET` | Yes | — | Secret (32+ chars) signing session cookies and HMAC CSRF tokens; example placeholders are rejected in `production` |
| `PORT` | No | `4000` | Port `@orqeli/api` listens on; Vite dev server proxies `/api` to `http://127.0.0.1:$PORT` |
| `WEB_ORIGIN` | No | `http://localhost:5173` | Allowed browser origin for CORS and CSRF `Origin`/`Referer` verification |
| `SESSION_COOKIE_NAME` | No | `orqeli.sid` | Name of the `HttpOnly` session cookie |
| `SESSION_TTL_HOURS` | No | `24` | Session lifetime (`1`–`720` hours) |
| `SESSION_COOKIE_SAMESITE` | No | `lax` | `lax`, `strict`, or `none` (`none` requires `NODE_ENV=production`) |
| `TRUST_PROXY` | No | `false` | Trust reverse-proxy headers (`X-Forwarded-Proto`); automatically enabled in `production` |
| `DATA_STORE_MODE` | No | `postgres` | `postgres` or `memory-sandbox` (`memory-sandbox` is blocked when `NODE_ENV=production`) |
| `NODE_ENV` | No | `development` | `development`, `test`, or `production` |

---

## Core API Endpoints

### Public School Discovery & Auth
- `GET /api/health` — Process liveness and runtime stage check (`{ status: "ok", service: "orqeli-education-api", stage: "early-stage-foundation", sandboxMode }`).
- `GET /api/public/schools` — Rate-limited public school directory search by name, location (`province`, district), `sector`, school `code` / registration number, and `portalOnly`, returning strictly approved public fields (zero staff/learner/mark records).
- `GET /api/public/schools/:codeOrId` — Public school profile and student-portal activation state (`canSelfRegister`).
- `GET /api/auth/csrf` — Issues a signed CSRF token required in `X-CSRF-Token` on all `POST`/`PUT`/`PATCH`/`DELETE` requests.
- `POST /api/student/register` — Rate-limited student registration requiring school selection, learner admission number, and either a single-use SHA-256 hashed school enrolment code (`ENROLMENT_CODE`) or a pending school-verification request (`STAFF_APPROVAL`). Never links accounts by name/class/DOB alone and never leaks whether an admission number exists on public endpoints.
- `POST /api/auth/login` — Rate-limited Argon2id email/password login, session ID rotation, and role-aware membership lookup.
- `POST /api/auth/logout` — Destroys server-side session and clears cookie.
- `GET /api/auth/me` — Returns current session user and school memberships.

### Student Academic Portal (`STUDENT` Role)
- `GET /api/student/portal` — CBU OPUS-inspired student academic dashboard returning verified school/class identity, published term results (subject marks, percentages, grade bands, teacher remarks), explicit unpublished-term status notices, school announcements, and pending verification request status.
- `GET /api/student/schools/:schoolId/learners/:learnerId/report-cards/:packId` — Printable A4 student report card strictly restricted (`403 STUDENT_LEARNER_ACCESS_DENIED`) to the authenticated student's own `LearnerStudentLink` and `PUBLISHED` packs only.

### School Leadership Student & Roster Administration (`DEPUTY_HEAD`, `HEAD_TEACHER`, `SCHOOL_ADMIN`)
- `GET /api/schools/:schoolId/admin/student-portal` — School-isolated roster, active enrolment code hints, pending student registration requests, and announcements.
- `POST /api/schools/:schoolId/admin/learners` — Adds a learner record to the school roster (audited).
- `POST /api/schools/:schoolId/admin/learners/:learnerId/enrolment-codes` — Generates/rotates a single-use expiring enrolment code (plain code returned once; only SHA-256 hash stored).
- `POST /api/schools/:schoolId/admin/enrolment-codes/:codeId/revoke` — Revokes an unused enrolment code.
- `POST /api/schools/:schoolId/admin/student-requests/:requestId/approve` & `/reject` — Approves & links (or rejects with notes) a pending student registration request, blocking self-approval and cross-school linking.
- `POST /api/schools/:schoolId/admin/announcements` — Publishes a school or results-publication notice (`STUDENTS_AND_STAFF` or `STAFF_ONLY`).

### Academic Marks & Approval Workflow (`STAFF` Roles)
- `GET /api/schools/:schoolId/overview` — School academic calendar, subject allocations, and result-pack completeness summary (`STAFF` roles in `:schoolId` only).
- `GET /api/schools/:schoolId/result-packs/:packId` — Class-term mark matrix, subject permissions, and missing-entry detector.
- `PUT /api/schools/:schoolId/result-packs/:packId/marks` — Records/updates marks for an allocated subject teacher while pack is `DRAFT` or `NEEDS_REVISION`, writing before/after `AuditEvent` records.
- `POST /api/schools/:schoolId/result-packs/:packId/submit` — Submits a 100%-complete result pack for review (`409 INCOMPLETE_MARKS` if any mark is missing).
- `POST /api/schools/:schoolId/result-packs/:packId/request-revision` — Returns a `SUBMITTED` or `APPROVED` pack to `NEEDS_REVISION` with mandatory review notes (`DEPUTY_HEAD`, `HEAD_TEACHER`, `SCHOOL_ADMIN`).
- `POST /api/schools/:schoolId/result-packs/:packId/approve` — Approves a `SUBMITTED` complete pack (`HEAD_TEACHER` or `SCHOOL_ADMIN` only).
- `POST /api/schools/:schoolId/result-packs/:packId/publish` — Publishes an `APPROVED` pack (`409 APPROVAL_REQUIRED_BEFORE_PUBLICATION` if not yet approved).
- `GET /api/schools/:schoolId/result-packs/:packId/report-cards/:learnerId` — Structured printable report card for `APPROVED` (staff preview) or `PUBLISHED` packs.
- `GET /api/schools/:schoolId/audit-events` — School-scoped audit log (`DEPUTY_HEAD`, `HEAD_TEACHER`, `SCHOOL_ADMIN`).

---

## Synthetic Sandbox Walkthrough

All synthetic sandbox accounts share the password `SyntheticDemo!2026`:

1. **Public School Discovery (`/schools`)**: Search by `Lukanga`, `Lusaka`, or `SYN-ZM-LUS-01`. Inspect `Mindolo Community Day Secondary` (`SYN-ZM-CB-03`) to see a directory-listed school whose student portal is not yet enabled.
2. **Instant Student Verification (`/student/register`)**: Select `Lukanga Day Secondary`, enter Admission Number `SYN-2026-0802` (`Chisomo Banda`) and single-use Enrolment Code `ORQ-8B02-2026` to verify immediately and open `/student`.
3. **Pending Approval Flow**: Sign in as `student.pending@synthetic.orqeli.invalid` (sees pending status with zero academic marks), then sign in as Head Teacher `head.mulenga@synthetic.orqeli.invalid` in `/workspace` to approve and link `Bupe Kasonde` (`SYN-2026-0903`).
4. **Verified OPUS-Style Student Portal (`/student`)**: Sign in as `student.lubasi@synthetic.orqeli.invalid` (`SYN-2026-0801`) to view published Term 2 marks/grades, open the printable A4 report card, and confirm Term 3 (`DRAFT`) marks remain hidden.

> **GitHub Pages Static Preview Limitation:** When built with `VITE_STATIC_SANDBOX=true` for GitHub Pages (`https://arabninja-hub.github.io/ORQELI/`), all workflow state runs in browser `sessionStorage` inside a single tab because GitHub Pages cannot host Node.js or PostgreSQL. Real server-side authentication, Argon2id password hashing, SHA-256 enrolment code verification, CSRF/session cookies, rate limiting, and durable audit logs require running `@orqeli/api` backed by PostgreSQL.

---

## Current Limitations & Further Documentation

- **Ongoing discovery:** Grading scale variations across Zambian primary, junior secondary, and senior secondary levels (including ECZ division/point scales), continuous assessment weighting, and termly attendance summaries are not yet finalised and intentionally not hardcoded.
- **No SMS/USSD gateway yet:** While learners carry a `preferredChannel` (`PRINT_REPORT`, `SMS_SUMMARY`, `GUARDIAN_PORTAL`) and report cards include a physical tear-off guardian acknowledgment slip, live telecom SMS/USSD integration is planned for a later phase after school workflow validation.
- **Administrative provisioning:** Institutional school onboarding, bulk learner/class CSV import, password reset flows, login rate limiting, MFA, and database-level PostgreSQL Row-Level Security (RLS) policies are not yet implemented.

See:
- [docs/architecture.md](docs/architecture.md) — Architecture, security boundaries, and tenant isolation model.
- [docs/results-workflow.md](docs/results-workflow.md) — Detailed design of the 8-part examination marks and report-card workflow.
