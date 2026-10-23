# ORQELI production deployment checklist

This repository contains no hosting, proxy, DNS, database-hosting, monitoring or
e-mail configuration. Nothing below can be verified from the code, so every item
is an **operator decision that must be recorded and evidenced** before launch.
Values in `<angle brackets>` are placeholders — no real hostnames, credentials,
retention periods or provider names are assumed or invented here.

Do not treat a green CI run as proof that these items are done.

## Deployment notes for this release

- Apply the new migration with `npm run db:deploy` **before** starting the new API
  build. It adds `User.sessionVersion` (NOT NULL DEFAULT 0) and the
  `PasswordResetToken` table.
- Every session issued before this release lacks `sessionVersion` and will be
  rejected on its next request, so all users must sign in again. This is the
  intended fail-closed behaviour; announce it in the release notes.
- Password recovery ships **disabled** (`PASSWORD_RESET_MODE=disabled`): the
  endpoints answer `503 PASSWORD_RESET_UNAVAILABLE`, `/api/health` reports
  `passwordReset: "disabled"` and `/api/health/ready` exposes the same value. That
  is the honest state until §5 is completed — do not present recovery to users.
- Setting `PASSWORD_RESET_MODE=enabled` without injecting a
  `PasswordResetDelivery` implementation makes the API fail at startup in
  production (deliberate fail-fast).
- Administrators must be provisioned with the CLI in §6; there is no HTTP route.

---

## 1. API hosting and proxy topology

**Current code behaviour (verified by tests):**

- `apps/api` is a standalone Node/Express 5 process; `apps/web` is a static
  bundle. They are deployed separately.
- In `NODE_ENV=production` the process sets Express `trust proxy` to **1 hop**
  and marks session cookies `Secure`. It therefore **assumes** it sits behind a
  single trusted TLS-terminating proxy/load balancer.
- `req.ip` (used by every rate limiter) is derived from `X-Forwarded-For` under
  that assumption.
- Non-production environments only trust the proxy when `TRUST_PROXY=true`.

**Decisions required:**

- [ ] Where does the API process run (PaaS, VM, container orchestrator)? Record
      the concrete platform.
- [ ] Is the API reachable directly from the internet, or only through the
      proxy? **Only-through-proxy is required** given `trust proxy: 1`.
- [ ] How many proxy hops sit in front of the API (CDN + LB + ingress counts as
      more than one)? If it is not exactly one, the code's trust setting must be
      changed deliberately (and the change reviewed) — do not guess.
- [ ] Does the proxy **overwrite** (preferred) or append to `X-Forwarded-For`?
      An append-only proxy is acceptable only when `trust proxy` is set to the
      real hop count.
- [ ] Are `/api/health` probes sent straight to the process, bypassing the proxy?
      (Liveness probes from the orchestrator are fine; they must not be exposed
      to the internet.)
- [ ] Is the API pinned to one instance? The built-in rate limiter is
      **in-process** (see §9).

**Verification steps (run against the deployed environment):**

1. From the public internet, send a request with a spoofed header and confirm
   the proxy replaces it:
   `curl -sS -o /dev/null -w '%{http_code}\n' -H 'X-Forwarded-For: 203.0.113.9' https://<api-host>/api/health`
   Then inspect the proxy/platform access log for the recorded client address —
   it must be your real egress IP, not `203.0.113.9`.
2. Confirm the API port is not reachable directly from outside the proxy network
   (connection attempt from an unrelated host must time out or be refused).
3. Trigger the login rate limit from one client (11 failed logins within 15
   minutes) and confirm the 11th returns `429` with `Retry-After`. Confirm a
   different client IP is unaffected.
4. If the platform rewrites `X-Forwarded-Proto`, confirm the session cookie is
   issued with `Secure` and the browser stores it over HTTPS only.

---

## 2. HTTPS, HSTS and security headers

Code already provides: Helmet headers on the API, origin-restricted CORS,
`Cache-Control: no-store` on authenticated API routes, and a build-time
`<meta http-equiv="Content-Security-Policy">` plus referrer policy in the SPA.

A `<meta>` policy cannot express `frame-ancestors` or transport security, and it
does not protect responses the proxy serves itself. The host must add response
headers.

**Decisions / actions:**

- [ ] TLS certificate provisioned and auto-renewing; TLS **1.2 minimum**,
      1.3 preferred; weak ciphers disabled.
