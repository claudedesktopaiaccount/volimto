---
name: db-migrate
description: Generate and apply Drizzle migrations.
disable-model-invocation: true
---

# Database Migration

Generate and apply Drizzle ORM migrations for the Cloudflare D1 database.

## Steps

1. Run `npm run db:generate` to generate migration SQL from the schema at `src/lib/db/schema.ts`
2. Show the generated migration SQL for review (read the latest file in `drizzle/`)
3. Ask for confirmation before applying
4. If confirmed, run `npm run db:push` to push the schema to D1
5. Report the migration result

## Notes

- Schema is defined in `src/lib/db/schema.ts`
- Migrations are stored in `drizzle/`
- Config is in `drizzle.config.ts` (uses d1-http driver)
- Requires env vars: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN`
