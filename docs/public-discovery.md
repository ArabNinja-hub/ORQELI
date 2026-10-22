# Public business discovery vertical slice

## Existing functionality reused

- PostgreSQL/Prisma `Business`, `Service`, `WorkingHour`, `Booking`, `User` and session models and committed migrations.
- Owner registration/onboarding, scoped owner business operations, manual administrator business approval and account suspension.
- Server-side sessions, role checks and CSRF protection on authenticated writes.
- The existing navy/teal design system, official logo, supplied video, accessible navigation and customer entry point.

Before this change, `/discover` was an availability placeholder. There were no public business APIs, public service/profile pages, or booking-write endpoints. This slice adds read-only public discovery, not a replacement owner/admin application.

## API contract

### `GET /api/businesses`

Query parameters (unknown and repeated parameters are rejected):

| Parameter | Rules |
| --- | --- |
| `city` | Required, exactly `Kitwe` or `Ndola`. Database matching is case-insensitive to accommodate existing owner-entered city names. |
| `q` | Optional, trimmed, maximum 100 characters. Literal case-insensitive substring search across business name/description and active service names. SQL LIKE wildcards are escaped. |
| `hasServices` | Optional `true` or `false`, default `false`. `true` requires at least one active service. |
| `page` | Optional integer string from 1 to 9999, default 1. Twelve businesses per page. |

Response: `{ businesses: PublicBusiness[], page: number, hasMore: boolean }`. Results are ordered by name then ID for stable pagination, with one extra row fetched to determine `hasMore`. Offset pagination can shift when listings change between requests; it is not a frozen snapshot.

### `GET /api/businesses/:businessId?city=Kitwe|Ndola`

ID: 1–128 alphanumeric, underscore or hyphen characters. `city` is required; no other query parameters accepted. Response: `{ business: PublicBusiness }`.

Both endpoints return only `APPROVED` businesses whose owners are `ACTIVE`. Pending, rejected, suspended, inactive-owner, wrong-city and nonexistent profiles all produce the same 404 response. An authenticated owner or admin receives no public approval bypass. Approval is based on the existing manual-review status, not an invented certification system.

Public fields are explicitly selected at the database boundary:

- Business: `id`, `name`, `description`, `city`, `location`, business `phone`, business `email`, `services`.
- Active service: `id`, `name`, `description`, `durationMinutes`, `priceMinorUnits`, `currency`.

Owner identity/contact records, user IDs, password hashes, customers, bookings, audit records and inactive services are not returned. Business contact information is intentionally public; it is separate from the owner's private user record. No ratings, reviews, category tags, stock images, availability or generated prices are supplied.

Responses use `Cache-Control: no-store`. A newly rejected/suspended listing is excluded from subsequent requests; this does not provide realtime removal from an already rendered screen. Public GET handlers do not require a session and do not initialize session state. Existing private routes retain their middleware and permissions. Invalid input returns 400; unexpected repository failures return a safe 500, never a fake successful empty result.

## Customer experience

1. Select Kitwe or Ndola in the existing homepage hero and explore businesses.
2. Search and apply the active-service filter. URLs retain applied filters and pagination and support browser back/forward.
3. Open `/businesses/:businessId` with the discovery context in the query string.
4. Read actual stored business details and active services. Stored prices are formatted in their stored currency; null/invalid prices are labelled “Price not listed”, while a genuine zero amount is displayed as zero.
5. Return to the previous discovery filters/page. The public navigation, home logo and How it works links retain the selected city; the shell also retains it during same-session SPA navigation to account/workspace routes.

Missing city on the web defaults to Kitwe. Explicit invalid city/filter values show a recovery screen, not a silently substituted search. Requests have loading, empty, not-found, failure/retry and 15-second timeout handling. Obsolete requests are aborted and their results cannot replace a newer search. The responsive profiles include a clearly labelled booking-coming-soon notice and business contact details; there is no fake booking action.

## Bookings are not implemented

The existing `Booking` model and customer booking-list read method do not constitute a complete booking flow. Missing pieces include:

- Owner service/working-hours management and validation (duration, price/currency, weekday/time formats).
- A capacity/resource policy: the schema has no staff/resource allocation or explicit concurrency capacity.
- Africa/Lusaka-aware slot calculation, lead-time/horizon rules, closures/exceptions and handling for working-hour boundaries.
- A server-authorized booking creation endpoint that revalidates business approval, active service, duration and availability using database records, not client-supplied amounts/times.
- Atomic conflict prevention under concurrent requests (the current time-range index is **not** an exclusion/uniqueness constraint), plus idempotency/retry handling.
- Authorized cancellation/confirmation/completion transitions, booking references/confirmation UI and customer/owner lifecycle views.
- Real PostgreSQL concurrency, authorization and full end-to-end transaction tests.

No booking writes, availability slots or confirmation claims were added in this slice. Services/working hours already stored in the database are not fabricated when absent. Service editing remains a separate owner-workflow slice.

## Setup and migrations

**No new database migrations, schema changes or application environment variables.** Use the existing `DATABASE_URL`, `SESSION_SECRET`, `WEB_ORIGIN`, `PORT` and session/proxy settings from `.env.example`.

In an environment with a configured PostgreSQL database and Prisma engine download access:

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

Public data comes from `PrismaDataRepository` in normal development/production. Do not run a public deployment with `NODE_ENV=test`, which selects the pre-existing in-memory test repository. No seed records or production demo-data paths were added. Test fixtures exist only in API tests and intercepted browser-test responses.

## Verification executed for this slice

- `npm test`: **43 API tests and 12 web tests passed**.
- `npm run typecheck`: both workspaces passed.
- `npm run build`: both workspaces passed.
- Playwright: **12 browser tests passed** (six flows each at desktop 1440px and mobile 390px).
- Desktop/mobile discovery and profile screenshots inspected; responsive checks found no horizontal overflow in the exercised listing/profile flow.
- New API coverage: approval states, inactive owner, city isolation, explicit public fields, active/unpriced/zero-priced services, text/service filtering, empty results, malformed/unknown/duplicate queries, authorization, no public writes, administrator suspension, bounded pagination, safe errors, and Prisma query/projection contract checks.
- Browser coverage: city/search/filter/profile/back flow, empty/invalid recovery, failure/retry, unavailable profile, loading and obsolete-request handling, pagination and no booking action.

The API integration tests execute real Express routes with the existing in-memory repository and simulated session store. Prisma query shape is tested with a spy, not a running PostgreSQL server. Browser tests intercept API responses with explicitly test-only fixtures. **These checks do not establish live PostgreSQL connectivity, migrations or production data correctness.** A local engine-free Prisma client was used for tests/typechecking; the sandbox has no configured database/normal Prisma engine access. No engine workaround is committed.

Before release, exercise both public endpoints against a migrated staging database with actual reviewed records, check query plans at expected volume, and verify approval/suspension visibility plus existing authenticated owner/admin workflows against PostgreSQL. The pre-existing three high npm audit findings in the Prisma/config/deepmerge-ts chain also remain a separate upgrade review.

### Repeat the browser tests

Start the web server in one terminal:

```sh
npm run dev -w @orqeli/web
```

Then in another:

```sh
npx playwright install --with-deps chromium
npm run test:e2e -w @orqeli/web
```

Optional test-only environment variables: `E2E_BASE_URL` (defaults to `http://127.0.0.1:5173`) and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for a locally supplied Chromium binary. Browser screenshots/traces stay in ignored `test-results/`; they are not site assets. The sandbox run used a packaged Chromium with its library directory supplied via `LD_LIBRARY_PATH`.
