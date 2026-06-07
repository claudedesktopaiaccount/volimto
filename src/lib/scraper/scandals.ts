import * as cheerio from "cheerio";
import { eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  mps,
  scandalAnalysisDrafts,
  scandalEvents,
  scandalPoliticianLinks,
  scandals,
  scandalSources,
} from "@/lib/db/schema";
import { createScandalAnalysisDraft, serializeActorClaims } from "@/lib/scandals/analysis";
import { classifyScandalSource } from "@/lib/scandals/trusted-sources";
import {
  extractAndStoreFinancialLinksFromScandals,
  type FinancialLinkExtractionResult,
} from "./financial-links";

const CUTOFF = "2011-05-23";
const DEFAULT_LIMIT = 80;
const WP_CATEGORY_ID = 4;
const ZK_ARCHIVE_URL = "https://zastavmekorupciu.sk/kauzy/";
const WP_API_URL = "https://zastavmekorupciu.sk/wp-json/wp/v2/posts";
const UA = "VolimTo/1.0 scandal importer (+https://volimto.sk)";

interface WpPost {
  id: number;
  date: string;
  modified: string;
  link: string;
  slug: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
}

interface MpMatch {
  id: number;
  slug: string;
  nameDisplay: string;
  nameFull: string;
}

export interface PreparedScandal {
  slug: string;
  titleSk: string;
  summarySk: string;
  startDate: string;
  status: string;
  category: string;
  institutionInvestigating: string;
  severity: number;
  sources: {
    url: string;
    outletName: string;
    publishedDate: string;
    isPrimary: boolean;
  }[];
  events: PreparedScandalEvent[];
  pageText: string;
  mpMatches: MpMatch[];
  mpIds: number[];
}

export interface PreparedScandalEvent {
  eventDate: string;
  titleSk: string;
  descriptionSk: string;
  eventType: string;
  sourceUrl: string;
  sortOrder: number;
}

export interface ScandalScrapeResult {
  scraped: number;
  scandalsUpserted: number;
  sourcesUpserted: number;
  linksUpserted: number;
  eventsUpserted: number;
  draftsCreated: number;
  financialLinks: FinancialLinkExtractionResult;
  unresolved: string[];
}

function excluded(columnName: string) {
  return sql.raw(`excluded.${columnName}`);
}

export function parseScandalLimit(rawArgs: string[], fallback = DEFAULT_LIMIT): number {
  const raw = rawArgs.slice().reverse().find((arg) => arg.startsWith("--limit="));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : fallback;
}

export async function scrapeAndStoreScandals(
  db: Database,
  limit = DEFAULT_LIMIT,
  options: { geminiApiKey?: string } = {}
): Promise<ScandalScrapeResult> {
  const prepared = await scrapeScandalArchive(db, limit);
  const result = await upsertPreparedScandals(db, prepared);
  const financialLinks = await extractAndStoreFinancialLinksFromScandals(
    db,
    prepared,
    options.geminiApiKey
  );
  return {
    scraped: prepared.length,
    ...result,
    financialLinks,
    unresolved: prepared.filter((item) => item.mpIds.length === 0).map((item) => item.titleSk),
  };
}

