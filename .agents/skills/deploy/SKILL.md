---
name: deploy
description: Build, verify, preview, and deploy the VolimTo Next.js app to Vercel. Use when the user asks to deploy, publish, preview, release, or verify a Vercel deployment for this project.
---

# Deploy VolimTo to Vercel

Deploy the VolimTo Next.js app with the project scripts. Production deploys run on Vercel, and the database is Neon Postgres via Drizzle.

## Commands

On Windows, run npm through the process-only policy:

```powershell
powershell -NoProfile -ExecutionPolicy RemoteSigned -Command "npm.ps1 run lint"
```

Use the same wrapper for other npm scripts.

Core scripts:

- `npm run preview` - create a Vercel preview deployment (`vercel`)
- `npm run deploy` - deploy production (`vercel --prod`)
- `npm run build` - local Next.js production build
- `npm run lint` - ESLint
- `npm test` - Vitest

## Workflow

1. Confirm the user asked for preview or production. Default to preview if the request is ambiguous.
2. Run `git status -sb` and summarize any dirty state before deploying. Do not revert unrelated changes.
3. Run preflight checks in this order:
   - `npm run lint`
   - `npm test`
   - `npm run build`
4. Stop immediately if any preflight step fails. Report the failing command and the relevant error.
5. For preview, run `npm run preview`.
6. For production, run `npm run deploy`.
7. Capture and report the deployment URL, target environment, and whether the command succeeded.
8. After deployment, smoke-test the deployment URL when available:
   - `/`
   - `/tipovanie`
   - `/predikcia`
   - `/admin`
   - cron routes only with the expected auth path; do not expose secrets in output.

## Vercel Notes

- If Vercel CLI asks for login or project linking, stop and ask the user to authenticate or approve the interactive step.
- `vercel --prod` and `vercel deploy --prod` both create production deployments. Prefer the repo script `npm run deploy`.
- Use `vercel build` or `vercel deploy --prebuilt` only for an explicit prebuilt workflow; do not substitute them for the normal repo scripts.
- Before production deploy, compare Vercel runtime variables with `.env.example` instead of relying on an old hard-coded list.
- Current production-sensitive variables include `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ALLOWED_EMAILS`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `GEMINI_KAUZY_MODEL`.
- Optional integrations include `SENTRY_DSN` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID`; report if they are absent, but do not block deploy unless the user expects those integrations.

## Database Guardrail

If the release includes schema changes, handle Drizzle migrations before production deployment:

1. Generate migrations with `npm run db:generate`.
2. Review generated SQL.
3. Apply with `npm run db:migrate` against the intended Neon branch.
4. Do not use `npm run db:push` against shared or production Neon branches.
