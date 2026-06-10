import type { ScrapedProgram } from "./programs";
import type { ExtractedPromise } from "@/lib/promise-types";

export type { ExtractedPromise } from "@/lib/promise-types";

const PROMISE_KEYWORDS = [
  "zavedieme",
  "znížime",
  "zvýšime",
  "zaistíme",
  "zabezpečíme",
  "budeme",
  "vytvoríme",
  "postavíme",
  "zrušíme",
  "zreformujeme",
  "podporíme",
  "investujeme",
  "rozšíríme",
  "pripravíme",
  "schválíme",
  "vybudujeme",
  "navrhneme",
  "presadíme",
  "obnovíme",
  "posilníme",
];

const MIN_LEN = 30;
const MAX_LEN = 500;
const HEURISTIC_CONFIDENCE = 0.6;

function normalizeSentence(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  // Split on ". " or newlines
  return text
    .split(/\.\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function hasPromiseKeyword(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return PROMISE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function extractPromisesFromProgram(program: ScrapedProgram): ExtractedPromise[] {
  const seen = new Set<string>();
  const results: ExtractedPromise[] = [];

  for (const section of program.sections) {
    const sentences = splitSentences(section.text);

    for (const sentence of sentences) {
      if (sentence.length < MIN_LEN) continue;
      if (sentence.length > MAX_LEN) continue;
      if (!hasPromiseKeyword(sentence)) continue;

      const norm = normalizeSentence(sentence);
      const dedupeKey = norm.slice(0, 100);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      results.push({
        partyId: program.partyId,
        sourceUrl: program.sourceUrl,
        sourceDate: program.sourceDate,
        textSk: sentence,
        aiConfidence: HEURISTIC_CONFIDENCE,
      });
    }
  }

  return results;
}
