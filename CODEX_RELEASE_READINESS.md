# Codex Release Readiness Audit

Last audit: 2026-06-01
Workspace: `C:\Users\misko\Downloads\volimto`
Target: Vercel + Neon Postgres

This file is the Codex handoff for bringing VolimTo to release-ready state. It records what was verified, what is blocking release, and what must pass before production deployment.

## Progress Log

### 2026-06-01

- Fixed `npm run test:integration` for Vitest 4 by adding `vitest.integration.config.ts` and replacing the removed `--include` CLI usage with `--config`.
- Verified `npm run test:integration`: 1 file, 2 tests passed.
- Fixed `/api/v1/polls` CORS to allow `Authorization` in preflight and error responses.
- Added route-level CORS coverage for `/api/v1/polls`.
- Moved missing API-key handling before `getDb()` so unauthenticated public API requests do not require database access.
- Verified `npm test`: 46 files, 318 tests passed.
- Verified `npm run lint` and `npx tsc --noEmit` after the changes.
- Added deterministic Playwright E2E database wiring: `E2E_DATABASE_URL`, `e2e/global-setup.ts`, `scripts/seed-e2e.ts`, and `npm run dev:e2e`.
- Playwright now seeds parties, one poll, poll results, crowd aggregates, and clears E2E rate limits before tests; it refuses to run if `E2E_DATABASE_URL` is missing or equals `DATABASE_URL`.
- Reduced E2E database pressure by running Playwright with one worker and disabling full parallel mode.
- Stabilized build/runtime DB access for `/kauzy`, `/tipovanie`, `/predikcia`, and `/volebny-kalkulator` with bounded timeout or intentional static-build fallback; marked `/admin/kalkulator` as dynamic.
- Fixed duplicate homepage `<main>` by leaving the root layout as the only primary main landmark.
- Restored accessible `aria-pressed` party toggles in the coalition simulator.
- Rounded `Hemicycle` SVG coordinates to deterministic values.
- Added scroll offset protection for the election calculator to avoid sticky-navbar click interception.
- Verified `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:coverage`, `npm run test:integration`, `npm run build`, `npm audit`, and `npm audit --omit=dev`.
- `npm run test:e2e` now fails fast without `E2E_DATABASE_URL` instead of using the shared database.
- Added route-level Vitest coverage for auth CSRF/validation/session endpoints, GDPR CSRF/no-data behavior, newsletter subscribe validation/rate-limit/error mapping, and tipovanie validation before DB access.
- Verified targeted route tests: 5 files, 22 tests passed.
- Verified `npm test`: 51 files, 340 tests passed.
- Verified `npm run lint` and `npx tsc --noEmit` after the route test additions.

## Current State

Verified commands from the audit run:

| Check | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Pass | ESLint exited cleanly. |
| `npx tsc --noEmit` | Pass | TypeScript exited cleanly. |
| `npm test` | Pass | 51 test files, 340 tests passed. |
| `npm run test:coverage` | Pass, insufficient | 58.11% statements, 62.10% lines. Coverage excludes important runtime areas. |
| `npm run build` | Pass, clean | Exit 0; no Neon errors, no route-generation retries, no 60s static generation timeout observed. |
| `npm run test:integration` | Pass | 1 file, 2 tests passed through `vitest.integration.config.ts`. |
| `npm run test:e2e` | Blocked by config | Fails fast: `E2E_DATABASE_URL is required for npm run test:e2e.` No shared DB was used. |
| `npm audit` | Pass | 0 vulnerabilities. |
| `npm audit --omit=dev` | Pass | 0 production vulnerabilities. |

The repository is not release-ready. Build and integration wiring are now clean, but E2E still needs an isolated Neon branch/test database configured through `E2E_DATABASE_URL`, and route/API coverage plus migration readiness remain incomplete.

## Release Blockers

### P0 - Must Fix Before Release

