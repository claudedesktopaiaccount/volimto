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

## Current State

Verified commands from the audit run:

| Check | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Pass | ESLint exited cleanly. |
| `npx tsc --noEmit` | Pass | TypeScript exited cleanly. |
| `npm test` | Pass | 46 test files, 316 tests passed. |
| `npm run test:coverage` | Pass, insufficient | 58.29% statements, 62.31% lines. Coverage excludes important runtime areas. |
| `npm run build` | Exit 0, not clean | Build completed, but static generation hit Neon errors and 60s retries. |
| `npm run test:integration` | Fail | Vitest 4 rejects `--include`; integration script is obsolete. |
| `npm run test:e2e` | Fail/hung | At least 12 failures before the run was stopped. |
| `npm audit` | Pass | 0 vulnerabilities. |
| `npm audit --omit=dev` | Pass | 0 production vulnerabilities. |

The repository is not release-ready. The strongest signal is not a compile failure; it is unreliable runtime behavior under build/E2E due to live Neon access, broken integration test wiring, and failing browser flows.

## Release Blockers

### P0 - Must Fix Before Release

1. Build must not depend on fragile live Neon access for public fallback-capable pages.
   - Observed during `npm run build`: `/kauzy` and `/admin/kalkulator` static generation exceeded 60 seconds and retried.
   - Observed Neon errors: `Control plane request failed` and `Failed to acquire permit to connect to the database`.
   - Required outcome: `npm run build` exits 0 with no hidden DB errors, no 60s route retries, and no public route silently falling back because Neon failed during build.

2. E2E must run against deterministic test data, not the shared production/dev Neon database.
   - Observed failures in `/kauzy`, GDPR delete, newsletter, tipovanie, and crowd data because multiple tests opened many DB-backed pages in parallel.
   - Required outcome: Playwright has isolated or seeded state, can run repeatedly, and does not exhaust Neon connection permits.

3. `npm run test:integration` must be repaired for Vitest 4.
   - Current script uses `vitest run --include 'src/**/*.integration.test.ts'`.
   - Vitest 4.1.6 rejects `--include`.
   - Context7/Vitest docs recommend config-level `include` or project-level config for integration tests.
   - Required outcome: integration tests run through a dedicated config or project, for example `vitest.integration.config.ts` with `test.include = ["src/**/*.integration.test.ts"]`.

4. E2E failures must be fixed.
   - `e2e/homepage.spec.ts`: `locator("main")` strict-mode violation because layout and page both render `<main>`.
   - `e2e/gdpr-delete.spec.ts`: delete flow timed out waiting for `/api/gdpr/delete`.
   - `e2e/kauzy.spec.ts`: `/kauzy` timed out or aborted when DB access failed.
   - `e2e/koalicny-simulator.spec.ts`: tests expect `[aria-pressed]`, but the current UI produced zero matches in at least two cases.
   - `e2e/newsletter.spec.ts`: success and duplicate tests did not find expected success text because API/DB failed.
   - `e2e/tipovanie.spec.ts`: vote flow failed; duplicate vote test received status 400 instead of 200/409.
   - `e2e/volebny-kalkulator.spec.ts`: long quiz flow timed out around question 18; restart flow had navbar pointer interception.
   - React hydration mismatch logged for `Hemicycle` SVG float attributes.
   - Required outcome: `npm run test:e2e` passes locally and in CI without retries hiding real failures.

5. Dirty migration state must be reconciled.
   - Many old `drizzle/` migrations and snapshots are deleted.
   - New `drizzle/0000_baseline_postgres.sql` exists.
   - Legacy migrations appear moved to `docs/db/legacy-migrations/`.
   - Required outcome: a reviewer can tell whether the baseline reset is intentional, what DB state it assumes, and exactly how to migrate/verify production.

6. Critical API route tests are incomplete.
   - Existing tests cover useful pure logic, scrapers, some DB builders, and limited route helpers.
   - Missing or thin coverage remains for auth routes, GDPR routes, tipovanie route behavior, newsletter route behavior, API keys, Stripe checkout/webhook, admin routes, cron route auth/idempotency, and public API error paths.
   - Required outcome: route-level tests lock status codes, CSRF behavior, validation, error handling, and no-secret-leak behavior.

7. `/api/v1/polls` CORS is incomplete.
   - Current preflight allows `Content-Type`, but the route accepts API keys through `Authorization`.
   - Required outcome: `OPTIONS` and all JSON responses consistently allow `Authorization`, preserve the public response shape, and expose rate limit headers where appropriate.

### P1 - Should Fix Before Release

