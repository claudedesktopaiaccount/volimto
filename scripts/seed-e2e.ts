import dotenv from "dotenv";
import path from "path";
import { pathToFileURL } from "url";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { seedParties } from "../src/lib/db/seed";
import type { Database } from "../src/lib/db";

const E2E_POLL = {
  agency: "E2E",
  publishedDate: "2026-05-31",
  fieldworkStart: "2026-05-28",
  fieldworkEnd: "2026-05-30",
  sampleSize: 1000,
  sourceUrl: "https://example.com/e2e-poll",
  createdAt: "2026-06-01T00:00:00.000Z",
};

const E2E_RESULTS = [
  ["ps", 24.8],
  ["smer-sd", 22.3],
  ["hlas-sd", 14.1],
  ["republika", 8.7],
  ["sas", 6.2],
  ["kdh", 5.9],
  ["sns", 5.1],
  ["slovensko", 4.8],
] as const;

function loadEnv() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

function requireE2eDatabaseUrl() {
  loadEnv();
  const e2eUrl = process.env.E2E_DATABASE_URL;
  if (!e2eUrl) {
    throw new Error("E2E_DATABASE_URL is required for Playwright tests.");
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === e2eUrl) {
    throw new Error("E2E_DATABASE_URL must not equal DATABASE_URL.");
  }
  return e2eUrl;
}

export async function seedE2eDatabase(databaseUrl = requireE2eDatabaseUrl()) {
  const db = drizzle(neon(databaseUrl), { schema });
  await seedParties(db as Database);

  await db.insert(schema.polls).values(E2E_POLL).onConflictDoNothing();
  const [poll] = await db
    .select({ id: schema.polls.id })
    .from(schema.polls)
    .where(eq(schema.polls.agency, E2E_POLL.agency))
    .limit(1);

  if (!poll) throw new Error("Failed to create E2E poll.");

  await db.delete(schema.pollResults).where(eq(schema.pollResults.pollId, poll.id));
  await db.insert(schema.pollResults).values(
    E2E_RESULTS.map(([partyId, percentage]) => ({
      pollId: poll.id,
      partyId,
      percentage,
    }))
  );

  for (const [partyId] of E2E_RESULTS.slice(0, 5)) {
    await db
      .insert(schema.crowdAggregates)
      .values({
        partyId,
        totalBets: 1,
        avgPredictedPct: null,
        computedAt: E2E_POLL.createdAt,
      })
      .onConflictDoUpdate({
        target: schema.crowdAggregates.partyId,
        set: {
          totalBets: 1,
          avgPredictedPct: null,
          computedAt: E2E_POLL.createdAt,
        },
      });
  }

  await db.delete(schema.rateLimits);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedE2eDatabase()
    .then(() => {
      console.log("E2E database seeded.");
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
