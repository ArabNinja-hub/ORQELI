# Architecture and decisions

## Deployment boundary

`apps/web` is a static React SPA and can be deployed to a static host. `apps/api` is a separate Node service and requires a reachable PostgreSQL database; GitHub Pages is not an API/database host. The Vite `/api` proxy is development-only. Production deployment must configure the frontend API base URL and API CORS/credentials for the deployed origins.

## Responsibilities

- Web: the public shell plus customer, business-owner, and administrator views. Authorization is enforced by the API on every request; the client never holds a session token in JavaScript-readable storage (the session lives in an `HttpOnly` cookie) and keeps only the CSRF token and the safe user profile in memory.
- API: JSON HTTP boundary, runtime environment validation, security headers, origin-restricted CORS, generic errors, database client, and role/owner authorization primitives.
- PostgreSQL: durable relational records, foreign keys, uniqueness and indexes. Prisma schema is the source of truth; use reviewed, committed Prisma migrations for schema changes (`npm run db:migrate` locally, `prisma migrate deploy` in deployment).

## Data model

`User` has a single role (`CUSTOMER`, `BUSINESS_OWNER`, `ADMIN`); a user can own businesses and/or have customer bookings. `Business` is owned by one user and carries city/location/contact data and review status. `Service` and weekday `WorkingHour` records belong to a business. `Booking` can point to an account or store guest name/phone/optional email, with start/end timestamps stored as PostgreSQL `timestamptz(3)` instants and a unique reference. Normalize incoming and outgoing instants as UTC; interpret `WorkingHour` wall-clock times using the explicitly configured business timezone (initial market: `Africa/Lusaka`), rather than treating them as UTC. `AuditEvent` records actor, action, entity and optional JSON metadata. Prices are optional integer minor units with ZMW currency; no payment behavior is present.

The city is a string rather than a closed enum so additional Zambian cities can be added without schema changes. Business list queries must include `status: APPROVED`; pending/rejected/suspended listings are not public and cannot accept bookings. Approval changes belong only to trusted administrator endpoints and should create audit events. The API currently has no business or booking endpoints.

## Authorization/security architecture

`requireAuth`, `requireRole`, and `ownerScope` in `apps/api/src/authz.ts` enforce role-based access control and tenant isolation:

- **PostgreSQL Session Persistence**: Sessions are stored in the PostgreSQL `"session"` table via `express-session` and `connect-pg-simple` (`apps/api/src/session.ts`), matching the `Session` model in `apps/api/prisma/schema.prisma`. `MemoryStore` is explicitly prohibited in `production`.
- **Cookie Security & Fixation Defense**: Session cookies use `httpOnly: true`, `secure: true` in `production`, `sameSite: 'lax'` (configurable), and explicit `maxAge`. On login and registration, `req.session.regenerate()` rotates the session ID before binding `userId`, invalidating any pre-authentication session ID. Logout calls `req.session.destroy()` and clears the cookie.
- **CSRF Defense-in-Depth**: State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) enforce `Origin`/`Referer` allowlisting, reject `Sec-Fetch-Site: cross-site`, reject browser form content types (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`), and **require** a valid HMAC-SHA256 `X-CSRF-Token` header verified with `crypto.timingSafeEqual`. A missing header returns `403 CSRF_MISSING`; a bad signature returns `403 CSRF_INVALID`. Anonymous tokens (issued before login/registration) are accepted only while the request has no session-bound CSRF secret, so an anonymous token cannot authorise an authenticated session. The token is derived from `SESSION_SECRET` and a per-session secret, never stored in JavaScript-readable storage, and is not a session identifier.
- **Server-Derived Identity & Ownership**: The API resolves `req.user` strictly from `req.session.userId` against the database on every request and verifies that the account is `ACTIVE`. Client-submitted `userId`, `ownerId`, `role`, or `status` fields are never trusted. Every business-owner query and mutation scopes by `ownerScope(req.user)` (`{ ownerId: req.user.id }`).
- **Authentication Rate Limiting**: `apps/api/src/rateLimit.ts` applies fixed-window limits to `POST /api/auth/login` (per IP address plus per IP+email identity) and `POST /api/auth/register` (per IP address). Rejections return `429` with `Retry-After` and a generic `RATE_LIMITED` body that never repeats the submitted email or password. Counters are in-process, so a multi-instance deployment also needs a shared/gateway limiter. Limits assume `req.ip` is trustworthy: in production `trust proxy` is enabled, so the reverse proxy must overwrite, not append to, `X-Forwarded-For`.
- **Response Caching**: `/api/auth`, `/api/account`, `/api/owner` and `/api/admin` responses are sent with `Cache-Control: no-store` so personal data and CSRF tokens are never stored by browsers or shared proxies. Public discovery responses are already `no-store`.
- **CSRF Origin Trust**: The allowlist is `WEB_ORIGIN` plus, outside production only, the origin implied by the `Host` header (needed for localhost/LAN/preview development). Production requests must match `WEB_ORIGIN` exactly, so a rebound or attacker-controlled host name cannot satisfy the origin check.
- **Browser Hardening**: The production web build emits a `<meta http-equiv="Content-Security-Policy">` (self-only scripts, self + Google Fonts styles, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`) plus a `strict-origin-when-cross-origin` referrer policy. `frame-ancestors`, HSTS and `X-Frame-Options` cannot be expressed through `meta`; the host/proxy must send them as HTTP response headers.

