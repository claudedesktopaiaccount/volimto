import { getDb } from "@/lib/db";
import { promises as promisesTable } from "@/lib/db/schema";
import type { ExtractedPromise } from "@/lib/promise-types";

const BATCH_SIZE = 50;

export async function upsertPromises(
  db: ReturnType<typeof getDb>,
  items: ExtractedPromise[]
): Promise<number> {
  if (items.length === 0) return 0;

  let inserted = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    const rows = batch.map((item) => ({
      sourceType: "program" as const,
      sourceUrl: item.sourceUrl,
      sourceDate: item.sourceDate,
      partyId: item.partyId,
      mpId: null,
      textSk: item.textSk,
      status: "nesplnený",
      evidenceVoteId: null,
      evidenceUrl: null,
      aiConfidence: item.aiConfidence,
    }));

    const result = await db
      .insert(promisesTable)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: promisesTable.id });

    inserted += result.length;
  }

  return inserted;
}
