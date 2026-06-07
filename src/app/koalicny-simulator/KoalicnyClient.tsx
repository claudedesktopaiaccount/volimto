"use client";

import { useState } from "react";
import { PARTIES, PARTY_LIST } from "@/lib/parties";
import { allocateSeats } from "@/lib/prediction/dhondt";
import Hemicycle from "@/components/charts/Hemicycle";

const MAJORITY = 76;

const PRESETS = [
  { label: "Najpravdepodobnejšia", parties: ["ps", "demokrati", "kdh", "sas"] },
  { label: "Koalícia SMER", parties: ["smer-sd", "hlas-sd", "sns"] },
  { label: "Široká opozícia", parties: ["ps", "demokrati", "kdh", "sas", "slovensko"] },
] as const;

function getInitialSelected(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const params = new URLSearchParams(window.location.search);
  const partiesParam = params.get("parties");
  if (partiesParam) {
    return new Set(partiesParam.split(",").filter((id) => id in PARTIES));
  }
  return new Set();
}

interface KoalicnyClientProps {
  pollResults: { partyId: string; percentage: number }[];
}

export default function KoalicnyClient({ pollResults }: KoalicnyClientProps) {
  const [selected, setSelected] = useState<Set<string>>(getInitialSelected);

  const shareUrl =
    typeof window !== "undefined"
      ? selected.size > 0
        ? `${window.location.origin}/koalicny-simulator?parties=${[...selected].join(",")}`
        : `${window.location.origin}/koalicny-simulator`
      : "";

  const allSeats = allocateSeats(pollResults);

  const seatMap: Record<string, number> = {};
  allSeats.forEach((s) => (seatMap[s.partyId] = s.seats));

  const coalitionSeats = Array.from(selected).reduce(
    (sum, id) => sum + (seatMap[id] ?? 0),
    0
  );
  const hasMajority = coalitionSeats >= MAJORITY;
  const inParliament = allSeats.map((s) => s.partyId);

  function toggleParty(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyPreset(partyIds: readonly string[]) {
    setSelected(new Set(partyIds.filter((id) => inParliament.includes(id))));
  }

  function handleCopyUrl() {
    navigator.clipboard?.writeText(shareUrl);
  }

  return (
    <div className="max-w-content mx-auto px-6 py-8">
      <div className="bg-card border border-border rounded-[12px] overflow-hidden">

        {/* Arc area: seat count + hemicycle */}
        <div className="flex gap-6 p-6 pb-0">
          {/* Left col: seat count */}
          <div className="w-[160px] shrink-0">
            <p className="text-[11px] text-xfaint uppercase tracking-[0.1em] mb-2">
              ZLOŽENIE PARLAMENTU
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-[40px] font-extrabold text-ink leading-none">
                {coalitionSeats}
              </span>
              <span className="text-[20px] text-xfaint">/{MAJORITY}</span>
            </div>
            <div
              className="mt-2 text-[13px] font-semibold"
              style={{ color: hasMajority ? "#16a34a" : "#dc2626" }}
            >
              {selected.size === 0
                ? "\u00a0"
                : hasMajority
                  ? "✓ Väčšina"
                  : `${MAJORITY - coalitionSeats} chýba`}
            </div>
          </div>

          {/* Right: SVG arc */}
          <div className="flex-1 w-full max-w-md">
            <Hemicycle seats={allSeats} selectedParties={selected} />
          </div>
        </div>

        {/* Share row */}
        <div className="flex items-center gap-2 px-6 py-3 border-t border-border mt-4 flex-wrap">
          <span className="text-[11px] text-muted uppercase tracking-[0.08em] font-semibold mr-2">
            ZDIEĽAŤ
          </span>
          {["Facebook", "X", "LinkedIn"].map((btn) => (
            <button
              key={btn}
              className="px-3 py-1.5 text-[12px] font-medium text-secondary bg-page border border-border rounded-md hover:border-border-strong transition-colors"
            >
              {btn}
            </button>
          ))}
          <button
            onClick={handleCopyUrl}
            className="px-3 py-1.5 text-[12px] font-medium text-secondary bg-page border border-border rounded-md hover:border-border-strong transition-colors"
          >
            Kopírovať odkaz
          </button>
        </div>

        {/* Preset pills row */}
        <div className="flex gap-2 px-6 py-3 border-t border-border flex-wrap">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.parties)}
              className="px-4 py-1.5 text-[13px] font-medium text-ink border border-border-strong rounded-[20px] hover:bg-subtle transition-colors"
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            className="px-4 py-1.5 text-[13px] font-medium text-muted border border-border rounded-[20px] hover:bg-subtle transition-colors"
          >
            Zmazať výber
          </button>
        </div>

        {/* Party table */}
        <table className="w-full border-t border-border" role="group" aria-label="Výber strán pre koalíciu">
          <thead>
            <tr className="text-[11px] text-muted uppercase tracking-[0.08em]">
              <th className="px-6 py-3 text-left w-10"></th>
              <th className="px-2 py-3 text-left">STRANA</th>
              <th className="px-4 py-3 text-right">%</th>
              <th className="px-6 py-3 text-right">MANDÁTY</th>
            </tr>
          </thead>
          <tbody>
            {PARTY_LIST.map((party) => {
              const seats = seatMap[party.id] ?? 0;
              const isSelected = selected.has(party.id);
              const isInParliament = inParliament.includes(party.id);
              const pct = pollResults.find((p) => p.partyId === party.id)?.percentage ?? 0;

              return (
                <tr
                  key={party.id}
                  onClick={() => isInParliament && toggleParty(party.id)}
                  className={`border-t border-border transition-colors ${
                    !isInParliament
                      ? "opacity-40 cursor-not-allowed"
                      : "cursor-pointer"
                  } ${isSelected ? "bg-[#f0f7ff]" : isInParliament ? "hover:bg-page" : ""}`}
                >
                  <td className="px-6 py-3">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? "Odobrať" : "Pridať"} ${party.name} do koalície`}
                      disabled={!isInParliament}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isInParliament) toggleParty(party.id);
                      }}
                      className="flex h-[18px] w-[18px] items-center justify-center rounded-[3px] border-2 transition-colors disabled:cursor-not-allowed"
                      style={{
                        borderColor: isSelected ? (party.color ?? "#1a6eb5") : "#d0cbc3",
                        background: isSelected ? (party.color ?? "#1a6eb5") : "transparent",
                      }}
                    >
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-3 text-[14px] font-medium text-ink">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-[2px] shrink-0"
                        style={{ background: party.color ?? "#aaa" }}
                      />
                      {party.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-right text-secondary">
                    {pct.toFixed(1)}%
                  </td>
                  <td className="px-6 py-3 text-[14px] font-semibold text-right text-ink">
                    {seats}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

      </div>
    </div>
  );
}
