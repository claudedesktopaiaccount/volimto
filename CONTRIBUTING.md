# Contributing to VolimTo

Thank you for your interest in contributing to VolimTo — a civic tech project tracking Slovak politics ahead of the 2027 elections.

## Development Setup

```bash
git clone https://github.com/<your-handle>/volimto.git
cd volimto
npm install
cp .env.example .env
# Fill in DATABASE_URL and a separate E2E_DATABASE_URL for Playwright tests
npm run db:migrate
npm run dev
```

## Project Conventions

- **UI language is Slovak** — all user-facing text must be in Slovak
- **Server components by default** — only add `"use client"` when you need browser APIs or interactivity
- **Drizzle for all DB access** — no raw SQL, use the query builder in `src/lib/db/`
- **No shadows, no border-radius** — follow the editorial design system (newsprint palette, 0px radius, Newsreader serif headlines)
- **TailwindCSS 4** — use CSS variable tokens (`var(--ink)`, `var(--paper)`, `var(--surface)`, `var(--divider)`) instead of hardcoded colors

## Submitting a PR

1. Fork the repo and create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Run `npm run lint` — must pass cleanly
4. Run `npm test` — all tests must pass
5. Run `npm run build` — build must succeed
6. Open a PR with a clear description of what you changed and why

## Reporting Issues

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser/OS if relevant

## Data Corrections

If you spot incorrect polling data, party positions, or promise statuses — open an issue or PR updating the seed data in `scripts/`. Source citations required.
