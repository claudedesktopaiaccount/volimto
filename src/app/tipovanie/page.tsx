import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { crowdAggregates, predictionScores, users } from "@/lib/db/schema";
import { createSentryWithoutRequest, captureException } from "@/lib/sentry";
import { eq, desc } from "drizzle-orm";
import TipovanieClient from "./TipovanieClient";
import PageHeader from "@/components/ui/PageHeader";
import { withTimeout } from "@/lib/runtime-data";

export const metadata: Metadata = {
  title: "Tipovanie",
  description: "Tipnite si víťaza slovenských parlamentných volieb a porovnajte sa s ostatnými.",
  openGraph: {
    title: "Tipovanie | VolímTo",
    description: "Tipnite si víťaza slovenských parlamentných volieb.",
  },
};

export const revalidate = 0; // always fresh crowd data

export default async function TipovaniePage() {
  let initialCrowd: { partyId: string; totalBets: number; avgPct: number }[] = [];
  let initialTotalBets = 0;
  let leaderboard: { rank: number; displayName: string; totalScore: number; winnerScore: number; percentageScore: number; coalitionScore: number }[] = [];

  try {
    const db = getDb();

    const [aggregates, lbRows] = await withTimeout("tipovanie initial data", () => Promise.all([
      db.select().from(crowdAggregates),
      db
        .select({
          totalScore: predictionScores.totalScore,
          winnerScore: predictionScores.winnerScore,
          percentageScore: predictionScores.percentageScore,
          coalitionScore: predictionScores.coalitionScore,
          displayName: users.displayName,
        })
        .from(predictionScores)
        .leftJoin(users, eq(predictionScores.userId, users.id))
        .where(eq(predictionScores.electionId, "2026"))
        .orderBy(desc(predictionScores.totalScore))
        .limit(20)
        .catch(() => []),
    ]));

    initialCrowd = aggregates.map((a) => ({
      partyId: a.partyId,
      totalBets: a.totalBets,
      avgPct: a.avgPredictedPct ?? 0,
    }));
    initialTotalBets = aggregates.reduce((s, a) => s + a.totalBets, 0);
    leaderboard = lbRows.map((r, i) => ({
      rank: i + 1,
      displayName: r.displayName ?? "Anonym",
      totalScore: r.totalScore,
      winnerScore: r.winnerScore ?? 0,
      percentageScore: r.percentageScore ?? 0,
      coalitionScore: r.coalitionScore ?? 0,
    }));
  } catch (e) {
    console.error("Failed to load crowd data:", e);
    try {
      captureException(createSentryWithoutRequest({ SENTRY_DSN: process.env.SENTRY_DSN }), e);
    } catch { /* Sentry reporting best-effort */ }
  }

  return (
    <div className="max-w-content mx-auto px-6 py-8">
      <PageHeader
        title="Tipovanie"
        eyebrow="TIPNITE SI, KTO VYHRÁ VOĽBY — POROVNAJTE SVOJ TIP S HLASOM ĽUDU"
      />

      <TipovanieClient
        initialCrowd={initialCrowd}
        initialTotalBets={initialTotalBets}
        leaderboard={leaderboard}
      />
    </div>
  );
}
