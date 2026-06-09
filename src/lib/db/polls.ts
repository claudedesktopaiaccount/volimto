import { and, desc, eq, inArray } from "drizzle-orm";
import type { RawPollRow } from "@/lib/scraper/wikipedia";
import { WIKIPEDIA_POLLS_URL } from "@/lib/scraper/wikipedia";
import type { Database } from "./index";
import { pollResults, polls } from "./schema";

export interface PollImportSummary {
  scraped: number;
  inserted: number;
  repaired: number;
  skipped: number;
  latest: Pick<RawPollRow, "agency" | "publishedDate"> | null;
}

export async function importPollRows(
  db: Database,
  rows: RawPollRow[]
): Promise<PollImportSummary> {
  let inserted = 0;
  let repaired = 0;
  let skipped = 0;
  const now = new Date().toISOString();
  const seen = new Set<string>();

  for (const row of rows) {
    const resultRows = Object.entries(row.results)
      .filter(([, percentage]) => Number.isFinite(percentage) && percentage > 0)
      .map(([partyId, percentage]) => ({ partyId, percentage }));

    if (!row.agency || !row.publishedDate || resultRows.length === 0) {
      skipped++;
      continue;
    }

    const key = `${row.agency}|${row.publishedDate}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);

    const insertedPoll = await db
      .insert(polls)
      .values({
        agency: row.agency,
        publishedDate: row.publishedDate,
        sampleSize: row.sampleSize,
        sourceUrl: WIKIPEDIA_POLLS_URL,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [polls.agency, polls.publishedDate],
      })
      .returning({ id: polls.id });

    const pollId = insertedPoll[0]?.id ?? (await getExistingPollId(db, row));
    if (!pollId) {
      skipped++;
      continue;
    }

    if (insertedPoll.length > 0) {
      await db.insert(pollResults).values(resultRows.map((item) => ({ pollId, ...item })));
      inserted++;
      continue;
    }

    const existingResult = await db
      .select({ id: pollResults.id })
      .from(pollResults)
      .where(eq(pollResults.pollId, pollId))
      .limit(1);

    if (existingResult.length === 0) {
      await db.insert(pollResults).values(resultRows.map((item) => ({ pollId, ...item })));
      repaired++;
    } else {
      skipped++;
    }
  }

  return {
    scraped: rows.length,
    inserted,
    repaired,
    skipped,
    latest: rows[0] ? { agency: rows[0].agency, publishedDate: rows[0].publishedDate } : null,
  };
}

export async function getPollRows(db: Database, limit?: number): Promise<RawPollRow[]> {
  const query = db
    .select()
    .from(polls)
    .orderBy(desc(polls.publishedDate));

  const pollRows = typeof limit === "number" ? await query.limit(limit) : await query;
  if (pollRows.length === 0) return [];

  const ids = pollRows.map((poll) => poll.id);
  const results = await db
    .select()
    .from(pollResults)
    .where(inArray(pollResults.pollId, ids));

  const resultsByPollId = new Map<number, Record<string, number>>();
  for (const result of results) {
    const resultMap = resultsByPollId.get(result.pollId) ?? {};
    resultMap[result.partyId] = result.percentage;
    resultsByPollId.set(result.pollId, resultMap);
  }

  return pollRows
    .map((poll) => ({
      agency: poll.agency,
      publishedDate: poll.publishedDate,
      sampleSize: poll.sampleSize,
      results: resultsByPollId.get(poll.id) ?? {},
    }))
    .filter((poll) => Object.keys(poll.results).length > 0);
}

async function getExistingPollId(db: Database, row: RawPollRow): Promise<number | null> {
  const existing = await db
    .select({ id: polls.id })
    .from(polls)
    .where(and(eq(polls.agency, row.agency), eq(polls.publishedDate, row.publishedDate)))
    .limit(1);

  return existing[0]?.id ?? null;
}
