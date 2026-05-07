interface PollParty {
  partyId: string;
  name: string;
  percentage: number;
  color: string;
  trend?: number;
  abbreviation?: string;
}

interface PollStripProps {
  parties: PollParty[];
  agency: string;
  date: string;
}

export default function PollStrip({ parties, agency, date }: PollStripProps) {
  const sorted = parties
    .filter((p) => p.percentage >= 5)
    .sort((a, b) => b.percentage - a.percentage);

  if (sorted.length === 0) return null;

  const max = sorted[0].percentage;

  const formatTrend = (t?: number) => {
    if (t === undefined || t === 0) return null;
    const sign = t > 0 ? "+" : "";
    return `${sign}${t.toFixed(1)}`;
  };

  return (
    <section className="bg-card border-b border-border">
      <div className="max-w-content mx-auto px-6 py-8">
        <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-xfaint tracking-[0.14em] font-semibold uppercase">
              Posledný dostupný prieskum
            </span>
            <span className="text-[11px] text-faint">
              {agency} · zverejnené {date}
            </span>
          </div>
          <a
            href="/prieskumy"
            className="text-[12px] font-semibold text-accent tracking-wide"
          >
            Všetky strany →
          </a>
        </div>

        <div className="flex flex-col">
          {sorted.map((p, i) => {
            const width = (p.percentage / max) * 100;
            const trendStr = formatTrend(p.trend);
            const trendColor =
              (p.trend ?? 0) > 0
                ? "#16a34a"
                : (p.trend ?? 0) < 0
                  ? "#dc2626"
                  : "#888";
            const isLeader = i === 0;
            return (
              <div
                key={p.partyId}
                className={`grid items-center gap-x-4 py-3 ${
                  i < sorted.length - 1 ? "border-b border-border/60" : ""
                }`}
                style={{ gridTemplateColumns: "96px minmax(0, 1fr) 72px 72px" }}
              >
                <div className="flex w-[96px] min-w-[96px] items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 shrink-0"
                    style={{ background: p.color }}
                  />
                  <span
                    className={`tracking-wide text-ink ${isLeader ? "text-[14px] font-bold" : "text-[12px] font-bold"}`}
                  >
                    {p.abbreviation ?? p.partyId}
                  </span>
                </div>

                <div className="relative min-w-0">
                  <div
                    className="bg-border/30"
                    style={{ height: isLeader ? "28px" : "20px" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${width}%`,
                        background: p.color,
                      }}
                    />
                  </div>
                </div>

                <div className="w-[72px] shrink-0 text-right">
                  <span
                    className={`font-bold text-ink tabular-nums ${isLeader ? "text-[20px]" : "text-[15px]"}`}
                  >
                    {p.percentage.toFixed(1)}%
                  </span>
                </div>

                <div className="w-[72px] shrink-0 text-right">
                  <span
                    className="text-[11px] font-mono font-semibold tabular-nums"
                    style={{ color: trendStr ? trendColor : "#bbb" }}
                  >
                    {trendStr ? `${trendStr} pp` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
