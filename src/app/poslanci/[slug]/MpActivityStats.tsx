import type { MpActivityStats } from "@/lib/db/mps";

interface Props {
  stats: MpActivityStats;
}

const ITEMS: { key: keyof MpActivityStats; label: string; suffix?: string }[] = [
  { key: "voteCount", label: "Hlasovaní" },
  { key: "attendancePct", label: "Účasť", suffix: "%" },
  { key: "speechCount", label: "Vystúpení" },
  { key: "interpellationCount", label: "Interpelácií" },
  { key: "questionCount", label: "Otázok" },
  { key: "legislationCount", label: "Legislatíva" },
  { key: "amendmentCount", label: "Pozmeňováky" },
  { key: "tripCount", label: "Cesty" },
];

export default function MpActivityStrip({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-border bg-card mb-6 divide-x divide-y sm:divide-y-0 divide-border">
      {ITEMS.map((it) => {
        const value = stats[it.key];
        return (
          <div key={it.key} className="p-3 flex flex-col gap-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted leading-none">
              {it.label}
            </span>
            <span className="text-lg font-bold text-ink leading-tight">
              {value}
              {it.suffix ?? ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
