import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { scrapeMps, scrapeIndependentMps, scrapeRecentVotes, scrapeRecentSpeeches } from "@/lib/scraper/nrsr";
import { upsertMps, upsertVotes, upsertSpeeches, MANUAL_PARTY_OVERRIDES } from "@/lib/db/nrsr";
import { mps, parties } from "@/lib/db/schema";
import { and, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { isCronAuthed } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  if (!(await isCronAuthed(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();

    // Build party abbreviation → id map
    const allParties = await db
      .select({ id: parties.id, abbreviation: parties.abbreviation })
      .from(parties);

    const partySlugToId: Record<string, string> = {};
    for (const p of allParties) {
      partySlugToId[p.abbreviation.toLowerCase()] = p.id;
    }

    // MPs
    const mpItems = await scrapeMps();

    const unknownParties = [...new Set(
      mpItems
        .filter(m => m.partyAbbr && !partySlugToId[m.partyAbbr.toLowerCase()])
        .map(m => m.partyAbbr)
    )];
    if (unknownParties.length) {
      console.warn("[cron/scrape-nrsr] unknown party abbreviations:", unknownParties);
    }

    const independentIds = await scrapeIndependentMps();
    const mpCount = await upsertMps(db, mpItems, partySlugToId, independentIds);

    // Apply manual overrides first (e.g. defectors who founded a new party but
    // NRSR still files them under their old ticket / "nezavisli" club).
    let overrideApplied = 0;
    for (const [nrsrId, partyId] of Object.entries(MANUAL_PARTY_OVERRIDES)) {
      const res = await db
        .update(mps)
        .set({ partyId })
        .where(
          and(
            eq(mps.nrsrPersonId, nrsrId),
            or(isNull(mps.partyId), ne(mps.partyId, partyId))
          )
        )
        .returning({ id: mps.id });
      overrideApplied += res.length;
    }

    // Reconcile independents against existing mps table — even when scrapeMps
    // returns 0 (NRSR list page requires POST and often yields nothing),
    // defectors must still be flipped to NULL. Skip overridden IDs.
    let independentReconciled = 0;
    const overrideIds = new Set(Object.keys(MANUAL_PARTY_OVERRIDES));
    const idsToNull = Array.from(independentIds).filter((i) => !overrideIds.has(i));
    if (idsToNull.length > 0) {
      const res = await db
        .update(mps)
        .set({ partyId: null })
        .where(and(inArray(mps.nrsrPersonId, idsToNull), isNotNull(mps.partyId)))
        .returning({ id: mps.id });
      independentReconciled = res.length;
    }

    // Votes (last 100)
    const { votes: voteItems, records: recordItems } = await scrapeRecentVotes(100);
    const { votes: voteCount, records: recordCount } = await upsertVotes(db, voteItems, recordItems);

    // Speeches (last 50)
    const speechItems = await scrapeRecentSpeeches(50);
    const speechCount = await upsertSpeeches(db, speechItems);
    revalidateTag("poslanci", "max");

    return NextResponse.json({
      ok: true,
      mps: { scraped: mpItems.length, upserted: mpCount, independentReconciled, overrideApplied },
      votes: { scraped: voteItems.length, upserted: voteCount },
      voteRecords: { scraped: recordItems.length, upserted: recordCount },
      speeches: { scraped: speechItems.length, upserted: speechCount },
    });
  } catch (error) {
    console.error("[cron] scrape-nrsr error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