- [ ] HTTP → HTTPS redirect (301) for every hostname, including `www` if used.
- [ ] HSTS enabled after HTTPS is confirmed working:
      `Strict-Transport-Security: max-age=<seconds>; includeSubDomains`
      Only add `preload` if every current and future subdomain is HTTPS-only.
- [ ] `frame-ancestors 'none'` (or an explicit allowlist) sent as an **HTTP
      header** on the SPA and API, plus `X-Frame-Options: DENY` for legacy
      clients.
- [ ] `X-Content-Type-Options: nosniff`, `Referrer-Policy` and
      `Permissions-Policy` set at the edge (the API already sends the first two
      via Helmet).
- [ ] CSP delivered as an HTTP header is preferable to the built-in meta tag;
      if replaced, keep `default-src 'self'`, `object-src 'none'`,
      `base-uri 'self'`, `form-action 'self'` and only the Google Fonts hosts
      that the SPA actually loads.
- [ ] Cookies: confirm `Secure`, `HttpOnly`, `SameSite` survive the proxy. If
      the SPA and API are on different sites, `SESSION_COOKIE_SAMESITE=none` is
      required (only accepted with `NODE_ENV=production`) and both origins must
      be HTTPS.
- [ ] `WEB_ORIGIN` is the exact public HTTPS origin of the SPA (no trailing
      slash, no wildcard). CORS and the CSRF origin check both depend on it.

**Verification:** `curl -sSI https://<host>/` and
`curl -sSI https://<api-host>/api/health`; confirm redirect, HSTS, CSP,
`frame-ancestors`, `nosniff`, and that the session `Set-Cookie` carries
`Secure; HttpOnly`.

---

## 3. Database hosting, backups, retention and restore

Required by the code: PostgreSQL with the migrations in
`apps/api/prisma/migrations` applied via `prisma migrate deploy`
(`npm run db:deploy`). Migrations are applied by CI against an ephemeral
database and drift-checked, but this repository has **no** production database
configuration.

**Verification commands:** `npm run db:test-client -w @orqeli/api` generates a
test-only Prisma client (query compiler + `pg` adapter) and
`npm run db:verify-security -w @orqeli/api` exercises the real
`PrismaDataRepository` password-reset, password-change, session-invalidation and
concurrency paths against the database. Run both against a non-production
database before promoting a release.

**Decisions required (record the chosen values, do not invent defaults):**

- [ ] Provider, region, PostgreSQL major version, and network exposure
      (private network / VPC only; TLS required).
- [ ] A dedicated least-privilege application role. The application needs DML on
      application tables; it does not need `SUPERUSER`, `CREATEDB` or schema
      ownership after migrations. Decide who owns migrations.
- [ ] `DATABASE_URL` stored in the platform secret manager, never in Git, CI
      logs or the frontend bundle.
- [ ] Automated backups: frequency, retention window, encryption at rest,
      cross-region/off-account copy. Target RPO: `<value>`.
- [ ] Point-in-time recovery (WAL archiving) if the RPO requires it.
- [ ] Target RTO: `<value>`.
- [ ] **Restore drill**: at least one restore into a non-production database,
      with row-count and `prisma migrate status` checks, and a record of who ran
      it and how long it took. A backup that has never been restored is not a
      recovery plan.
- [ ] Access control: who can read production data, how access is requested and
      revoked, whether audit logging of privileged DB access is enabled.

**Verification after any restore:** `npm run db:status` reports no pending
migrations; `PasswordResetToken`, `session` and `User.sessionVersion` exist; the
application can authenticate a test account.

---

## 4. Monitoring, incident response and secret management

**Code provides:** audit rows (`AuditEvent`) for registration, login success,
login failure/block, business/admin status changes, `PASSWORD_CHANGED`,
`PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED` and `ADMIN_PROVISIONED`.
Failed-login audit rows store an HMAC pseudonym of the e-mail, never the address
or password. Application logs never contain passwords, reset tokens or hashes.

**No monitoring, log shipping, alerting or on-call process exists in this
repository.** Until one is configured, none of the following is operational.

**Decisions required:**

- [ ] Log aggregation destination, retention and access control.
- [ ] Alerting on: sustained `5xx` rate, `RATE_LIMITED`/`429` spikes, repeated
      `USER_LOGIN_FAILED` for one pseudonym, `USER_LOGIN_BLOCKED` bursts,
      `PASSWORD_RESET_REQUESTED` volume, migration failures, DB connection
      saturation, and backup failures.
