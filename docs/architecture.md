# Architecture & Security Boundaries

## 1. Service Separation & Deployment Boundary

ORQELI Education maintains a strict boundary between browser presentation and server-side authority:

- **`apps/web` (`@orqeli/web`)**: React 19 + Vite + TypeScript SPA. Renders the public research overview, sign-in flow, school staff academic workspace, guardian published-results view, and `@media print` A4 report cards. Browser code uses relative `/api/*` paths exclusively (never hardcoded `localhost` URLs) and never stores session identifiers in `localStorage` or `sessionStorage`.
- **`apps/api` (`@orqeli/api`)**: Node.js + Express 5 + TypeScript JSON API. Owns runtime environment validation (Zod), session management, CSRF verification, Argon2id password verification, school-level tenant isolation, role/allocation authorization, completeness validation, state transitions, and audit logging.
- **PostgreSQL + Prisma**: Durable relational store (`apps/api/prisma/schema.prisma` and committed migrations under `apps/api/prisma/migrations/`).

Note: GitHub Pages or static CDN hosts can only serve static assets and cannot host `@orqeli/api` or PostgreSQL. No automatic production deployment is triggered from working branches.

---

## 2. Relational Domain & Multi-School Tenant Isolation

Every school-specific table carries an explicit `schoolId` column and foreign key referencing `School(id)`:

- `School` — Tenant root (`code`, `registrationNumber`, `name`, `sector`, `province`, `district`, `levelSummary`, `publicDescription`, `studentPortalEnabled`, `timezone`, `isSyntheticDemo`, `status`).
- `SchoolMembership` — Binds `User` to `School` with a `SchoolRole` (`SCHOOL_ADMIN`, `HEAD_TEACHER`, `DEPUTY_HEAD`, `TEACHER`, `PARENT_GUARDIAN`, `STUDENT`) and `MembershipStatus`. Note: `STUDENT` is intentionally excluded from `STAFF_ROLES`, `LEADERSHIP_ROLES`, and `APPROVAL_ROLES`.
- `AcademicYear` & `AcademicTerm` — School calendar hierarchy (`TERM_1`, `TERM_2`, `TERM_3`).
- `SchoolClass` & `Subject` — Classes (`gradeLevel`, optional `classTeacherMembershipId`) and school subjects (`code`, `maxMark`, `isCore`).
- `ClassSubjectAllocation` — Authorises a specific `TEACHER` membership to enter marks for `(schoolClassId, subjectId)`.
- `Learner`, `LearnerGuardianLink`, & `LearnerStudentLink` — School-scoped learner records (`@@unique([schoolId, admissionNumber])`) and explicit verified 1:1 student-to-learner links (`@@unique([learnerId])`, `@@unique([membershipId])`).
- `StudentEnrolmentCode` & `StudentRegistrationRequest` — Single-use expiring/revocable SHA-256 hashed enrolment codes (`codeHash` unique, plaintext never stored) and audited staff-approval queue for students without an enrolment slip.
- `SchoolAnnouncement` — School-scoped notices (`STUDENTS_AND_STAFF` vs `STAFF_ONLY`).
- `TermResultPack` & `SubjectMark` — Class-term result lifecycle (`DRAFT` → `SUBMITTED` → `NEEDS_REVISION` → `APPROVED` → `PUBLISHED`) and individual learner-subject marks (`PENDING`, `PRESENT`, `ABSENT`, `EXEMPT`).
- `AuditEvent` — Immutable event log recording `schoolId`, `actorUserId`, `actorMembershipId`, `action`, `entityType`, `entityId`, `beforeState`, `afterState`, and `metadata`.
- `Session` (`"session"`) — PostgreSQL backing table for `connect-pg-simple`.

### How Isolation Is Enforced Today