1. E2E must run against deterministic test data, not the shared production/dev Neon database.
   - Observed failures in `/kauzy`, GDPR delete, newsletter, tipovanie, and crowd data because multiple tests opened many DB-backed pages in parallel.
   - Current implementation requires `E2E_DATABASE_URL`, seeds deterministic data, refuses `E2E_DATABASE_URL === DATABASE_URL`, and runs with one worker.
   - Remaining required outcome: provision an isolated Neon branch/test database, run `npm run test:e2e`, and confirm it passes repeatedly without exhausting Neon connection permits.

2. E2E failures must be verified against the new isolated E2E database.
   - `e2e/homepage.spec.ts`: `locator("main")` strict-mode violation because layout and page both render `<main>`.
   - `e2e/gdpr-delete.spec.ts`: delete flow timed out waiting for `/api/gdpr/delete`.
   - `e2e/kauzy.spec.ts`: `/kauzy` timed out or aborted when DB access failed.
   - `e2e/koalicny-simulator.spec.ts`: tests expect `[aria-pressed]`, but the current UI produced zero matches in at least two cases.
   - `e2e/newsletter.spec.ts`: success and duplicate tests did not find expected success text because API/DB failed.
   - `e2e/tipovanie.spec.ts`: vote flow failed; duplicate vote test received status 400 instead of 200/409.
   - `e2e/volebny-kalkulator.spec.ts`: long quiz flow timed out around question 18; restart flow had navbar pointer interception.
   - React hydration mismatch logged for `Hemicycle` SVG float attributes.
   - Current implementation addresses the known UI contracts and isolates test state, but the suite has not run because `E2E_DATABASE_URL` is not configured.
   - Required outcome: `npm run test:e2e` passes locally and in CI without retries hiding real failures.

3. Dirty migration state must be reconciled.
   - Many old `drizzle/` migrations and snapshots are deleted.
   - New `drizzle/0000_baseline_postgres.sql` exists.
   - Legacy migrations appear moved to `docs/db/legacy-migrations/`.
   - Required outcome: a reviewer can tell whether the baseline reset is intentional, what DB state it assumes, and exactly how to migrate/verify production.

4. Critical API route tests are incomplete.
   - Existing tests cover useful pure logic, scrapers, some DB builders, and limited route helpers.
   - Current implementation covers `/api/v1/polls` CORS/missing-key behavior, scrape-scandals cron auth happy/unauthorized paths, admin import Claude parsing, auth CSRF/basic validation/session missing-token/logout behavior, GDPR CSRF/no-data behavior, newsletter subscribe validation/rate-limit/safe errors, and tipovanie pre-DB validation.
   - Missing or thin coverage remains for auth database success/failure paths, GDPR data export/delete success paths, tipovanie duplicate/success behavior, newsletter unsubscribe behavior, API keys, Stripe checkout/webhook, admin routes, broader cron auth/idempotency, and public API error paths.
   - Required outcome: route-level tests lock status codes, CSRF behavior, validation, error handling, and no-secret-leak behavior.

### P1 - Should Fix Before Release

1. Add bounded DB fallbacks/timeouts for public pages that can render fallback data.
   - Candidates: `/`, `/kauzy`, `/tipovanie`, `/poslanci`, `/predikcia`, `/prieskumy`, `/koalicny-simulator`.
   - Current implementation covers `/kauzy`, `/tipovanie`, `/predikcia`, and `/volebny-kalkulator`; `/admin/kalkulator` is dynamic.
   - Remaining required outcome: evaluate `/`, `/poslanci`, `/prieskumy`, `/koalicny-simulator`, and any other DB-heavy public page for bounded runtime behavior.

