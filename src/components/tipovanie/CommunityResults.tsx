import { PARTIES } from "@/lib/parties";
import Badge from "@/components/ui/Badge";
import Panel from "@/components/ui/Panel";

export interface CrowdData {
  partyId: string;
  totalBets: number;
  avgPct?: number;
}

interface Props {
  crowdData: CrowdData[];
  totalBets: number;
  submitted: boolean;
  selectedWinner: string | null;
}

export default function CommunityResults({ crowdData, totalBets, submitted, selectedWinner }: Props) {
  const sortedCrowd = [...crowdData].sort((a, b) => b.totalBets - a.totalBets);

  return (
    <Panel>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-secondary">Hlas ľudu</h2>
        {totalBets > 0 && (
          <span className="text-caption text-faint tabular-nums">
            {totalBets.toLocaleString("sk-SK")} tipov
          </span>
        )}
      </div>

      {totalBets === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
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
  );
}