async function scrapeScandalArchive(db: Database, limit = DEFAULT_LIMIT): Promise<PreparedScandal[]> {
  const matchMps = await loadMpMatcher(db);
  const posts = await fetchZastavmePosts(limit);
  const prepared: PreparedScandal[] = [];

  for (const post of posts) {
    const item = await prepareScandal(post, matchMps);
    if (!item) continue;
    prepared.push(item);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return prepared;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchZastavmePosts(limit: number): Promise<WpPost[]> {
  const posts: WpPost[] = [];
  for (let page = 1; posts.length < limit && page <= 5; page++) {
    const url = `${WP_API_URL}?categories=${WP_CATEGORY_ID}&per_page=100&page=${page}&after=${CUTOFF}T00:00:00`;
    const batch = await fetchJson<WpPost[]>(url);
    if (batch.length === 0) break;
    posts.push(...batch);
  }
  return posts.slice(0, limit);
}

async function loadMpMatcher(db: Database): Promise<(text: string) => MpMatch[]> {
  const rows = await db
    .select({
      id: mps.id,
      slug: mps.slug,
      nameDisplay: mps.nameDisplay,
      nameFull: mps.nameFull,
    })
    .from(mps);

  const surnameCounts = new Map<string, number>();
  for (const mp of rows) {
    const surname = lastName(mp.nameDisplay);
    if (surname) surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
  }

  return (text: string) => {
    const normalizedText = normalize(text);
    return rows.filter((mp) => {
      const full = normalize(mp.nameDisplay);
      const legalFull = normalize(mp.nameFull);
      if (full && normalizedText.includes(full)) return true;
      if (legalFull && normalizedText.includes(legalFull)) return true;

      const surname = lastName(mp.nameDisplay);
      return Boolean(surname && surnameCounts.get(surname) === 1 && normalizedText.includes(surname));
    });
  };
}

async function prepareScandal(post: WpPost, matchMps: (text: string) => MpMatch[]): Promise<PreparedScandal | null> {
  const title = cleanHtml(post.title.rendered);
  const date = post.date.slice(0, 10);
  if (date < CUTOFF || !title) return null;
  if (!looksLikeScandalTitle(title)) return null;

  let html = post.content.rendered;
  let pageHtml = "";
  try {
    pageHtml = await fetchText(post.link);
    if (!html.trim()) html = pageHtml;
  } catch (error) {
    console.warn(`[scraper:scandals] failed to fetch page ${post.link}: ${(error as Error).message}`);
  }

  const text = cleanHtml(`${title} ${post.excerpt.rendered} ${html}`);
  const mpMatches = matchMps(text);
  const sources = extractScandalSources(post);
  if (sources.length === 0) return null;

  return {
    slug: buildScandalSlug(post.slug),
    titleSk: title,
    summarySk: buildSummary(title, text, mpMatches),
    startDate: date,
    status: inferStatus(text),
    category: inferCategory(text),
    institutionInvestigating: inferInstitution(text),
    severity: inferSeverity(text),
    sources,
    events: extractScandalEvents(post, text),
    pageText: text,
    mpMatches,
    mpIds: mpMatches.map((mp) => mp.id),
  };
}

export function buildScandalSlug(sourceSlug: string) {
  return `zk-${sourceSlug}`;
}

async function upsertPreparedScandals(db: Database, items: PreparedScandal[]) {
  let scandalsUpserted = 0;
  let sourcesUpserted = 0;
  let linksUpserted = 0;
  let eventsUpserted = 0;
  let draftsCreated = 0;

  for (const item of items) {
    const [row] = await db
      .insert(scandals)
      .values({
        slug: item.slug,
        titleSk: item.titleSk,
        summarySk: item.summarySk,
        startDate: item.startDate,
        endDate: null,
        status: item.status,
        category: item.category,
        institutionInvestigating: item.institutionInvestigating,
        verdictUrl: null,
        severity: item.severity,
        isEditorialOpinion: false,
      })
      .onConflictDoUpdate({
        target: scandals.slug,
        set: {
          titleSk: excluded(scandals.titleSk.name),
          summarySk: excluded(scandals.summarySk.name),
          startDate: excluded(scandals.startDate.name),
          status: excluded(scandals.status.name),
          category: excluded(scandals.category.name),
          institutionInvestigating: excluded(scandals.institutionInvestigating.name),
          severity: excluded(scandals.severity.name),
          isEditorialOpinion: excluded(scandals.isEditorialOpinion.name),
        },
      })
      .returning({ id: scandals.id });

    if (!row) continue;
    scandalsUpserted++;

    for (const source of item.sources) {
      const result = await db
        .insert(scandalSources)
        .values({ scandalId: row.id, ...source })
        .onConflictDoUpdate({
          target: [scandalSources.scandalId, scandalSources.url],
          set: {
            outletName: excluded(scandalSources.outletName.name),
            publishedDate: excluded(scandalSources.publishedDate.name),
            isPrimary: excluded(scandalSources.isPrimary.name),
          },
        })
        .returning({ id: scandalSources.id });
      sourcesUpserted += result.length;
    }

    for (const mpId of item.mpIds) {
      const result = await db
        .insert(scandalPoliticianLinks)
        .values({
          scandalId: row.id,
          mpId,
          roleInScandal: "needs_review",
        })
        .onConflictDoNothing({
          target: [scandalPoliticianLinks.scandalId, scandalPoliticianLinks.mpId],
        })
        .returning({ id: scandalPoliticianLinks.id });
      linksUpserted += result.length;
    }

    await db.delete(scandalEvents).where(eq(scandalEvents.scandalId, row.id));
    for (const event of item.events) {
      const result = await db
        .insert(scandalEvents)
        .values({ scandalId: row.id, ...event })
        .returning({ id: scandalEvents.id });
      eventsUpserted += result.length;
    }

    const existingDrafts = await db
      .select({ id: scandalAnalysisDrafts.id })
      .from(scandalAnalysisDrafts)
      .where(eq(scandalAnalysisDrafts.scandalId, row.id));

    if (existingDrafts.length === 0) {
      const draft = createScandalAnalysisDraft({
        scandal: {
          titleSk: item.titleSk,
          summarySk: item.summarySk,
          status: item.status,
          institutionInvestigating: item.institutionInvestigating,
        },
        actors: item.mpMatches.map((mp) => ({ mpId: mp.id, nameDisplay: mp.nameDisplay })),
        sources: item.sources,
        pageText: item.pageText,
      });

      await db.insert(scandalAnalysisDrafts).values({
        scandalId: row.id,
        caseSummarySk: draft.caseSummarySk,
        publicInterestSk: draft.publicInterestSk,
        legalStatusSk: draft.legalStatusSk,
        openQuestionsSk: draft.openQuestionsSk,
        actorClaimsJson: serializeActorClaims(draft.actorClaims),
        sourceUrlsJson: JSON.stringify(draft.sourceUrls),
        reviewStatus: "needs_review",
        model: draft.model,
        createdAt: new Date().toISOString(),
        reviewedAt: null,
      });
      draftsCreated++;
    }
  }

  return { scandalsUpserted, sourcesUpserted, linksUpserted, eventsUpserted, draftsCreated };
}

export function extractScandalSources(post: Pick<WpPost, "content" | "date" | "link">) {
  const urls = new Set<string>([post.link, ZK_ARCHIVE_URL]);
  const $ = cheerio.load(post.content.rendered || "");
  $("a[href]").each((_, element) => {
    const raw = $(element).attr("href");
    if (!raw) return;
    const url = toAbsoluteUrl(raw, post.link);
    if (!url) return;
    if (url.includes("zastavmekorupciu.sk/wp-content")) return;
    if (url.startsWith("mailto:") || url.startsWith("tel:")) return;
    urls.add(url);
  });

  return [...urls]
    .filter((url) => classifyScandalSource(url).trusted)
    .slice(0, 5)
    .map((url, index) => {
      const classified = classifyScandalSource(url);
      return {
        url,
        outletName: classified.outletName,
        publishedDate: post.date.slice(0, 10),
        isPrimary: index === 0,
      };
    });
}

export function extractScandalEvents(
  post: Pick<WpPost, "date" | "modified" | "link">,
  text: string
): PreparedScandalEvent[] {
  const startDate = post.date.slice(0, 10);
  const modifiedDate = post.modified.slice(0, 10);
  const events: PreparedScandalEvent[] = [
    {
      eventDate: startDate,
      titleSk: "Prvy verejne evidovany zaznam",
      descriptionSk: "Kauza bola zachytena vo verejnom zdroji a zaradena do evidencie.",
      eventType: "source_published",
      sourceUrl: post.link,
      sortOrder: 0,
    },
  ];

  const signal = inferProcessSignal(text);
  if (signal) {
    events.push({
      eventDate: startDate,
      titleSk: signal.titleSk,
      descriptionSk: signal.descriptionSk,
      eventType: signal.eventType,
      sourceUrl: post.link,
      sortOrder: 10,
    });
  }

  if (modifiedDate && modifiedDate !== startDate) {
    events.push({
      eventDate: modifiedDate,
      titleSk: "Aktualizacia zdroja",
      descriptionSk: "Povodny zdroj eviduje neskorsiu upravu alebo doplnenie clanku.",
      eventType: "source_updated",
      sourceUrl: post.link,
      sortOrder: 20,
    });
  }

  return dedupeEvents(events).sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.sortOrder - b.sortOrder);
}

function inferProcessSignal(text: string) {
  const value = normalize(text);
  if (hasAny(value, ["odsuden", "pravoplatn", "rozsudok"])) {
    return {
      titleSk: "Procesny signal: rozhodnutie",
      descriptionSk: "Text zdroja obsahuje signal o rozhodnuti alebo rozsudku.",
      eventType: "decision",
    };
  }
  if (hasAny(value, ["zastavil", "zastavene", "zrusil obvinenie", "363"])) {
    return {
      titleSk: "Procesny signal: zastavenie",
      descriptionSk: "Text zdroja obsahuje signal o zastaveni alebo zruseni veci.",
      eventType: "stopped",
    };
  }
  if (hasAny(value, ["obzalob"])) {
    return {
      titleSk: "Procesny signal: obzaloba",
      descriptionSk: "Text zdroja obsahuje signal o obzalobe alebo posune do konania.",
      eventType: "indictment",
    };
  }
  if (hasAny(value, ["obvinen"])) {
    return {
      titleSk: "Procesny signal: obvinenie",
      descriptionSk: "Text zdroja obsahuje signal o obvineni alebo procesnom postaveni.",
      eventType: "charge",
    };
  }
  if (hasAny(value, ["podnet", "trestne oznamenie"])) {
    return {
      titleSk: "Procesny signal: podnet",
      descriptionSk: "Text zdroja obsahuje signal o podnete alebo trestnom oznameni.",
      eventType: "complaint",
    };
  }
  if (hasAny(value, ["vysetru", "preveruje", "riesi"])) {
    return {
      titleSk: "Procesny signal: preverovanie",
      descriptionSk: "Text zdroja obsahuje signal o preverovani alebo vysetrovani.",
      eventType: "investigation",
    };
  }
  return null;
}

function dedupeEvents(events: PreparedScandalEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.eventDate}|${event.titleSk}|${event.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSummary(_title: string, _text: string, matches: MpMatch[]) {
  const actorText = matches.length > 0
    ? ` Verejne rozpoznane prepojenia na politikov v databaze: ${matches.map((mp) => mp.nameDisplay).join(", ")}.`
    : " Prepojenie na konkretneho politika sa nepodarilo spolahlivo sparovat s databazou poslancov.";

  return [
    "Zaznam vychadza z archivu Nadacie Zastavme korupciu a prilozenych verejnych zdrojov.",
    actorText.trim(),
    "Zaznam nepredstavuje vlastny pravny zaver aplikacie.",
  ].join(" ");
}

function inferCategory(text: string) {
  const value = normalize(text);
  if (hasAny(value, ["plagiat", "rigoroz", "diplomov"])) return "plagiatorstvo";
  if (hasAny(value, ["mimovlad", "konflikt zaujmov", "majetkov", "priznani"])) return "konflikt_zaujmov";
  if (hasAny(value, ["rodin", "pribuz", "nominant", "dosaden"])) return "nepotizmus";
  if (hasAny(value, ["podvod", "fiktiv", "danov", "dph"])) return "podvod";
  if (hasAny(value, ["policia", "naka", "prokuratur", "363", "sudna rada"])) return "zneuzitie_moci";
  if (hasAny(value, ["tender", "zakazk", "dotaci", "eurofond", "ppa", "klienteliz"])) return "klientelizmus";
  if (hasAny(value, ["uplat", "korup", "obalk", "provizi"])) return "korupcia";
  return "ine";
}

function inferStatus(text: string) {
  const value = normalize(text);
  if (hasAny(value, ["odsuden", "pravoplatn"])) return "odsudeny";
  if (hasAny(value, ["osloboden"])) return "oslobodeny";
  if (hasAny(value, ["zastavil", "zastavene", "zrusil obvinenie", "363"])) return "zastavene";
  if (hasAny(value, ["pokuta", "disciplinar", "priestup"])) return "disciplinarne_potrestany";
  if (hasAny(value, ["obvinen", "obzalob", "vysetru", "riesi", "preveruje", "europrokuratura"])) return "vysetruje_sa";
  return "prebieha";
}

function inferSeverity(text: string) {
  const value = normalize(text);
  if (hasAny(value, ["odsuden", "obzalob", "uplatok", "korupcia", "eurofond", "europrokuratura"])) return 4;
  if (hasAny(value, ["obvinen", "vysetru", "tender", "zakazka", "dotacia"])) return 3;
  if (hasAny(value, ["pokuta", "priestupok", "konflikt zaujmov"])) return 2;
  return 1;
}

function inferInstitution(text: string) {
  const value = normalize(text);
  if (value.includes("europrokuratura")) return "Europska prokuratura";
  if (value.includes("naka")) return "NAKA";
  if (value.includes("policia")) return "Policia SR";
  if (value.includes("uvo") || value.includes("verejne obstaravanie")) return "UVO";
  if (value.includes("nku")) return "NKU";
  if (value.includes("sud")) return "Sud";
  if (value.includes("prokuratura")) return "Prokuratura";
  return "Kontrolne organy / verejne zdroje";
}

function looksLikeScandalTitle(title: string) {
  const value = normalize(title);
  if (hasAny(value, ["achillove data", "reakcia na vyjadrenie", "mimovladky poslancom"])) return false;
  if (hasAny(value, ["pise do bruselu", "chceme nezavislu", "je v rozpore s pravom eu"])) return false;

  return hasAny(value, [
    "kauza",
    "korup",
    "uplat",
    "obvin",
    "obzal",
    "vysetru",
    "prever",
    "podnet",
    "trestne oznamenie",
    "zakazk",
    "tender",
    "dotaci",
    "eurofond",
    "mimovlad",
    "porus",
    "pokuta",
    "sud",
    "policia",
    "naka",
    "ppa",
    "myto",
    "cistky",
    "dan",
    "odmen",
    "predrazen",
    "stat",
  ]);
}

function cleanHtml(html: string) {
  const $ = cheerio.load(html ?? "");
  $("script, style, nav, footer, header").remove();
  return $.root().text().replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(raw: string, base: string) {
  try {
    return new URL(raw, base).toString().split("#")[0];
  } catch {
    return null;
  }
}

function lastName(name: string) {
  const parts = normalize(name).split(" ").filter(Boolean);
  const last = parts.at(-1);
  return last && last.length >= 4 ? last : null;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}
