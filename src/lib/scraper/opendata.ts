// RPVS + OpenData scraper
// Serverless compatible: no Node.js fs/path/Buffer APIs.

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { ScrapedCompany, ScrapedContract } from "@/lib/opendata-types";

export type { ScrapedCompany, ScrapedContract } from "@/lib/opendata-types";

export type Fetcher = (url: string) => Promise<string>;
export type BinaryFetcher = (url: string) => Promise<ArrayBuffer>;

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

async function defaultBinaryFetcher(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT },
  });
  if (!r.ok) {
    const retryable = [429, 503, 504].includes(r.status);
    console.warn(`[scraper/opendata] HTTP ${r.status} from ${url} (${retryable ? "retryable" : "permanent"})`);
    throw new Error(`HTTP ${r.status}`);
  }
  return r.arrayBuffer();
}

// Types

// Helpers

/**
 * Parse Slovak number format: "1 234,56" -> 1234.56
 * Also handles plain "1234.56" and "1234,56".
 */
export function parseSlovakNumber(raw: string): number {
  if (!raw || !raw.trim()) return 0;
  const stripped = raw.trim().replace(/\s/g, "");
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

function getObjectValue(item: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (item[name] !== undefined && item[name] !== null) return item[name];
  }
  return null;
}

function normalizeIco(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function parseIsoishDate(raw: string): string | null {
  const trimmed = raw.trim();
  const dateMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dateMatch) return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return null;
}

// RPVS Companies

const RPVS_URL = "https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?$expand=Partner";
const MAX_RPVS_COMPANY_PAGES = 100;

function buildRpvsDetailUrl(item: Record<string, unknown>): string | null {
  const explicit = getObjectValue(item, ["Url", "url"]);
  if (explicit) {
    try {
      const url = new URL(String(explicit).trim());
      if (
        url.protocol === "https:" &&
        url.hostname === "rpvs.gov.sk" &&
        url.port === "" &&
        url.pathname.startsWith("/rpvs/Partner/")
      ) {
        return url.toString();
      }
    } catch {
      // Fall back to the official detail URL derived from Partner.Id.
    }
  }

  const partner = getObjectValue(item, ["Partner", "partner"]);
  if (!partner || typeof partner !== "object") return null;
  const partnerId = getObjectValue(partner as Record<string, unknown>, ["Id", "id"]);
  if (!partnerId) return null;
  return `https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/${String(partnerId).trim()}`;
}

/**
 * Fetch companies from RPVS OpenData JSON endpoint.
 * Returns up to `limit` records. Pagination is atomic: a failed or malformed
 * later page rejects the scrape instead of returning an apparently successful
 * truncated result.
 */
