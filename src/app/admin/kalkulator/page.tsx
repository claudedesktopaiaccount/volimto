import { getDb } from "@/lib/db";
import { getKalkulatorWeights, upsertKalkulatorWeight } from "@/lib/db/kalkulator";
import { QUESTIONS } from "@/lib/kalkulator/questions";
import { redirect } from "next/navigation";
import { isAdminAuthedFromCookies } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminKalkulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const db = getDb();
  const weights = await getKalkulatorWeights(db);

  // Build lookup: [questionId][answerIndex][partyId] = weight
  const lookup: Record<number, Record<number, Record<string, number>>> = {};
  for (const row of weights) {
    lookup[row.questionId] ??= {};
    lookup[row.questionId][row.answerIndex] ??= {};
    lookup[row.questionId][row.answerIndex][row.partyId] = row.weight;
  }

  async function saveWeights(formData: FormData) {
    "use server";
    if (!(await isAdminAuthedFromCookies())) throw new Error("Unauthorized");
    const serverDb = getDb();
    const entries = Array.from(formData.entries());
    for (const [key, value] of entries) {
      // key format: "q{questionId}_a{answerIndex}_{partyId}"
      const match = key.match(/^q(\d+)_a(\d+)_(.+)$/);
      if (!match) continue;
      await upsertKalkulatorWeight(serverDb, {
        questionId: parseInt(match[1]),
        answerIndex: parseInt(match[2]),
        partyId: match[3],
        weight: parseFloat(value as string) || 0,
        sourceUrl: null,
      });
    }
    redirect("/admin/kalkulator?saved=1");
  }

  const partyIds = ["ps", "demokrati", "sas", "kdh", "hlas-sd", "smer-sd", "sns", "republika", "aliancia", "slovensko"];
  const { saved } = await searchParams;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="font-newsreader text-2xl font-bold mb-2">Volebný kalkulátor — váhy</h1>
      {saved && <p className="text-green-700 mb-4">Uložené.</p>}
      <form action={saveWeights}>
        {QUESTIONS.map((q) => (
          <div key={q.id} className="mb-8 border-t border-divider pt-4">
            <p className="font-semibold mb-3">{q.id}. {q.text}</p>
            {q.answers.map((answer, ai) => (
              <div key={ai} className="mb-4">
                <p className="text-sm text-ink/60 mb-1">{answer.label}</p>
                <div className="grid grid-cols-5 gap-2">
                  {partyIds.map((partyId) => (
                    <label key={partyId} className="text-xs">
                      <span className="block text-ink/50 mb-0.5">{partyId}</span>
                      <input
                        type="number"
                        name={`q${q.id}_a${ai}_${partyId}`}
                        step="0.5"
                        min="-2"
                        max="2"
                        defaultValue={lookup[q.id]?.[ai]?.[partyId] ?? answer.weights[partyId] ?? 0}
                        className="w-full border border-divider px-1 py-0.5 text-xs"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        <button type="submit" className="bg-ink text-surface px-6 py-2 text-sm">
          Uložiť zmeny
        </button>
      </form>
    </div>
  );
}
