import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { importPollRows } from "@/lib/db/polls";
import { isCronAuthed } from "@/lib/cron-auth";
import { scrapeWikipediaPolls } from "@/lib/scraper/wikipedia";
import { revalidateCacheTag } from "@/lib/cache/tags";

export async function GET(req: NextRequest) {
  if (!(await isCronAuthed(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scrapedPolls = await scrapeWikipediaPolls();
    const summary = await importPollRows(getDb(), scrapedPolls);

    revalidateCacheTag("polls");
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron] scrape-polls error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
