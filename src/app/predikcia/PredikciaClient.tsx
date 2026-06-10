"use client";

import { PARTIES } from "@/lib/parties";
import ShareButtons from "@/components/ShareButtons";
import MethodologyAccordion from "@/components/predikcia/MethodologyAccordion";
import PoslanciSection from "@/components/predikcia/PoslanciSection";
import type { SimulationResult } from "@/lib/prediction/monte-carlo";
import type { SeatAllocation } from "@/lib/prediction/dhondt";
import type { CandidateWithParty } from "@/lib/candidate-types";

interface PredikciaClientProps {
  simulation: SimulationResult[];
  currentSeats: SeatAllocation[];
  narrative: string | null;
  newestPollDate: string;
  pollCount: number;
  candidates: CandidateWithParty[];
}

export default function PredikciaClient({
  simulation,
  currentSeats,
  narrative,
  newestPollDate,
  pollCount,
  candidates,
}: PredikciaClientProps) {
  const seatMap: Record<string, number> = {};
  currentSeats.forEach((s) => (seatMap[s.partyId] = s.seats));

  const sorted = [...simulation].sort((a, b) => b.winProbability - a.winProbability);
  const winner = sorted[0];
  const winnerParty = winner ? PARTIES[winner.partyId] : null;

  return (
    <>
      {/* AI narrative */}
      {narrative && (
        <div className="mb-6 pl-4 border-l-[3px] border-accent">
          <p className="font-serif italic text-base text-ink leading-relaxed">{narrative}</p>
        </div>
      )}

      {/* 2-col: result left, methodology right */}
      <div
        className="grid gap-5 mb-8 items-start"
        style={{ gridTemplateColumns: "1fr 320px" }}
      >
        {/* ── LEFT: Result ── */}
        <div className="flex flex-col gap-3">
          {/* Winner card */}
          {winner && winnerParty && (
            <div
              className="bg-card border border-border rounded-lg p-4 flex items-center gap-4"
              style={{ borderLeft: `4px solid ${winnerParty.color}` }}
            >
              <div className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] bg-subtle border border-border px-2 py-0.5 rounded-[3px] flex-shrink-0">
                #1 · Víťaz
              </div>
              <div
                className="text-[20px] font-black flex-1"
                style={{ letterSpacing: "-0.5px", color: winnerParty.color }}
              >
                {winnerParty.name}
              </div>
              <div className="text-right flex-shrink-0">
                <div
                  className="text-[24px] font-black"
                  style={{ letterSpacing: "-1px", color: winnerParty.color }}
                >
                  {winner.meanPct.toFixed(1)}%
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {seatMap[winner.partyId] ?? 0} mandátov · {(winner.winProbability * 100).toFixed(0)} % šanca
                </div>
              </div>
            </div>
          )}

          {/* Party rows */}
          <div className="flex flex-col gap-1.5">
            {sorted.map((result) => {
              const party = PARTIES[result.partyId];
              const seats = seatMap[result.partyId] ?? 0;
              const inParliament = result.parliamentProbability > 0.5;
              const barWidth = Math.min((result.meanPct / 35) * 100, 100);
              const parliamentParties = sorted.filter(s => s.parliamentProbability > 0.5);
              const rank = parliamentParties.indexOf(result) + 1;

              return (
                <div
                  key={result.partyId}
                  className={`bg-card border border-border rounded-lg overflow-hidden flex items-center ${!inParliament ? "opacity-40" : ""}`}
                >
                  <div className="w-1 self-stretch flex-shrink-0" style={{ background: party?.color }} />
                  <div className="flex-1 px-3 py-2.5 flex items-center gap-2.5">
                    <span className="text-[11px] text-faint font-bold w-3.5 flex-shrink-0">
                      {inParliament ? rank : "—"}
                    </span>
                    <span className="text-[13px] font-bold text-ink flex-1 min-w-0 truncate">
                      {party?.abbreviation ?? party?.name}
                    </span>
                    <div className="flex-[2] h-[5px] bg-subtle rounded-full overflow-hidden relative">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${barWidth}%`, background: party?.color }}
                      />
                    </div>
                    <span
                      className="text-[13px] font-extrabold w-10 text-right tabular-nums flex-shrink-0"
                      style={{ color: party?.color }}
                    >
                      {result.meanPct.toFixed(1)}%
                    </span>
                    <span className="text-[11px] text-muted w-12 text-right flex-shrink-0">
                      {seats > 0 ? `${seats} m.` : "—"}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-[10px] flex-shrink-0"
                      style={
                        inParliament
                          ? { background: "#dcfce7", color: "#16a34a" }
                          : { background: "#fee2e2", color: "#dc2626" }
                      }
                    >
                      {inParliament ? "V parlamente" : "Pod prahom"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Confidence note */}
          <div className="bg-subtle border border-border rounded-md px-3.5 py-2.5 text-[12px] text-secondary leading-[1.65]">
            <strong className="text-ink font-semibold">Ako čítať percentá:</strong>{" "}
            Čísla sú priemery naprieč 10 000 simulovanými voľbami. Skutočný výsledok bude s 90 % pravdepodobnosťou v intervale uvedenom v detailnej tabuľke nižšie.
          </div>

          <div className="text-[11px] text-faint leading-[1.7]">
            Na základe {pollCount} prieskum{pollCount === 1 ? "u" : "ov"}{newestPollDate ? ` · posledný ${newestPollDate}` : ""} · interval spoľahlivosti 90. percentil · mandáty metódou D&apos;Hondt · 5 % prah
          </div>

          <ShareButtons
            url={typeof window !== "undefined" ? window.location.href : "/predikcia"}
            title="Predikcia volieb | VolímTo"
            description="Monte Carlo predikcia výsledkov slovenských parlamentných volieb."
          />
        </div>

        {/* ── RIGHT: Methodology (sticky) ── */}
        <div className="sticky top-[68px]">
          <MethodologyAccordion />
        </div>
      </div>

      {/* Full-width: Poslanci */}
      <PoslanciSection candidates={candidates} currentSeats={currentSeats} />
    </>
  );
}
