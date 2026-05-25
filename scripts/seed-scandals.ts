/**
 * Import a curated baseline of Slovak public-affairs scandals.
 *
 * Source policy:
 * - pulls from the "Kauzy" archive of Nadácia Zastavme korupciu
 * - keeps only records since 2011-05-23
 * - stores at least two public source URLs per record
 * - links politicians only when an existing mps row matches by full name or unique surname
 *
 * Usage:
 *   npx tsx scripts/seed-scandals.ts --limit=80
 */
import "dotenv/config";
import * as cheerio from "cheerio";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { mps, scandals, scandalPoliticianLinks, scandalSources } from "../src/lib/db/schema";

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

interface PreparedScandal {
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
  mpIds: number[];
}

function excluded(columnName: string) {
  return sql.raw(`excluded.${columnName}`);
}

function numberArg(name: string, fallback: number): number {
  const raw = process.argv.slice().reverse().find((arg) => arg.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : fallback;
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

async function loadMpMatcher(): Promise<(text: string) => MpMatch[]> {
  const db = getDb();
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
    console.warn(`[seed:scandals] failed to fetch page ${post.link}: ${(error as Error).message}`);
  }

  const text = cleanHtml(`${title} ${post.excerpt.rendered} ${html}`);
  const mpMatches = matchMps(text);
  const sources = extractSources(post);
  if (sources.length < 2) return null;

  return {
    slug: `zk-${post.slug}`,
    titleSk: title,
    summarySk: buildSummary(title, text, mpMatches),
    startDate: date,
    status: inferStatus(text),
    category: inferCategory(text),
    institutionInvestigating: inferInstitution(text),
    severity: inferSeverity(text),
    sources,
    mpIds: mpMatches.map((mp) => mp.id),
  };
}

async function upsertPrepared(items: PreparedScandal[]) {
  const db = getDb();
  let scandalsUpserted = 0;
  let sourcesUpserted = 0;
  let linksUpserted = 0;

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

    await db.delete(scandalSources).where(eq(scandalSources.scandalId, row.id));
    for (const source of item.sources) {
      const result = await db
        .insert(scandalSources)
        .values({ scandalId: row.id, ...source })
        .onConflictDoNothing({
          target: [scandalSources.scandalId, scandalSources.url],
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
          roleInScandal: "verejne_spomenuty",
        })
        .onConflictDoNothing({
          target: [scandalPoliticianLinks.scandalId, scandalPoliticianLinks.mpId],
        })
        .returning({ id: scandalPoliticianLinks.id });
      linksUpserted += result.length;
    }
  }

  return { scandalsUpserted, sourcesUpserted, linksUpserted };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL. Add Neon Postgres connection string to .env first.");
  }

  const limit = numberArg("limit", DEFAULT_LIMIT);
  const matchMps = await loadMpMatcher();
  const posts = await fetchZastavmePosts(limit);
  const prepared: PreparedScandal[] = [];
  const unresolved: string[] = [];

  for (const post of posts) {
    const item = await prepareScandal(post, matchMps);
    if (!item) continue;
    prepared.push(item);
    if (item.mpIds.length === 0) unresolved.push(item.titleSk);
    console.log(`[seed:scandals] prepared ${prepared.length}/${limit}: ${item.titleSk}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const result = await upsertPrepared(prepared);
  console.log("[seed:scandals] done", JSON.stringify({ ...result, unresolved: unresolved.length }, null, 2));
  if (unresolved.length > 0) {
    console.warn("[seed:scandals] unresolved politician links:");
    for (const title of unresolved.slice(0, 20)) console.warn(`  - ${title}`);
    if (unresolved.length > 20) console.warn(`  ... ${unresolved.length - 20} more`);
  }
}

function extractSources(post: WpPost) {
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

  return [...urls].slice(0, 5).map((url, index) => ({
    url,
    outletName: outletName(url),
    publishedDate: post.date.slice(0, 10),
    isPrimary: index === 0,
  }));
}

function buildSummary(_title: string, _text: string, matches: MpMatch[]) {
  const actorText = matches.length > 0
    ? ` Verejne rozpoznané prepojenia na politikov v databáze: ${matches.map((mp) => mp.nameDisplay).join(", ")}.`
    : " Prepojenie na konkrétneho politika sa nepodarilo spoľahlivo spárovať s databázou poslancov.";

  return [
    "Záznam vychádza z archívu Nadácie Zastavme korupciu a priložených verejných zdrojov.",
    actorText.trim(),
    "Záznam nepredstavuje vlastný právny záver aplikácie.",
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
  if (value.includes("europrokuratura")) return "Európska prokuratúra";
  if (value.includes("naka")) return "NAKA";
  if (value.includes("policia")) return "Polícia SR";
  if (value.includes("uvo") || value.includes("verejne obstaravanie")) return "ÚVO";
  if (value.includes("nku")) return "NKÚ";
  if (value.includes("sud")) return "Súd";
  if (value.includes("prokuratura")) return "Prokuratúra";
  return "Kontrolné orgány / verejné zdroje";
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

function outletName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("zastavmekorupciu.sk")) return "Nadácia Zastavme korupciu";
    return host;
  } catch {
    return "Verejný zdroj";
  }
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
