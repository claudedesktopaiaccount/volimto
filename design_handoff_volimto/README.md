# Handoff: VolimTo — Slovenské voľby 2026

## Overview
VolimTo is a Slovak political data platform for the 2026 elections. It aggregates public opinion polls, runs Monte Carlo election predictions, and provides interactive tools: a coalition simulator, a voter calculator quiz, party programme explorer, and a community tipping feature.

This handoff covers a full redesign/improvement of the existing Claude Code–built app.

## About the Design Files
The files in this bundle (`VolimTo.html` and `js/`) are **HTML design prototypes** — they show intended look, layout, interactions and behaviour. They are **not** production code to copy directly. Your task is to **recreate these designs in your existing codebase** (Next.js, SvelteKit, etc.) using its established patterns, routing, state management, and component libraries.

The prototype uses React + Babel in-browser for interactivity. Map these components to your framework's equivalents.

## Fidelity
**High-fidelity.** These are pixel-accurate mocks with final colours, typography, spacing, and interactions. Recreate them as closely as possible using your codebase's design system. Where exact values are given below, use them.

---

## Design Tokens

### Typography
- **Body font:** `DM Sans` (Google Fonts) — weights 400, 500, 600, 700, 800
- **Logo/wordmark:** `DM Serif Display` (Google Fonts) — weight 400
- **Base size:** 16px
- **Antialiasing:** `-webkit-font-smoothing: antialiased`

### Colours
| Token | Value | Usage |
|---|---|---|
| `bg-page` | `#f8f5f0` | Page background |
| `bg-card` | `#ffffff` | Cards, nav |
| `bg-subtle` | `#f0ede6` | Hero, section bg, input fills |
| `bg-muted` | `#f8f5f0` | Card previews, table zebra |
| `border` | `#e8e3db` | All borders |
| `border-strong` | `#d0cbc3` | Inputs, secondary buttons |
| `text-primary` | `#1a1a1a` | Headings, body |
| `text-secondary` | `#444444` | Secondary text |
| `text-muted` | `#888888` | Labels, captions |
| `text-faint` | `#aaaaaa` | Placeholder, disabled |
| `text-xfaint` | `#bbbbbb` | Eyebrow labels |
| `accent-blue` | `#1a6eb5` | Links, PS party colour |
| `success` | `#16a34a` | Majority indicator, success states |
| `success-bg` | `#dcfce7` | Success badge bg |
| `danger` | `#dc2626` | Below-threshold indicator |
| `danger-bg` | `#fee2e2` | Danger badge bg |
| `btn-primary-bg` | `#1a1a1a` | Primary button |
| `btn-primary-text` | `#ffffff` | |
| `footer-bg` | `#1a1a1a` | Footer |

### Party Colours
| Party | Hex |
|---|---|
| PS | `#1a6eb5` |
| SMER | `#c0392b` |
| REP | `#2c3e50` |
| SLOV | `#16a085` |
| HLAS | `#e74c3c` |
| SaS | `#27ae60` |
| KDH | `#1a3a6b` |
| DEM | `#d63384` |
| AL | `#e67e22` |
| SNS | `#95a5a6` |

### Spacing & Shape
- **Max content width:** 1100px, centred, `padding: 0 24px`
- **Nav height:** 52px
- **Card border-radius:** 10–12px
- **Button border-radius:** 6–8px
- **Pill/tag border-radius:** 20px
- **Page padding:** `32px 24px 60px`

### Shadows
- **Card hover:** `0 8px 32px rgba(0,0,0,0.08)`
- **Cookie banner:** `0 -4px 20px rgba(0,0,0,0.08)`
- **Dropdown:** `0 4px 16px rgba(0,0,0,0.10)`

---

## Screens / Views

### 1. Global Navigation
**Sticky top nav, 52px height, white bg, bottom border `#e8e3db`.**

- Left: "VolimTo" logo — `DM Serif Display`, 20px, `#1a1a1a`, navigates to Home
- Right links (14px, `#444`): Prehľad · Prieskumy · Predikcia · Tipovanie · Viac ↓ · Prihlásiť sa · 🌙
- **"Viac" dropdown** (opens on click): Koaličný simulátor / Volebný kalkulátor / Povolebné plány
  - Dropdown: white, `border: 1px solid #e8e3db`, `border-radius: 8px`, `box-shadow: 0 4px 16px rgba(0,0,0,0.1)`, `min-width: 200px`, `padding: 4px 0`
  - Each item: `padding: 9px 16px`, 14px, `#333`, hover bg `#f8f5f0`