2. Add production environment validation.
   - Required production variables include at least `DATABASE_URL`, `ADMIN_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, Stripe variables, and AI provider keys for enabled features.
   - Required outcome: missing required variables fail clearly in production-only code paths and never leak secrets.

3. Harden admin auth.
   - Add admin login rate limiting.
   - Make malformed `admin_sig` cookies fail closed without throwing.
   - Verify all admin mutations are protected and covered by tests.

4. Harden cron and webhook behavior.
   - Cron routes must be authenticated, idempotent, and safe on partial external failures.
   - Stripe webhook signature verification must be tested with valid, invalid, old, and malformed signatures.

5. Verify React hydration mismatch in `Hemicycle` is gone.
   - Coordinates are now rounded before rendering.
   - Required outcome: confirm through E2E/browser logs once `E2E_DATABASE_URL` is configured.

6. Verify mobile/click behavior in the election calculator.
   - Scroll padding and button scroll margins were added.
   - Required outcome: confirm through E2E/mobile viewport once `E2E_DATABASE_URL` is configured.

## Test Coverage Audit

Current strengths:

- Core election math has tests: D'Hondt, Monte Carlo, prediction scoring, narrative.
- Scraper parsing has broad unit coverage for Wikipedia, NRSR, OpenData, programs, promises, scandals, financial links, and MP activity fixtures.
- Auth primitives have tests: password hashing, session hashing/validation, input validation.
- Initial route-level coverage now exists for auth CSRF/validation/session endpoints, GDPR CSRF/no-data behavior, newsletter subscribe, tipovanie validation, `/api/v1/polls`, and scrape-scandals cron auth.
- Several components have tests: ticker, share buttons, leaderboard preview, MP activity UI.
- `kauzy` mapping and scandal analysis/trusted-source policies have meaningful tests.

Current gaps:

- Coverage config only includes `src/lib/**/*.ts`.
- Coverage explicitly excludes `src/lib/db/**`, even though DB behavior is release-critical.
- `src/app/api/**` route handlers are mostly not counted in coverage.
- Client flows with stateful fetch behavior are under-tested outside E2E.
- E2E relies on real DB behavior instead of deterministic fixtures/mocks.
- Integration tests are excluded from default Vitest, but the dedicated script now works.

Required test changes:

1. Keep the Vitest integration config for `src/**/*.integration.test.ts` passing.
2. Expand coverage include patterns to cover `src/app/api/**/*.ts`, selected `src/app/**` helpers, and DB modules that can be tested with mocks.
3. Add route-level unit/integration tests for:
   - `src/app/api/auth/register/route.ts` (partial: CSRF and validation)
   - `src/app/api/auth/login/route.ts` (partial: CSRF and validation)
   - `src/app/api/auth/logout/route.ts` (partial: missing/session cookie behavior)
   - `src/app/api/auth/me/route.ts` (partial: missing-token behavior)
   - `src/app/api/gdpr/delete/route.ts` (partial: CSRF and no-data behavior)
   - `src/app/api/gdpr/export/route.ts` (partial: CSRF and no-data behavior)
   - `src/app/api/tipovanie/route.ts` (partial: pre-DB validation)
   - `src/app/api/newsletter/subscribe/route.ts` (partial: validation, rate limit, safe errors)
   - `src/app/api/newsletter/unsubscribe/route.ts`
   - `src/app/api/keys/route.ts`
   - `src/app/api/v1/polls/route.ts`
   - Stripe checkout/webhook routes
   - admin routes
   - cron routes
4. Finish E2E fixtures or a test DB strategy:
   - Seed required parties/polls/crowd state.
   - Use unique test identifiers per run.
   - Run stateful suites serially or isolate them. Current config uses one worker.
   - Avoid production/shared DB URLs in browser tests. Current config refuses missing/equal E2E DB URLs.
   - Provision `E2E_DATABASE_URL` and verify the suite.
5. Add CI gating so `lint`, `tsc`, unit tests, coverage, integration tests, build, E2E, and audit all run before release.

Suggested minimum coverage targets after expanding scope:

- Start with practical thresholds that reflect current app size.
- Do not set a high threshold before route coverage exists.
- Suggested first gate: 70% lines for included files, then ratchet upward after API tests land.
- Critical auth/GDPR/payment modules should target near-complete branch coverage.

## Security/API Review

Known positive findings:

- User sessions store SHA-256 token hashes, not plaintext tokens.
- Session cookies are `httpOnly`, `sameSite: "lax"`, and secure in production.
- User password hashing uses PBKDF2 with random salt.
- User-facing mutating routes generally use double-submit CSRF.
- Cron auth supports header and bearer token validation with timing-safe comparison.
- `npm audit` reported no known vulnerabilities.

Required security/API work:

1. Admin auth:
   - Add rate limiting to `/api/admin/auth`.
   - Guard malformed `admin_sig` hex before `sigHex.match(/.{2}/g)!`.
   - Add tests for invalid, missing, malformed, expired, and valid admin cookies.

2. CSRF:
   - Verify every browser-origin mutating endpoint requires CSRF.
   - Add tests for missing cookie, missing header, mismatch, and match.

3. Stripe:
   - Do not use non-null env assertions as the only config guard.
   - Test webhook signature validation.
   - Ensure checkout route returns safe errors and never returns raw provider secrets.

4. API keys:
   - Ensure raw API keys are only returned once at creation.
   - Test rate limiting and revoked key behavior.
   - Keep `/api/v1/polls` CORS coverage for `Authorization`.

5. Error handling:
   - Avoid returning provider raw error bodies to clients unless scrubbed.
   - Keep structured server logs, but do not leak secrets or sensitive user data.

6. Privacy/GDPR:
   - Add scheduled retention cleanup for old `user_predictions`, sessions, rate limits, and expired audit-adjacent transient data.
   - Test export/delete behavior for anonymous visitor, authenticated user, both, and neither.

## DB/Migrations

Current risk:

- The repo has a large migration reset in progress: old migrations deleted, a new baseline added, and legacy SQL moved under docs.
- Build no longer hit Neon connection/control-plane failures in the latest run.
- E2E now refuses to run without `E2E_DATABASE_URL`; it still needs an isolated Neon branch/test database to complete.
- Some routes perform runtime seeding or aggregate recomputation in request handlers.

Required DB work:

1. Document baseline migration policy.
   - State whether `drizzle/0000_baseline_postgres.sql` is for new installs only or production migration reset.
   - State what existing production DB version it assumes.
   - State rollback/recovery plan.

2. Add migration verification.
   - Use an isolated Neon branch or test database.
   - Run `npm run db:migrate`.
   - Run schema smoke queries for all tables referenced by runtime code.
   - Verify indexes/unique constraints used by duplicate vote, API keys, scandal mapping, NRSR imports, and newsletter.

3. Remove release-time ambiguity.
   - Keep old migrations only under docs if intentionally archived.
   - Ensure Drizzle journal matches the baseline strategy.
   - Do not deploy until production migration instructions are reviewed.

4. Reduce connection pressure.
   - Avoid parallel page generation repeatedly opening live Neon HTTP queries. Latest build passed cleanly.
   - Add cache/fallback boundaries for remaining data-heavy pages.
   - Configure E2E to avoid live shared DB use. Current config requires `E2E_DATABASE_URL`.

## UX/Accessibility

Known issues from E2E:

- Homepage nested/duplicate `<main>` issue has a code fix and needs E2E confirmation.
- Election calculator sticky-navbar click interception has a code fix and needs E2E confirmation.
- Coalition simulator pressed-state controls have a code fix and need E2E confirmation.
- Hemicycle SVG numeric mismatch has a code fix and needs E2E/browser-log confirmation.
- Some E2E selectors are brittle and rely on broad text/attribute matching.

Required UX/accessibility work:

1. Keep one primary `<main id="main-content">` landmark from the root layout.
2. Page components should not add a second `<main>` unless the root layout changes.
3. Stabilize interactive controls with accessible names and deterministic states.
4. Add `data-testid` only where semantic locators are insufficient.
5. Verify calculator, coalition simulator, `kauzy`, newsletter, tipovanie, and GDPR flows on desktop and mobile viewports.
6. Ensure no sticky/fixed element blocks primary actions.

## Deployment/Observability

Required release gates:

1. Vercel build must be clean.
   - No route-generation timeouts.
   - No hidden Neon errors.
   - No fallback path triggered by provider outage during build.

2. Cron routes must be operational.
   - `vercel.json` currently schedules newsletter, notifications, MP activity scrape, and scandal scrape.
   - Confirm whether news/NRSR/OpenData/program scraping should also be scheduled or intentionally manual.

3. Observability must cover failures.
   - Sentry DSN configured in production if enabled.
   - Cron failures captured or logged with route, job name, and sanitized error.
   - Payment webhook failures observable.
   - Newsletter send failures counted and visible.

4. Runtime smoke checks after deploy:
   - `/`
   - `/prieskumy`
   - `/predikcia`
   - `/koalicny-simulator`
   - `/volebny-kalkulator`
   - `/tipovanie`
   - `/kauzy`
   - `/poslanci`
   - `/api/v1/polls` with valid and invalid API key
   - newsletter subscribe/unsubscribe
   - GDPR export/delete
   - admin login and one admin write flow

## Final Release Checklist

Release is allowed only when all items below are true:

- [ ] Dirty worktree reviewed; unrelated user changes preserved.
- [ ] Migration reset/baseline reviewed and documented.
- [ ] Production environment variables verified.
- [x] `npm run lint` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `npm test` passes.
- [ ] `npm run test:coverage` passes with expanded scope and accepted thresholds.
- [x] `npm run test:integration` passes with Vitest 4-compatible config.
- [x] `npm run build` passes with no DB errors, route timeouts, or hidden fallback failures.
- [ ] `npm run test:e2e` passes against isolated deterministic test state.
- [x] `npm audit` passes.
- [x] `npm audit --omit=dev` passes.
- [ ] Critical route tests cover auth, GDPR, newsletter, tipovanie, API keys, Stripe, admin, cron, and public API error paths.
- [x] `/api/v1/polls` CORS supports `Authorization`.
- [ ] Admin auth has rate limiting and malformed-cookie tests.
- [ ] Public pages degrade gracefully under DB failure where fallback data exists.
- [ ] Stripe webhook is signature-tested and idempotent.
- [ ] Cron routes are authenticated and idempotent.
- [ ] E2E confirms no duplicate `<main>` issue, no navbar click interception, no hydration mismatch, and no DB exhaustion.
- [ ] Post-deploy smoke checklist completed.

## Recommended Execution Order

1. Stabilize test infrastructure.
   - Fix Vitest integration config/script.
   - Add E2E test DB/fixture strategy.
   - Make Playwright suites deterministic.

2. Fix runtime release blockers.
   - DB fallbacks/timeouts.
   - `/api/v1/polls` CORS.
   - admin auth hardening.
   - hydration and click-interception issues.

3. Expand tests.
   - Route tests first for high-risk API paths.
   - Coverage config next.
   - E2E assertions last, after UI contracts are stable.

4. Reconcile DB/migrations.
   - Confirm baseline strategy.
   - Verify against isolated Neon branch/test DB.
   - Document production migration procedure.

5. Run final gate.
   - Execute every command in the release checklist.
   - Capture exact command output summary in this file or a release note.

## Notes for Future Codex Agents

- Do not modify ignored `HANDOFF.md` unless the user explicitly asks.
- Do not revert existing dirty worktree changes without explicit instruction.
- Use Context7 before changing Next.js, React, Drizzle ORM, TailwindCSS, Recharts, Cheerio, or Vitest behavior.
- Keep user-facing UI copy in Slovak.
- Treat exit code 0 from `next build` as insufficient if logs contain provider errors or route retries.
- Prefer deterministic test fixtures over depending on live third-party or shared Neon state.
