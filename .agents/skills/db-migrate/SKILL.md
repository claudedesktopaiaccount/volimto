---
name: db-migrate
description: Generate and apply Drizzle migrations.
disable-model-invocation: true
---

# Database Migration

Generate and apply Drizzle ORM migrations for Neon Postgres.

## Steps

1. Inspect `src/lib/db/schema.ts`, `drizzle.config.ts`, and `drizzle/` to understand the pending schema change.
2. Run `npm run db:generate` to generate migration SQL from `src/lib/db/schema.ts`.
3. Show the generated migration SQL for review by reading the latest file in `drizzle/`.
4. Ask for confirmation before applying a migration to any shared or production Neon branch.
5. If confirmed, run `npm run db:migrate` against the intended Neon database.
6. Report the migration result and the migration file created.

## Notes

- Schema is defined in `src/lib/db/schema.ts`
- Migrations are stored in `drizzle/`
- Config is in `drizzle.config.ts` and uses Drizzle Kit with `dialect: "postgresql"` and Neon role metadata.
- Requires `DATABASE_URL` for the target Neon branch.
- Use `npm run db:push` only for disposable local/dev database synchronization when the user explicitly asks for it. Do not use `db:push` against shared or production Neon branches.
- On Windows, run npm through the project policy wrapper:
  ```powershell
  powershell -NoProfile -ExecutionPolicy RemoteSigned -Command "npm.ps1 run db:generate"
  ```