- Active nav item: `fontWeight: 500`, `#1a1a1a`
- "Prihlásiť sa": outlined button, `border: 1px solid #d0cbc3`, `border-radius: 6px`, `padding: 5px 12px`

### 2. Home (`/`)

**Hero section** — `background: #f0ede6`, `border-bottom: 1px solid #e8e3db`, `padding: 64px 24px 56px`, centred
- Eyebrow: "SLOVENSKÉ VOĽBY 2026" — 11px, `#999`, `letter-spacing: 0.12em`, `font-weight: 600`
- H1: "Kde stojíš v slovenskej politike?" — 42px, `font-weight: 800`, `letter-spacing: -1px`, `line-height: 1.15`, `text-wrap: balance`
- Subtext: 16px, `#666`, `line-height: 1.6`
- CTA button: "Spustiť kalkulačku →" — black fill, `padding: 13px 28px`, 15px, `font-weight: 600`, `border-radius: 8px`

**Poll strip** — white bg, `border-bottom: 1px solid #e8e3db`, `padding: 20px 24px`
- Label: "AKTUÁLNE PRIESKUMY" — 10px, `#bbb`, `letter-spacing: 0.12em`
- Party chips: each shows coloured square (28×28, `border-radius: 5px`) + percentage (15px, `font-weight: 600`) + trend arrow (↑`#16a34a` / ↓`#dc2626` / →`#aaa`) + short name
- "Všetky strany →" text link at end

**Feature cards** — 3-column grid (`repeat(auto-fit, minmax(300px, 1fr))`), `gap: 20px`, `padding: 48px 24px`
- Each card: white, `border: 1px solid #e8e3db`, `border-radius: 12px`, overflow hidden
- Top preview area: `background: #f8f5f0`, `border-bottom: 1px solid #e8e3db`, min-height 90px — contains live mini-visualization (see below)
- Bottom: `padding: 20px 22px 22px` — title (17px, 700), desc (13px, `#666`, `line-height: 1.55`), link (13px, 600, `#1a6eb5`)
- Hover: `box-shadow: 0 8px 32px rgba(0,0,0,0.08)`, `transform: translateY(-2px)`

**Feature card previews:**
- *Predikcia*: horizontal probability bars for PS (91%, `#1a6eb5`), SMER (9%, `#c0392b`), REP (0%, `#2c3e50`). Height 8px, bg `#eee`, `border-radius: 4px`
- *Simulátor*: SVG semicircle parliament arc, 150 dots coloured by party
- *Prieskumy*: SVG line chart, PS (blue) and SMER (red) trend lines

### 3. Prieskumy (`/prieskumy`)

**Layout:** sidebar (160px, sticky) + main (flex 1), `gap: 40px`

**Sidebar:**
- "AGENTÚRY" section: checkboxes for NMS, Focus, AKO, Ipsos
- "ČASOVÉ OBDOBIE" section: button group — 6 mesiacov / 1 rok / Všetko. Active state: `background: #1a1a1a`, `color: #fff`, `border-radius: 6px`
- Export CSV button with download icon

**Main:**
- Tabs: Prieskumy / Model / Dav — underline style, active: `border-bottom: 2px solid #1a1a1a`, `font-weight: 500`
- **Chart card** (`background: #fff`, `border: 1px solid #e8e3db`, `border-radius: 10px`, `padding: 20px 22px`):
  - Title: "Vývoj volebných preferencií" (16px, 600)
  - Chart.js line chart, height 280px — 10 party lines, y-axis 0–28%, grid lines `#f0ede6`
  - PS/SMER lines: `strokeWidth: 2.5`; others: `1.5`
  - Legend: coloured lines + party ID labels, 11px, `#888`
  - Share row: ZDIEĽAŤ label + Facebook/X/LinkedIn/Kopírovať odkaz buttons (`background: #f8f5f0`, `border: 1px solid #e8e3db`)
- **Raw data table card**: agency comparison (NMS/FOCUS/IPSOS/AKO), parties below 5% are `opacity: 0.5`, highest value per row coloured `#c0392b`

### 4. Predikcia (`/predikcia`)

**Layout:** 2-column grid `1fr 1fr`, `gap: 28px`

**Left — Win probabilities:**
- Each party in a card (`border: 1px solid #e8e3db`, `border-radius: 8px`, `padding: 12px 14px`)
- Header: party short name (14px, 600) + probability (18px, 800, `letter-spacing: -0.5px`)
- Progress bar: 20px height, party colour fill, `border-radius: 4px`; seat count label overlaid in white 11px
- Below: "Odhadované mandáty: N · interval X–Y%" in 11px `#aaa`

