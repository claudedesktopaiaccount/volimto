/**
 * Seed parties table from PARTY_LIST. Idempotent (INSERT OR IGNORE).
 * Run: npx tsx scripts/seed-parties.ts
 */
import "dotenv/config";
import { getDb } from "../src/lib/db";
import { seedParties } from "../src/lib/db/seed";

(async () => {
  const db = getDb();
  await seedParties(db);
  console.log("✓ Parties seeded");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
