"use client";

import { useState } from "react";
import { PARTIES } from "@/lib/parties";
import type { CandidateWithParty } from "@/lib/candidate-types";
import type { SeatAllocation } from "@/lib/prediction/dhondt";

interface PoslanciSectionProps {
  candidates: CandidateWithParty[];
  currentSeats: SeatAllocation[];
}

export default function PoslanciSection({ candidates, currentSeats }: PoslanciSectionProps) {
  const [activeParty, setActiveParty] = useState<string>("all");

  // Build seat map
  const seatMap: Record<string, number> = {};
  currentSeats.forEach((s) => { seatMap[s.partyId] = s.seats; });

  // Only parties with seats, ordered by seat count desc
  const partiesWithSeats = currentSeats
    .filter((s) => s.seats > 0)
    .sort((a, b) => b.seats - a.seats);

  // Group candidates by party, slice to seat count
  const grouped: Record<string, CandidateWithParty[]> = {};
  partiesWithSeats.forEach(({ partyId, seats }) => {
    grouped[partyId] = candidates
      .filter((c) => c.partyId === partyId)
      .sort((a, b) => a.listRank - b.listRank)
      .slice(0, seats);
  });

  const totalSeats = partiesWithSeats.reduce((s, p) => s + p.seats, 0);

  const displayParties = activeParty === "all"
    ? partiesWithSeats.map((p) => p.partyId)
    : [activeParty];

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-extrabold text-ink" style={{ letterSpacing: "-0.4px" }}>
            Predpokladaní poslanci
          </h2>
          <p className="text-[11px] text-muted mt-0.5">
            Na základe posledných kandidátnych listín · zoradení podľa poradia
          </p>
        </div>
        <span className="text-[11px] text-faint">{totalSeats} mandátov · {partiesWithSeats.length} strán</span>
      </div>

      {/* Seat composition bar */}
      <div className="bg-card border border-border rounded-lg p-3 mb-4 flex items-center gap-4 flex-wrap">
        <span className="text-[13px] text-secondary flex-shrink-0">
          Celkom <strong className="text-[16px] font-black text-ink">{totalSeats}</strong> mandátov
        </span>
        <div className="flex-1 min-w-[120px] h-2.5 bg-subtle rounded-full overflow-hidden flex">
          {partiesWithSeats.map(({ partyId, seats }) => {
            const party = PARTIES[partyId];
            return (
              <div
                key={partyId}
                style={{ width: `${(seats / totalSeats) * 100}%`, background: party?.color }}
                title={`${party?.abbreviation} ${seats}`}
              />
            );
          })}
        </div>
        <div className="flex gap-3 flex-wrap flex-shrink-0">
          {partiesWithSeats.map(({ partyId, seats }) => {
            const party = PARTIES[partyId];
            return (
              <div key={partyId} className="flex items-center gap-1 text-[10px] text-muted">
                <div className="w-2 h-2 rounded-[2px]" style={{ background: party?.color }} />
                {party?.abbreviation} {seats}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button
          onClick={() => setActiveParty("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] border text-[12px] font-semibold transition-colors ${
            activeParty === "all"
              ? "border-ink text-ink bg-card"
              : "border-border text-muted bg-card hover:border-border-strong hover:text-ink"
          }`}
        >
          Všetci <span className="text-[10px] opacity-60">{totalSeats}</span>
        </button>
        {partiesWithSeats.map(({ partyId, seats }) => {
          const party = PARTIES[partyId];
          return (
            <button
              key={partyId}
              onClick={() => setActiveParty(partyId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] border text-[12px] font-semibold transition-colors ${
                activeParty === partyId
                  ? "border-ink text-ink bg-card"
                  : "border-border text-muted bg-card hover:border-border-strong hover:text-ink"
              }`}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: party?.color }} />
              {party?.abbreviation}
              <span className="text-[10px] opacity-60">{seats}</span>
            </button>
          );
        })}
      </div>

      {/* Party blocks */}
      <div className="flex flex-col gap-4">
        {displayParties.map((partyId) => {
          const party = PARTIES[partyId];
          const seats = seatMap[partyId] ?? 0;
          const partyCandidates = grouped[partyId] ?? [];
          if (!party || partyCandidates.length === 0) return null;

          return (
            <div key={partyId} className="border border-border rounded-lg overflow-hidden">
              {/* Party header */}
              <div
                className="flex items-center gap-3 px-4 py-2.5 border-b border-border"
                style={{ background: party.color + "0d" }}
              >
                <div className="w-3 h-3 rounded-[3px]" style={{ background: party.color }} />
                <span className="text-[13px] font-bold" style={{ color: party.color }}>
                  {party.name}
                </span>
                <span className="ml-auto text-[11px] text-muted">{seats} mandátov</span>
              </div>

              {/* Candidate rows */}
              <div className="bg-card divide-y divide-border">
                {partyCandidates.map((candidate) => (
                  <CandidateRow key={candidate.id} candidate={candidate} partyColor={party.color} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  partyColor,
}: {
  candidate: CandidateWithParty;
  partyColor: string;
}) {
  const initials = candidate.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-0 hover:bg-page transition-colors">
      {/* Party color stripe */}
      <div className="w-[3px] self-stretch flex-shrink-0" style={{ background: partyColor }} />

      {/* Rank */}
      <div className="w-8 text-center text-[11px] font-bold text-faint flex-shrink-0 font-[tabular-nums]">
        {candidate.listRank}
      </div>

      {/* Portrait */}
      <div
        className="w-9 h-9 rounded-full flex-shrink-0 my-1.5 mx-2 overflow-hidden border border-border flex items-center justify-center text-[11px] font-bold"
        style={
          candidate.portraitUrl
            ? {}
            : { background: partyColor + "20", color: partyColor }
        }
      >
        {candidate.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.portraitUrl}
            alt={candidate.name}
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-2">
        <div className="text-[13px] font-bold text-ink truncate">{candidate.name}</div>
        {candidate.role && (
          <div className="text-[11px] text-muted truncate">{candidate.role}</div>
        )}
      </div>
    </div>
  );
}