1. Add bounded DB fallbacks/timeouts for public pages that can render fallback data.
   - Candidates: `/`, `/kauzy`, `/tipovanie`, `/poslanci`, `/predikcia`, `/prieskumy`, `/koalicny-simulator`.
   - Required outcome: DB outage does not hang build or request handling beyond a small budget.

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

5. Fix React hydration mismatch in `Hemicycle`.
   - Current log shows server/client float string differences on SVG coordinates.
   - Required outcome: deterministic rounded coordinates or client-only rendering where appropriate.

6. Stabilize mobile/click behavior in the election calculator.
   - Current E2E shows sticky navbar intercepting answer button clicks.
   - Required outcome: quiz answer buttons remain clickable at all scroll positions and viewport sizes.

## Test Coverage Audit

Current strengths:

- Core election math has tests: D'Hondt, Monte Carlo, prediction scoring, narrative.
- Scraper parsing has broad unit coverage for Wikipedia, NRSR, OpenData, programs, promises, scandals, financial links, and MP activity fixtures.
- Auth primitives have tests: password hashing, session hashing/validation, input validation.
- Several components have tests: ticker, share buttons, leaderboard preview, MP activity UI.
- `kauzy` mapping and scandal analysis/trusted-source policies have meaningful tests.

Current gaps:

- Coverage config only includes `src/lib/**/*.ts`.
- Coverage explicitly excludes `src/lib/db/**`, even though DB behavior is release-critical.
- `src/app/api/**` route handlers are mostly not counted in coverage.
- Client flows with stateful fetch behavior are under-tested outside E2E.
- E2E relies on real DB behavior instead of deterministic fixtures/mocks.
- Integration tests are excluded from default Vitest and the dedicated script is broken.

Required test changes:

1. Create a Vitest integration config or project for `src/**/*.integration.test.ts`.
2. Expand coverage include patterns to cover `src/app/api/**/*.ts`, selected `src/app/**` helpers, and DB modules that can be tested with mocks.
3. Add route-level unit/integration tests for:
   - `src/app/api/auth/register/route.ts`
   - `src/app/api/auth/login/route.ts`
   - `src/app/api/auth/logout/route.ts`
   - `src/app/api/auth/me/route.ts`
   - `src/app/api/gdpr/delete/route.ts`
   - `src/app/api/gdpr/export/route.ts`
   - `src/app/api/tipovanie/route.ts`
   - `src/app/api/newsletter/subscribe/route.ts`
   - `src/app/api/newsletter/unsubscribe/route.ts`
   - `src/app/api/keys/route.ts`
   - `src/app/api/v1/polls/route.ts`
   - Stripe checkout/webhook routes
   - admin routes
   - cron routes
4. Add E2E fixtures or a test DB strategy:
   - Seed required parties/polls/crowd/newsletter state.
   - Use unique test identifiers per run.
   - Run stateful suites serially or isolate them.
   - Avoid production/shared DB URLs in browser tests.
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
   - Fix `/api/v1/polls` CORS for `Authorization`.

5. Error handling:
   - Avoid returning provider raw error bodies to clients unless scrubbed.
   - Keep structured server logs, but do not leak secrets or sensitive user data.

6. Privacy/GDPR:
   - Add scheduled retention cleanup for old `user_predictions`, sessions, rate limits, and expired audit-adjacent transient data.
   - Test export/delete behavior for anonymous visitor, authenticated user, both, and neither.

## DB/Migrations

Current risk:

- The repo has a large migration reset in progress: old migrations deleted, a new baseline added, and legacy SQL moved under docs.
- Build and E2E use live Neon and hit connection/control-plane failures.
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
   - Avoid parallel page generation repeatedly opening live Neon HTTP queries.
   - Add cache/fallback boundaries for data-heavy pages.
   - Configure E2E to avoid live shared DB use.

## UX/Accessibility

Known issues from E2E:

- Homepage has nested/duplicate `<main>` landmarks, causing strict selector ambiguity.
- Election calculator clicks can be intercepted by sticky navbar.
- Coalition simulator tests no longer find expected pressed-state controls.
- Hemicycle produces React hydration mismatch due to SVG numeric differences.
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
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm test` passes.
- [ ] `npm run test:coverage` passes with expanded scope and accepted thresholds.
- [ ] `npm run test:integration` passes with Vitest 4-compatible config.
- [ ] `npm run build` passes with no DB errors, route timeouts, or hidden fallback failures.
- [ ] `npm run test:e2e` passes against isolated deterministic test state.
- [ ] `npm audit` passes.
- [ ] `npm audit --omit=dev` passes.
- [ ] Critical route tests cover auth, GDPR, newsletter, tipovanie, API keys, Stripe, admin, cron, and public API error paths.
- [ ] `/api/v1/polls` CORS supports `Authorization`.
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
