/**
 * MP activity scraper.
 *
 * Default run is a small batch so routine jobs do not full-backfill all MPs.
 * Full backfill: npx tsx scripts/backfill-mp-activities.ts --all
 * Batch:        npx tsx scripts/backfill-mp-activities.ts --start=40 --limit=20
 */
import "dotenv/config";
import { asc, isNotNull } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { upsertMpActivities } from "../src/lib/db/nrsr";
import { mps } from "../src/lib/db/schema";
import { scrapeMpActivities } from "../src/lib/scraper/nrsr";

function numberArg(name: string, fallback: number): number {
  const raw = process.argv.slice().reverse().find((arg) => arg.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

async function main() {
  const db = getDb();
  const fullBackfill = process.argv.includes("--all");
  const start = numberArg("start", 0);
  const limit = fullBackfill ? Number.POSITIVE_INFINITY : numberArg("limit", 20);

  const allMps = await db
    .select({ id: mps.id, nrsrPersonId: mps.nrsrPersonId, nameDisplay: mps.nameDisplay })
    .from(mps)
    .where(isNotNull(mps.nrsrPersonId))
    .orderBy(asc(mps.id));

  const selectedMps = allMps.slice(start, Number.isFinite(limit) ? start + limit : undefined);
  const mode = fullBackfill ? "full backfill" : `batch start=${start} limit=${limit}`;
  console.log(`Scraping MP activities: ${mode}, ${selectedMps.length}/${allMps.length} MPs...`);

  const totals = {
    interpellations: 0, questions: 0, legislation: 0,
    amendments: 0, trips: 0, assistants: 0, offices: 0,
    errors: 0,
  };

  for (let i = 0; i < selectedMps.length; i++) {
    const mp = selectedMps[i];
    const absoluteIndex = start + i;
    if (!mp.nrsrPersonId) continue;
    try {
      const activities = await scrapeMpActivities(mp.nrsrPersonId);
      const counts = await upsertMpActivities(db, mp.id, activities);
      totals.interpellations += counts.interpellations;
      totals.questions += counts.questions;
      totals.legislation += counts.legislation;
      totals.amendments += counts.amendments;
      totals.trips += counts.trips;
      totals.assistants += counts.assistants;
      totals.offices += counts.offices;

      console.log(
        `[${absoluteIndex + 1}/${allMps.length}] ${mp.nameDisplay} -> ` +
        `int:${counts.interpellations} q:${counts.questions} ` +
        `leg:${counts.legislation} am:${counts.amendments} ` +
        `trip:${counts.trips} asst:${counts.assistants} off:${counts.offices}`
      );
    } catch (e) {
      totals.errors++;
      console.error(`[${absoluteIndex + 1}/${allMps.length}] ${mp.nameDisplay} ERROR:`, e);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n=== MP activity scrape complete ===");
  console.log(JSON.stringify(totals, null, 2));
}

main().catch((e) => {
  console.error("[mp-activities] fatal:", e);
  process.exit(1);
});