export async function scrapeRpvsCompanies(
  limit: number,
  fetcher?: Fetcher
): Promise<ScrapedCompany[]> {
  const fetch_ = fetcher ?? defaultFetcher;
  const results: ScrapedCompany[] = [];
  const seenIcos = new Set<string>();
  const visitedUrls = new Set<string>();
  let url: string | null = RPVS_URL;
  let pageNumber = 0;

  while (url && results.length < limit) {
    if (visitedUrls.has(url)) throw new Error("RPVS company pagination loop detected");
    if (visitedUrls.size >= MAX_RPVS_COMPANY_PAGES) {
      throw new Error("RPVS company pagination exceeded the safety limit");
    }
    visitedUrls.add(url);
    pageNumber++;

    let raw: string;
    try {
      raw = await fetch_(url);
    } catch (err) {
      console.warn("[scraper/opendata] RPVS fetch failed:", err);
      throw new Error(`RPVS company fetch failed on page ${pageNumber}`, { cause: err });
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn("[scraper/opendata] RPVS JSON parse failed:", err);
      throw new Error(`RPVS company JSON parse failed on page ${pageNumber}`, {
        cause: err,
      });
    }

    const records = Array.isArray(data)
      ? data
      : data && typeof data === "object" && Array.isArray((data as { value?: unknown }).value)
        ? (data as { value: unknown[] }).value
        : null;

    if (!records) {
      console.warn("[scraper/opendata] RPVS response is not an array or OData wrapper");
      throw new Error(`Malformed RPVS company response on page ${pageNumber}`);
    }

    for (const item of records) {
      if (results.length >= limit) break;
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;

      const ico = normalizeIco(getObjectValue(obj, ["Ico", "ico", "ICO"]));
      const companyName = String(
        getObjectValue(obj, ["ObchodneMeno", "obchodneMeno", "name"]) ?? ""
      ).trim();
      const personName = [
        getObjectValue(obj, ["TitulPred"]),
        getObjectValue(obj, ["Meno"]),
        getObjectValue(obj, ["Priezvisko"]),
        getObjectValue(obj, ["TitulZa"]),
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
        .join(" ");
      const name = companyName || personName;

      if (!ico) {
        console.warn("[scraper/opendata] RPVS record missing ICO, skipping:", JSON.stringify(item).slice(0, 100));
        continue;
      }
      if (!name || seenIcos.has(ico)) continue;

      const addressRaw = getObjectValue(obj, ["Sidlo", "sidlo", "address", "Address"]);
      const addressSk = addressRaw ? String(addressRaw).trim() : null;
      const rpvsUboUrl = buildRpvsDetailUrl(obj);

      let legalForm: string | null = null;
      const legalMatch = name.match(/\b(s\.\s*r\.\s*o\.|a\.\s*s\.|k\.\s*s\.|v\.\s*o\.\s*s\.|š\.\s*p\.|n\.\s*o\.|o\.\s*z\.)\s*$/i);
      if (legalMatch) legalForm = legalMatch[1].toLowerCase().replace(/\s+/g, "");

      seenIcos.add(ico);
      results.push({ ico, name, legalForm, rpvsUboUrl, addressSk });
    }

    if (Array.isArray(data)) {
      url = null;
      continue;
    }

    const nextLink = (data as Record<string, unknown>)["@odata.nextLink"];
    if (nextLink === undefined || nextLink === null || nextLink === "") {
      url = null;
    } else if (typeof nextLink === "string" && nextLink.trim()) {
      url = safeRpvsCompanyNextLink(nextLink);
    } else {
      throw new Error(`Malformed RPVS company nextLink on page ${pageNumber}`);
    }
  }

  return results;
}

function safeRpvsCompanyNextLink(raw: string): string {
  const url = new URL(raw, RPVS_URL);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "rpvs.gov.sk" ||
    url.port !== "" ||
    url.pathname !== "/opendatav2/PartneriVerejnehoSektora"
  ) {
    throw new Error("Unsafe RPVS company nextLink");
  }
  return url.toString();
}

// Public Contracts (CRZ)

const CRZ_LEGACY_CSV_URL = "https://www.crz.gov.sk/data/crz_zmluvy.csv";
const CRZ_EXPORT_BASE_URL = "https://www.crz.gov.sk/export";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function previousUtcDateIso(now = new Date()): string {
  const previous = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1
  ));
  return toIsoDate(previous);
}

function getCrzExportUrl(dateIso = previousUtcDateIso()): string {
  return `${CRZ_EXPORT_BASE_URL}/${dateIso}.zip`;
}

async function inflateRaw(compressed: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream is not available in this runtime");
  }

  const payload = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength
  ) as ArrayBuffer;
  const stream = new Blob([payload]).stream().pipeThrough(
    new DecompressionStream("deflate-raw")
  );
  return new Response(stream).text();
}

async function extractFirstZipText(zipBuffer: ArrayBuffer): Promise<string> {
  const view = new DataView(zipBuffer);
  const bytes = new Uint8Array(zipBuffer);

  if (view.byteLength < 30 || view.getUint32(0, true) !== 0x04034b50) {
    throw new Error("Invalid ZIP file");
  }

  const flags = view.getUint16(6, true);
  if ((flags & 0x08) !== 0) {
    throw new Error("ZIP data descriptors are not supported");
  }

  const method = view.getUint16(8, true);
  const compressedSize = view.getUint32(18, true);
  const fileNameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const dataStart = 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + compressedSize;

  if (dataEnd > bytes.length) {
    throw new Error("ZIP entry exceeds archive size");
  }

  const payload = bytes.slice(dataStart, dataEnd);
  if (method === 0) return new TextDecoder("utf-8").decode(payload);
  if (method === 8) return inflateRaw(payload);
  throw new Error(`Unsupported ZIP compression method ${method}`);
}

function xmlText($el: cheerio.Cheerio<AnyNode>, names: string[]): string {
  for (const name of names) {
    const value = $el.find(name).first().text().trim();
    if (value) return value;
  }
  return "";
}

