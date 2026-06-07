# VolimTo Claude Rules

Use `AGENTS.md` as the canonical project memory and agent rule file.

Important local overrides:
- UI language is Slovak.
- Stack: Next.js 16 App Router, React 19, TypeScript, TailwindCSS 4, Recharts 3, Cheerio, Neon Postgres, Drizzle ORM, Vercel, Vitest 4, ESLint 9.
- Use Context7 before changing current library/API behavior for Next.js, React, Drizzle, Recharts, TailwindCSS, Cheerio, Fallow, or cloud/service docs.
- Use Fallow for repo-wide TypeScript/JavaScript analysis: unused code, duplication, complexity, dependency usage, boundaries, feature flags, and PR gates.
- Use OpenSpec skills for proposal/spec/design/ADR/tasks workflows.
- If user says "continue with HANDOFF.md", read `HANDOFF.md`; otherwise do not load it.
- On Windows, run npm as:
```powershell
powershell -NoProfile -ExecutionPolicy RemoteSigned -Command "npm.ps1 <args>"
```