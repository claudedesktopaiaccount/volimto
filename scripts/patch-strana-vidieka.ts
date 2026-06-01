/**
 * Idempotent data patch for Strana vidieka and Huliak faction MP overrides.
 *
 * Usage:
 *   npx tsx scripts/patch-strana-vidieka.ts
 */
import "dotenv/config";
import { and, eq, inArray, or, isNull } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { seedParties } from "../src/lib/db/seed";
import { mps, parties } from "../src/lib/db/schema";

const STRANA_VIDIEKA_MP_IDS = ["1150", "1152", "1173"];
const HULIAK_NRSR_PERSON_ID = "1148";
const STRANA_VIDIEKA_PORTRAIT = "/portraits/minister-rudolf-huliak.png";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL. Add Neon Postgres connection string to .env first.");
  }

  const db = getDb();
  await seedParties(db);

  await db
    .update(parties)
    .set({ portraitUrl: STRANA_VIDIEKA_PORTRAIT })
    .where(eq(parties.id, "vidieka"));

  const factionRows = await db
    .update(mps)
    .set({ partyId: "vidieka" })
    .where(inArray(mps.nrsrPersonId, STRANA_VIDIEKA_MP_IDS))
    .returning({ id: mps.id });

  const inactiveRows = await db
    .update(mps)
    .set({ activeTo: todayIsoDate() })
    .where(
      and(
        eq(mps.nrsrPersonId, HULIAK_NRSR_PERSON_ID),
        or(isNull(mps.activeTo), eq(mps.activeTo, ""))
      )
    )
    .returning({ id: mps.id });

  console.log(
    `[patch:strana-vidieka] party upserted, faction MPs updated: ${factionRows.length}, inactive Huliak rows updated: ${inactiveRows.length}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