1. **Server-Derived Identity**: `req.user` and `req.memberships` are hydrated on every `/api` request from `req.session.userId` against the repository. Client-supplied user IDs, roles, or school memberships are never trusted.
2. **Route Gate (`requireSchoolRole`)**: Every `/api/schools/:schoolId/*` route verifies that the authenticated user holds an `ACTIVE` membership in that exact `schoolId` (and that the school is not `SUSPENDED`) with an allowed `SchoolRole`. Users from another school immediately receive `403 SCHOOL_ACCESS_DENIED`.
3. **Repository Scope (`schoolScope`)**: Every repository query and mutation filters by `{ schoolId: access.schoolId }` in addition to primary keys (`packId`, `learnerId`, etc.), preventing cross-school ID enumeration or tampering.

---

## 3. Implemented Security Controls vs. Planned Hardening

To avoid overstating security posture during early-stage development, ORQELI Education separates **implemented controls** from **planned controls**:

### Implemented and Tested in This Codebase
- **Argon2id password hashing** (`argon2id`, constant-time dummy verification when email is unknown).
- **PostgreSQL-persisted `HttpOnly` sessions** (`express-session` + `connect-pg-simple`), session ID rotation (`req.session.regenerate()`) on login, `MemoryStore` blocked in `production`, and `Secure` cookies enforced in `production`.
- **HMAC-SHA256 CSRF defense-in-depth**: `Origin`/`Referer` allowlisting, `Sec-Fetch-Site: cross-site` rejection, form content-type rejection, and constant-time verification of session-bound `X-CSRF-Token` headers on all state-changing HTTP methods.
- **Controlled student registration & verification (no open staff self-registration)**:
  - Staff accounts and roles (`SCHOOL_ADMIN`, `HEAD_TEACHER`, `DEPUTY_HEAD`, `TEACHER`) cannot be self-registered publicly.
  - Student self-registration (`POST /api/student/register`) is restricted to non-suspended schools with `studentPortalEnabled = true`, is IP rate-limited, never links accounts by name/class/DOB alone, and requires either a valid single-use SHA-256 enrolment code matching `(schoolId, admissionNumber)` or an `INACTIVE` pending request explicitly approved by school leadership.
  - Public endpoints return uniform errors without enumerating whether a learner admission number exists, and student report-card routes enforce strict 1:1 `LearnerStudentLink` ownership (`403 STUDENT_LEARNER_ACCESS_DENIED`) to prevent IDOR across learners or schools.
- **IP sliding-window rate limiting** on public school discovery, student registration, and login routes.
- **API-enforced workflow permissions**:
  - Only the allocated subject `TEACHER` can enter/modify marks for a class-subject, and only while the pack is `DRAFT` or `NEEDS_REVISION`.
  - Incomplete packs (`missingCount > 0`) are rejected at submission, approval, and publication (`409 INCOMPLETE_MARKS`).
  - Only `HEAD_TEACHER` or `SCHOOL_ADMIN` can approve or publish results, and publication requires `status === 'APPROVED'` (`409 APPROVAL_REQUIRED_BEFORE_PUBLICATION`).
  - `PARENT_GUARDIAN` endpoints filter strictly on `TermResultPack.status === 'PUBLISHED'` and `LearnerGuardianLink` — unpublished marks are never returned.
- **Transactional audit logging**: Mark creations/updates (with `beforeState` and `afterState`) and workflow status transitions write `AuditEvent` records inside the same database transaction in `PrismaEducationRepository`.

### Planned Before Any Real-School Pilot (Not Yet Implemented)
- **PostgreSQL Row-Level Security (RLS)** policies binding `app.current_school_id` at the database session level as defense-in-depth behind repository scoping.
- **Authentication rate limiting, account lockout, and MFA** for school leadership and platform administrators.
- **Tamper-evident audit retention** (append-only DB role permissions prohibiting `UPDATE`/`DELETE` on `"AuditEvent"` in production).
- **Encryption & retention governance** for real learner records once legal/regulatory data-protection requirements in Zambia (Data Protection Act, 2021) are formally reviewed.
- **Prisma dependency upgrade review**: `prisma` 6.19.x carries a known advisory in its CLI config transitive dependency (`@prisma/config` → `deepmerge-ts`). Upgrading to Prisma 7+ should be validated end-to-end against staging PostgreSQL before production release.
