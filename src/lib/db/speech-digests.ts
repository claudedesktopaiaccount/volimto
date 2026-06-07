import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { speeches } from "@/lib/db/schema";
import {
  summarizeSpeechWithGemini,
  type SpeechDigest,
  type SpeechSummaryStatus,
} from "@/lib/speech-digest";

export interface SpeechDigestJobResult {
  processed: number;
  done: number;
  skipped: number;
  failed: number;
}

async function updateSpeechDigest(
  db: Database,
  speechId: number,
  digest: SpeechDigest
): Promise<void> {
  await db
    .update(speeches)
    .set({
      cleanTitleSk: digest.cleanTitleSk,
      speechType: digest.speechType,
      summarySk: digest.summarySk,
      keyPointsSk: JSON.stringify(digest.keyPointsSk),
      summaryStatus: digest.summaryStatus,
      summaryModel: digest.summaryModel,
      summarizedAt: new Date().toISOString(),
    })
    .where(eq(speeches.id, speechId));
}

export async function summarizePendingSpeechDigests(
  db: Database,
  opts: { apiKey?: string; mpId?: number; limit?: number } = {}
): Promise<SpeechDigestJobResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const pendingStatuses = ["pending", "failed"] satisfies SpeechSummaryStatus[];
  const statusFilter = or(
    isNull(speeches.summaryStatus),
    isNull(speeches.summarySk),
    inArray(speeches.summaryStatus, pendingStatuses)
  );
  const whereClause =
    opts.mpId === undefined ? statusFilter : and(eq(speeches.mpId, opts.mpId), statusFilter);

  const pending = await db
    .select({
      id: speeches.id,
      date: speeches.date,
      titleSk: speeches.titleSk,
      textSk: speeches.textSk,
    })
    .from(speeches)
    .where(whereClause)
    .orderBy(asc(speeches.date), asc(speeches.id))
    .limit(limit);

  const result: SpeechDigestJobResult = {
    processed: 0,
    done: 0,
    skipped: 0,
    failed: 0,
  };

  for (const speech of pending) {
    const digest = await summarizeSpeechWithGemini(
      {
        titleSk: speech.titleSk,
        textSk: speech.textSk,
        date: speech.date,
      },
      opts.apiKey
    );

    await updateSpeechDigest(db, speech.id, digest);
    result.processed++;
    result[digest.summaryStatus]++;
  }

  return result;
}
