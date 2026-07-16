import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isCronAuthed } from "@/lib/cron-auth";
import { scrapeAndStoreScandals } from "@/lib/scraper/scandals";
import { boundedInteger } from "@/lib/api/validation";
import { revalidateCacheTag } from "@/lib/cache/tags";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await isCronAuthed(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const result = await scrapeAndStoreScandals(getDb(), limit, {
      geminiApiKey: process.env.GEMINI_API_KEY,
    });
    revalidateCacheTag("kauzy");
    if (
      result.financialLinks.upserted > 0 ||
      result.financialLinks.linkedContracts > 0
    ) {
      revalidateCacheTag("opendata", { expire: 0 });
      revalidateCacheTag("poslanci", { expire: 0 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] scrape-scandals error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function parseLimit(raw: string | null) {
  return boundedInteger(raw, 80, 1, 100);
}
