import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import VolebnyKalkulatorClient from "./VolebnyKalkulatorClient";
import { getKalkulatorWeights } from "@/lib/db/kalkulator";
import { QUESTIONS } from "@/lib/kalkulator/questions";
import type { Question } from "@/lib/kalkulator/questions";
import { isStaticBuild, withTimeout } from "@/lib/runtime-data";

export const revalidate = 86400; // 24h — weights change rarely

export const metadata: Metadata = {
  title: "Koho voliť?",
  description: "Volebný kalkulátor — odpovedzte na 20 otázok a zistite, ktorá slovenská politická strana vám je najbližšia.",
  openGraph: {
    title: "Koho voliť? | VolímTo",
    description: "Volebný kalkulátor — zistite, ktorá strana vám je najbližšia.",
  },
};

export default async function VolebnyKalkulatorPage() {
  let questions: Question[] = QUESTIONS; // fallback to static data

  try {
    if (isStaticBuild()) throw new Error("skip calculator weights during static build");
    const db = getDb();
    const rows = await withTimeout("calculator weights", () => getKalkulatorWeights(db));

    if (rows.length > 0) {
      // Reconstruct Question[] from flat DB rows
      questions = QUESTIONS.map((q) => ({
        ...q,
        answers: q.answers.map((answer, answerIndex) => {
          const weights: Record<string, number> = { ...answer.weights };
          // Override with DB values
          for (const row of rows) {
            if (row.questionId === q.id && row.answerIndex === answerIndex) {
              weights[row.partyId] = row.weight;
            }
          }
          return { ...answer, weights };
        }),
      }));
    }
  } catch {
    // DB unavailable during static build — use static fallback
  }

  return <VolebnyKalkulatorClient questions={questions} />;
}
