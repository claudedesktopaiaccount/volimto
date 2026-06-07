import type { LatestPollData } from "@/lib/poll-data";

interface TickerBarProps {
  parties: LatestPollData[];
  agency: string;
  date: string;
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(1)}`;
  if (delta < 0) return `${delta.toFixed(1)}`;
  return "0.0";
}

function getDeltaClass(delta: number): string {
  if (delta > 0) return "delta-positive";
  if (delta < 0) return "delta-negative";
  return "delta-neutral";
}

function TickerBar({ parties, agency, date }: TickerBarProps) {
  return (
    <div className="bg-[#111] text-[#ccc] px-4 py-2 overflow-x-auto whitespace-nowrap border-b border-divider">
      <div className="flex items-center gap-6 font-mono text-xs">
        {parties.slice(0, 8).map((p) => (
          <span key={p.partyId} className="flex items-center gap-1.5">
            <span className="font-semibold text-white">{p.abbreviation}</span>
            <span className="data-value">{p.percentage.toFixed(1)}%</span>
            <span className={getDeltaClass(p.trend)}>
              {p.trend > 0 ? "▲" : p.trend < 0 ? "▼" : "—"}
              {formatDelta(p.trend)}
            </span>
          </span>
        ))}
        <span className="ml-auto text-[10px] opacity-50 flex items-center gap-1.5">
          <span className="pulse-dot" />
          {agency} · {date}
        </span>
      </div>
    </div>
  );
}

export { formatDelta, getDeltaClass };
