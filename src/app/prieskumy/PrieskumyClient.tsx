"use client";

import { Fragment, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { buildPollCsv } from "./export-csv";
import Panel from "@/components/ui/Panel";
import { DataTable, DataTd, DataTh } from "@/components/ui/DataTable";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PollTrendChart = dynamic(
  () => import("@/components/charts/PollTrendChart"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[300px] sm:h-[400px] lg:h-[500px] bg-surface animate-pulse flex items-center justify-center">
        <span className="text-xs text-text/40">Načítavam graf…</span>
      </div>
    ),
  }
);

interface PartyBar {
  id: string;
  abbreviation: string;
  color: string;
  percentage: number;
  trend: number;
}

interface Agency {
  name: string;
  results: Record<string, number>;
}

interface PartyMeta {
  id: string;
  abbreviation: string;
  color: string;
}

interface PrieskumyClientProps {
  chartData: Record<string, string | number>[];
  partyBars: PartyBar[];
  agencies: Agency[];
  partyMeta: PartyMeta[];
}

const TIME_RANGES = [
  { label: "6 mesiacov", months: 6 },
  { label: "1 rok", months: 12 },
  { label: "Všetko", months: 0 },
] as const;

function formatMiniChartDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.`;
}

function getMiniChartDomain(values: number[]) {
  if (values.length === 0) return [0, 10] as const;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1.5);
  const padding = Math.max(spread * 0.35, 0.8);

  return [
    Math.max(0, Math.floor((min - padding) * 2) / 2),
    Math.ceil((max + padding) * 2) / 2,
  ] as const;
}

export default function PrieskumyClient({
  chartData,
  partyBars,
  agencies,
  partyMeta,
}: PrieskumyClientProps) {
  const allAgencyNames = useMemo(
    () => [...new Set(chartData.map((d) => String(d.agency)))],
    [chartData]
  );

  const [selectedAgencies, setSelectedAgencies] = useState<Set<string>>(
    new Set(allAgencyNames)
  );
  const [timeRange, setTimeRange] = useState(12);
  const [showTable, setShowTable] = useState(false);
  const [viewMode, setViewMode] = useState<"polls" | "model" | "crowd">("polls");
  const [expandedParty, setExpandedParty] = useState<string | null>(null);

  const toggleAgency = (name: string) => {
    setSelectedAgencies((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filteredData = useMemo(() => {
    let data = chartData.filter((d) => selectedAgencies.has(String(d.agency)));
    if (timeRange > 0) {
      data = data.slice(-timeRange * 3);
    }
    return data;
  }, [chartData, selectedAgencies, timeRange]);

  // Build per-party history from chartData for drill-down mini charts
  const partyHistory = useMemo(() => {
    const map: Record<string, { date: string; value: number }[]> = {};
    for (const party of partyBars) {
      map[party.id] = filteredData
        .filter((d) => d[party.id] !== undefined)
        .map((d) => ({ date: String(d.date), value: Number(d[party.id]) }));
    }
    return map;
  }, [filteredData, partyBars]);

  const exportCSV = () => {
    const csv = buildPollCsv(filteredData, partyBars);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prieskumy.csv";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="max-w-content mx-auto px-6 pt-4 pb-8 md:pt-5">
      <div className="flex gap-10">
        {/* Sidebar 160px */}
        <aside className="w-[160px] shrink-0 sticky top-[76px] self-start">
          <div className="mb-6">
            <p className="mb-2 text-label text-muted">
              AGENTÚRY
            </p>
            <div className="space-y-2">
              {allAgencyNames.map((name) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer text-sm text-text hover:text-ink">
                  <input
                    type="checkbox"
                    checked={selectedAgencies.has(name)}
                    onChange={() => toggleAgency(name)}
                    className="accent-ink w-4 h-4"
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="mb-2 mt-5 text-label text-muted">
              ČASOVÉ OBDOBIE
            </p>
            <div>
              {TIME_RANGES.map((range) => (
                <button
                  key={range.months}
                  onClick={() => setTimeRange(range.months)}
                  className={cn(
                    "mb-1 w-full rounded-md px-3 py-2 text-left text-body-sm font-medium transition-colors",
                    timeRange === range.months
                      ? "bg-ink text-paper"
                      : "text-secondary hover:bg-subtle"
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 text-sm text-text/60 hover:text-ink transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Tabs — underline style */}
          <div className="flex gap-0 border-b border-border mb-5">
            {(["polls", "model", "crowd"] as const).map((mode) => {
              const label = mode === "polls" ? "Prieskumy" : mode === "model" ? "Model" : "Dav";
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 text-sm transition-colors ${
                    viewMode === mode
                      ? "font-medium text-ink border-b-2 border-ink -mb-px"
                      : "text-secondary hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Chart card */}
          <Panel className="mb-5" padding="md">
            {viewMode === "polls" && (
              <>
                <h3 className="font-serif text-xl font-bold text-ink mb-1">
                  Vývoj volebných preferencií
                </h3>
                <p className="text-xs text-text/50 mb-4">
                  Agregované dáta z agentúr. Hrubé čiary označujú hlavné strany.
                </p>
                <PollTrendChart data={filteredData} parties={partyMeta} />
              </>
            )}

            {viewMode === "model" && (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-ink mb-1">Model dáta</p>
                <p className="text-xs text-text/50">
                  Predikčný model — čoskoro k dispozícii.
                </p>
              </div>
            )}

            {viewMode === "crowd" && (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-ink mb-1">Dav — tipovanie</p>
                <p className="text-xs text-text/50">
                  Agregované tipy používateľov — čoskoro k dispozícii.
                </p>
              </div>
            )}

            {/* Share buttons row */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <span className="mr-2 text-label text-muted">
                ZDIEĽAŤ
              </span>
              {["Facebook", "X", "LinkedIn", "Kopírovať odkaz"].map((btn) => (
                <button
                  key={btn}
                  className="rounded-md border border-border bg-page px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:border-border-strong"
                >
                  {btn}
                </button>
              ))}
            </div>
          </Panel>

          {/* Raw data table card */}
          <Panel padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-bold text-ink">Surové dáta</h3>
              <button
                onClick={() => setShowTable(!showTable)}
                className="text-xs font-medium text-text/50 hover:text-ink underline underline-offset-4 transition-colors"
              >
                {showTable ? "Skryť tabuľku" : "Zobraziť všetky dáta"}
              </button>
            </div>

            {showTable && (
              <div className="overflow-x-auto">
                <DataTable>
                  <thead>
                    <tr className="border-b-2 border-ink">
                      <DataTh className="text-left">
                        Dátum
                      </DataTh>
                      <DataTh className="text-left">
                        Agentúra
                      </DataTh>
                      {partyBars.map((p) => (
                        <DataTh
                          key={p.id}
                          className="text-right"
                          style={{ color: p.color }}
                        >
                          {p.abbreviation}
                        </DataTh>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredData].reverse().map((row, i) => {
                      const rowValues = partyBars
                        .map((p) => (typeof row[p.id] === "number" ? (row[p.id] as number) : undefined))
                        .filter((v): v is number => v !== undefined);
                      const maxVal = rowValues.length > 0 ? Math.max(...rowValues) : undefined;
                      return (
                        <tr key={i} className="border-b border-divider hover:bg-hover">
                          <DataTd className="text-xs tabular-nums">
                            {row.date}
                          </DataTd>
                          <DataTd className="text-xs text-text/60">{row.agency}</DataTd>
                          {partyBars.map((p) => {
                            const val = row[p.id];
                            const pct = typeof val === "number" ? val : undefined;
                            const isMax = pct !== undefined && maxVal !== undefined && pct === maxVal;
                            const isBelowThreshold = pct !== undefined && pct < 5;
                            return (
                              <DataTd
                                key={p.id}
                                className={`text-right py-2 px-2 tabular-nums text-xs ${isBelowThreshold ? "opacity-50" : ""}`}
                                style={isMax ? { color: "var(--color-danger)" } : undefined}
                              >
                                {pct !== undefined ? pct.toFixed(1) : "–"}
                              </DataTd>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </div>
            )}

            {/* Agency comparison */}
            <div className="mt-8">
              <h4 className="mb-3 text-label text-text/50">
                Porovnanie agentúr (najnovší prieskum)
              </h4>
              <div className="overflow-x-auto">
                <DataTable>
                  <thead>
                    <tr className="border-b-2 border-ink">
                      <DataTh className="text-left">
                        Strana
                      </DataTh>
                      {agencies.map((a) => (
                        <DataTh
                          key={a.name}
                          className="text-right"
                        >
                          {a.name}
                        </DataTh>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partyBars.map((party) => (
                      <Fragment key={party.id}>
                        <tr
                          className="border-b border-divider hover:bg-hover cursor-pointer"
                          onClick={() => setExpandedParty(expandedParty === party.id ? null : party.id)}
                        >
                          <DataTd>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 shrink-0"
                                style={{ backgroundColor: party.color }}
                              />
                              <span className="font-medium text-ink text-xs">{party.abbreviation}</span>
                              <span className="text-micro text-text/30">{expandedParty === party.id ? "▲" : "▼"}</span>
                            </div>
                          </DataTd>
                          {agencies.map((a) => {
                            const pct = a.results[party.id];
                            return (
                              <DataTd
                                key={a.name}
                                className={`text-right py-2 px-2 tabular-nums text-xs ${
                                  pct !== undefined && pct < 5 ? "opacity-50" : "text-text"
                                }`}
                              >
                                {pct !== undefined ? `${pct.toFixed(1)}%` : "–"}
                              </DataTd>
                            );
                          })}
                        </tr>
                        {expandedParty === party.id && (() => {
                          const history = partyHistory[party.id] ?? [];
                          const chartDomain = getMiniChartDomain(history.map((point) => point.value));

                          return (
                            <tr key={`${party.id}-drill`} className="border-b border-divider bg-hover/30">
                              <td colSpan={agencies.length + 1} className="px-2 py-3">
                                <div className="rounded-btn border border-border bg-card/70 px-3 py-3">
                                  <div className="mb-3 flex items-end justify-between gap-3">
                                    <div>
                                      <p className="micro-label mb-1">{party.abbreviation} — trend</p>
                                      <p className="text-caption text-text/45">
                                        Vývoj preferencií v čase s osami a mierkou.
                                      </p>
                                    </div>
                                    <div className="text-right text-caption text-text/45">
                                      <p>Rozsah</p>
                                      <p className="font-medium text-text/70">
                                        {history[0]?.date} – {history.at(-1)?.date}
                                      </p>
                                    </div>
                                  </div>
                                  {history.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={148}>
                                      <LineChart data={history} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
                                        <CartesianGrid
                                          vertical={false}
                                          stroke="rgba(34,34,34,0.09)"
                                          strokeDasharray="3 4"
                                        />
                                        <XAxis
                                          dataKey="date"
                                          tickFormatter={formatMiniChartDate}
                                          minTickGap={28}
                                          tick={{ fontSize: 10, fill: "rgba(43,43,43,0.55)" }}
                                          tickLine={false}
                                          axisLine={{ stroke: "rgba(34,34,34,0.14)" }}
                                        />
                                        <YAxis
                                          domain={chartDomain}
                                          width={38}
                                          tickCount={4}
                                          tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                                          tick={{ fontSize: 10, fill: "rgba(43,43,43,0.55)" }}
                                          tickLine={false}
                                          axisLine={false}
                                        />
                                        <Tooltip
                                          contentStyle={{
                                            background: "var(--bg-card)",
                                            border: "1px solid var(--border-color)",
                                            borderRadius: "var(--radius-btn)",
                                            fontSize: 12,
                                          }}
                                          labelFormatter={(label) => `Dátum: ${label}`}
                                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                          formatter={(v: any) => [`${Number(v).toFixed(1)}%`, party.abbreviation]}
                                        />
                                        <Line
                                          type="monotone"
                                          dataKey="value"
                                          stroke={party.color}
                                          dot={false}
                                          strokeWidth={2.5}
                                          activeDot={{
                                            r: 4,
                                            stroke: party.color,
                                            strokeWidth: 2,
                                            fill: "var(--bg-card)",
                                          }}
                                        />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  ) : (
                                    <p className="text-xs text-text/40">Žiadne dáta</p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })()}
                      </Fragment>
                    ))}
                  </tbody>
                </DataTable>
              </div>
              <p className="mt-3 text-micro text-text/40">
                Hodnoty pod 5% sú zvýraznené červenou — prah pre vstup do parlamentu.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
