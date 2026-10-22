# ORQELI interface audit and redesign

## Scope

Reviewed the homepage, navigation, authentication forms, owner onboarding/workspace and admin UI; ran the complete repository test/typecheck/build commands. No backend, database schema or authentication contracts changed. This is a visual and customer-navigation improvement, not certification that the marketplace is ready to launch.

## Audit findings and decisions

- The original hero used the company logo as a large static graphic. Use the supplied official identity in the persistent header/footer, cropped only to remove surrounding whitespace. Preserve the original JPEG and supplied MP4 unchanged.
- Forest-green/orange remnants, serif accents, very small text, inconsistent cards and obsolete CSS illustration rules competed with the navy/teal identity. Replace them with shared colour, typography, spacing, radius and shadow foundations. Retain meaningful semantic status colours.
- Generic brand messaging obscured the customer purpose. Use a service-oriented headline, concise location-specific copy, a city selector and one primary customer action. Put the owner invitation in a dedicated section and keep registration accessible in navigation.
- The previous customer CTA ignored the city and navigated to the owner workspace. There is **no public discovery route/API in this checkout**. Add `/discover?city=Kitwe|Ndola` as an honest availability page; do not fabricate businesses or expose owner/admin APIs. Keep `/business` and its existing permissions intact.
- “Book instantly” contradicted the existing release status. Clearly disclose that public listings and online appointments are not yet available.
- Duplicate sign-in links, missing menu state semantics and lack of video controls weakened the UI. Remove the duplicate; add a skip link, named navigation, expanded/control attributes, Escape-to-close, visible keyboard focus and a background playback toggle.

## Design and media

- Restrained navy text, accessible darker teal controls, pale teal surfaces and white space. No fabricated testimonials, statistics or partner marks.
- Left-aligned hero with a purpose-specific contrast overlay, consistent section widths, readable body copy and simple numbered service-journey columns.
- Shared form styling also covers login, registration, onboarding, owner cards and admin controls. Status/error colours remain distinct.
- Responsive navigation at tablet widths; single-column layouts and 16px form inputs on small screens.
- Original video is approximately 356 KB. It uses `preload="metadata"`, muted inline playback and a navy fallback. Reduced-motion preference is observed live and prevents mounting the video; background playback can be stopped. Stopping unmounts the video, so playing again restarts it. Autoplay still downloads video data when playback is allowed; metadata preload is not a promise of zero bandwidth.

## Verification (2026-10-22)

- `npm test`: **34 API tests + 9 web tests passed**. Four new web regression tests cover branding/navigation, city-aware discovery/fallback, motion-safe initial rendering/accessibility landmarks and session guards.
- `npm run typecheck`: passed for API and web.
- `npm run build`: passed for API and web; CSS output approximately 15.34 KB (3.82 KB gzip).
- `git diff --check`: passed.
- Playwright with packaged Chromium: 30 anonymous route/viewport combinations across `/`, `/discover?city=Ndola`, `/login`, `/register?role=BUSINESS_OWNER`, `/business` and `/admin` at 320, 390, 768, 1024 and 1440 pixels. No horizontal overflow or uncaught JavaScript errors.
- Browser interaction checks passed: Ndola selection reaches the matching discovery heading; mobile owner link reaches the actual onboarding form; expected business-name/address fields present; skip link is first keyboard target; Escape closes the menu; reduced motion mounts no video; background stop removes playback.
- Desktop and mobile homepage screenshots were inspected, and the duplicate sign-in link found in that review was fixed. Anonymous browser checks stubbed `/api/auth/me` as unauthenticated; they do not verify live authentication or database persistence.

## Environment limitations and launch follow-up

1. Normal Prisma generation initially failed because this sandbox cannot reach `binaries.prisma.sh`. A local **engine-free generated client** enabled typechecks and repository tests (which use simulated/in-memory database components). No generated client or environment workaround is committed. In an unrestricted deployment environment run normal `npm ci`, `npm run db:generate`, migrations and `npm run db:verify-flow`. Real PostgreSQL integration and authenticated visual states remain to be checked against a configured backend.
2. `npm audit --omit=dev` reports three high findings in the Prisma / `@prisma/config` / `deepmerge-ts` dependency chain (GHSA-ggr8-5vv4-36mx). The suggested fix is a Prisma major upgrade. This needs a separate compatibility/security change; no forced major upgrade was mixed into this visual PR.
3. Public discovery data, business detail/service pages, availability and booking transactions are not implemented in this checkout. The new discovery page is explicitly a pre-launch state, not a working marketplace. Product/API work is required before advertising bookable services.
4. Real-device video playback, full assistive-technology testing, production-host checks and end-to-end authenticated owner/admin workflows are still required before launch.
