import { NextRequest } from "next/server";
import { scrapeWikipediaPolls } from "@/lib/scraper/wikipedia";
import { getDb } from "@/lib/db";
import { importPollRows } from "@/lib/db/polls";
import { isCronAuthed } from "@/lib/cron-auth";
import { createSentry, captureException } from "@/lib/sentry";

export async function GET(req: NextRequest) {
  if (!(await isCronAuthed(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const polls = await scrapeWikipediaPolls();
    const summary = await importPollRows(getDb(), polls);
    return Response.json({
      success: true,
      ...summary,
      count: summary.scraped,
      latest: polls.slice(0, 5),
      parties: polls.length > 0 ? Object.keys(polls[0].results) : [],
    });
  } catch (error) {
    const sentry = createSentry(new Request("https://volimto.sk/api/scrape"), {
      SENTRY_DSN: process.env.SENTRY_DSN,
    });
    captureException(sentry, error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
