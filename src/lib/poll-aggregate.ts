import { scrapeWikipediaPolls, type RawPollRow } from "./scraper/wikipedia";
import { estimateStdDev } from "./prediction/monte-carlo";
import type { Database } from "./db";
import { getPollRows } from "./db/polls";

export const POLL_WEIGHT_LAMBDA = 0.023; // 30-day half-life: e^(-0.023*30) ≈ 0.5
const WINDOW_DAYS = 365;

export interface AggregatedParty {
  partyId: string;
  meanPct: number;
  stdDev: number;
  pollCount: number;
  oldestPollDate: string;
  newestPollDate: string;
}

export async function getAggregatedPolls(db?: Database): Promise<AggregatedParty[]> {
  let allPolls: RawPollRow[] = [];

  if (db) {
    try {
      allPolls = await getPollRows(db);
    } catch (error) {
      console.error("[poll-aggregate] Failed to load stored polls:", error);
      allPolls = [];
    }
  }

  if (!allPolls || allPolls.length === 0) {
    try {
      allPolls = await scrapeWikipediaPolls();
    } catch {
      return [];
    }
  }

  if (allPolls.length === 0) return [];

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const recent = allPolls.filter((p) => p.publishedDate >= cutoffStr);
  const workingPolls = recent.length > 0 ? recent : allPolls;

  if (workingPolls.length === 0) return [];
  if (recent.length === 0) {
    console.warn("[poll-aggregate] No polls within 12-month window, using all available polls");
  }

  const todayStr = today.toISOString().split("T")[0];

  const partyIds = new Set<string>();
  for (const poll of workingPolls) {
    for (const id of Object.keys(poll.results)) partyIds.add(id);
  }

  const result: AggregatedParty[] = [];

  for (const partyId of partyIds) {
    const entries = workingPolls
      .filter((p) => p.results[partyId] != null && p.results[partyId] > 0)
      .map((p) => ({
        weight: calculatePollAgeWeight(daysBetween(p.publishedDate, todayStr)),
        pct: p.results[partyId],
        agency: p.agency,
        publishedDate: p.publishedDate,
      }));

    if (entries.length === 0) continue;

    const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
    const meanPct = entries.reduce((s, e) => s + e.weight * e.pct, 0) / totalWeight;

    const stdDev = estimateStdDev(
      entries.map((e) => ({ agency: e.agency, percentage: e.pct }))
    );

    const dates = entries.map((e) => e.publishedDate).sort();

    result.push({
      partyId,
      meanPct: Math.round(meanPct * 100) / 100,
      stdDev,
      pollCount: entries.length,
      oldestPollDate: dates[0],
      newestPollDate: dates[dates.length - 1],
    });
  }

  return result
    .filter((p) => p.meanPct > 0)
    .sort((a, b) => b.meanPct - a.meanPct);
}

function daysBetween(dateStr: string, referenceStr: string): number {
  const d = new Date(dateStr).getTime();
  const r = new Date(referenceStr).getTime();
  return Math.max(0, Math.round((r - d) / (1000 * 60 * 60 * 24)));
}

export function calculatePollAgeWeight(ageDays: number): number {
  return Math.exp(-POLL_WEIGHT_LAMBDA * Math.max(0, ageDays));
}
