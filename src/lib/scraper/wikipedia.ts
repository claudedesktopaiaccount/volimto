import * as cheerio from "cheerio";
import { WIKIPEDIA_POLLS_URL, type RawPollRow } from "@/lib/poll-types";

export type { RawPollRow } from "@/lib/poll-types";

/**
 * Mapping from Wikipedia header text (lowercased) → our internal party IDs.
 * Keep in sync with src/lib/parties.ts
 */
const HEADER_TO_PARTY: Record<string, string> = {
  smer: "smer-sd",
  "smer-sd": "smer-sd",
  "smer–sd": "smer-sd",
  ps: "ps",
  hlas: "hlas-sd",
  "hlas-sd": "hlas-sd",
  "hlas–sd": "hlas-sd",
  kdh: "kdh",
  sas: "sas",
  sns: "sns",
  republika: "republika",
  rep: "republika",
  dem: "demokrati",
  democrats: "demokrati",
  "hungarian alliance": "aliancia",
  hungarianalliancema: "aliancia",
  slovakia: "slovensko",
  slovensko: "slovensko",
  "progressive slovakia": "ps",
  "oľano and friends": "slovensko",
  "oľano": "slovensko",
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04",
  may: "05", jun: "06", jul: "07", aug: "08",
  sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseWikiDate(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, " ").replace(/–/g, "-");
  const match = cleaned.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const monthKey = match[2].slice(0, 3).toLowerCase();
  const year = match[3];
  const month = MONTHS[monthKey];
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

function resolvePartyId(headerText: string): string | null {
  const cleaned = headerText
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (!cleaned || cleaned.length === 0) return null;
  if (HEADER_TO_PARTY[cleaned]) return HEADER_TO_PARTY[cleaned];

  for (const [key, id] of Object.entries(HEADER_TO_PARTY)) {
    if (cleaned.includes(key) || key.includes(cleaned)) return id;
  }
  return null;
}

function parsePercentage(text: string): number | null {
  const cleaned = text.replace(/,/g, ".").replace(/[^0-9.]/g, "").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0 || num >= 100) return null;
  return Math.round(num * 10) / 10;
}

/**
 * Expand header rows into a flat column→partyId map,
 * correctly handling colspan and rowspan.
 *
 * Strategy: Build a 2D grid of the header area, then for each
 * visual column, find the best party match from any header row.
 */
function buildColumnMap(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: cheerio.Cheerio<any>
): {
  columnMap: Map<number, string>;
  agencyCol: number;
  dateCol: number;
  sampleCol: number;
  headerRowCount: number;
} {
  const rows = table.find("tr");
  // We'll process up to 3 header rows
  const maxHeaderRows = 3;
  // grid[row][col] = text content of that cell
  const grid: (string | null)[][] = [];

  for (let r = 0; r < maxHeaderRows && r < rows.length; r++) {
    if (!grid[r]) grid[r] = [];
  }

  // Fill the grid accounting for colspan and rowspan
  for (let r = 0; r < maxHeaderRows && r < rows.length; r++) {
    const cells = $(rows[r]).find("th, td");
    let visualCol = 0;

    cells.each((_, cell) => {
      const $cell = $(cell);
      const text = $cell.text().trim();
      const colspan = parseInt($cell.attr("colspan") || "1", 10);
      const rowspan = parseInt($cell.attr("rowspan") || "1", 10);

      // Find next free column in this row
      while (grid[r] && grid[r][visualCol] !== undefined && grid[r][visualCol] !== null) {
        visualCol++;
      }

      // Fill the grid for this cell's span
      for (let dr = 0; dr < rowspan && r + dr < maxHeaderRows; dr++) {
        if (!grid[r + dr]) grid[r + dr] = [];
        for (let dc = 0; dc < colspan; dc++) {
          grid[r + dr][visualCol + dc] = text;
        }
      }

      visualCol += colspan;
    });
  }

  // Now determine the total number of visual columns
  const totalCols = Math.max(...grid.map((row) => row?.length ?? 0));

  // For each visual column, find the best party ID
  const columnMap = new Map<number, string>();
  let agencyCol = 0;
  let dateCol = 1;
  let sampleCol = 2;

  for (let col = 0; col < totalCols; col++) {
    // Collect all header texts for this column
    const texts: string[] = [];
    for (let r = 0; r < grid.length; r++) {
      const t = grid[r]?.[col];
      if (t) texts.push(t);
    }

    const combined = texts.join(" ").toLowerCase();

    if (combined.includes("polling firm") || combined.includes("fieldwork")) {
      agencyCol = col;
      continue;
    }
    if (combined.includes("date")) {
      dateCol = col;
      continue;
    }
    if (combined.includes("sample")) {
      sampleCol = col;
      continue;
    }
    if (combined.includes("lead") || combined.includes("others")) {
      continue;
    }

    // Try to match each text to a party (prefer more specific sub-headers)
    // Check from last row first (sub-headers are more specific)
    for (let r = grid.length - 1; r >= 0; r--) {
      const t = grid[r]?.[col];
      if (!t) continue;
      const partyId = resolvePartyId(t);
      if (partyId) {
        columnMap.set(col, partyId);
        break;
      }
    }
  }

  // Count how many rows are headers (rows that are mostly <th>)
  let headerRowCount = 0;
  for (let r = 0; r < rows.length; r++) {
    const thCount = $(rows[r]).find("th").length;
    const totalCount = $(rows[r]).find("th, td").length;
    if (thCount > totalCount * 0.5) {
      headerRowCount++;
    } else {
      break;
    }
  }

  return { columnMap, agencyCol, dateCol, sampleCol, headerRowCount };
}