- [ ] Suggested starting thresholds to tune after launch: page on any `5xx`
      rate above `<x>%` for `<n>` minutes; ticket on more than
      `<10>` failed logins for one pseudonym in 15 minutes; ticket on more than
      `<50>` `429`s per hour from one source; alert if automated backups have not
      succeeded in `<24>` hours. Set explicit numbers with the on-call team.
- [ ] Incident response: who is paged, how accounts are disabled
      (`PATCH /api/admin/users/:userId/status`), how all sessions for a user are
      invalidated (bump `User.sessionVersion`), how `SESSION_SECRET` is rotated
      (rotation invalidates every session — expected), and how a leaked
      `DATABASE_URL` is rotated.
- [ ] Secret management: storage location, rotation schedule, who has read
      access, and confirmation that CI never prints environment values.

---

## 5. E-mail / SMS delivery for recovery and verification

**Not implemented in this repository.** Password-reset tokens are generated,
hashed and stored, but the default delivery is a no-op. The API logs a warning
at startup when `NODE_ENV=production` and no delivery implementation is
configured.

**Decisions required:**

- [ ] E-mail (and/or SMS) provider, sending domain and credentials stored in the
      secret manager.
- [ ] Implement `PasswordResetDelivery` (see
      `apps/api/src/passwordReset.ts`), inject it where `createApp` is called and
      set `PASSWORD_RESET_MODE=enabled`; this requires a small code change,
      reviewed and tested, because no credentials or provider exist in the
      repository. Enable the mode only once delivery works — enabling it without a
      delivery implementation aborts startup in production.
- [ ] Confirm the product does not link to a reset screen while recovery is
      disabled; the API answers `503 PASSWORD_RESET_UNAVAILABLE`.
- [ ] SPF, DKIM and DMARC records for the sending domain.
- [ ] Reset link design: the token belongs in the reset page URL (query string
      or fragment). The page must not load third-party resources with the token
      present, must not log the URL, and must send the token to
      `POST /api/auth/password-reset/confirm` in the JSON body.
- [ ] Token lifetime is currently a 30-minute code constant
      (`PASSWORD_RESET_TOKEN_TTL_MS`). Change it only with a reviewed code change.
- [ ] Template contents: no password, no account enumeration hints, generic
      "if this wasn't you" guidance.
- [ ] E-mail verification for new accounts is **not implemented**; registration
      accepts unverified addresses. Decide whether this blocks launch.

---

## 6. Administrator provisioning runbook

There is no HTTP endpoint that can create administrators. Use the CLI with
production database credentials, from a trusted machine:

```bash
npm run admin:create -- --email <address> --name "<full name>" \
  --expect-target "<host:port/database (schema public)>" --password-stdin
```

- The password is read from stdin or a hidden prompt and is never accepted as an
  argument.
- `--yes` (or typing the e-mail address at the prompt) is required.
- The command refuses to modify or promote an existing account.
- It writes an `ADMIN_PROVISIONED` audit event with `actorId: null` and
  `metadata.source = "cli"` (provisioning happens outside an authenticated
  request).
- Run it once per administrator, capture the output for the change record, and
  store the password in a password manager.

---

## 7. Scaling

The rate limiter (`apps/api/src/rateLimit.ts`) is in-process. Single-instance
deployments are supported as-is. Before running more than one API instance,
either add a shared limiter (Redis or the platform's gateway rate limiting) or
accept that limits are per instance. No shared store or paid service has been
added to the repository.

---

## 8. Launch sign-off

Record each item with evidence (link to config, command output, ticket):

| Area | Evidence required | Owner | Status |
|---|---|---|---|
| API/proxy topology and `X-Forwarded-For` handling | §1 verification output | | ☐ |
| HTTPS + headers | `curl -I` output | | ☐ |
| Database role, backups, restore drill | Drill record + backup policy | | ☐ |
| Monitoring and alerting | Dashboard/alert links | | ☐ |
| Secret storage and rotation | Secret manager reference | | ☐ |
| E-mail delivery for reset | Provider config + test send | | ☐ |
| Administrator provisioned | CLI output + audit row | | ☐ |
| Security review of this checklist | Reviewer sign-off | | ☐ |
