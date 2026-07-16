"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OpendataMonthlyPoint } from "@/lib/db/opendata-analytics";

const eur = new Intl.NumberFormat("sk-SK", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const compactEur = new Intl.NumberFormat("sk-SK", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function OpendataTimelineChart({
  data,
}: {
  data: OpendataMonthlyPoint[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-md bg-subtle px-6 text-center text-sm text-muted">
        Pre vybrané filtre nie je dostupný časový rad.
      </div>
    );
  }

  return (
    <div className="h-[280px] min-w-0 w-full" role="img" aria-label="Vývoj hodnoty zmlúv podľa mesiaca">
      <AreaChart
        responsive
        style={{ width: "100%", height: "100%" }}
        data={data}
        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
        title="Vývoj hodnoty importovaných zmlúv CRZ podľa mesiaca"
      >
          <defs>
            <linearGradient id="opendataAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.28} />
              <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border-color)" }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value) => compactEur.format(Number(value))}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={68}
          />
          <Tooltip
            formatter={(value) => [eur.format(Number(value)), "Hodnota zmlúv"]}
            labelFormatter={(label) => formatMonth(String(label))}
            contentStyle={{
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="var(--accent-blue)"
            strokeWidth={2}
            fill="url(#opendataAmount)"
            activeDot={{ r: 4 }}
          />
      </AreaChart>
    </div>
  );
}

function formatMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;

  return new Intl.DateTimeFormat("sk-SK", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
