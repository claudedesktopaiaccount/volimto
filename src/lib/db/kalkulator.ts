import { type Database } from "@/lib/db";
import { kalkulatorWeights } from "./schema";

export type KalkulatorWeightRow = typeof kalkulatorWeights.$inferSelect;

export async function getKalkulatorWeights(
  db: Database
): Promise<KalkulatorWeightRow[]> {
  return db.select().from(kalkulatorWeights);
}

export async function upsertKalkulatorWeight(
  db: Database,
  row: {
    questionId: number;
    answerIndex: number;
    partyId: string;
    weight: number;
    sourceUrl: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(kalkulatorWeights)
    .values({ ...row, updatedAt: now })
    .onConflictDoUpdate({
      target: [
        kalkulatorWeights.questionId,
        kalkulatorWeights.answerIndex,
        kalkulatorWeights.partyId,
      ],
      set: { weight: row.weight, sourceUrl: row.sourceUrl, updatedAt: now },
    });
}
