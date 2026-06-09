import type { Metadata } from "next";
import SectionHeading from "@/components/ui/SectionHeading";
import { getAllPolls } from "@/lib/poll-data";
import { PARTY_LIST } from "@/lib/parties";
import { getDb } from "@/lib/db";
import { isStaticBuild, withTimeout } from "@/lib/runtime-data";
import PrieskumyClient from "./PrieskumyClient";

export const metadata: Metadata = {
  title: "Prieskumy",
  description: "Aktuálne volebné prieskumy a trendy pre slovenské parlamentné voľby. Agregátor dát od Focus, AKO, Median a ďalších agentúr.",
  openGraph: {
    title: "Prieskumy | VolímTo",
    description: "Aktuálne volebné prieskumy a trendy pre slovenské parlamentné voľby.",
  },
};

export const revalidate = 21600;

function formatSlovakDate(isoDate?: string): string {
  if (!isoDate) return "N/A";

  const months = [
    "januára", "februára", "marca", "apríla", "mája", "júna",
    "júla", "augusta", "septembra", "októbra", "novembra", "decembra",
  ];
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day || !months[month - 1]) return isoDate;
  return `${day}. ${months[month - 1]} ${year}`;
}

export default async function PrieskumyPage() {
  let polls: Awaited<ReturnType<typeof getAllPolls>> = [];
  try {
    if (!isStaticBuild() && process.env.DATABASE_URL) {
      const db = getDb();
      polls = await withTimeout("polls database load", () => getAllPolls(db));
    }
  } catch {
    // fall back to live scraping below
  }
  if (polls.length === 0) {
    polls = await getAllPolls();
  }

  // Build chart data: each poll → { date, partyId: percentage, agency }
  const chartData = polls
    .slice(0, 60)
    .reverse()
    .map((poll) => {
      const entry: Record<string, string | number> = {
        date: poll.publishedDate,
        agency: poll.agency,
      };
      for (const [partyId, pct] of Object.entries(poll.results)) {
        entry[partyId] = pct;
      }
      return entry;
    });

  // Build agency comparison: group latest poll per agency
  const agencyMap = new Map<string, Record<string, number>>();
  for (const poll of polls) {
    if (!agencyMap.has(poll.agency)) {
      agencyMap.set(poll.agency, poll.results);
    }
  }
  const agencies = Array.from(agencyMap.entries()).map(([name, results]) => ({
    name,
    results,
  }));

  // Latest poll data for bar chart
  const latest = polls[0];
  const previous = polls.length > 1 ? polls[1] : null;
  const latestLabel = latest
    ? `${latest.agency}, ${formatSlovakDate(latest.publishedDate)}`
    : "N/A";

  const partyBars = PARTY_LIST
    .map((party) => ({
      id: party.id,
      abbreviation: party.abbreviation,
      color: party.color,
      percentage: latest?.results[party.id] ?? 0,
      trend: latest && previous
        ? Math.round(((latest.results[party.id] ?? 0) - (previous.results[party.id] ?? 0)) * 10) / 10
        : 0,
    }))
    .filter((p) => p.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);

  const partyMeta = PARTY_LIST.map((p) => ({
    id: p.id,
    abbreviation: p.abbreviation,
    color: p.color,
  })).sort((a, b) => (latest?.results[b.id] ?? 0) - (latest?.results[a.id] ?? 0));

  return (
    <>
      <div className="max-w-content mx-auto px-6 pt-8">
        <SectionHeading
          title="Prieskumy verejnej mienky"
          subtitle={`${polls.length} prieskumov z Wikipédie — posledný dostupný prieskum: ${latestLabel}`}
        />
      </div>

      <PrieskumyClient
        chartData={chartData}
        partyBars={partyBars}
        agencies={agencies}
        partyMeta={partyMeta}
      />
    </>
  );
}