## Booking consistency (future phase)

A future booking endpoint must only accept approved businesses and active services, derive duration and end time from the database, verify opening hours and availability, and re-check all conditions during the write transaction. Use an appropriate transaction isolation/locking strategy and preferably a PostgreSQL exclusion constraint on a `tstzrange(starts_at, ends_at, '[)')` per business for active conflicting appointments (requiring `btree_gist`), with booking status updates designed around that constraint. This protection and all booking behavior are not implemented in Phase 1.

## Dependency audit follow-up

`npm audit` reports no known vulnerabilities. The three high-severity advisory nodes that previously appeared came from one build-tooling chain: `prisma` → `@prisma/config` → `deepmerge-ts` (GHSA-ggr8-5vv4-36mx / CVE-2026-40345, recursive-graph stack exhaustion, affected `<8.0.0`, fixed in `8.0.0`). That chain is only loaded by the Prisma CLI when it reads a `prisma.config.ts`; it is not part of the API runtime or the browser bundle.

The fix applied is a root `overrides` entry pinning `deepmerge-ts` to `^8.0.2` (the version Prisma 7.10.1 itself ships). The vulnerable `deepmerge` entry point is still exported by 8.x with the same call signature used by `@prisma/config`'s c12 merger, and config loading was exercised locally against 8.0.2. Prisma itself stays on 6.19.3 because a 7.x upgrade is a SemVer-major change to the CLI/config/client workflow and is not required for this advisory. `npm audit --audit-level=high` runs in CI so a regression fails the build.

## Assumptions and follow-up

- ZMW is the initial currency; monetary values are represented as integer minor units only if a service price is later supplied.
- A business owner may own multiple businesses.
- Working hours use weekday (0–6) and local wall-clock strings; the Phase 1 schema does not store a business timezone. Before booking implementation, add or define a trusted timezone field/config (initially `Africa/Lusaka`) and handle UTC conversion consistently.
- Guest bookings do not require a user record; collection, retention, and privacy requirements for contact details must be decided before launch.
- Initial migrations should be generated from the Prisma schema, reviewed, and committed. Database tooling could not be exercised in the current environment because PostgreSQL/Docker are not installed.

## Outstanding security work (not implemented)

These are known gaps, not silent assumptions:

- **Administrator provisioning**: there is no endpoint that creates `ADMIN` accounts; an administrator must be provisioned directly in the database with an Argon2id hash produced by the application. Server-side rejection of `ADMIN` self-registration is covered by tests.
- **Multi-instance rate limiting**: the built-in limiter is per process. Use a shared store or edge/gateway limits before running more than one API instance.
- **Account lifecycle**: no email/phone verification, password reset, password change, MFA, or absolute session lifetime. Adding password reset requires single-use, hashed, time-limited tokens and a fixed response message that does not reveal account existence.
- **Enumeration**: registration answers `409 EMAIL_ALREADY_IN_USE` / `PHONE_ALREADY_IN_USE`, which confirms that an account exists. Login is intentionally generic.
- **Monitoring**: failed logins are rate limited but not recorded as `AuditEvent`s (that would let an unauthenticated caller write rows). Forward API logs to a monitored sink and alert on `RATE_LIMITED` volume.
- **Backups/DR**: no backup or restore procedure exists in the repository. The deployment owner must configure PostgreSQL point-in-time recovery or scheduled `pg_dump` retention and prove a restore.
- **Deployment hardening**: the repository has no hosting/proxy configuration, so HTTPS redirect, HSTS, `frame-ancestors`, TLS versions and cookie `Secure` delivery must be configured and verified at the host.
- **Dependency supply chain**: GitHub Actions are pinned by tag, not commit SHA.
