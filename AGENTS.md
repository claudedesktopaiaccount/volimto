# VolimTo Agent Rules

Slovak political tracker for polls, predictions, coalition simulation, crowd predictions, MP data, and news aggregation.

## Session
- Canonical workspace: `C:\Users\misko\Downloads\volimto`.
- If user says "continue with HANDOFF.md", read `HANDOFF.md`; otherwise do not load it.
- Do not create git worktrees unless user explicitly asks.
- Keep replies concise; `/caveman` is preferred for token-heavy sessions.

## Stack
- Next.js 16 App Router, React 19, TypeScript
- TailwindCSS 4, Recharts 3, Cheerio
- Neon Postgres via Drizzle ORM
- Vercel deployment
- Vitest 4, ESLint 9

## Commands
```bash
npm run dev
npm run build
npm run deploy
npm run preview
npm run db:generate
npm run db:migrate
npm run db:push
npm run lint
npm test
npm run test:watch
npm run test:coverage
```

On Windows, run npm through process-only policy:
```powershell
powershell -NoProfile -ExecutionPolicy RemoteSigned -Command "npm.ps1 <args>"
```

## Product Conventions
- UI language is Slovak.
- Server components by default; use `"use client"` only when needed.
- Use existing App Router, Drizzle, data, UI, and Tailwind patterns before adding abstractions.
- Database changes go through `src/lib/db/schema.ts` and Drizzle migrations.
- Keep `.env*` and `package-lock.json` protected unless user explicitly asks.

## Context7
Use Context7 before changing code that depends on current library/framework/API behavior for: Next.js, React, Drizzle ORM, Recharts, TailwindCSS, Cheerio, Fallow, or other cloud/library docs.
Flow: `resolve-library-id` with the library + task, then `query-docs` with the selected `/org/project` ID and full question.
Do not use Context7 for pure refactors, business-logic debugging, code review, or writing scripts from scratch.

## Fallow
Use Fallow for repo-wide TypeScript/JavaScript intelligence: unused code/exports/deps, duplication, complexity, health, boundaries, feature flags, and PR quality gates.
Prefer Fallow MCP when available; CLI fallback uses local npm scripts such as `npm run fallow`, `npm run fallow:dead-code`, `npm run fallow:dupes`, `npm run fallow:health`, and `npm run fallow:audit`.
Before changing Fallow config or CLI/MCP workflow, fetch current Fallow docs first, preferably Context7 `/fallow-rs/docs`.

## OpenSpec
Use intent-driven OpenSpec workflows from natural language:
- explore/think/shape -> `openspec-explore`
- start/new/spec/propose -> `openspec-new-change` or `openspec-propose`
- continue/next artifact -> `openspec-continue-change`
- implement/apply/build -> `openspec-apply-change`
- verify/validate/ready -> `openspec-verify-change`
- sync specs -> `openspec-sync-specs`
- archive/finalize/close -> `openspec-archive-change`

For OpenSpec propose/apply/verify/archive, use `openspec-git-discipline`. Artifact rules live in `openspec/config.yaml`.

## Local Helpers
- `/deploy`: deploy to Vercel.
- `/db-migrate`: generate/apply Drizzle migrations.
- `security-reviewer`: credential handling, scraping safety, input sanitization.