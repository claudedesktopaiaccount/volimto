# VolimTo

Nezávislý agregátor volebných prieskumov a predikcií slovenských parlamentných volieb.

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

E2E testy vyzadujú samostatnú testovaciu Postgres databázu cez `E2E_DATABASE_URL`.
Nepoužívaj rovnakú hodnotu ako `DATABASE_URL`, pretože E2E seed upravuje testovacie dáta.

## Potrebne Vercel premenne

Nastav pred deploymentom:

- `DATABASE_URL` z Neon integracie vo Vercel Marketplace
- `CRON_SECRET`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_ALLOWED_EMAILS`

Admin pristup pouziva iba Google OAuth. Prihlasit sa mozu len e-maily v `GOOGLE_ALLOWED_EMAILS`; povoleny ucet sa vytvori ako `users.role = 'admin'`.

Lokalny vyvoj: skopiruj `.env.example` do `.env.local` a dopln hodnoty.
## Licencia

Súkromný projekt. Všetky práva vyhradené.
