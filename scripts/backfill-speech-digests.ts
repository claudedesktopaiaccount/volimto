/**
 * Backfill useful speech digests for already stored speeches.
 *
 * Run: npx tsx scripts/backfill-speech-digests.ts --limit=20
 */
import "dotenv/config";
import { getDb } from "../src/lib/db";
import { summarizePendingSpeechDigests } from "../src/lib/db/speech-digests";

function numberArg(name: string, fallback: number): number {
  const raw = process.argv.slice().reverse().find((arg) => arg.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : fallback;
}

async function main() {
  const limit = numberArg("limit", 20);
  const result = await summarizePendingSpeechDigests(getDb(), {
    apiKey: process.env.GEMINI_API_KEY,
    limit,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[speech-digests] fatal:", error);
  process.exit(1);
});
