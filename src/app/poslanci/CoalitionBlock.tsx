import { PartySection } from "./PartySection";
import type { PartyGroup } from "@/lib/db/mps-grouped";
import { TOTAL_SEATS } from "@/lib/coalition";

interface Props {
  label: string;
  groups: PartyGroup[];
  inverted?: boolean;
}

export function CoalitionBlock({ label, groups, inverted = false }: Props) {
  if (groups.length === 0) return null;
  const total = groups.reduce((s, g) => s + g.stats.count, 0);
  const pct = Math.round((total / TOTAL_SEATS) * 100);

  return (
    <div className="mb-8">
      <div
        className={`flex items-baseline justify-between px-4 py-3 mb-3 ${
          inverted
            ? "bg-ink text-white border border-ink"
            : "bg-card text-ink border border-ink"
        }`}
      >
        <h2
          className="text-sm font-bold uppercase tracking-[0.15em] font-mono"
          style={{ color: "inherit" }}
        >
          {label}
        </h2>
        <span className="text-xs font-mono">
          {total} / {TOTAL_SEATS} ({pct}%)
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <PartySection key={g.party.id} group={g} />
        ))}
      </div>
    </div>
  );
}
