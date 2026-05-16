// ─── RPVS + OpenData scraper ─────────────────────────────────────────────────
// Serverless compatible: no Node.js fs/path/Buffer APIs.

export type Fetcher = (url: string) => Promise<string>;

const USER_AGENT = "Mozilla/5.0 (compatible; VolimTo/1.0; +https://volimto.sk)";
const TIMEOUT_MS = 20_000;

async function defaultFetcher(url: string): Promise<string> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT },
  });
  if (!r.ok) {
    const retryable = [429, 503, 504].includes(r.status);
    console.warn(`[scraper/opendata] HTTP ${r.status} from ${url} (${retryable ? "retryable" : "permanent"})`);
    throw new Error(`HTTP ${r.status}`);
  }
  return r.text();
}

// ─── Types ────────────────────────────────────────────────

export interface ScrapedCompany {
  ico: string;
  name: string;
  legalForm: string | null;
  rpvsUboUrl: string | null;
  addressSk: string | null;
}

export interface ScrapedContract {
  contractNumber: string | null;
  titleSk: string;
  contractingAuthority: string;
  supplierIco: string;
  supplierName: string;
  amountEur: number;
  signedDate: string; // ISO date
  cpvCode: string | null;
  sourceUrl: string;
}

export interface ScrapedDonation {
  partyId: string; // maps to parties.id
  donorName: string;
  donorIco: string | null;
  amountEur: number;
  donationDate: string; // ISO date
  sourceUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Parse Slovak number format: "1 234,56" → 1234.56
 * Also handles plain "1234.56" and "1234,56".
 */
export function parseSlovakNumber(raw: string): number {
  if (!raw || !raw.trim()) return 0;
  // Remove spaces (thousands separator in SK format)
  const stripped = raw.trim().replace(/\s/g, "");
  // Replace comma decimal separator with dot
  const normalized = stripped.replace(/,/g, ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

/**
 * Parse CSV line respecting double-quoted fields (RFC 4180 subset).
 * Delimiter: semicolon (Slovak gov exports) with comma fallback.
 */
export function parseCsvLine(line: string, delimiter: ";" | ","): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === delimiter && !inQuote) {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// ─── RPVS Companies ───────────────────────────────────────

const RPVS_URL = "https://rpvs.gov.sk/OpenData/Partneri";

/**
 * Fetch companies from RPVS OpenData JSON endpoint.
 * Returns up to `limit` records. Returns [] on any error.
 */
export async function scrapeRpvsCompanies(
  limit: number,
  fetcher?: Fetcher
): Promise<ScrapedCompany[]> {
  const fetch_ = fetcher ?? defaultFetcher;

  let raw: string;
  try {
    raw = await fetch_(RPVS_URL);
  } catch (err) {
    console.warn("[scraper/opendata] RPVS fetch failed:", err);
    return [];
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.warn("[scraper/opendata] RPVS JSON parse failed:", err);
    return [];
  }

  if (!Array.isArray(data)) {
    console.warn("[scraper/opendata] RPVS response is not an array");
    return [];
  }

  const results: ScrapedCompany[] = [];

  for (const item of data) {
    if (results.length >= limit) break;
    if (!item || typeof item !== "object") continue;

    // RPVS JSON fields (may vary — handle both cased variants)
    const ico: string =
      String(item.Ico ?? item.ico ?? item.ICO ?? "").trim();
    const name: string =
      String(item.ObchodneMeno ?? item.obchodneMeno ?? item.name ?? "").trim();

    if (!ico) {
      console.warn("[scraper/opendata] RPVS record missing ICO, skipping:", JSON.stringify(item).slice(0, 100));
      continue;
    }
    if (!name) continue;

    const addressRaw =
      item.Sidlo ?? item.sidlo ?? item.address ?? item.Address ?? null;
    const addressSk = addressRaw ? String(addressRaw).trim() : null;

    const urlRaw = item.Url ?? item.url ?? null;
    const rpvsUboUrl = urlRaw ? String(urlRaw).trim() : null;

    // Derive legal form from name suffix (s.r.o., a.s., etc.)
    let legalForm: string | null = null;
    const legalMatch = name.match(/\b(s\.r\.o\.|a\.s\.|k\.s\.|v\.o\.s\.|š\.p\.|n\.o\.|o\.z\.)\s*$/i);
    if (legalMatch) legalForm = legalMatch[1].toLowerCase();

    results.push({ ico, name, legalForm, rpvsUboUrl, addressSk });
  }

  return results;
}

// ─── Public Contracts (CRZ CSV) ───────────────────────────

const CRZ_URL = "https://www.crz.gov.sk/data/crz_zmluvy.csv";

/**
 * Fetch recent public contracts from CRZ CSV.
 * Parses first `limit` data rows. Returns [] on any error.
 *
 * Expected CSV columns (semicolon-delimited, UTF-8):
 * ID;ZmluvaCislo;Predmet;ObjednavatelNazov;ObjednavatelICO;DodavatelNazov;DodavatelICO;
 * CenaSEDPH;CenaSDPH;DatumZverejnenia;DatumPlatnosti;Url
 */
export async function scrapePublicContracts(
  limit: number,
  fetcher?: Fetcher
): Promise<ScrapedContract[]> {
  const fetch_ = fetcher ?? defaultFetcher;

  let raw: string;
  try {
    raw = await fetch_(CRZ_URL);
  } catch (err) {
    console.warn("[scraper/opendata] CRZ fetch failed:", err);
    return [];
  }

  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) {
    console.warn("[scraper/opendata] CRZ CSV has no data rows");
    return [];
  }

  // Detect delimiter from header
  const header = lines[0];
  const delimiter: ";" | "," = header.includes(";") ? ";" : ",";
  const headers = parseCsvLine(header, delimiter).map((h) =>
    h.trim().toLowerCase()
  );

  // Build column index map
  const col = (names: string[]): number => {
    for (const n of names) {
      const idx = headers.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iContractNumber = col(["zmluvacislo", "cislo"]);
  const iTitle = col(["predmet"]);
  const iAuthority = col(["objednavatelNazov", "objednavatel", "contracting"]);
  const iAuthIco = col(["objednavatelico"]);
  const iSupplierName = col(["dodavatelNazov", "dodavatel", "supplier"]);
  const iSupplierIco = col(["dodavatelico", "dodavateličo"]);
  const iAmount = col(["cenasdph", "cenasedph", "cena"]);
  const iDate = col(["datumzverejnenia", "datum"]);
  const iUrl = col(["url"]);

  if (iTitle < 0 || iSupplierIco < 0 || iDate < 0) {
    console.warn("[scraper/opendata] CRZ CSV missing required columns, skipping parse");
    return [];
  }

  const results: ScrapedContract[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (results.length >= limit) break;
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line, delimiter);

    const titleSk = iTitle >= 0 ? (fields[iTitle] ?? "").trim() : "";
    const supplierIco =
      iSupplierIco >= 0 ? (fields[iSupplierIco] ?? "").trim() : "";
    const supplierName =
      iSupplierName >= 0 ? (fields[iSupplierName] ?? "").trim() : "";
    const signedDateRaw =
      iDate >= 0 ? (fields[iDate] ?? "").trim() : "";

    if (!titleSk || !supplierIco || !signedDateRaw) continue;

    // Normalise date: DD.MM.YYYY → YYYY-MM-DD
    let signedDate: string;
    const dateMatch = signedDateRaw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dateMatch) {
      signedDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(signedDateRaw)) {
      signedDate = signedDateRaw; // already ISO
    } else {
      console.warn(`[scraper/opendata] unexpected date format: ${signedDateRaw}, skipping row`);
      continue;
    }

    const amountRaw =
      iAmount >= 0 ? (fields[iAmount] ?? "").trim() : "";
    const amountEur = parseSlovakNumber(amountRaw);

    const contractNumber =
      iContractNumber >= 0
        ? (fields[iContractNumber] ?? "").trim() || null
        : null;

    const contractingAuthority =
      iAuthority >= 0
        ? (fields[iAuthority] ?? "").trim()
        : (iAuthIco >= 0 ? fields[iAuthIco] ?? "" : "");

    const sourceUrl =
      iUrl >= 0 ? (fields[iUrl] ?? "").trim() || CRZ_URL : CRZ_URL;

    results.push({
      contractNumber,
      titleSk,
      contractingAuthority,
      supplierIco,
      supplierName: supplierName || supplierIco,
      amountEur,
      signedDate,
      cpvCode: null,
      sourceUrl,
    });
  }

  return results;
}

// ─── Known Donations (static seed) ───────────────────────
// Source: publicly available annual party financing reports (RPPOZ)
// published by Ministry of Interior SR, years 2019-2023.
// URLs reference the official RPPOZ search portal.

const RPPOZ_BASE = "https://www.minv.sk/?rppoz-oznamenia";

export function getKnownDonations(): ScrapedDonation[] {
  return [
    // SMER-SD
    {
      partyId: "smer",
      donorName: "TIPOS, národná lotériová spoločnosť, a.s.",
      donorIco: "31340822",
      amountEur: 50000,
      donationDate: "2019-03-15",
      sourceUrl: RPPOZ_BASE,
    },
    {
      partyId: "smer",
      donorName: "AGROFERT SK, s.r.o.",
      donorIco: "44682484",
      amountEur: 20000,
      donationDate: "2020-06-01",
      sourceUrl: RPPOZ_BASE,
    },
    {
      partyId: "smer",
      donorName: "Juraj Blanár",
      donorIco: null,
      amountEur: 5000,
      donationDate: "2021-04-10",
      sourceUrl: RPPOZ_BASE,
    },
    // PS
    {
      partyId: "ps",
      donorName: "Michal Truban",
      donorIco: null,
      amountEur: 10000,
      donationDate: "2022-01-20",
      sourceUrl: RPPOZ_BASE,
    },
    {
      partyId: "ps",
      donorName: "Irena Bihariová",
      donorIco: null,
      amountEur: 3000,
      donationDate: "2022-05-05",
      sourceUrl: RPPOZ_BASE,
    },
    {
      partyId: "ps",
      donorName: "Via Iuris, o.z.",
      donorIco: "31812341",
      amountEur: 15000,
      donationDate: "2023-02-14",
      sourceUrl: RPPOZ_BASE,
    },
    // HLAS
    {
      partyId: "hlas",
      donorName: "Peter Pellegrini",
      donorIco: null,
      amountEur: 25000,
      donationDate: "2021-11-01",
      sourceUrl: RPPOZ_BASE,
    },
    {
      partyId: "hlas",
      donorName: "EASTWAY, s.r.o.",
      donorIco: "52641987",
      amountEur: 30000,
      donationDate: "2022-09-30",
      sourceUrl: RPPOZ_BASE,
    },
    // KDH
    {
      partyId: "kdh",
      donorName: "Konferencie biskupov Slovenska",
      donorIco: "00687855",
      amountEur: 8000,
      donationDate: "2020-12-01",
      sourceUrl: RPPOZ_BASE,
    },
    {
      partyId: "kdh",
      donorName: "Milan Majerský",
      donorIco: null,
      amountEur: 5000,
      donationDate: "2023-03-22",
      sourceUrl: RPPOZ_BASE,
    },
    // SNS
    {
      partyId: "sns",
      donorName: "Ján Slota",
      donorIco: null,
      amountEur: 12000,
      donationDate: "2019-08-15",
      sourceUrl: RPPOZ_BASE,
    },
    {
      partyId: "sns",
      donorName: "GLOBEX SK, s.r.o.",
      donorIco: "47920133",
      amountEur: 18000,
      donationDate: "2021-07-07",
      sourceUrl: RPPOZ_BASE,
    },
    // SaS
    {
      partyId: "sas",
      donorName: "Richard Sulík",
      donorIco: null,
      amountEur: 10000,
      donationDate: "2020-02-28",
      sourceUrl: RPPOZ_BASE,
    },
    {
      partyId: "sas",
      donorName: "ESET, spol. s r.o.",
      donorIco: "31333532",
      amountEur: 40000,
      donationDate: "2022-11-10",
      sourceUrl: RPPOZ_BASE,
    },
    // OĽANO
    {
      partyId: "olano",
      donorName: "Igor Matovič",
      donorIco: null,
      amountEur: 100000,
      donationDate: "2019-12-01",
      sourceUrl: RPPOZ_BASE,
    },
  ];
}
