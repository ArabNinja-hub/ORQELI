# ORQELI

ORQELI is a booking marketplace foundation for local barbershops and salons, initially focused on Kitwe and Ndola, Zambia. Phase 1 sets up an independently deployable React frontend and Node API, relational data model, and responsive product shell. It intentionally does **not** implement listings, authentication, bookings, or admin operations yet.

## Repository inspection / current status

The original repository had only this README and no application framework, packages, tests, or existing configuration. There was no working code to replace. This repository now uses an npm workspace monorepo with `apps/web` (React, TypeScript, Vite) and `apps/api` (Express, TypeScript, Prisma, PostgreSQL). They build and deploy independently; Vite proxies `/api` to the API during local development.

## Requirements coverage and boundaries

- Initial relational entities and roles are modeled: users (`CUSTOMER`, `BUSINESS_OWNER`, `ADMIN`), user account statuses (`ACTIVE`, `DISABLED`, `SUSPENDED`), businesses, services, working hours, bookings, administrator audit events, and PostgreSQL-backed sessions (`session`).
- Business statuses are `PENDING`, `APPROVED`, `REJECTED`, and `SUSPENDED`; new records default to pending. Public discovery/booking access must filter for approved businesses.
- Business records include city and location; city is free text for extensibility and indexed with status. Launch UI city choices are Kitwe and Ndola.
- Server-verified session authentication (`express-session` + `connect-pg-simple`), Argon2id password hashing, CSRF protections, role-based access control (`requireRole`), and business-owner tenant isolation (`ownerScope`) are implemented across `/api/auth/*`, `/api/account`, `/api/owner/*`, and `/api/admin/*`. Public registration never permits creating `ADMIN` accounts, and newly registered business owners always create `PENDING` business listings subject to manual administrator review.
- Account security includes hashed single-use password-reset tokens (30-minute expiry), an authenticated password change that requires the current password, session invalidation on any credential change (`User.sessionVersion`), a seven-day absolute session lifetime, and pseudonymised audit records for failed/blocked logins. Administrators are created only with the `npm run admin:create` CLI — never through HTTP. E-mail delivery for reset tokens is not configured in this repository; see [docs/deployment-checklist.md](docs/deployment-checklist.md).
- Booking data includes guest contact fields and a unique reference. Booking creation, availability calculation, transaction/concurrency protections, and confirmation are not implemented; the UI explicitly does not claim an appointment was made. For a real booking flow, revalidate approval, service duration, working hours and conflicts in a transaction. PostgreSQL exclusion constraints (with a range and `btree_gist`) are a recommended additional migration to prevent overlapping active appointments under concurrency.
- Subscription, featured listing, payments, and commissions are intentionally out of scope.
- API configuration is validated with Zod, response errors use a stable structure, and Helmet/CORS/request body limits are configured. Authentication and account-recovery endpoints are rate limited (in-process fixed window: login per IP and per IP+email, registration per IP, password reset per IP, password change per account) and return `429 RATE_LIMITED` with `Retry-After`; `npm audit` is part of CI. The production web build injects a Content-Security-Policy and referrer policy. Outstanding items (shared rate-limit store, e-mail verification and reset delivery, MFA, backups, proxy-level HSTS/frame protections) are listed in [docs/architecture.md](docs/architecture.md#outstanding-security-work-not-implemented) and [docs/deployment-checklist.md](docs/deployment-checklist.md).

See [docs/architecture.md](docs/architecture.md) for design choices and the schema/migration approach.

## Local setup (Windows 11, VS Code, PowerShell)

Prerequisites: 64-bit Windows 11, Git, Node.js 20+ (Node 22 was used for verification), npm, and PostgreSQL running locally. Docker is not required. Install PostgreSQL using the official [PostgreSQL Windows download page](https://www.postgresql.org/download/windows/), which links to the EDB installer. Select PostgreSQL Server and Command Line Tools; pgAdmin is optional. During installation, set a strong password for the `postgres` administrator, keep it private, and leave the default port `5432` unless it is already occupied. The installer registers PostgreSQL as a Windows service.

1. Open the existing repository folder in VS Code (`File → Open Folder…`). Open a PowerShell terminal at the repository root (`Terminal → New Terminal`). Confirm `node --version` (20 or later) and `npm --version`, then install the locked workspace dependencies:
   ```powershell
   npm install
   ```
2. Confirm the database service is running. The service name varies by PostgreSQL major version:
   ```powershell
   Get-Service *postgres*
   ```
   If it is stopped, start the matching service from an elevated PowerShell: `Start-Service postgresql-x64-18` (replace `18` with the installed version). Alternatively use Windows Services or pgAdmin.
3. Open SQL Shell (psql) from the Start menu, or in PowerShell run the installed `psql.exe` by full path, for example:
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432 -d postgres
   ```
   Replace `18` if needed; if `psql` is on PATH, `psql -U postgres -h localhost -p 5432 -d postgres` works. Enter the administrator password when prompted. In the psql prompt create a dedicated local role and database (not the `postgres` superuser):
   ```sql
   CREATE ROLE orqeli LOGIN;
   CREATE DATABASE orqeli OWNER orqeli;
   \password orqeli
   ```
   `\password` prompts for the new role password without putting it in the PowerShell command history. Exit with `\q`.
4. Copy the example config to the ignored local environment file and edit it in VS Code:
   ```powershell
   Copy-Item .env.example .env
   code .env
   ```
   Set `DATABASE_URL` to `postgresql://orqeli:URL_ENCODED_PASSWORD@localhost:5432/orqeli?schema=public`. If the password has URL-reserved characters, percent-encode them. Set `SESSION_SECRET` to a private random value of at least 32 characters. For example, generate 32 cryptographically random bytes in PowerShell and Base64-encode them:
   ```powershell
   $bytes = New-Object byte[] 32
   $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($bytes)
   $rng.Dispose()
   [Convert]::ToBase64String($bytes)
   ```
   Paste the output as the quoted `SESSION_SECRET` value in `.env`. Keep `.env` local; `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`. Never paste real credentials into source files or commit them.

   Keep the API and the Vite dev proxy on the same port. `PORT` in the root `.env` is read by both: the API listens on it, and the Vite `/api` proxy targets `http://127.0.0.1:$PORT` (`VITE_API_PROXY_TARGET` overrides the proxy target for a non-default host). Do not hardcode a port in `apps/web/vite.config.ts`. The API loads `apps/api/.env` first and then the repository-root `.env`, so `npm run dev` (which runs each workspace script with the workspace as its working directory) picks up the same configuration as a terminal started at the repository root.
5. With the terminal still at the repository root, validate and generate the Prisma client, then apply the committed migrations:
   ```powershell
   npm run db:validate
   npm run db:generate
   npm run db:deploy
   ```
   Expected: validation says the schema is valid; generation reports a Prisma Client generated using the installed Prisma version; `migrate deploy` applies the committed migrations under `apps/api/prisma/migrations/` (`init` and `auth_and_sessions`) and updates `_prisma_migrations`. Use `npm run db:migrate -- --name <name>` only when you intentionally change `apps/api/prisma/schema.prisma` and need a new migration generated; it applies migrations too. Inspect `apps/api/prisma/migrations/` before committing; do not hand-write migration SQL to bypass Prisma.
6. Confirm migration state and inspect tables:
   ```powershell
   npm run db:status
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U orqeli -h localhost -p 5432 -d orqeli -c "\dt"
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U orqeli -h localhost -p 5432 -d orqeli -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;"
   ```
   Use the installed version path if not 18. Expected: Prisma reports the database schema is up to date; `\dt` lists application tables and `_prisma_migrations`; the query lists the successful migration with a non-null `finished_at`.
7. Start the app and run the foundation checks:
   ```powershell
   npm run dev
   npm run test
   npm run typecheck
   npm run build
   ```
   Web: http://localhost:5173 · API liveness: `http://localhost:$PORT/api/health` (`PORT` from `.env`, default `4000`).

   The web app talks to the API through the Vite `/api` proxy. Checking `http://localhost:4000/api/health` directly only proves the API process is alive; `http://localhost:5173/api/health` proves the browser path works too. If only the direct URL works, `PORT` and the proxy target disagree. The UI now reports this explicitly (for example `The ORQELI API returned an unexpected response (HTTP 500)`).

   `npm test` runs both suites (API and web) and needs no database. To exercise the real PostgreSQL code paths (registration, login, logout, roles, CSRF, and the `session` table written by `connect-pg-simple`), run the migration-backed flow check after `npm run db:deploy`; it creates and then deletes its own test rows:
   ```powershell
   npm run db:verify-flow -w @orqeli/api
   ```
   Password reset, password change, session invalidation and the reset-token concurrency guarantees are covered the same way by a script that runs the real `PrismaDataRepository` against PostgreSQL (including parallel issuance and parallel consumption):
   ```powershell
   npm run db:test-client -w @orqeli/api      # generates a disposable driver-adapter client
   npm run db:verify-security -w @orqeli/api
   ```
   `.github/workflows/ci.yml` runs the same steps — install, `db:validate`, `db:generate`, typecheck, `db:deploy`, `prisma migrate diff` drift check, tests, the flow check, the account-security check and the production build — against an ephemeral PostgreSQL 16 service on every push and pull request, so these checks do not depend on a local database.

### Prisma download/TLS troubleshooting

A previous schema-engine attempt failed exactly with: `request to https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/debian-openssl-3.0.x/schema-engine.gz.sha256 failed, reason: Client network socket disconnected before secure TLS connection was established`. This is an engine-download/network problem, **not evidence of a schema error**. First check system date/time, internet connectivity, VPN/proxy/firewall settings, and whether HTTPS to `binaries.prisma.sh` is permitted. Retry `npm run db:validate`; Prisma's `prisma version` or `prisma debug` can help report the platform/engine resolution. On a managed network, ask IT to allow the Prisma engine host or configure the organization's trusted HTTPS proxy correctly. Do not disable TLS verification, use insecure HTTP, download a random engine binary, or fabricate migration SQL. Once access is restored, rerun the commands in step 5 and retain the actual command output.

### "The request could not be completed." / HTTP 500 when registering

That message is the UI fallback for a non-JSON response. In development the usual cause is that the browser request went through the Vite proxy but the API was not reachable on the proxied port, so Vite answered `500 text/plain` (Vite logs `http proxy error ... ECONNREFUSED`). Check in this order: `npm run db:generate` has been run (the API exits on start if the Prisma client is not generated); the API terminal shows `ORQELI API listening on <port>`; that port equals `PORT` in the root `.env`; and `http://localhost:5173/api/health` returns `"status":"ok"`. The proxy now derives its target from `PORT`, so a stale hardcoded port cannot desynchronise it.

`/api/health` is a process/liveness check and intentionally does not verify PostgreSQL; `/api/health/ready` performs the database check. The API creates the Prisma client lazily and does not connect on startup; missing required environment values fail fast. Database-backed routes currently surface connection failures as a generic `500 INTERNAL_ERROR` (the details are logged server-side, not returned).

## API Endpoints

### Health
- `GET /api/health` — Process liveness check: `{ "status": "ok", "passwordReset": "enabled" | "disabled" }`. Never touches the database.
- `GET /api/health/ready` — Readiness check: `{ "status": "ready", "checks": { "database": "ok", "passwordReset": ... } }`, or `503` with `database: "unavailable"` when the repository cannot be reached.

### Authentication & Session Management
- `GET /api/auth/csrf` — Returns a signed CSRF token (`{ "csrfToken": "..." }`). Every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) must send it back in the `X-CSRF-Token` header; a missing token is rejected with `403 CSRF_MISSING` and an invalid/expired one with `403 CSRF_INVALID`. The token is bound to the current session once authenticated, so `curl`/script clients must fetch a token with the same cookie they use for the mutation.
- `POST /api/auth/register` — Registers a `CUSTOMER` or `BUSINESS_OWNER` (with initial `PENDING` business profile). Prohibits `ADMIN` registration (`403 FORBIDDEN`), normalizes emails, hashes passwords with Argon2id, regenerates the session ID, and returns `201` with `{ user, csrfToken }`. Rate limited per client IP (`429 RATE_LIMITED`).
- `POST /api/auth/login` — Authenticates email and password using Argon2, rejects `DISABLED` or `SUSPENDED` accounts (`403`), regenerates the session ID to prevent session fixation, and returns `200` with `{ user, csrfToken }`. Repeated attempts are rate limited per client IP and per IP+email (`429 RATE_LIMITED` with `Retry-After`).
- `POST /api/auth/logout` — Destroys the server-side PostgreSQL session, clears the session cookie, and returns `200` with `{ "status": "ok" }`.
- `GET /api/auth/me` — Returns `200` with the authenticated user's safe profile (`{ user, csrfToken }`) or `401 UNAUTHENTICATED`.
- `POST /api/auth/password-reset/request` — `{ email }`. Returns `200 { "status": "ok" }` for every address (existing, unknown or ineligible) when recovery is available. For an eligible account it creates a single-use token (only its SHA-256 hash is stored, 30-minute expiry) and hands it to the configured delivery implementation. **No delivery provider exists in this repository**, so recovery ships disabled (`PASSWORD_RESET_MODE=disabled`) and both reset endpoints answer `503 PASSWORD_RESET_UNAVAILABLE` rather than pretending a token was sent. Enabling the mode without a delivery implementation aborts startup in production. Rate limited per IP.
- `POST /api/auth/password-reset/confirm` — `{ token, password }`. Consumes the token exactly once, re-hashes the password with Argon2id, invalidates every existing session for the account, and returns `200 { "status": "ok" }`. Unknown, expired, superseded and already-used tokens all return the same `400 INVALID_RESET_TOKEN`; `503 PASSWORD_RESET_UNAVAILABLE` while recovery is disabled. Requires a CSRF token; rate limited per IP.
- `POST /api/auth/password/change` — Authenticated. `{ currentPassword, newPassword }`. Verifies the current password, updates the hash, invalidates every other session, rotates the caller's session ID and returns `200 { status, csrfToken }`. Requires a CSRF token; rate limited per account.

### Role-Protected & Owner-Scoped Endpoints
- `GET /api/account` — Authenticated customer/user profile and account bookings (`CUSTOMER`, `BUSINESS_OWNER`, `ADMIN`).
- `GET /api/owner/businesses` — Lists businesses owned by the authenticated `BUSINESS_OWNER` (scoped via `ownerScope`).
- `POST /api/owner/businesses` — Submits a new business onboarding application (`status: PENDING`) for the authenticated `BUSINESS_OWNER`.
- `GET /api/owner/businesses/:businessId` — Retrieves a business owned by the authenticated `BUSINESS_OWNER` (`404` if not owned).
- `PATCH /api/owner/businesses/:businessId` — Updates allowed profile fields on a business owned by the authenticated `BUSINESS_OWNER` (rejects attempts to change `status` or `ownerId`).
- `GET /api/admin/businesses` — Lists business applications for `ADMIN` review (optional `?status=` filter).
- `PATCH /api/admin/businesses/:businessId/status` — Updates a business review status (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`) as `ADMIN` and records an `AuditEvent`.
- `GET /api/admin/users` — Lists safe user profiles for `ADMIN` oversight (never exposes `passwordHash`).
- `PATCH /api/admin/users/:userId/status` — Updates a user account status (`ACTIVE`, `DISABLED`, `SUSPENDED`) as `ADMIN` and records an `AuditEvent`.

## Administrator provisioning

There is no HTTP endpoint that can create or promote an administrator. Provision the first
administrator deliberately from a trusted machine with production database credentials:

```bash
npm run admin:create -- --email <address> --name "<full name>" \
  --expect-target "<host:port/database (schema public)>" --password-stdin
```

The first line printed is `Target database: …` (host/database/schema only, never
credentials). That exact value must be repeated in `--expect-target` for a non-interactive run;
`--yes` removes the prompt but never the target check, so a wrong `DATABASE_URL` cannot be
provisioned silently. Interactive runs ask the operator to type the database name. The password
is read from stdin or a hidden prompt (never an argument), existing accounts are never promoted,
and an `ADMIN_PROVISIONED` audit event is written with `actorId: null` and
`metadata.source = "cli"`. The command is not run by CI (CI only executes `--help` as a smoke
test).

## Environment variables

| Name | Required | Description |
|---|---:|---|
| `DATABASE_URL` | yes | PostgreSQL URL, including database and schema |
| `SESSION_SECRET` | yes | Cryptographically strong secret for signing session cookies and CSRF tokens; 32+ chars |
| `PORT` | no | API listen port; defaults to `4000` |
| `WEB_ORIGIN` | no | Exact browser origin allowed by CORS and the CSRF origin check; defaults to `http://localhost:5173`. In production set it to the public HTTPS origin (for example `https://orqeli.zm`). |
| `SESSION_COOKIE_NAME` | no | Session cookie name; defaults to `orqeli.sid` |
| `SESSION_TTL_HOURS` | no | Session lifetime in hours (`1`–`720`); defaults to `24` |
| `SESSION_COOKIE_SAMESITE` | no | Cookie SameSite policy (`lax`, `strict`, `none`); defaults to `lax`. A cross-site deployment (web and API on different origins) needs `none`, which is only accepted when `NODE_ENV=production` so the `Secure` flag is guaranteed. |
| `TRUST_PROXY` | no | Trust reverse proxy `X-Forwarded-Proto` header (`true`/`false`); defaults to `false` (enabled automatically in `production`) |
| `PASSWORD_RESET_MODE` | no | `enabled` or `disabled`; defaults to `disabled`, which makes `/api/auth/password-reset/*` answer `503 PASSWORD_RESET_UNAVAILABLE`. Set to `enabled` only after injecting a `PasswordResetDelivery`; enabling it without one aborts startup in `production`. |
| `NODE_ENV` | no | `development`, `test`, or `production`; defaults to `development`. `production` sets `Secure` session cookies (the site must be served over HTTPS, terminating TLS at a trusted proxy), refuses `MemoryStore`, rejects the example `SESSION_SECRET` placeholder, and enables `trust proxy`. |

## Public business discovery

The city-aware marketplace now reads approved businesses from the existing database:

- `GET /api/businesses?city=Kitwe` — public, paginated discovery with optional `q`, `hasServices`, and `page` filters.
- `GET /api/businesses/:businessId?city=Kitwe` — approved public profile with stored active services and prices where available.
- Web routes: `/discover?city=Kitwe` and `/businesses/:businessId?city=Kitwe` (also supports Ndola).

Only approved businesses with active owners are returned; private owner/customer records are never part of public responses. **Online booking is not implemented.** No migrations or new application environment variables are needed for this read-only slice.

See [Public discovery](docs/public-discovery.md) for validation rules, data visibility, setup, test commands and remaining booking/database-verification work.
