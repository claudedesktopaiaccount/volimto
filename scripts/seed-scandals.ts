/**
 * Import a curated baseline of Slovak public-affairs scandals.
 *
 * Usage:
 *   npx tsx scripts/seed-scandals.ts --limit=80
 */
import "dotenv/config";
import { getDb } from "../src/lib/db";
import { parseScandalLimit, scrapeAndStoreScandals } from "../src/lib/scraper/scandals";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL. Add Neon Postgres connection string to .env first.");
  }

  const limit = parseScandalLimit(process.argv, 80);
  const result = await scrapeAndStoreScandals(getDb(), limit, {
    geminiApiKey: process.env.GEMINI_API_KEY,
  });

  console.log("[seed:scandals] done", JSON.stringify(result, null, 2));
  if (result.unresolved.length > 0) {
    console.warn("[seed:scandals] unresolved politician links:");
    for (const title of result.unresolved.slice(0, 20)) console.warn(`  - ${title}`);
    if (result.unresolved.length > 20) console.warn(`  ... ${result.unresolved.length - 20} more`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
