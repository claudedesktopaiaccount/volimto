interface PartyBarLike {
  id: string;
  abbreviation: string;
}

type ChartRow = Record<string, string | number>;

function escapeCsvValue(value: string | number) {
  const normalized = String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function buildPollCsv(chartData: ChartRow[], partyBars: PartyBarLike[]) {
  const headers = ["Dátum", "Agentúra", ...partyBars.map((party) => party.abbreviation)];
  const rows = chartData.map((row) => [
    row.date ?? "",
    row.agency ?? "",
    ...partyBars.map((party) => row[party.id] ?? ""),
  ]);

  return [headers, ...rows]
    .map((cells) => cells.map(escapeCsvValue).join(","))
    .join("\n");
}

