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
- **Session Invalidation & Absolute Lifetime**: Each session stores the `User.sessionVersion` it was issued with, plus `authenticatedAt`. Changing or resetting a password increments `sessionVersion`, so every other session (and any session issued before the change) is destroyed on its next request. Destroying a session never leaves the request chain without a session object: `destroyAuthenticatedSession` immediately re-attaches an empty, unsaved session (`ensureSessionObject`), so a browser that still holds the dead cookie can log in or register normally instead of triggering a 500. Sessions older than `7 days` (`ABSOLUTE_SESSION_LIFETIME_MS` in `apps/api/src/session.ts`) are rejected even when the rolling `SESSION_TTL_HOURS` expiry has not elapsed, and sessions with a missing/invalid/future `authenticatedAt` fail closed.
- **CSRF Defense-in-Depth**: State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) enforce `Origin`/`Referer` allowlisting, reject `Sec-Fetch-Site: cross-site`, reject browser form content types (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`), and **require** a valid HMAC-SHA256 `X-CSRF-Token` header verified with `crypto.timingSafeEqual`. A missing header returns `403 CSRF_MISSING`; a bad signature returns `403 CSRF_INVALID`. Anonymous tokens (issued before login/registration) are accepted only while the request has no session-bound CSRF secret, so an anonymous token cannot authorise an authenticated session. The token is derived from `SESSION_SECRET` and a per-session secret, never stored in JavaScript-readable storage, and is not a session identifier.
- **Server-Derived Identity & Ownership**: The API resolves `req.user` strictly from `req.session.userId` against the database on every request and verifies that the account is `ACTIVE`. Client-submitted `userId`, `ownerId`, `role`, or `status` fields are never trusted. Every business-owner query and mutation scopes by `ownerScope(req.user)` (`{ ownerId: req.user.id }`).
- **Authentication Rate Limiting**: `apps/api/src/rateLimit.ts` applies fixed-window limits to `POST /api/auth/login` (per IP address plus per IP+email identity), `POST /api/auth/register` (per IP address), `POST /api/auth/password-reset/request` and `POST /api/auth/password-reset/confirm` (per IP address) and `POST /api/auth/password/change` (per authenticated account). Rejections return `429` with `Retry-After` and a generic `RATE_LIMITED` body that never repeats the submitted email or password. Counters are in-process, so a multi-instance deployment also needs a shared/gateway limiter. Limits assume `req.ip` is trustworthy: in production `trust proxy` is enabled, so the reverse proxy must overwrite, not append to, `X-Forwarded-For`.
- **Password Reset & Change**: `POST /api/auth/password-reset/request` answers with the same generic `200` for every address, generating a 256-bit random token only for eligible accounts. Only the SHA-256 digest is stored (`PasswordResetToken`), tokens expire after 30 minutes, only one token per account is outstanding, and consumption is a conditional single-row update so a token can be used exactly once. Token issuance, consumption and password changes all take a `SELECT … FOR UPDATE` row lock on the `User` record inside their transaction, so concurrent requests are serialised: parallel reset requests cannot leave several live tokens, and a token that was valid before a password change can never remain usable. Database and audit failures are contained (generic `200`, nothing logged about the account) so an unhealthy table cannot become an account-existence oracle. Expired/consumed rows are deleted in bounded batches (`deleteExpiredPasswordResetTokens`, at most 200 rows per hour, triggered from the rate-limited request path). `POST /api/auth/password-reset/confirm` and `POST /api/auth/password/change` (authenticated, current password required) re-hash with Argon2id, increment `sessionVersion`, and audit `PASSWORD_RESET_*` / `PASSWORD_CHANGED`. Tokens are never returned in responses or written to audit records; delivery is injected through a `PasswordResetDelivery` seam, and no implementation exists in this repository (see *Recovery Availability* below).
- **Authentication Audit Trail**: `USER_LOGIN_FAILED` and `USER_LOGIN_BLOCKED` rows are written with `actorId: null` for failures. The e-mail address is replaced by a truncated HMAC-SHA256 pseudonym keyed with `SESSION_SECRET`, so operators can correlate attempts without storing PII. Audit write failures are swallowed so they cannot change the login response. Volume is bounded by the login rate limiter.
- **Administrator Provisioning**: `apps/api/scripts/create-admin.ts` (`npm run admin:create`) is the only way to create an `ADMIN`. It requires explicit confirmation, reads the password from a hidden prompt or stdin (never argv), validates input with Zod, refuses to modify or promote an existing account, hashes with Argon2id, and records an `ADMIN_PROVISIONED` audit event (`actorId: null`, `metadata.source = "cli"`). No HTTP route can create or elevate an administrator. The command prints a credential-free `Target database:` line derived from `DATABASE_URL`; `--yes` never bypasses target validation, because a non-interactive run must repeat that value in `--expect-target` (interactive runs type the database name instead).
- **Recovery Availability**: `PASSWORD_RESET_MODE` (default `disabled`) controls whether the recovery endpoints exist. With no injected `PasswordResetDelivery`, both endpoints answer `503 PASSWORD_RESET_UNAVAILABLE` instead of returning a success that can never reach the user; `NODE_ENV=production` with `PASSWORD_RESET_MODE=enabled` and no delivery refuses to start. `GET /api/health` reports the state as `passwordReset`, and `GET /api/health/ready` adds a database check (503 when the repository is unreachable).
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
- Initial migrations should be generated from the Prisma schema, reviewed, and committed. The `20261023094500_password_reset_and_session_version` migration was written to Prisma's documented SQL conventions because the Prisma migration engine could not be downloaded in the authoring environment; all migrations were then applied successfully to a PostgreSQL 16 instance. CI's `prisma migrate diff --from-migrations ... --exit-code` step is the authoritative drift gate and must pass before deployment.
- The Prisma CLI cannot be exercised against a live database in the authoring sandbox (no engine binary), so `migrate deploy`, `db:verify-flow` and `db:verify-discovery` remain CI-only checks.

## Outstanding security work (not implemented)

These are known gaps, not silent assumptions. Infrastructure-dependent items are
tracked in [deployment-checklist.md](deployment-checklist.md).

- **Password-reset delivery**: tokens are created and stored safely, but nothing
  sends them. Until a `PasswordResetDelivery` implementation backed by a real
  e-mail (or SMS) provider is injected and `PASSWORD_RESET_MODE=enabled` is set,
  the endpoints answer `503 PASSWORD_RESET_UNAVAILABLE` and no token is issued.
  This is a deliberate unavailable state, not a working recovery flow.
- **Account lifecycle**: no e-mail/phone verification, no MFA. Registration
  accepts unverified addresses.
- **Multi-instance rate limiting**: the built-in limiter is per process. Use a
  shared store or edge/gateway limits before running more than one API instance.
- **Proxy topology**: production assumes exactly one trusted proxy hop and
  overwrites nothing itself. `trust proxy` is deliberately unchanged because the
  deployment topology is not part of this repository; see the checklist for the
  required verification steps.
- **Enumeration trade-off**: registration still answers
  `409 EMAIL_ALREADY_IN_USE` / `PHONE_ALREADY_IN_USE`. That is a deliberate UX
  choice: a returning user must learn that they already have an account (and
  should use password reset instead). The cost is that an attacker can confirm
  whether an address is registered. Login responses, admin-only data and the
  password-reset request endpoint are all generic. Removing the disclosure would
  require an e-mail-verification flow first, otherwise a user who mistypes their
  address would receive false success.
- **Reset-token housekeeping**: expired tokens are pruned in bounded batches from
  the request path (at most 200 rows per hour). A deployment with very high reset
  volume should schedule `deleteExpiredPasswordResetTokens` instead.
- **Monitoring**: audit rows are written but no log shipping, alerting or on-call
  process exists. `/api/health/ready` exposes `passwordReset: "disabled"` so a
  platform can alert on it. Suggested thresholds are in the deployment checklist; they are
  recommendations, not operational monitoring.
- **Backups/DR**: no backup or restore procedure exists in the repository. The
  deployment owner must configure backups and prove a restore.
- **Deployment hardening**: the repository has no hosting/proxy configuration, so
  HTTPS redirect, HSTS, `frame-ancestors`, TLS versions and cookie `Secure`
  delivery must be configured and verified at the host.
- **Dependency supply chain**: GitHub Actions are now pinned to full commit SHAs;
  refresh the pins deliberately when upgrading the actions.