**Right — Parliament arc:**
- SVG `viewBox="0 0 320 130"`, dots in 5 concentric arcs (15/22/28/35/50 dots per row)
- Dot radius: 4px
- Dashed vertical centre line at x=160
- Legend below: coloured square + "SHORT (N)" for each party with seats

**Detail table** (full width, below grid):
- Columns: STRANA / PRIEMER / INTERVAL / MANDÁTY / V PARLAMENTE / VÝHRA / ÚPRAVA
- "V parlamente" badge: green `#16a34a` / red `#dc2626`, pill style
- ÚPRAVA column: − / value / + stepper buttons, adjusts prediction by ±0.5% with live recalculation

### 5. Koaličný simulátor (`/simulator`)

**Single card** (`background: #fff`, `border: 1px solid #e8e3db`, `border-radius: 12px`)

**Arc area** (`padding: 24px 28px 0`):
- Left column (160px): "ZLOŽENIE PARLAMENTU" label (11px, `#aaa`, uppercase), seat count (40px, 800) / 76 suffix (20px, `#bbb`), majority status ("✓ Väčšina" in `#16a34a` or "N chýba" in `#dc2626`)
- Right: SVG parliament arc — selected party dots use party colour at full opacity, unselected dots `#e8e3db` at 0.4 opacity. Transition `fill .2s, opacity .2s`

**Share row:** `padding: 14px 24px`, same share buttons as Prieskumy

**Preset row:** `padding: 14px 24px`, pill buttons (border `1px solid #d0cbc3`, `border-radius: 20px`) — Najpravdepodobnejšia / Koalícia SMER / Široká opozícia / Zmazať výber

**Party table:** checkbox + party name + % + mandáty
- Row click toggles selection (only for parties with seats)
- Selected row: `background: #f0f7ff`
- Checkbox: 18×18, custom style — border becomes party colour when checked, fill party colour with white checkmark SVG

### 6. Tipovanie (`/tipovanie`)

**Layout:** 2-column grid `1fr 1fr`, `gap: 24px`

**Left card — Vote panel:**
- Title: "Kto vyhrá voľby?" (18px, 700)
- Party list: full-width button rows, `padding: 10px 12px`, `border-radius: 8px`
  - Unselected: white bg, `border: 1px solid #e8e3db`
  - Hovered: `background: #fafaf8`
  - Selected: `background: {partyColor}15`, `border: 2px solid {partyColor}`
  - Each row: coloured square (10px) + party name (14px) + leader name (13px, `#aaa`, right-aligned) + checkmark circle if selected
- After voting: success banner (`background: #f0fdf4`, `border: 1px solid #bbf7d0`, green text) with "Zmeniť tip" link

**Right card — Community results:**
- *Before voting:* empty state with SVG face icon, "Hlас ľudu" (15px, 600, `#888`), instructional text
- *After voting:* bar chart — sorted by votes descending, horizontal bars (height 7px, `border-radius: 4px`), party colour fill; voted party has `opacity: 1` others `0.5`; "VÁŠ TIP" badge in party colour; prediction callout box at bottom

### 7. Volebný kalkulátor (`/kalkulator`)

**Max width 680px, centred.**

**Progress bar:** `height: 3px`, `background: #f0ede6`, filled `#1a1a1a`, animated width transition. Labels: "Otázka N z 20" (left) + "N%" (right), 13px, `#aaa`

**Question card** (`background: #fff`, `border: 1px solid #e8e3db`, `border-radius: 12px`, `padding: 28px 26px`):
- Question text: 20px, 700, `letter-spacing: -0.3px`, `line-height: 1.4`, `text-wrap: balance`
- Answer buttons: `border: 1.5px solid #e8e3db`, `border-radius: 9px`, `padding: 13px 16px`, 14px, 500, full width
  - Selected: `background: #1a1a1a`, `color: #fff`, `border-color: #1a1a1a`, `transform: scale(1.01)`
  - Transition: `all .15s`

**Previous answers** (shown below as they accumulate): small cards showing question + answer, `padding: 8px 12px`, `border: 1px solid #f0ede6`, `border-radius: 8px`, 12px text

**Results screen:**
- Top match panel: `background: #f8f5f0`, large coloured party square (56×56, `border-radius: 12px`), party name (24px, 800), match % 
- All parties: % match bars (height 6px, party colour, `border-radius: 3px`)
- "Začať znova" button + disclaimer

