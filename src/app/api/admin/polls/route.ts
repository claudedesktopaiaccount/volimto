import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pollResults, polls } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin-auth";
import { numberRecord, readJsonObject, requiredString } from "@/lib/api/validation";
import { revalidateCacheTag } from "@/lib/cache/tags";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await readJsonObject(req);
  if (!body.ok) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const agency = requiredString(body.value.agency);
  const publishedDate = requiredString(body.value.publishedDate);
  const results = numberRecord(body.value.results);

  if (!agency || !publishedDate || !results) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  const [insertedPoll] = await db
    .insert(polls)
    .values({ agency, publishedDate, createdAt: now })
    .returning({ id: polls.id });

  const pollId = insertedPoll.id;
  const resultRows = Object.entries(results)
    .filter(([, pct]) => typeof pct === "number" && pct > 0)
    .map(([partyId, pct]) => ({ pollId, partyId, percentage: pct }));

  if (resultRows.length > 0) {
    await db.insert(pollResults).values(resultRows);
  }

  revalidateCacheTag("polls");
  return NextResponse.json({ ok: true, pollId });
}
