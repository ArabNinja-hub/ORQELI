# ORQELI

ORQELI is a booking marketplace foundation for local barbershops and salons, initially focused on Kitwe and Ndola, Zambia. Phase 1 sets up an independently deployable React frontend and Node API, relational data model, and responsive product shell. It intentionally does **not** implement listings, authentication, bookings, or admin operations yet.

## Repository inspection / current status

The original repository had only this README and no application framework, packages, tests, or existing configuration. There was no working code to replace. This repository now uses an npm workspace monorepo with `apps/web` (React, TypeScript, Vite) and `apps/api` (Express, TypeScript, Prisma, PostgreSQL). They build and deploy independently; Vite proxies `/api` to the API during local development.

## Requirements coverage and boundaries

- Initial relational entities and roles are modeled: users, businesses, services, working hours, bookings, and administrator audit events.
- Business statuses are `PENDING`, `APPROVED`, `REJECTED`, and `SUSPENDED`; new records default to pending. Public discovery/booking access must filter for approved businesses.
- Business records include city and location; city is free text for extensibility and indexed with status. Launch UI city choices are Kitwe and Ndola.
- API authorization helpers define role checks and owner scope patterns, but no authentication/session provider or privileged endpoints are active. Frontend route placeholders are navigation, **not** access controls. Before adding protected operations, implement server-verified sessions, authorization, and owner-scoped queries on every request. Provision/admin role assignment must be a trusted server operation.
- Booking data includes guest contact fields and a unique reference. Booking creation, availability calculation, transaction/concurrency protections, and confirmation are not implemented; the UI explicitly does not claim an appointment was made. For a real booking flow, revalidate approval, service duration, working hours and conflicts in a transaction. PostgreSQL exclusion constraints (with a range and `btree_gist`) are a recommended additional migration to prevent overlapping active appointments under concurrency.
- Subscription, featured listing, payments, and commissions are intentionally out of scope.
- API configuration is validated with Zod, response errors use a stable structure, and Helmet/CORS/request body limits are configured. Add request schemas and rate limiting before public mutation endpoints.

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
5. With the terminal still at the repository root, run the checks and initialize the database from the Prisma schema:
   ```powershell
   npm run db:validate
   npm run db:generate
   npm run db:migrate -- --name init
   ```
   Expected: validation says the schema is valid; generation reports a Prisma Client generated using the installed Prisma version; `migrate dev` creates a timestamped migration under `apps/api/prisma/migrations/`, applies it, and updates `_prisma_migrations`. The last command creates a **generated** development migration and applies it to the local database. Inspect `apps/api/prisma/migrations/` before committing; do not hand-write migration SQL to bypass Prisma. `npm run db:deploy` applies already-generated migrations in a deployment environment; it does not create migrations.
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
   Web: http://localhost:5173 · API liveness: http://localhost:4000/api/health.

### Prisma download/TLS troubleshooting

A previous schema-engine attempt failed exactly with: `request to https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/debian-openssl-3.0.x/schema-engine.gz.sha256 failed, reason: Client network socket disconnected before secure TLS connection was established`. This is an engine-download/network problem, **not evidence of a schema error**. First check system date/time, internet connectivity, VPN/proxy/firewall settings, and whether HTTPS to `binaries.prisma.sh` is permitted. Retry `npm run db:validate`; Prisma's `prisma version` or `prisma debug` can help report the platform/engine resolution. On a managed network, ask IT to allow the Prisma engine host or configure the organization's trusted HTTPS proxy correctly. Do not disable TLS verification, use insecure HTTP, download a random engine binary, or fabricate migration SQL. Once access is restored, rerun the commands in step 5 and retain the actual command output.

`/api/health` is a process/liveness check and intentionally does not verify PostgreSQL. The API creates the Prisma client lazily and does not connect on startup; missing required environment values fail fast. There are not yet database-backed application routes, so DB outage handling for such routes is not implemented.

## Environment variables

| Name | Required | Description |
|---|---:|---|
| `DATABASE_URL` | yes | PostgreSQL URL, including database and schema |
| `SESSION_SECRET` | yes | Placeholder for future server-side session signing; 32+ chars. No session implementation yet |
| `PORT` | no | API listen port; defaults to `4000` |
| `WEB_ORIGIN` | no | CORS frontend origin; defaults to `http://localhost:5173` |
| `NODE_ENV` | no | `development`, `test`, or `production`; defaults to `development` |
