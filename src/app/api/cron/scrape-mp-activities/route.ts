import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { and, asc, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { upsertMpActivities } from "@/lib/db/nrsr";
import { mpActivityScrapeState, mps } from "@/lib/db/schema";
import { isCronAuthed } from "@/lib/cron-auth";
import {
  MP_ACTIVITY_SUCCESS_COOLDOWN_MS,
  mpActivityFailureBackoffMs,
  nextIsoAfter,
  parseMpActivityLimit,
} from "@/lib/scraper/mp-activity-schedule";
import { isNrsrRateLimitError, scrapeMpActivities } from "@/lib/scraper/nrsr";

function trimError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

async function recordAttempt(db: ReturnType<typeof getDb>, mpId: number, nowIso: string) {
  await db
    .insert(mpActivityScrapeState)
    .values({
      mpId,
      lastAttemptAt: nowIso,
      lastSuccessAt: null,
      nextEligibleAt: nowIso,
      failCount: 0,
      lastError: null,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: mpActivityScrapeState.mpId,
      set: {
        lastAttemptAt: nowIso,
        updatedAt: nowIso,
      },
    });
}

async function recordSuccess(db: ReturnType<typeof getDb>, mpId: number, nowMs: number) {
  const nowIso = new Date(nowMs).toISOString();
  await db
    .insert(mpActivityScrapeState)
    .values({
      mpId,
      lastAttemptAt: nowIso,
      lastSuccessAt: nowIso,
      nextEligibleAt: nextIsoAfter(nowMs, MP_ACTIVITY_SUCCESS_COOLDOWN_MS),
      failCount: 0,
      lastError: null,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: mpActivityScrapeState.mpId,
      set: {
        lastSuccessAt: nowIso,
        nextEligibleAt: nextIsoAfter(nowMs, MP_ACTIVITY_SUCCESS_COOLDOWN_MS),
        failCount: 0,
        lastError: null,
        updatedAt: nowIso,
      },
    });
}

async function recordFailure(
  db: ReturnType<typeof getDb>,
  mpId: number,
  previousFailCount: number,
  error: unknown,
  retryAfterMs?: number
) {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const failCount = previousFailCount + 1;
  const nextEligibleAt = nextIsoAfter(nowMs, mpActivityFailureBackoffMs(previousFailCount, retryAfterMs));
  const lastError = trimError(error);

  await db
    .insert(mpActivityScrapeState)
    .values({
      mpId,
      lastAttemptAt: nowIso,
      lastSuccessAt: null,
      nextEligibleAt,
      failCount,
      lastError,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: mpActivityScrapeState.mpId,
      set: {
        nextEligibleAt,
        failCount,
        lastError,
        updatedAt: nowIso,
      },
    });
}

export async function GET(req: NextRequest) {
  if (!(await isCronAuthed(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = parseMpActivityLimit(req.nextUrl.searchParams.get("limit") ?? req.nextUrl.searchParams.get("size"));
  const nowIso = new Date().toISOString();

  try {
    const db = getDb();

    const selectedMps = await db
      .select({
        id: mps.id,
        nrsrPersonId: mps.nrsrPersonId,
        lastSuccessAt: mpActivityScrapeState.lastSuccessAt,
        nextEligibleAt: mpActivityScrapeState.nextEligibleAt,
        failCount: mpActivityScrapeState.failCount,
      })
      .from(mps)
      .leftJoin(mpActivityScrapeState, eq(mpActivityScrapeState.mpId, mps.id))
      .where(
        and(
          isNotNull(mps.nrsrPersonId),
          or(isNull(mpActivityScrapeState.nextEligibleAt), lte(mpActivityScrapeState.nextEligibleAt, nowIso))
        )
      )
      .orderBy(
        asc(sql`coalesce(${mpActivityScrapeState.lastSuccessAt}, '1970-01-01T00:00:00.000Z')`),
        asc(mps.id)
      )
      .limit(limit);

    const results: {
      mpId: number;
      nrsrPersonId: string | null;
      counts?: Awaited<ReturnType<typeof upsertMpActivities>>;
      error?: string;
      nextEligibleAt?: string;
    }[] = [];

    let rateLimited = false;

    for (const mp of selectedMps) {
      if (!mp.nrsrPersonId) continue;
      await recordAttempt(db, mp.id, new Date().toISOString());

      try {
        const activities = await scrapeMpActivities(mp.nrsrPersonId);
        const counts = await upsertMpActivities(db, mp.id, activities);
        await recordSuccess(db, mp.id, Date.now());
        results.push({ mpId: mp.id, nrsrPersonId: mp.nrsrPersonId, counts });
      } catch (error) {
        const retryAfterMs = isNrsrRateLimitError(error) ? error.retryAfterMs : undefined;
        await recordFailure(db, mp.id, mp.failCount ?? 0, error, retryAfterMs);
        results.push({
          mpId: mp.id,
          nrsrPersonId: mp.nrsrPersonId,
          error: trimError(error),
          nextEligibleAt: nextIsoAfter(Date.now(), mpActivityFailureBackoffMs(mp.failCount ?? 0, retryAfterMs)),
        });

        if (isNrsrRateLimitError(error)) {
          rateLimited = true;
          break;
        }
      }
    }

    if (results.some((r) => r.counts)) {
      revalidateTag("poslanci", "max");
    }

    return NextResponse.json({
      ok: true,
      limit,
      selected: selectedMps.length,
      processed: results.length,
      rateLimited,
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
