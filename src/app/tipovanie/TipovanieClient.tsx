"use client";

import { useState } from "react";
import { PARTY_LIST, PARTIES } from "@/lib/parties";
import ShareButtons from "@/components/ShareButtons";
import { getFingerprint } from "@/lib/fingerprint";
import { useAuth } from "@/components/AuthProvider";
import Badge from "@/components/ui/Badge";
import Panel from "@/components/ui/Panel";
import { DataTable, DataTd, DataTh } from "@/components/ui/DataTable";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface CrowdData {
  partyId: string;
  totalBets: number;
  avgPct?: number;
}

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
  const [coalitionPick, setCoalitionPick] = useState<Set<string>>(new Set());

  async function handleSubmit() {
    if (!selectedWinner) return;
    setSubmitting(true);

    try {
      const fingerprint = await getFingerprint();
      const csrfToken = document.cookie
        .split("; ")
        .find((c) => c.startsWith("pt_csrf="))
        ?.split("=")[1] ?? "";

      const res = await fetch("/api/tipovanie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          selectedWinner,
          fingerprint,
          ...(showAdvanced && Object.keys(predictedPcts).length > 0
            ? { predictedPercentages: Object.fromEntries(
                Object.entries(predictedPcts)
                  .filter(([, v]) => v !== "")
                  .map(([k, v]) => [k, parseFloat(v)])
              ) }
            : {}),
          ...(showAdvanced && coalitionPick.size > 0
            ? { coalitionPick: [...coalitionPick] }
            : {}),
        }),
      });

      const data = await res.json() as { error?: string; partyId?: string };

      if (res.status === 409 && data.error === "already_voted") {
        setAlreadyVotedParty(data.partyId ?? null);
        setSelectedWinner(data.partyId ?? null);
        setSubmitted(true);
        const crowdRes = await fetch("/api/tipovanie");
        if (crowdRes.ok) {
          const crowd = await crowdRes.json() as { aggregates: CrowdData[]; totalBets: number };
          setCrowdData(crowd.aggregates);
          setTotalBets(crowd.totalBets);
        }
        return;
      }

      if (!res.ok) throw new Error("Submit failed");

      const crowdRes = await fetch("/api/tipovanie");
      if (crowdRes.ok) {
        const crowd = await crowdRes.json() as { aggregates: CrowdData[]; totalBets: number };
        setCrowdData(crowd.aggregates);
        setTotalBets(crowd.totalBets);
      }

      setSubmitted(true);
    } catch (e) {
      console.error("Submit error:", e);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedParty = selectedWinner ? PARTIES[selectedWinner] : null;

  const sortedCrowd = [...crowdData].sort((a, b) => b.totalBets - a.totalBets);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Voting panel */}
        <Panel>
          <h2 className="mb-4 text-lg font-bold text-ink">Kto vyhrá voľby?</h2>

          {!submitted ? (
            <>
              <div className="space-y-2">
                {PARTY_LIST.map((party) => {
                  const isSelected = selectedWinner === party.id;
                  return (
                    <button
                      key={party.id}
                      onClick={() => setSelectedWinner(party.id)}
                      aria-pressed={isSelected}
                      aria-label={`Tipovať ${party.name}`}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-btn border px-3 py-2.5 transition-all",
                        isSelected ? "border-2" : "border"
                      )}
                      style={{
                        background: isSelected ? `${party.color}15` : "var(--bg-card)",
                        borderColor: isSelected ? party.color : "var(--border-color)",
                      }}
                    >
                      <div className="h-2.5 w-2.5 shrink-0 rounded-xs" style={{ background: party.color }} />
                      <span className="flex-1 text-left text-sm font-medium text-ink">{party.name}</span>
                      <span className="text-caption text-faint">{party.leader}</span>
                      {isSelected && (
                        <svg className="w-4 h-4 shrink-0" style={{ color: party.color }} fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.15" />
                          <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedWinner && (
                <div className="mt-4">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full rounded-btn py-2.5 text-sm font-semibold text-paper transition-colors disabled:opacity-50"
                    style={{
                      background: selectedParty?.color ?? "var(--btn-primary-bg)",
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? "Odosielam..." : "Odoslať tip"}
                  </button>

                  {/* Advanced predictions toggle */}
                  <div className="mt-3">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-caption text-muted underline transition-colors hover:text-ink"
                    >
                      {showAdvanced ? "Skryť rozšírené tipovanie" : "Rozšírené tipovanie (percentá, koalícia)"}
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 space-y-4">
                        {/* Percentage predictions */}
                        <div className="rounded-lg border border-border p-4">
                          <h4 className="mb-3 text-label text-secondary">
                            Tipnite percentá strán
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {PARTY_LIST.map((party) => (
                              <div key={party.id} className="flex items-center gap-2">
                                <div className="h-2 w-2 shrink-0 rounded-xs" style={{ backgroundColor: party.color }} />
                                <span className="flex-1 truncate text-caption text-secondary">{party.abbreviation}</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  placeholder="—"
                                  value={predictedPcts[party.id] ?? ""}
                                  onChange={(e) =>
                                    setPredictedPcts((prev) => ({
                                      ...prev,
                                      [party.id]: e.target.value,
                                    }))
                                  }
                                  className="w-16 rounded-sm border border-border bg-transparent px-2 py-1 text-right text-caption tabular-nums focus:border-ink focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Coalition prediction */}
                        <div className="rounded-lg border border-border p-4">
                          <h4 className="mb-3 text-label text-secondary">
                            Tipnite koalíciu
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {PARTY_LIST.map((party) => {
                              const isInCoalition = coalitionPick.has(party.id);
                              return (
                                <button
                                  key={party.id}
                                  onClick={() => {
                                    setCoalitionPick((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(party.id)) next.delete(party.id);
                                      else next.add(party.id);
                                      return next;
                                    });
                                  }}
                                  className={cn(
                                    "rounded-md border px-3 py-1.5 text-caption transition-colors",
                                    isInCoalition ? "font-semibold" : "font-normal"
                                  )}
                                  style={{
                                    borderColor: isInCoalition ? party.color : "var(--border-color)",
                                    background: isInCoalition ? `${party.color}15` : "var(--bg-card)",
                                    color: isInCoalition ? party.color : "var(--text-secondary)",
                                  }}
                                >
                                  {party.abbreviation}
                                </button>
                              );
                            })}
                          </div>
                          {coalitionPick.size > 0 && (
                            <p className="mt-2 text-caption text-faint">
                              {coalitionPick.size} {coalitionPick.size === 1 ? "strana" : coalitionPick.size < 5 ? "strany" : "strán"}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Success state */
            <div>
              <div className="mt-4 flex items-center justify-between rounded-btn border border-success-border bg-success-bg p-3 text-body-sm text-success">
                <span>{alreadyVotedParty ? "Už ste tipovali." : "Váš tip bol zaznamenaný."}</span>
              </div>
              <div className="mt-4 text-center">
                <p className="text-body-sm text-secondary">
                  Tipujete výhru:{" "}
                  <strong style={{ color: selectedParty?.color }}>{selectedParty?.name}</strong>
                </p>
                {user ? (
                  <p className="mt-2 text-caption text-faint">Prihlásený ako {user.displayName}</p>
                ) : (
                  <p className="mt-3 text-caption text-muted">
                    <Link href="/prihlasenie" className="underline hover:text-ink">
                      Prihláste sa
                    </Link>{" "}
                    pre uloženie tipu naprieč zariadeniami
                  </p>
                )}
                <ShareButtons
                  url={typeof window !== "undefined" ? window.location.href : "/tipovanie"}
                  title="Tipujem voľby na VolímTo"
                  description="Tipnite si víťaza slovenských parlamentných volieb."
                />
                <Link
                  href="/tipovanie/rebricek"
                  className="mt-3 inline-block text-xs text-muted underline hover:text-ink"
                >
                  Pozrite si rebríček predpovedí →
                </Link>
              </div>
            </div>
          )}
        </Panel>

        {/* Right: Community results */}
        <Panel>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold text-secondary">Hlas ľudu</h2>
            {totalBets > 0 && (
              <span className="text-caption text-faint tabular-nums">
                {totalBets.toLocaleString("sk-SK")} tipov
              </span>
            )}
          </div>

          {totalBets === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="23" stroke="var(--border-color)" strokeWidth="2" />
                <circle cx="17" cy="21" r="3" fill="var(--border-strong)" />
                <circle cx="31" cy="21" r="3" fill="var(--border-strong)" />
                <path d="M16 32c2-3 14-3 16 0" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-center text-body-sm text-muted">Najprv tipnite, potom uvidíte výsledky komunity.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedCrowd.map((item) => {
                const party = PARTIES[item.partyId];
                if (!party) return null;
                const pct = totalBets > 0 ? (item.totalBets / totalBets) * 100 : 0;
                const isMyVote = submitted && selectedWinner === item.partyId;
                return (
                  <div key={item.partyId} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 text-xs text-secondary">{party.abbreviation}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-subtle">
                      <div
                        className="h-full rounded-sm transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: party.color,
                          opacity: isMyVote ? 1 : 0.5,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold text-ink tabular-nums">
                      {pct.toFixed(1)}%
                    </span>
                    {isMyVote && (
                      <Badge className="shrink-0 border-0 text-paper" style={{ background: party.color }}>
                        VÁŠ TIP
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Leaderboard section — full width below grid */}
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
                {leaderboard.map((e) => (
                  <tr key={e.rank} className="border-b border-border transition-colors hover:bg-hover">
                    <DataTd className="py-2.5 pr-3 font-mono text-muted">{e.rank}.</DataTd>
                    <DataTd className="py-2.5 pr-3 text-body-sm text-ink">{e.displayName}</DataTd>
                    <DataTd className="py-2.5 pr-3 text-right text-xs text-secondary tabular-nums">{e.winnerScore.toFixed(0)}</DataTd>
                    <DataTd className="py-2.5 pr-3 text-right text-xs text-secondary tabular-nums">{e.percentageScore.toFixed(0)}</DataTd>
                    <DataTd className="py-2.5 pr-3 text-right text-xs text-secondary tabular-nums">{e.coalitionScore.toFixed(0)}</DataTd>
                    <DataTd className="py-2.5 text-right text-xs font-bold text-ink tabular-nums">{e.totalScore.toFixed(0)}</DataTd>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          {!user && (
            <div className="mt-4 rounded-lg border border-border bg-subtle p-3 text-center text-body-sm">
              <Link href="/registracia" className="text-accent font-medium hover:underline">
                Zaregistruj sa
              </Link>
              {" "}a sleduj svoje skóre v rebríčku.
            </div>
          )}
        </section>
      )}

      {/* Crowd consensus — avg predicted percentages */}
      {crowdData.some((c) => (c.avgPct ?? 0) > 0) && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="mb-4 text-lg font-bold text-ink">Čo tipuje dav?</h2>
          <div className="space-y-3">
            {[...crowdData]
              .filter((c) => (c.avgPct ?? 0) > 0)
              .sort((a, b) => (b.avgPct ?? 0) - (a.avgPct ?? 0))
              .map((c) => {
                const party = PARTIES[c.partyId];
                if (!party) return null;
                return (
                  <div key={c.partyId} className="flex items-center gap-3">
                    <span className="w-12 text-xs font-semibold text-secondary">{party.abbreviation}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-subtle">
                      <div
                        className="h-full rounded-sm transition-all duration-500"
                        style={{
                          width: `${Math.min(((c.avgPct ?? 0) / 30) * 100, 100)}%`,
                          backgroundColor: party.color,
                        }}
                      />
                    </div>
                    <span className="w-14 text-right text-xs font-bold text-ink tabular-nums">
                      {(c.avgPct ?? 0).toFixed(1)}%
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
