"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { PARTY_LIST } from "@/lib/parties";
import ShareButtons from "@/components/ShareButtons";
import { useAuth } from "@/components/AuthProvider";
import Panel from "@/components/ui/Panel";
import { cn } from "@/lib/utils";

interface Props {
  selectedWinner: string | null;
  setSelectedWinner: (id: string) => void;
  submitted: boolean;
  submitting: boolean;
  alreadyVotedParty: string | null;
  showAdvanced: boolean;
  setShowAdvanced: (value: boolean) => void;
  predictedPcts: Record<string, string>;
  setPredictedPcts: Dispatch<SetStateAction<Record<string, string>>>;
  coalitionPickSet: Set<string>;
  toggleCoalitionPick: (id: string) => void;
  onSubmit: () => void;
}

export default function VotingPanel({
  selectedWinner,
  setSelectedWinner,
  submitted,
  submitting,
  alreadyVotedParty,
  showAdvanced,
  setShowAdvanced,
  predictedPcts,
  setPredictedPcts,
  coalitionPickSet,
  toggleCoalitionPick,
  onSubmit,
}: Props) {
  const { user } = useAuth();
  const selectedParty = selectedWinner ? PARTY_LIST.find((party) => party.id === selectedWinner) : null;

  return (
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
                    isSelected ? "border-2" : "border",
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
                    <svg className="h-4 w-4 shrink-0" style={{ color: party.color }} fill="currentColor" viewBox="0 0 20 20">
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
                onClick={onSubmit}
                disabled={submitting}
                className="w-full rounded-btn py-2.5 text-sm font-semibold text-paper transition-colors disabled:opacity-50"
                style={{
                  background: selectedParty?.color ?? "var(--btn-primary-bg)",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Odosielam..." : "Odoslať tip"}
              </button>

              <div className="mt-3">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-caption text-muted underline transition-colors hover:text-ink"
                >
                  {showAdvanced ? "Skryť rozšírené tipovanie" : "Rozšírené tipovanie (percentá, koalícia)"}
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg border border-border p-4">
                      <h4 className="mb-3 text-label text-secondary">Tipnite percentá strán</h4>
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
                              placeholder="-"
                              value={predictedPcts[party.id] ?? ""}
                              onChange={(event) =>
                                setPredictedPcts((prev) => ({
                                  ...prev,
                                  [party.id]: event.target.value,
                                }))
                              }
                              className="w-16 rounded-sm border border-border bg-transparent px-2 py-1 text-right text-caption tabular-nums focus:border-ink focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border p-4">
                      <h4 className="mb-3 text-label text-secondary">Tipnite koalíciu</h4>
                      <div className="flex flex-wrap gap-2">
                        {PARTY_LIST.map((party) => {
                          const isInCoalition = coalitionPickSet.has(party.id);
                          return (
                            <button
                              key={party.id}
                              onClick={() => toggleCoalitionPick(party.id)}
                              className={cn(
                                "rounded-md border px-3 py-1.5 text-caption transition-colors",
                                isInCoalition ? "font-semibold" : "font-normal",
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
                      {coalitionPickSet.size > 0 && (
                        <p className="mt-2 text-caption text-faint">
                          {coalitionPickSet.size}{" "}
                          {coalitionPickSet.size === 1 ? "strana" : coalitionPickSet.size < 5 ? "strany" : "strán"}
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
        <div>
          <div className="mt-4 flex items-center justify-between rounded-btn border border-success-border bg-success-bg p-3 text-body-sm text-success">
            <span>{alreadyVotedParty ? "Už ste tipovali." : "Váš tip bol zaznamenaný."}</span>
          </div>
          <div className="mt-4 text-center">
            <p className="text-body-sm text-secondary">
              Tipujete výhru: <strong style={{ color: selectedParty?.color }}>{selectedParty?.name}</strong>
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
            <Link href="/tipovanie/rebricek" className="mt-3 inline-block text-xs text-muted underline hover:text-ink">
              Pozrite si rebríček predpovedí →
            </Link>
          </div>
        </div>
      )}
    </Panel>
  );
}
