import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pollResults, polls } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    agency?: string;
    publishedDate?: string;
    results?: Record<string, number>;
  } | null;

  if (!body?.agency || !body?.publishedDate || !body?.results) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  const [insertedPoll] = await db
    .insert(polls)
    .values({ agency: body.agency, publishedDate: body.publishedDate, createdAt: now })
    .returning({ id: polls.id });

  const pollId = insertedPoll.id;
  const resultRows = Object.entries(body.results)
    .filter(([, pct]) => typeof pct === "number" && pct > 0)
    .map(([partyId, pct]) => ({ pollId, partyId, percentage: pct }));

  if (resultRows.length > 0) {
    await db.insert(pollResults).values(resultRows);
  }

  return NextResponse.json({ ok: true, pollId });
}
