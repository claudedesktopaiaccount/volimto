No file path provided — compressing the pasted text directly following the skill rules.

---

# VolimTo

Slovak political tracker — polls, predictions, coalition simulations, crowd predictions (tipovanie), news aggregation.

## Session Start

User says "continue with HANDOFF.md" or similar → read `HANDOFF.md` at project root. Contains status, completed work, pending tasks (Phase 1-4), key files, technical notes, design rules. Pick up next incomplete task unless user specifies otherwise.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: TailwindCSS 4
- **Charts**: Recharts 3
- **Scraping**: Cheerio (news aggregation)
- **Database**: Neon Postgres via Drizzle ORM
- **Deployment**: Vercel
- **Testing**: Vitest 4 + @vitest/coverage-v8
- **Linting**: ESLint 9

## Commands

```bash
npm run dev          # Local Next.js dev server
npm run build        # Next.js production build
npm run deploy       # Deploy to Vercel production
npm run preview      # Vercel preview
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply Drizzle migrations
npm run db:push      # Push schema directly to Neon (dev only)
npm run lint         # ESLint
npm test             # Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run test:coverage # Vitest with coverage
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Homepage — dashboard
│   ├── prieskumy/          # Polls page
│   ├── predikcia/          # Prediction model page
│   ├── tipovanie/          # Crowd predictions (user betting)
│   ├── koalicny-simulator/ # Coalition simulator
│   ├── volebny-kalkulator/ # Election calculator
│   ├── povolebne-plany/    # Post-election plans
│   ├── podmienky/          # Terms of service
│   └── sukromie/           # Privacy policy
├── lib/
│   └── db/schema.ts        # Drizzle ORM schema (all tables)
drizzle/                    # Migration files
public/portraits/           # Party leader WebP portraits
vercel.json                 # Vercel cron configuration
drizzle.config.ts           # Drizzle Kit config (d1-http driver)
```

## Database

- **Connection**: `DATABASE_URL` (Neon Postgres)
- **Schema**: `src/lib/db/schema.ts`
- **Tables**: parties, polls, poll_results, predictions, prediction_results, news_items, party_promises, coalition_scenarios, user_predictions, crowd_aggregates, rate_limits
- **Migrations**: `drizzle/` directory

## Environment Variables

See `.env.example`:
- `DATABASE_URL` � Neon Postgres connection string

## Conventions

- UI language **Slovak** — all user-facing text in Slovak
- App Router patterns — server components default, `"use client"` only when needed
- Political data domain — parties, polls, predictions, coalitions
- Neon Postgres via Drizzle ORM, type-safe queries

## Context7 — ALWAYS Use for Documentation

Before writing/modifying code using any library below, ALWAYS use context7 MCP (`resolve-library-id` → `get-library-docs`). Do NOT rely on training data.

**Libraries requiring context7 lookup:**
- **Next.js 16** (App Router) — routing, server components, metadata, caching
- **React 19** — hooks, server actions, use() API
- **Drizzle ORM** — queries, schema, migrations, Postgres adapter
- **Recharts 3** — chart components, data format, customization
- **TailwindCSS 4** — utility classes, config, new v4 syntax
- **Cheerio** — selectors, parsing, extraction

Haven't looked up docs this session → stop, use context7 first.

## Fallow - Official Docs and Codebase Intelligence

Use Fallow when a task needs repo-wide TypeScript/JavaScript intelligence: unused code, unused exports, unused dependencies, duplicate code, complexity/health hotspots, architecture boundary drift, feature-flag inventory, or PR quality gates.

Before changing Fallow config, MCP setup, CI integration, suppression syntax, or Fallow CLI usage, fetch current Fallow docs first:
- Prefer Context7 library `/fallow-rs/docs` for Fallow documentation.
- If Context7 is unavailable or incomplete, use the official docs index `https://docs.fallow.tools/llms.txt`, then open the specific linked page under `https://docs.fallow.tools/`.
- Do not rely on training data for Fallow command syntax, config keys, MCP tools, or agent workflow details.

Tooling rules:
- Prefer the configured `fallow` MCP server for structured analysis when available.
- CLI fallback is local project Fallow via npm scripts or `npx fallow`.
- Use JSON output for agent workflows: `npm run fallow`, `npm run fallow:dead-code`, `npm run fallow:dupes`, `npm run fallow:health`, or `npm run fallow:audit`.
- After code generation or broad refactors, run `npm run fallow:audit` when the change can affect reachability, duplication, complexity, dependency usage, or boundaries.
- For full cleanup/adoption work, run full-repo analysis first (`npm run fallow`, `npm run fallow:dead-code`, `npm run fallow:dupes`, `npm run fallow:health`), not only `fallow audit`.
- Run dry-run auto-fix first (`npx fallow fix --dry-run --format json`) and only apply (`npx fallow fix --yes --format json`) after reviewing the proposed edits.
- Trace before deleting ambiguous findings: use Fallow trace commands/MCP tools for exports, files, dependencies, or duplicate clone fingerprints.
- Prefer modeling intentional exceptions in Fallow config over repeated inline suppressions; keep any suppression narrow and documented.
## Claude Code Automations

### Hooks (`.claude/settings.json`)
- **PostToolUse**: Auto-lint with ESLint after file edits
- **PreToolUse**: Block direct edits to `.env*` files and `package-lock.json`

### Skills
- `/deploy` � Deploy to Vercel
- `/db-migrate` — Generate and apply Drizzle database migrations
- `/caveman` — ALWAYS invoke at session start to activate caveman compression mode (saves tokens)

### Subagents
- `security-reviewer` — Audits credential handling, scraping safety, input sanitization