### 8. Povolebné plány (`/plany`)

**Party tabs:** pill buttons with party colour when active (`background: {partyColor}`, `color: #fff`), bordered when inactive

**Search bar:** `border: 1px solid #e8e3db`, `border-radius: 8px`, `padding: 9px 14px`, with search icon

**Plan header:** left accent bar in party colour (4px wide, `border-radius: 2px`), plan title + point count

**Category chips:** quick-jump pills `background: #f8f5f0`

**Expandable categories:** click header to expand/collapse. Chevron rotates 180° when open (`transition: transform .2s`). Items: numbered badge in party colour + item text (13px, `#444`, `line-height: 1.55`)

---

## Global Components

### Cookie Banner
**Critical:** `position: fixed; bottom: 0; left: 0; right: 0` — **never overlaps page content** (this was a bug in the original).
- `background: #fff`, `border-top: 1px solid #e8e3db`, `box-shadow: 0 -4px 20px rgba(0,0,0,0.08)`, `z-index: 500`
- Inner: max-width 1100px, flex row — avatar circle + text + Odmietnuť/Prijať buttons
- Dismissed state stored in `localStorage('volimto_cookie_ok')`

### Footer
- `background: #1a1a1a`, top `margin-top: 80px`
- Newsletter: input + "Odoberať" button, side by side
- Bottom row: © 2026 VolimTo + disclaimer text (left) · Ochrana súkromia / Podmienky / Impressum links (right)
- Input: `background: #2a2a2a`, `border: 1px solid #444`, `border-radius: 6px 0 0 6px`

---

## Interactions & Behaviour

| Feature | Detail |
|---|---|
| Nav "Viac" dropdown | Opens on click, closes on `mouseleave` |
| Party chip hover | `border-color` darkens slightly |
| Feature card hover | `transform: translateY(-2px)` + shadow |
| Answer selection | Instantly advances to next question after 300ms delay |
| Seat calculation | Live recalculation when adjustments change; uses D'Hondt-style proportional rounding |
| Coalition arc | Dot colours animate on party toggle (`transition: fill .2s`) |
| Chart tooltip | `mode: 'index'`, white bg card, all parties shown |
| Scroll on nav | `window.scrollTo({ top: 0, behavior: 'smooth' })` on page change |
| Persistence | `localStorage` for: current page, cookie consent, tipping vote |

---

## State Management

Each page is largely self-contained. Key shared state:
- **Current page/route** — string key, persisted to `localStorage('volimto_page')`
- **Cookie dismissed** — `localStorage('volimto_cookie_ok')`
- **Tip vote** — `localStorage('volimto_tip')` — party ID string

Page-local state:
- Prieskumy: active agencies (array), time period, active tab
- Predikcia: adjustments object `{ [partyId]: number }`
- Simulator: selected parties array
- Tipovanie: voted party ID (also in localStorage)
- Kalkulátor: answers object `{ [questionId]: answerIndex }`, done boolean

---

## Assets & Data

### Party Data
See `VolimTo.html` inline `data.js` block for full dataset including:
- `PARTIES` array: id, name, short, color, leader, pct, seats, winProb, predPct, interval
- `POLL_SERIES`: monthly time series for each party (Jun 2025 – Apr 2026)
- `AGENCY_DATA`: NMS/Focus/Ipsos/AKO latest readings per party
- `QUIZ_QUESTIONS`: 8 questions with 3 answers each + party weight matrices
- `PLANS_DATA`: programme data for PS and SMER
- `COALITION_PRESETS`: 3 preset coalitions

### Icons
All icons are inline SVGs (no icon library needed). Sizes: 12–16px, `stroke="currentColor"`, `strokeWidth="1.5–2"`.

### Charts
Uses **Chart.js 4.4.0** (`https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`). Replace with your preferred charting library (Recharts, Victory, D3) matching the visual spec: line chart, no fill, tension 0.35, custom tooltip.

### Parliament Arc
Custom SVG — 5 concentric semicircular arcs with 15/22/28/35/50 dots. Dots sorted left-to-right by political leaning. Calculated geometrically; no library needed.

---

## Files in This Bundle

| File | Contents |
|---|---|
| `VolimTo.html` | Complete interactive prototype — all pages, interactions, and data inline |
| `README.md` | This document |

Open `VolimTo.html` in a browser to see the full interactive reference. Use browser DevTools to inspect exact computed styles.
