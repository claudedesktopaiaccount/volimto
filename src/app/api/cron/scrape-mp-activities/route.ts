import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { scrapeMpActivities } from "@/lib/scraper/nrsr";
import { upsertMpActivities } from "@/lib/db/nrsr";
import { mps } from "@/lib/db/schema";
import { isNotNull, asc } from "drizzle-orm";
import { isCronAuthed } from "@/lib/cron-auth";

const CHUNK_SIZE = 20; // ~20 MPs per cron beh; 8 chunks pokryje 150 MP

export async function GET(req: NextRequest) {
  if (!(await isCronAuthed(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const chunkIndex = Math.max(0, Number(url.searchParams.get("chunk") ?? "0") | 0);
  const chunkSize = Math.max(
    1,
    Math.min(50, Number(url.searchParams.get("size") ?? CHUNK_SIZE) | 0)
  );

  try {
    const db = getDb();

    const allMps = await db
      .select({ id: mps.id, nrsrPersonId: mps.nrsrPersonId })
      .from(mps)
      .where(isNotNull(mps.nrsrPersonId))
      .orderBy(asc(mps.id));

    const start = chunkIndex * chunkSize;
    const slice = allMps.slice(start, start + chunkSize);

    const results: {
      mpId: number;
      nrsrPersonId: string | null;
      counts?: Awaited<ReturnType<typeof upsertMpActivities>>;
      error?: string;
    }[] = [];

    for (const mp of slice) {
      if (!mp.nrsrPersonId) continue;
      try {
        const activities = await scrapeMpActivities(mp.nrsrPersonId);
        const counts = await upsertMpActivities(db, mp.id, activities);
        results.push({ mpId: mp.id, nrsrPersonId: mp.nrsrPersonId, counts });
      } catch (e) {
        results.push({
          mpId: mp.id,
          nrsrPersonId: mp.nrsrPersonId,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      chunkIndex,
      chunkSize,
      processed: slice.length,
      totalMps: allMps.length,
      hasNext: start + chunkSize < allMps.length,
      results,
    });
  } catch (error) {
    console.error("[cron] scrape-mp-activities error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
