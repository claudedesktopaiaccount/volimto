import Link from "next/link";
import { MpCard } from "./MpCard";
import type { PartyGroup } from "@/lib/db/mps-grouped";
import { TOTAL_SEATS } from "@/lib/coalition";

export function PartySection({ group }: { group: PartyGroup }) {
  const { party, mps, stats } = group;
  const pct = Math.round((stats.count / TOTAL_SEATS) * 100);

  return (
    <section className="border border-border bg-card">
      {/* Sticky party header */}
      <header
        className="sticky top-0 z-10 bg-card border-b border-border"
        style={{ borderTopWidth: 4, borderTopColor: party.color, borderTopStyle: "solid" }}
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
          <span
            className="px-2 py-0.5 text-xs font-bold text-white font-mono"
            style={{ backgroundColor: party.color }}
          >
            {party.abbreviation}
          </span>
          <Link
            href={`/strany/${party.id}`}
            className="text-base font-serif text-ink hover:underline"
          >
            {party.name}
          </Link>
          {party.leader && (
            <span className="text-xs text-muted">{party.leader}</span>
          )}
          <span className="ml-auto text-[11px] font-mono text-muted uppercase tracking-wide">
            {stats.count} kresiel
            {stats.avgAge != null ? ` · ⌀ ${stats.avgAge}` : ""}
            {stats.ministerCount > 0 ? ` · ${stats.ministerCount} ministrov` : ""}
          </span>
        </div>
        {/* Seat bar */}
        <div className="h-[2px] bg-surface">
          <div
            className="h-full"
            style={{ width: `${pct}%`, backgroundColor: party.color }}
          />
        </div>
      </header>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {mps.map((mp) => (
          <MpCard key={mp.id} mp={mp} compact />
        ))}
      </div>
    </section>
  );
}
