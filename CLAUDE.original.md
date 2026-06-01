# VolimTo

Slovak political tracker web app — polls, predictions, coalition simulations, crowd predictions (tipovanie), and political news aggregation.

## Session Start

When the user says "continue with HANDOFF.md" or similar, read `HANDOFF.md` at the project root. It contains the current project status, completed work, pending tasks (Phase 1-4), key files, technical notes, and design rules. Pick up from the next incomplete task unless the user specifies otherwise.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: TailwindCSS 4
- **Charts**: Recharts 3
- **Scraping**: Cheerio (news aggregation)
- **Database**: Cloudflare D1 (SQLite) via Drizzle ORM
- **Deployment**: Cloudflare Workers via OpenNextJS adapter
- **Testing**: Vitest 4 + @vitest/coverage-v8
- **Linting**: ESLint 9

## Commands

```bash
npm run dev          # Local Next.js dev server
npm run build        # Next.js production build
npm run build:cf     # Cloudflare Workers build (via OpenNextJS)
npm run deploy       # Build + deploy to Cloudflare Workers
npm run preview      # Local Wrangler preview (Workers runtime)
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply Drizzle migrations
npm run db:push      # Push schema directly to D1
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
wrangler.jsonc              # Cloudflare Workers config (D1 binding: DB)
drizzle.config.ts           # Drizzle Kit config (d1-http driver)
```

## Database

- **Binding**: `DB` (Cloudflare D1)
- **Schema**: `src/lib/db/schema.ts`
- **Tables**: parties, polls, poll_results, predictions, prediction_results, news_items, party_promises, coalition_scenarios, user_predictions, crowd_aggregates, rate_limits
- **Migrations**: `drizzle/` directory

## Environment Variables

See `.env.example`:
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account
- `CLOUDFLARE_DATABASE_ID` — D1 database ID
- `CLOUDFLARE_D1_TOKEN` — API token for D1 access

## Conventions

- UI language is **Slovak** — all user-facing text is in Slovak
- App Router patterns — server components by default, `"use client"` only when needed
- Political data domain — parties, polls, predictions, coalitions
- D1 database accessed via Drizzle ORM with type-safe queries

## Context7 — ALWAYS Use for Documentation

Before writing or modifying code that uses any of these libraries, ALWAYS use context7 MCP (`resolve-library-id` → `get-library-docs`) to fetch current documentation. Do NOT rely on training data for API usage.

**Libraries in this project that require context7 lookup:**
- **Next.js 16** (App Router) — routing, server components, metadata, caching
- **React 19** — hooks, server actions, use() API
- **Drizzle ORM** — queries, schema, migrations, D1 adapter
- **Recharts 3** — chart components, data format, customization
- **Cloudflare Workers / D1** — bindings, runtime APIs, wrangler config
- **TailwindCSS 4** — utility classes, config, new v4 syntax
- **Cheerio** — selectors, parsing, extraction

If you are about to write code involving any of these and you haven't looked up the docs in this session, stop and use context7 first.

## Claude Code Automations

### Hooks (`.claude/settings.json`)
- **PostToolUse**: Auto-lint with ESLint after file edits
- **PreToolUse**: Block direct edits to `.env*` files and `package-lock.json`

### Skills
- `/deploy` — Build and deploy to Cloudflare Workers
- `/db-migrate` — Generate and apply Drizzle database migrations

### Subagents
- `security-reviewer` — Audits credential handling, scraping safety, input sanitization