export async function scrapeWikipediaPolls(): Promise<RawPollRow[]> {
  const response = await fetch(WIKIPEDIA_POLLS_URL, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent":
        "VolimTo/1.0 (Slovak poll aggregator; educational project)",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const polls: RawPollRow[] = [];

  const table = $("table.wikitable").first();
  if (!table.length) {
    throw new Error("Could not find wikitable on page");
  }

  const { columnMap, agencyCol, dateCol, sampleCol, headerRowCount } =
    buildColumnMap($, table);

  // Parse data rows (skip header rows)
  const rows = table.find("tr").slice(headerRowCount);

  rows.each((_, row) => {
    const cells = $(row).find("td, th");
    if (cells.length < 5) return;

    // Skip sub-header rows
    const thCount = $(row).find("th").length;
    if (thCount > cells.length * 0.5) return;

    // Skip rows with colspan (section dividers)
    const hasColspan = $(row).find("[colspan]").length > 0;
    if (hasColspan) return;

    const agencyText = cells.eq(agencyCol).text().trim();
    const dateText = cells.eq(dateCol).text().trim();
    const sampleText = cells.eq(sampleCol).text().trim();

    if (!agencyText || agencyText === "–" || agencyText === "—") return;

    const publishedDate = parseWikiDate(dateText);
    if (!publishedDate) return;

    const sampleSize =
      parseInt(sampleText.replace(/[,\s]/g, ""), 10) || null;

    const results: Record<string, number> = {};
    columnMap.forEach((partyId, colIndex) => {
      const cellText = cells.eq(colIndex).text();
      const pct = parsePercentage(cellText);
      if (pct !== null) {
        // Sum values when multiple columns map to the same party
        // (e.g. OĽaNO sub-columns: Slovakia + ZĽ + KÚ)
        results[partyId] = (results[partyId] || 0) + pct;
      }
    });
    // Round summed values to 1 decimal
    for (const key of Object.keys(results)) {
      results[key] = Math.round(results[key] * 10) / 10;
    }

    if (Object.keys(results).length >= 3) {
      const agency = agencyText
        .replace(/\[.*?\]/g, "")
        .replace(/\(.*?\)/g, "")
        .trim();

      polls.push({ agency, publishedDate, sampleSize, results });
    }
  });

  polls.sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
  return polls;
}

// Exported for testing
export { buildColumnMap, resolvePartyId, parsePercentage, parseWikiDate };
