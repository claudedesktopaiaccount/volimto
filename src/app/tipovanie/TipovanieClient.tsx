"use client";

import { useState } from "react";
import Link from "next/link";
import { getCsrfToken } from "@/lib/csrf";
import { getFingerprint } from "@/lib/fingerprint";
import { PARTIES } from "@/lib/parties";
import { useAuth } from "@/components/AuthProvider";
import { DataTable, DataTd, DataTh } from "@/components/ui/DataTable";
import VotingPanel from "@/components/tipovanie/VotingPanel";
import CommunityResults, { type CrowdData } from "@/components/tipovanie/CommunityResults";
import { useToggleSet } from "@/hooks/useToggleSet";

export type { CrowdData };

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  winnerScore: number;
  percentageScore: number;
  coalitionScore: number;
}

interface Props {
  initialCrowd: CrowdData[];
  initialTotalBets: number;
  leaderboard?: LeaderboardEntry[];
}

export default function TipovanieClient({ initialCrowd, initialTotalBets, leaderboard = [] }: Props) {
  const { user } = useAuth();
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyVotedParty, setAlreadyVotedParty] = useState<string | null>(null);
  const [crowdData, setCrowdData] = useState<CrowdData[]>(initialCrowd);
  const [totalBets, setTotalBets] = useState(initialTotalBets);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [predictedPcts, setPredictedPcts] = useState<Record<string, string>>({});
  const coalitionPick = useToggleSet<string>();

  async function refreshCrowd() {
    const crowdRes = await fetch("/api/tipovanie");
    if (crowdRes.ok) {
      const crowd = (await crowdRes.json()) as { aggregates: CrowdData[]; totalBets: number };
      setCrowdData(crowd.aggregates);
      setTotalBets(crowd.totalBets);
    }
  }

  async function handleSubmit() {
    if (!selectedWinner) return;
    setSubmitting(true);

    try {
      const fingerprint = await getFingerprint();

      const res = await fetch("/api/tipovanie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken(),
        },
        body: JSON.stringify({
          selectedWinner,
          fingerprint,
          ...(showAdvanced && Object.keys(predictedPcts).length > 0
            ? {
                predictedPercentages: Object.fromEntries(
                  Object.entries(predictedPcts)
                    .filter(([, value]) => value !== "")
                    .map(([key, value]) => [key, parseFloat(value)]),
                ),
              }
            : {}),
          ...(showAdvanced && coalitionPick.set.size > 0
            ? { coalitionPick: [...coalitionPick.set] }
            : {}),
        }),
      });

      const data = (await res.json()) as { error?: string; partyId?: string };

      if (res.status === 409 && data.error === "already_voted") {
        setAlreadyVotedParty(data.partyId ?? null);
        setSelectedWinner(data.partyId ?? null);
        setSubmitted(true);
        await refreshCrowd();
        return;
      }

      if (!res.ok) throw new Error("Submit failed");

      await refreshCrowd();
      setSubmitted(true);
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <VotingPanel
          selectedWinner={selectedWinner}
          setSelectedWinner={setSelectedWinner}
          submitted={submitted}
          submitting={submitting}
          alreadyVotedParty={alreadyVotedParty}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          predictedPcts={predictedPcts}
          setPredictedPcts={setPredictedPcts}
          coalitionPickSet={coalitionPick.set}
          toggleCoalitionPick={coalitionPick.toggle}
          onSubmit={handleSubmit}
        />
        <CommunityResults
          crowdData={crowdData}
          totalBets={totalBets}
          submitted={submitted}
          selectedWinner={selectedWinner}
        />
      </div>

      {leaderboard.length > 0 && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="mb-1 text-xl font-bold text-ink">Rebríček prediktorov</h2>
          <p className="mb-4 text-xs text-muted">Kto najlepšie predpovedá voľby?</p>
          <div className="overflow-x-auto">
            <DataTable>
              <thead>
                <tr className="border-b-2 border-ink text-left">
                  <DataTh className="pr-3 text-secondary">#</DataTh>
                  <DataTh className="pr-3 text-secondary">Meno</DataTh>
                  <DataTh className="pr-3 text-right text-secondary">Víťaz</DataTh>
                  <DataTh className="pr-3 text-right text-secondary">Percentá</DataTh>
                  <DataTh className="pr-3 text-right text-secondary">Koalícia</DataTh>
                  <DataTh className="text-right text-secondary">Celkom</DataTh>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.rank} className="border-b border-border transition-colors hover:bg-hover">
                    <DataTd className="py-2.5 pr-3 font-mono text-muted">{entry.rank}.</DataTd>
                    <DataTd className="py-2.5 pr-3 text-body-sm text-ink">{entry.displayName}</DataTd>
                    <DataTd className="py-2.5 pr-3 text-right text-xs text-secondary tabular-nums">
                      {entry.winnerScore.toFixed(0)}
                    </DataTd>
                    <DataTd className="py-2.5 pr-3 text-right text-xs text-secondary tabular-nums">
                      {entry.percentageScore.toFixed(0)}
                    </DataTd>
                    <DataTd className="py-2.5 pr-3 text-right text-xs text-secondary tabular-nums">
                      {entry.coalitionScore.toFixed(0)}
                    </DataTd>
                    <DataTd className="py-2.5 text-right text-xs font-bold text-ink tabular-nums">
                      {entry.totalScore.toFixed(0)}
                    </DataTd>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          {!user && (
            <div className="mt-4 rounded-lg border border-border bg-subtle p-3 text-center text-body-sm">
              <Link href="/prihlasenie" className="font-medium text-accent hover:underline">
                Prihlás sa cez Google
              </Link>{" "}
              a sleduj svoje skóre v rebríčku.
            </div>
          )}
        </section>
      )}

      {crowdData.some((item) => (item.avgPct ?? 0) > 0) && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="mb-4 text-lg font-bold text-ink">Čo tipuje dav?</h2>
          <div className="space-y-3">
            {[...crowdData]
              .filter((item) => (item.avgPct ?? 0) > 0)
              .sort((a, b) => (b.avgPct ?? 0) - (a.avgPct ?? 0))
              .map((item) => {
                const party = PARTIES[item.partyId];
                if (!party) return null;
                return (
                  <div key={item.partyId} className="flex items-center gap-3">
                    <span className="w-12 text-xs font-semibold text-secondary">{party.abbreviation}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-subtle">
                      <div
                        className="h-full rounded-sm transition-all duration-500"
                        style={{
                          width: `${Math.min(((item.avgPct ?? 0) / 30) * 100, 100)}%`,
                          backgroundColor: party.color,
                        }}
                      />
                    </div>
                    <span className="w-14 text-right text-xs font-bold text-ink tabular-nums">
                      {(item.avgPct ?? 0).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </>
  );
}
