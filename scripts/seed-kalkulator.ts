/**
 * One-time seeder: populates kalkulator_weights from the QUESTIONS array.
 * Run with: npx tsx scripts/seed-kalkulator.ts
 */
import { getDb } from "../src/lib/db";
import { kalkulatorWeights } from "../src/lib/db/schema";
import { QUESTIONS } from "../src/lib/kalkulator/questions";

async function main() {
  const db = getDb();
  const now = new Date().toISOString();
  let count = 0;

  for (const question of QUESTIONS) {
    for (let answerIndex = 0; answerIndex < question.answers.length; answerIndex++) {
      const answer = question.answers[answerIndex];
      for (const [partyId, weight] of Object.entries(answer.weights)) {
        await db.insert(kalkulatorWeights).values({
          questionId: question.id,
          answerIndex,
          partyId,
          weight,
          sourceUrl: null,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [
            kalkulatorWeights.questionId,
            kalkulatorWeights.answerIndex,
            kalkulatorWeights.partyId,
          ],
          set: { weight, updatedAt: now },
        });
        count++;
      }
    }
  }
  console.log(`Seeded ${count} rows.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
