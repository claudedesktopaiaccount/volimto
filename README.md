# VolimTo

Nezávislý agregátor volebných prieskumov a predikcií slovenských parlamentných volieb.

**Live:** https://volimto.sk

## Čo VolimTo robí

- Agreguje volebné prieskumy z Wikipedie (automatický scraper)
- Monte Carlo simulácia rozdelenia mandátov (10 000 iterácií)
- D'Hondt alokátor mandátov
- Koaličný simulátor
- Volebný kalkulátor (20 otázok)
- Crowd predictions (tipovanie) s databazovou perzistenciou
- AI naratívny komentár (Claude API)
- Newsletter (Resend)
- GDPR-compliant s consent management

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** TailwindCSS v4 (CSS-based config, nie tailwind.config.ts)
- **Charts:** Recharts 3
- **Database:** Neon Postgres via Drizzle ORM
- **Deployment:** Vercel
- **Email:** Resend
- **Payments:** Stripe
- **Analytics:** Umami Cloud (GDPR consent-gated)

## Lokálny vývoj

```bash
npm install
npm run dev          # Next.js dev server → http://localhost:3000
npm run preview      # Vercel preview
```

## Databáza

```bash
npm run db:generate  # Generuj Drizzle migrácie
npm run db:migrate   # Aplikuj migracie na Neon Postgres
npm run db:push      # Push schémy priamo (dev)
```

## Testy

```bash
npm test             # Vitest unit testy
npm run test:e2e     # Playwright E2E testy
```

## Potrebne Vercel premenne

Nastav pred deploymentom:

- `DATABASE_URL` z Neon integracie vo Vercel Marketplace
- `ADMIN_SECRET`
- `CRON_SECRET`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

Lokalny vyvoj: skopiruj `.env.example` do `.env.local` a dopln hodnoty.
## Licencia

Súkromný projekt. Všetky práva vyhradené.
