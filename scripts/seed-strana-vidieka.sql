-- Seed Strana vidieka party (Huliak's faction).
-- Run via: wrangler d1 execute volimto-db --remote --file=scripts/seed-strana-vidieka.sql
-- Or paste into Cloudflare D1 console.

INSERT OR IGNORE INTO parties (id, name, abbreviation, color, secondary_color, leader, ideology, seats, logo_url, portrait_url)
VALUES (
  'vidieka',
  'Strana vidieka',
  'SV',
  '#22c55e',
  '#16a34a',
  'Rudolf Huliak',
  'národno-konzervatívna, agrárna',
  3,
  NULL,
  '/portraits/minister-rudolf-huliak.png'
);

-- Apply manual overrides immediately so /poslanci picks them up before next cron.
UPDATE mps SET party_id = 'vidieka' WHERE nrsr_person_id IN ('1150', '1152', '1173');

-- Huliak (1148) is a minister with suspended mandate — exclude from /poslanci.
-- If he exists as an MP row, mark him inactive (set active_to to today).
UPDATE mps SET active_to = date('now') WHERE nrsr_person_id = '1148' AND (active_to IS NULL OR active_to = '');
