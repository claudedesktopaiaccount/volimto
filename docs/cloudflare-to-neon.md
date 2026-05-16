# Cloudflare to Vercel + Neon Cutover

## Target

- Production deploys run on Vercel.
- Postgres runs on Neon, preferably provisioned through Vercel Marketplace.
- The app reads `DATABASE_URL` and uses Drizzle's Neon HTTP driver.
- Vercel cron routes authenticate with `Authorization: Bearer $CRON_SECRET`.

## Data Migration Rehearsal

1. Freeze writes to the Cloudflare D1 production database.
2. Export the D1 database to SQL or CSV snapshots.
3. Create a Neon branch for rehearsal.
4. Apply the Postgres Drizzle schema to the Neon branch.
5. Transform SQLite export syntax to Postgres-compatible inserts:
   - booleans become `true` / `false`;
   - `INSERT OR IGNORE` becomes `INSERT ... ON CONFLICT DO NOTHING`;
   - integer primary keys use Postgres identity/serial defaults;
   - timestamp text values stay ISO strings unless a table is explicitly changed later.
6. Import all preserved tables: parties, polls, poll results, predictions, prediction results, news, promises, coalition scenarios, users, sessions, tipovanie, newsletter, MPs, API keys, and cron-derived tables.
7. Run smoke checks against the Neon branch.
8. Repeat the export/import for production during the final read-only window.

## Vercel Environment

Set these variables in Vercel:

- `DATABASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_SECRET`
- `CRON_SECRET`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `ANTHROPIC_API_KEY`
- `SENTRY_DSN` if Sentry remains enabled
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID` if analytics remain enabled

## Verification Gates

Run after dependencies are cleanly installed:

```bash
npm ci
npm run lint
npm test
npx tsc --noEmit
npm run build
vercel build
```

Then smoke-test `/`, `/tipovanie`, auth, profile, newsletter, admin, API keys, MP pages, Stripe, and all cron routes.
