# Architecture and decisions

## Deployment boundary

`apps/web` is a static React SPA and can be deployed to a static host. `apps/api` is a separate Node service and requires a reachable PostgreSQL database; GitHub Pages is not an API/database host. The Vite `/api` proxy is development-only. Production deployment must configure the frontend API base URL and API CORS/credentials for the deployed origins.

## Responsibilities

- Web: responsive public entry shell and navigation placeholders only. It has no privileged control surface and does not persist authentication data in local storage.
- API: JSON HTTP boundary, runtime environment validation, security headers, origin-restricted CORS, generic errors, database client, and role/owner authorization primitives.
- PostgreSQL: durable relational records, foreign keys, uniqueness and indexes. Prisma schema is the source of truth; use reviewed, committed Prisma migrations for schema changes (`npm run db:migrate` locally, `prisma migrate deploy` in deployment).

## Data model

`User` has a single role (`CUSTOMER`, `BUSINESS_OWNER`, `ADMIN`); a user can own businesses and/or have customer bookings. `Business` is owned by one user and carries city/location/contact data and review status. `Service` and weekday `WorkingHour` records belong to a business. `Booking` can point to an account or store guest name/phone/optional email, with start/end timestamps stored as PostgreSQL `timestamptz(3)` instants and a unique reference. Normalize incoming and outgoing instants as UTC; interpret `WorkingHour` wall-clock times using the explicitly configured business timezone (initial market: `Africa/Lusaka`), rather than treating them as UTC. `AuditEvent` records actor, action, entity and optional JSON metadata. Prices are optional integer minor units with ZMW currency; no payment behavior is present.

The city is a string rather than a closed enum so additional Zambian cities can be added without schema changes. Business list queries must include `status: APPROVED`; pending/rejected/suspended listings are not public and cannot accept bookings. Approval changes belong only to trusted administrator endpoints and should create audit events. The API currently has no business or booking endpoints.

## Authorization/security plan

`requireRole` and `ownerScope` in `apps/api/src/authz.ts` are reusable foundations, not a complete identity system. Authentication and session persistence are not yet implemented; until they are, privileged routes must not be added. Future sessions should use secure, HttpOnly, SameSite cookies, CSRF protections where applicable, session rotation/revocation, and server-side identity resolution. Do not accept role, owner ID, or approval status as trusted client inputs. Every owner query/mutation must scope through the authenticated owner's ID and return no cross-tenant records. Admin access requires a server-verified ADMIN role. Validate and normalize all untrusted inputs at API boundaries.

## Booking consistency (future phase)

A future booking endpoint must only accept approved businesses and active services, derive duration and end time from the database, verify opening hours and availability, and re-check all conditions during the write transaction. Use an appropriate transaction isolation/locking strategy and preferably a PostgreSQL exclusion constraint on a `tstzrange(starts_at, ends_at, '[)')` per business for active conflicting appointments (requiring `btree_gist`), with booking status updates designed around that constraint. This protection and all booking behavior are not implemented in Phase 1.

## Dependency audit follow-up

The installed Prisma packages resolve to 6.19.3, with `@prisma/config` 6.19.3 depending on `deepmerge-ts` 7.1.5. `npm audit` reports three high-severity nodes in this single dependency chain (`prisma` → `@prisma/config` → `deepmerge-ts`), for GHSA-ggr8-5vv4-36mx (recursive-graph stack exhaustion; affected `<8.0.0`, fixed in `8.0.0`). npm's available fix is Prisma 7.10.1, whose published `@prisma/config` 7.10.1 manifest depends on `deepmerge-ts` 8.0.2; this is a SemVer-major Prisma upgrade. No upgrade or override was applied because Prisma 7 compatibility with the existing schema, generated client and migration setup has not been verified. Recheck with `npm audit` before deployment and test any proposed dependency change end-to-end.

## Assumptions and follow-up

- ZMW is the initial currency; monetary values are represented as integer minor units only if a service price is later supplied.
- A business owner may own multiple businesses.
- Working hours use weekday (0–6) and local wall-clock strings; the Phase 1 schema does not store a business timezone. Before booking implementation, add or define a trusted timezone field/config (initially `Africa/Lusaka`) and handle UTC conversion consistently.
- Guest bookings do not require a user record; collection, retention, and privacy requirements for contact details must be decided before launch.
- Initial migrations should be generated from the Prisma schema, reviewed, and committed. Database tooling could not be exercised in the current environment because PostgreSQL/Docker are not installed.
