"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type { TooltipContentProps } from "recharts";

interface Party {
  id: string;
  abbreviation: string;
  color: string;
}

interface PollTrendChartProps {
  data: Record<string, string | number>[];
  parties: Party[];
}

function CustomTooltip({
  active,
  payload,
  label,
  parties,
}: TooltipContentProps & { parties: Party[] }) {
  if (!active || !payload?.length) return null;

  const sortedPayload = [...payload]
    .filter((entry) => Number.isFinite(Number(entry.value)))
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

  return (
    <div
      className="min-w-[190px] border px-3 py-3 shadow-[0_14px_30px_rgba(17,17,16,0.18)]"
      style={{
        borderRadius: 0,
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-strong)",
        boxShadow:
          "0 0 0 6px var(--bg-page), 0 14px 30px rgba(17,17,16,0.18)",
      }}
    >
      <p className="mb-2 text-sm font-semibold text-ink">{String(label)}</p>
      <ul className="space-y-1.5">
        {sortedPayload.map((entry, index) => {
          const value = Number(entry.value);
          const party = parties.find((item) => item.id === entry.dataKey);
          const isTopThree = index < 3;

          return (
            <li
              key={String(entry.dataKey)}
              className="flex items-center justify-between gap-3 text-sm"
              style={{
                opacity: isTopThree ? 1 : 0.72,
                fontWeight: isTopThree ? 700 : 500,
              }}
            >
              <span className="flex items-center gap-2 text-ink">
                <span
                  className="shrink-0 rounded-full"
                  style={{
                    backgroundColor: party?.color ?? entry.color ?? "var(--ink)",
                    width: isTopThree ? 11 : 9,
                    height: isTopThree ? 11 : 9,
                    boxShadow: isTopThree ? "0 0 0 2px rgba(255,255,255,0.9)" : "none",
                  }}
                />
                <span>{party?.abbreviation ?? String(entry.name ?? entry.dataKey)}</span>
              </span>
              <span className="tabular-nums text-ink">{value.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function PollTrendChart({ data, parties }: PollTrendChartProps) {
  const visibleParties = parties.filter((p) =>
    data.some((d) => typeof d[p.id] === "number" && (d[p.id] as number) > 0)
  );

  return (
    <div className="w-full max-w-[980px] mx-auto aspect-[4/3] min-h-[300px] max-h-[560px] sm:aspect-[16/10] lg:aspect-[16/9]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--text)" }}
            tickLine={{ stroke: "var(--divider)" }}
            axisLine={{ stroke: "var(--divider)" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text)" }}
            tickFormatter={(v: number) => `${v}%`}
            domain={[0, "auto"]}
            tickLine={{ stroke: "var(--divider)" }}
            axisLine={{ stroke: "var(--divider)" }}
          />
          <Tooltip
            itemSorter={(item) => -(Number(item.value) || 0)}
            content={(props) => <CustomTooltip {...props} parties={parties} />}
            cursor={{ stroke: "rgba(17,17,16,0.18)", strokeWidth: 1 }}
            wrapperStyle={{ outline: "none", zIndex: 20 }}
          />
          <Legend
            content={() => (
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2" style={{ fontSize: "12px", color: "var(--text)" }}>
                {visibleParties.map((party) => (
                  <li key={party.id} className="flex items-center gap-1">
                    <svg width="14" height="10"><line x1="0" y1="5" x2="14" y2="5" stroke={party.color} strokeWidth="2" /></svg>
                    <span>{party.abbreviation}</span>
                  </li>
                ))}
              </ul>
            )}
          />
          <ReferenceLine
            y={5}
            stroke="var(--text)"
            strokeDasharray="6 3"
            strokeOpacity={0.4}
            label={{ value: "5%", position: "right", fill: "var(--text)", fontSize: 11 }}
          />
          {visibleParties.map((party) => (
            <Line
              key={party.id}
              type="monotone"
              dataKey={party.id}
              stroke={party.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
