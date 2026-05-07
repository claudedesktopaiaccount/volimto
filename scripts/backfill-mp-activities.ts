/**
 * Jednorazový backfill: pre každého poslanca s nrsrPersonId stiahni 7 typov
 * NRSR aktivít a zapíš do D1.
 *
 * Spustenie: npx tsx scripts/backfill-mp-activities.ts
 */
import { getDb } from "../src/lib/db";
import { scrapeMpActivities } from "../src/lib/scraper/nrsr";
import { upsertMpActivities } from "../src/lib/db/nrsr";
import { mps } from "../src/lib/db/schema";
import { isNotNull, asc } from "drizzle-orm";

async function main() {
  const db = getDb();

  const allMps = await db
    .select({ id: mps.id, nrsrPersonId: mps.nrsrPersonId, nameDisplay: mps.nameDisplay })
    .from(mps)
    .where(isNotNull(mps.nrsrPersonId))
    .orderBy(asc(mps.id));

  console.log(`Backfilling ${allMps.length} MPs...`);

  const totals = {
    interpellations: 0, questions: 0, legislation: 0,
    amendments: 0, trips: 0, assistants: 0, offices: 0,
    errors: 0,
  };

  for (let i = 0; i < allMps.length; i++) {
    const mp = allMps[i];
    if (!mp.nrsrPersonId) continue;
    try {
      const activities = await scrapeMpActivities(mp.nrsrPersonId);
      const counts = await upsertMpActivities(db, mp.id, activities);
      totals.interpellations += counts.interpellations;
      totals.questions      += counts.questions;
      totals.legislation    += counts.legislation;
      totals.amendments     += counts.amendments;
      totals.trips          += counts.trips;
      totals.assistants     += counts.assistants;
      totals.offices        += counts.offices;

      console.log(
        `[${i + 1}/${allMps.length}] ${mp.nameDisplay} → ` +
        `int:${counts.interpellations} q:${counts.questions} ` +
        `leg:${counts.legislation} am:${counts.amendments} ` +
        `trip:${counts.trips} asst:${counts.assistants} off:${counts.offices}`
      );
    } catch (e) {
      totals.errors++;
      console.error(`[${i + 1}/${allMps.length}] ${mp.nameDisplay} ERROR:`, e);
    }
    // 1s delay between MPs
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n=== Backfill complete ===");
  console.log(JSON.stringify(totals, null, 2));
}

main().catch((e) => {
  console.error("[backfill] fatal:", e);
  process.exit(1);
});