export function parseCrzExportXml(xml: string, sourceArchiveUrl: string): ScrapedContract[] {
  const $ = cheerio.load(xml, { xml: true });
  const results: ScrapedContract[] = [];

  $("zmluva").each((_, element) => {
    const $el = $(element);
    const id = xmlText($el, ["ID"]);
    const titleSk = xmlText($el, ["predmet"]);
    const supplierIco = normalizeIco(xmlText($el, ["ico"]));
    const supplierName = xmlText($el, ["zs2"]);
    const signedDate = parseIsoishDate(
      xmlText($el, ["datum", "datum_zverejnene", "datum_ucinnost"])
    );

    if (!titleSk || !supplierIco || !supplierName || !signedDate) return;

    const amountEur = parseSlovakNumber(
      xmlText($el, ["suma_zmluva", "suma_spolu"])
    );
    const sourceUrl = id
      ? `https://www.crz.gov.sk/zmluva/${encodeURIComponent(id)}/`
      : sourceArchiveUrl;

    results.push({
      contractNumber: xmlText($el, ["nazov"]) || null,
      titleSk,
      contractingAuthority: xmlText($el, ["zs1"]) || xmlText($el, ["ico1"]),
      supplierIco,
      supplierName,
      amountEur,
      signedDate,
      cpvCode: null,
      sourceUrl,
    });
  });

  return results;
}

async function scrapeCrzZipContracts(
  limit: number,
  binaryFetcher: BinaryFetcher
): Promise<ScrapedContract[]> {
  const exportUrl = getCrzExportUrl();
  const zip = await binaryFetcher(exportUrl);
  const xml = await extractFirstZipText(zip);
  return parseCrzExportXml(xml, exportUrl).slice(0, limit);
}

function parseCrzCsv(raw: string, limit: number): ScrapedContract[] {
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) {
    console.warn("[scraper/opendata] CRZ CSV has no data rows");
    return [];
  }

  const header = lines[0];
  const delimiter: ";" | "," = header.includes(";") ? ";" : ",";
  const headers = parseCsvLine(header, delimiter).map((h) =>
    h.trim().toLowerCase()
  );

  const col = (names: string[]): number => {
    for (const n of names) {
      const idx = headers.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iId = col(["id"]);
  const iContractNumber = col(["zmluvacislo", "cislo"]);
  const iTitle = col(["predmet"]);
  const iAuthority = col(["objednavatelnazov", "objednavatel", "contracting"]);
  const iAuthIco = col(["objednavatelico"]);
  const iSupplierName = col(["dodavatelnazov", "dodavatel", "supplier"]);
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
      iSupplierIco >= 0 ? normalizeIco(fields[iSupplierIco] ?? "") : "";
    const supplierName =
      iSupplierName >= 0 ? (fields[iSupplierName] ?? "").trim() : "";
    const signedDateRaw =
      iDate >= 0 ? (fields[iDate] ?? "").trim() : "";

    if (!titleSk || !supplierIco || !signedDateRaw) continue;

    const signedDate = parseIsoishDate(signedDateRaw);
    if (!signedDate) {
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
    const exportedUrl = iUrl >= 0 ? (fields[iUrl] ?? "").trim() : "";
    const recordId = iId >= 0 ? (fields[iId] ?? "").trim() : "";
    const sourceUrl = exportedUrl || (/^\d+$/.test(recordId)
      ? `https://www.crz.gov.sk/zmluva/${encodeURIComponent(recordId)}/`
      : CRZ_LEGACY_CSV_URL);

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

/**
 * Fetch recent public contracts from CRZ.
 * Current CRZ OpenData is a daily ZIP/XML export; tests may still inject legacy CSV.
 * Returns [] on any error.
 */
export async function scrapePublicContracts(
  limit: number,
  fetcher?: Fetcher,
  binaryFetcher?: BinaryFetcher
): Promise<ScrapedContract[]> {
  if (!fetcher) {
    try {
      return await scrapeCrzZipContracts(limit, binaryFetcher ?? defaultBinaryFetcher);
    } catch (err) {
      console.warn("[scraper/opendata] CRZ ZIP fetch/parse failed:", err);
    }
  }

  let raw: string;
  try {
    raw = await (fetcher ?? defaultFetcher)(CRZ_LEGACY_CSV_URL);
  } catch (err) {
    console.warn("[scraper/opendata] CRZ fetch failed:", err);
    return [];
  }

  return parseCrzCsv(raw, limit);
}
