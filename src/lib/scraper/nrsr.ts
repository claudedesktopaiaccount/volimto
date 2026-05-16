import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

// ─── Types ────────────────────────────────────────────────

export interface ScrapedMp {
  nrsrPersonId: string;
  nameFull: string;
  nameDisplay: string;
  slug: string;
  partyAbbr: string | null;
  role: string;
  constituency: string | null;
  birthYear: number | null;
  photoUrl: string | null;
}

export interface ScrapedVote {
  nrsrVoteId: string;
  date: string;
  titleSk: string;
  topicCategory: string;
  result: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  votesAbsent: number;
  sourceUrl: string;
}

export interface ScrapedVoteRecord {
  nrsrVoteId: string;
  nrsrPersonId: string;
  choice: string;
}

export interface ScrapedSpeech {
  nrsrSpeechId: string;
  nrsrPersonId: string;
  date: string;
  titleSk: string | null;
  textSk: string;
  sourceUrl: string;
}

// ─── Fetcher ──────────────────────────────────────────────

export type Fetcher = (url: string) => Promise<string>;

const BASE_URL = "https://www.nrsr.sk";
const USER_AGENT =
  "Mozilla/5.0 (compatible; VolimTo/1.0; +https://volimto.sk)";

function defaultFetcher(url: string): Promise<string> {
  return fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": USER_AGENT },
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.text();
  });
}

/**
 * Fetch legislation list for an MP via ASP.NET form POST.
 * The NRSR sslp GET endpoint (zakony/sslp?PredkladatelPoslanecId=X) hangs —
 * it requires a proper form POST with ViewState extracted from a prior GET.
 * Flow: GET sslp form → extract ViewState → POST with mpsCombo=personId →
 * follow 302 redirect → return result HTML.
 */
export async function fetchLegislationHtml(
  personId: string,
  term: number
): Promise<string> {
  const sslpUrl = `${BASE_URL}/web/Default.aspx?sid=zakony/sslp`;
  const headers = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "sk-SK,sk;q=0.9",
  };

  // Step 1: GET the search form to obtain ViewState tokens
  const formResp = await fetch(sslpUrl, {
    signal: AbortSignal.timeout(15_000),
    headers,
  });
  if (!formResp.ok) throw new Error(`sslp form GET: HTTP ${formResp.status}`);
  const formHtml = await formResp.text();

  const vsMatch = formHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const evvMatch = formHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/);
  const vsgMatch = formHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);
  if (!vsMatch || !evvMatch) throw new Error("sslp form: ViewState not found");

  // Collect session cookies from form GET
  const setCookie = formResp.headers.get("set-cookie") ?? "";
  const cookieHeader = setCookie
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

  // Step 2: POST the search form
  const params = new URLSearchParams({
    "__EVENTTARGET": "",
    "__EVENTARGUMENT": "",
    "__LASTFOCUS": "",
    "__VIEWSTATE": vsMatch[1],
    "__VIEWSTATEGENERATOR": vsgMatch?.[1] ?? "",
    "__SCROLLPOSITIONX": "0",
    "__SCROLLPOSITIONY": "0",
    "__EVENTVALIDATION": evvMatch[1],
    "_sectionLayoutContainer$ctl01$ctlNazov": "",
    "_sectionLayoutContainer$ctl01$ctlCPT": "",
    "_sectionLayoutContainer$ctl01$ctlPredkladatelName": "",
    "_sectionLayoutContainer$ctl01$_Ciastka": "",
    "_sectionLayoutContainer$ctl01$_Cislo": "",
    "_sectionLayoutContainer$ctl01$ctlCisObdobia": String(term),
    "_sectionLayoutContainer$ctl01$ctlCategory": "-1",
    "_sectionLayoutContainer$ctl01$ctlPredkladatel": "0",  // Poslanci NR SR
    "_sectionLayoutContainer$ctl01$_mpsCombo": personId,
    "_sectionLayoutContainer$ctl01$ctlView": "Podatelna",
    "_sectionLayoutContainer$ctl01$cmdSearch": "Vyhľadať",
  });

  const postResp = await fetch(sslpUrl, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": BASE_URL,
      "Referer": sslpUrl,
      ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
    },
    body: params.toString(),
  });

  if (!postResp.ok) throw new Error(`sslp POST: HTTP ${postResp.status}`);
  return postResp.text();
}

// ─── Slug ────────────────────────────────────────────────

export function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áä]/g, "a")
    .replace(/[čć]/g, "c")
    .replace(/[ď]/g, "d")
    .replace(/[éě]/g, "e")
    .replace(/[íî]/g, "i")
    .replace(/[ĺľ]/g, "l")
    .replace(/[ňń]/g, "n")
    .replace(/[óô]/g, "o")
    .replace(/[řŕ]/g, "r")
    .replace(/[šś]/g, "s")
    .replace(/[ťţ]/g, "t")
    .replace(/[úů]/g, "u")
    .replace(/[ý]/g, "y")
    .replace(/[žź]/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Category / Result mapping ────────────────────────────

export function mapTopicCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("zákon") || t.includes("novela")) return "zákon";
  if (t.includes("rozpočet") || t.includes("rozpočt")) return "rozpočet";
  if (t.includes("personálne") || t.includes("voľba")) return "personálne";
  if (
    t.includes("zahraniční") ||
    t.includes("zahranič") ||
    t.includes("medzinárod")
  )
    return "zahranično-politické";
  return "iné";
}

export function mapResult(raw: string): string {
  const r = raw.toLowerCase().trim();
  if (r.includes("zamietnut") || r.includes("neprijat")) return "zamietnuté";
  if (r.includes("prijat") || r.includes("schválen")) return "schválené";
  if (r.includes("odroč")) return "odročené";
  console.warn("[nrsr] mapResult: unmatched outcome:", raw);
  return "neznámy";
}

export function mapChoice(raw: string): string {
  switch (raw.trim().toUpperCase()) {
    case "Z":
      return "za";
    case "P":
      return "proti";
    case "N":
      return "zdržal_sa";
    case "B":
      return "neprítomný";
    default:
      return "nehlasoval";
  }
}

// ─── scrapeIndependentMps ─────────────────────────────────

export async function scrapeIndependentMps(
  fetcher: Fetcher = defaultFetcher
): Promise<Set<string>> {
  const url = `${BASE_URL}/web/Default.aspx?sid=poslanci/kluby/nezavisli`;
  try {
    const html = await fetcher(url);
    return parseIndependentIds(html);
  } catch (err) {
    console.error("[nrsr] scrapeIndependentMps error:", err);
    return new Set();
  }
}

export function parseIndependentIds(html: string): Set<string> {
  const ids = new Set<string>();
  const re = /PoslanecID=(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return ids;
}

// ─── scrapeM ps ──────────────────────────────────────────

/**
 * Scrapes list of MPs from NRSR.
 * URL: https://www.nrsr.sk/web/Default.aspx?sid=poslanci/zoznam_adv
 */
export async function scrapeMps(fetcher: Fetcher = defaultFetcher): Promise<ScrapedMp[]> {
  const url = `${BASE_URL}/web/Default.aspx?sid=poslanci/zoznam_adv`;
  try {
    const html = await fetcher(url);
    return parseMpList(html);
  } catch (err) {
    console.error("[nrsr] scrapeMps error:", err);
    return [];
  }
}

export function parseMpList(html: string): ScrapedMp[] {
  const $ = cheerio.load(html);
  const mps: ScrapedMp[] = [];

  // NRSR renders MPs in a table with class "tab_zoznam" or similar
  // Each row: link to poslanec detail page with PoslanecID param
  $("table tr, .poslanci-zoznam tr, tr").each((_, row) => {
    const $row = $(row);

    // Skip header rows
    if ($row.find("th").length > 0) return;

    // Find anchor with PoslanecID
    const $link = $row.find("a[href*='PoslanecID']").first();
    if (!$link.length) return;

    const href = $link.attr("href") ?? "";
    const idMatch = href.match(/PoslanecID=(\d+)/i);
    if (!idMatch) return;

    const nrsrPersonId = idMatch[1];
    const nameFull = $link.text().trim();
    if (!nameFull) return;

    // Name display: last name, first name → "First Last"
    // NRSR format is typically "Fico Robert" or "Fico, Robert"
    const nameParts = nameFull.replace(",", "").split(/\s+/);
    const nameDisplay =
      nameParts.length >= 2
        ? `${nameParts[nameParts.length - 1]} ${nameParts.slice(0, -1).join(" ")}`.trim()
        : nameFull.trim();

    const slug = makeSlug(nameDisplay);

    // Party abbreviation: usually in a separate td
    const cells = $row.find("td");
    let partyAbbr: string | null = null;
    let constituency: string | null = null;

    cells.each((i, td) => {
      const text = $(td).text().trim();
      // Party abbr: short (2–6 chars), all caps or known pattern
      if (i === 1 && text && text.length <= 10 && !text.includes(" ")) {
        partyAbbr = text || null;
      }
      // Constituency: typically longer text in later columns
      if (i >= 2 && text && text.length > 5 && !constituency) {
        constituency = text;
      }
    });

    // Photo: look for img near the link
    const $img = $row.find("img").first();
    const photoSrc = $img.attr("src") ?? null;
    const photoUrl = photoSrc
      ? photoSrc.startsWith("http")
        ? photoSrc
        : `${BASE_URL}${photoSrc}`
      : null;

    mps.push({
      nrsrPersonId,
      nameFull,
      nameDisplay,
      slug,
      partyAbbr,
      role: "poslanec",
      constituency,
      birthYear: null,
      photoUrl,
    });
  });

  return mps;
}

// ─── scrapeRecentVotes ────────────────────────────────────

const VOTES_LIST_URL = `${BASE_URL}/web/Default.aspx?sid=schodze/hlasovanie/hlasovanie_zoznam&CisObdobia=9`;
const VOTE_DETAIL_URL = `${BASE_URL}/web/Default.aspx?sid=schodze/hlasovanie/hlasovanie&ID=`;

export async function scrapeRecentVotes(
  limit: number = 100,
  fetcher: Fetcher = defaultFetcher
): Promise<{ votes: ScrapedVote[]; records: ScrapedVoteRecord[] }> {
  try {
    const listHtml = await fetcher(VOTES_LIST_URL);
    const voteIds = parseVoteIds(listHtml, limit);

    const allVotes: ScrapedVote[] = [];
    const allRecords: ScrapedVoteRecord[] = [];

    // Fetch details sequentially to be polite to server
    for (const voteId of voteIds) {
      try {
        const detailUrl = `${VOTE_DETAIL_URL}${voteId}`;
        const detailHtml = await fetcher(detailUrl);
        const { vote, records } = parseVoteDetail(detailHtml, voteId, detailUrl);
        if (vote) {
          allVotes.push(vote);
          allRecords.push(...records);
        }
      } catch (err) {
        console.error(`[nrsr] vote detail ${voteId} error:`, err);
      }
    }

    return { votes: allVotes, records: allRecords };
  } catch (err) {
    console.error("[nrsr] scrapeRecentVotes error:", err);
    return { votes: [], records: [] };
  }
}

export function parseVoteIds(html: string, limit: number): string[] {
  const $ = cheerio.load(html);
  const ids: string[] = [];
  const seen = new Set<string>();

  $("a[href*='hlasovanie&ID='], a[href*='hlasovanie_detail'], a[href*='ID=']").each((_, el) => {
    if (ids.length >= limit) return false;
    const href = $(el).attr("href") ?? "";
    const match = href.match(/[?&]ID=(\d+)/i);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      ids.push(match[1]);
    }
  });

  return ids;
}

export function parseVoteDetail(
  html: string,
  nrsrVoteId: string,
  sourceUrl: string
): { vote: ScrapedVote | null; records: ScrapedVoteRecord[] } {
  const $ = cheerio.load(html);
  const records: ScrapedVoteRecord[] = [];

  // Extract vote metadata
  const bodyText = $("body").text();

  // Title: look for h1, h2 or specific labeled cell
  let titleSk =
    $("h1").first().text().trim() ||
    $("h2").first().text().trim() ||
    $(".vote-title, .hlasovanie-title, #ctl00_MainContent_NadpisHlasovaniaLabel")
      .first()
      .text()
      .trim() ||
    $("td:contains('Predmet'), td:contains('Názov')")
      .next("td")
      .first()
      .text()
      .trim();

  if (!titleSk) {
    // Fallback: find a descriptive-looking label in the page
    $("td, th, label").each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 15 && t.length < 300 && !titleSk) {
        titleSk = t;
      }
    });
  }

  if (!titleSk) titleSk = `Hlasovanie #${nrsrVoteId}`;

  // Date
  let date = "";
  const dateMatch = bodyText.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    date = `${dateMatch[3]}-${month}-${day}`;
  } else {
    date = new Date().toISOString().slice(0, 10);
  }

  // Vote counts — look for labeled numbers
  let votesFor = 0;
  let votesAgainst = 0;
  let votesAbstain = 0;
  let votesAbsent = 0;

  // NRSR typically shows: Za: X  Proti: X  Zdržal sa: X  Neprítomní: X
  const forMatch = bodyText.match(/[Zz]a[:\s]+(\d+)/);
  const againstMatch = bodyText.match(/[Pp]roti[:\s]+(\d+)/);
  const abstainMatch = bodyText.match(/[Zz]držal[:\s]+(\d+)/);
  const absentMatch = bodyText.match(/[Nn]eprítomn[íi][:\s]+(\d+)/);

  if (forMatch) votesFor = parseInt(forMatch[1], 10);
  if (againstMatch) votesAgainst = parseInt(againstMatch[1], 10);
  if (abstainMatch) votesAbstain = parseInt(abstainMatch[1], 10);
  if (absentMatch?.[1]) votesAbsent = parseInt(absentMatch[1], 10);

  // Result
  let rawResult = "";
  const resultMatch = bodyText.match(/[Vv]ýsledok[:\s]+([^\n\r.]+)/);
  if (resultMatch) rawResult = resultMatch[1].trim();
  const result = mapResult(rawResult);

  const vote: ScrapedVote = {
    nrsrVoteId,
    date,
    titleSk,
    topicCategory: mapTopicCategory(titleSk),
    result,
    votesFor,
    votesAgainst,
    votesAbstain,
    votesAbsent,
    sourceUrl,
  };

  // Per-MP vote records — NRSR shows table with MP name + vote choice
  // Typical: table with columns for MP and their choice (Z/P/N/B/?)
  $("table tr").each((_, row) => {
    const $row = $(row);
    const $link = $row.find("a[href*='PoslanecID']").first();
    if (!$link.length) return;

    const personHref = $link.attr("href") ?? "";
    const personMatch = personHref.match(/PoslanecID=(\d+)/i);
    if (!personMatch) return;

    const nrsrPersonId = personMatch[1];

    // Choice: look for Z/P/N/B/? in cells
    let choiceRaw = "?";
    $row.find("td").each((_, td) => {
      const t = $(td).text().trim();
      if (/^[ZPNB?]$/.test(t)) {
        choiceRaw = t;
        return false;
      }
    });

    records.push({
      nrsrVoteId,
      nrsrPersonId,
      choice: mapChoice(choiceRaw),
    });
  });

  return { vote, records };
}

// ─── scrapeRecentSpeeches ─────────────────────────────────

const SPEECHES_URL = `${BASE_URL}/web/Default.aspx?sid=schodze/stenozaznamy`;

export async function scrapeRecentSpeeches(
  limit: number = 50,
  fetcher: Fetcher = defaultFetcher
): Promise<ScrapedSpeech[]> {
  try {
    const html = await fetcher(SPEECHES_URL);
    return parseSpeechesList(html, limit);
  } catch (err) {
    console.error("[nrsr] scrapeRecentSpeeches error:", err);
    return [];
  }
}

export function parseSpeechesList(html: string, limit: number): ScrapedSpeech[] {
  const $ = cheerio.load(html);
  const speeches: ScrapedSpeech[] = [];
  const seen = new Set<string>();

  // NRSR stenographic records: links to individual speeches
  // Each entry typically has: date, MP name link, speech text or title
  $("table tr, .stenozaznam-row, tr").each((_, row) => {
    if (speeches.length >= limit) return false;
    const $row = $(row);
    if ($row.find("th").length > 0) return;

    const $personLink = $row.find("a[href*='PoslanecID']").first();
    // Speech link: any anchor with ID= that is NOT a person link
    const $speechLink = $row
      .find("a[href*='ID=']")
      .filter((_, el) => !$(el).attr("href")?.includes("PoslanecID"))
      .first();

    // Need at least a person or speech link
    const $anyLink = $personLink.length ? $personLink : $speechLink;
    if (!$anyLink.length) return;

    // Extract speech ID from speech link — skip if not parseable
    const speechHref = $speechLink.attr("href") ?? "";
    const speechIdMatch = speechHref.match(/[?&]ID=(\d+)/i);
    if (!speechIdMatch?.[1]) {
      console.warn("[nrsr] speech without parseable ID, skipping");
      return;
    }
    const nrsrSpeechId = speechIdMatch[1];

    if (seen.has(nrsrSpeechId)) return;
    seen.add(nrsrSpeechId);

    // Person ID
    const personHref = $personLink.attr("href") ?? "";
    const personMatch = personHref.match(/PoslanecID=(\d+)/i);
    if (!personMatch) return;
    const nrsrPersonId = personMatch[1];

    // Date
    let date = "";
    const cells = $row.find("td");
    const rowText = $row.text();
    const dateMatch = rowText.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, "0");
      const month = dateMatch[2].padStart(2, "0");
      date = `${dateMatch[3]}-${month}-${day}`;
    } else {
      date = new Date().toISOString().slice(0, 10);
    }

    // Title: first non-empty text cell that isn't the name or date
    let titleSk: string | null = null;
    let textSk = "";

    cells.each((i, td) => {
      const t = $(td).text().trim();
      if (i === 0) return; // usually date col or name col
      if (t.length > 20 && !titleSk && !t.match(/^\d/)) {
        titleSk = t.slice(0, 200);
        textSk = t;
      }
    });

    if (!textSk) textSk = rowText.trim().slice(0, 500);

    const sourceUrl = speechHref
      ? speechHref.startsWith("http")
        ? speechHref
        : `${BASE_URL}${speechHref}`
      : `${SPEECHES_URL}`;

    speeches.push({
      nrsrSpeechId,
      nrsrPersonId,
      date,
      titleSk,
      textSk,
      sourceUrl,
    });
  });

  return speeches;
}

// ─── scrapeMpActivities — per-MP NRSR enrichment ──────────

export interface ScrapedInterpellation {
  date: string;
  addressee: string | null;
  subject: string;
  url: string;
  answerUrl: string | null;
}

export interface ScrapedQuestion {
  date: string;
  subject: string;
  url: string;
}

export interface ScrapedLegislationItem {
  cisloTlace: string | null;
  title: string;
  date: string;
  status: string | null;
  url: string;
}

export interface ScrapedAmendment {
  toLaw: string;
  date: string;
  url: string;
}

export interface ScrapedForeignTrip {
  date: string;
  country: string;
  purpose: string | null;
  costEur: number | null;
  sourceUrl: string;
}

export interface ScrapedAssistant {
  name: string;
  type: string | null;
}

export interface ScrapedOffice {
  address: string;
  city: string | null;
}

export interface ScrapedMpActivities {
  interpellations: ScrapedInterpellation[];
  questions: ScrapedQuestion[];
  legislation: ScrapedLegislationItem[];
  amendments: ScrapedAmendment[];
  trips: ScrapedForeignTrip[];
  assistants: ScrapedAssistant[];
  offices: ScrapedOffice[];
}

const MP_ACTIVITY_URLS = (personId: string, term: number) => ({
  interpellations: `${BASE_URL}/web/Default.aspx?sid=schodze/interpelacie_result&ZadavatelId=${personId}&CisObdobia=${term}`,
  questions:      `${BASE_URL}/web/Default.aspx?sid=schodze/ho_result&AssignerId=${personId}&CisObdobia=${term}`,
  legislation:    `${BASE_URL}/web/Default.aspx?sid=zakony/sslp&PredkladatelID=0&PredkladatelPoslanecId=${personId}&CisObdobia=${term}`,
  amendments:     `${BASE_URL}/web/Default.aspx?sid=schodze/nrepdn&CisObdobia=${term}&PoslanecMasterID=${personId}`,
  trips:          `${BASE_URL}/web/Default.aspx?sid=poslanci/zpc&PoslanecID=${personId}&CisObdobia=${term}`,
  assistants:     `${BASE_URL}/web/Default.aspx?sid=poslanci/posl_asistenti&PoslanecID=${personId}&CisObdobia=${term}`,
  offices:        `${BASE_URL}/web/Default.aspx?sid=poslanci/kancelarie&PoslanecID=${personId}&CisObdobia=${term}`,
});

function parseSlovakDate(raw: string): string | null {
  // "06. 02. 2024" | "10. 1. 2024" | "1. 6. 2025"
  const m = raw.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function absUrl(href: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  return `${BASE_URL}/web/${href.replace(/^\/?web\//, "")}`;
}

function parseEur(raw: string): number | null {
  // "2 314,00 €" → 2314.00
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : null;
}

/** Parse a tab_zoznam table and return raw row cell texts (header row skipped). */
function parseTabZoznamRows(
  $: cheerio.CheerioAPI,
  tableSelector: string
): { cells: string[]; cellHtml: string[]; row: cheerio.Cheerio<AnyNode> }[] {
  const rows: { cells: string[]; cellHtml: string[]; row: cheerio.Cheerio<AnyNode> }[] = [];
  $(`${tableSelector} tr`).each((_, tr) => {
    const $tr = $(tr);
    if ($tr.find("th").length > 0) return;
    const cells: string[] = [];
    const cellHtml: string[] = [];
    $tr.find("td").each((_, td) => {
      const $td = $(td);
      cells.push($td.text().replace(/\s+/g, " ").trim());
      cellHtml.push($td.html() ?? "");
    });
    if (cells.length === 0) return;
    rows.push({ cells, cellHtml, row: $tr });
  });
  return rows;
}

export function parseInterpellationsList(html: string): ScrapedInterpellation[] {
  const $ = cheerio.load(html);
  const out: ScrapedInterpellation[] = [];
  // Columns observed: [Popis, Stav, Dátum, Zadávateľ, Klub, Adresát]
  const rows = parseTabZoznamRows($, "table.tab_zoznam");
  for (const r of rows) {
    if (r.cells.length < 6) continue;
    const subject = r.cells[0];
    const date = parseSlovakDate(r.cells[2]);
    if (!date) continue;
    const addressee = r.cells[5] || null;
    const $link = r.row.find("a[href*='schodze/interpelacia']").first();
    const href = $link.attr("href") ?? "";
    if (!href) continue;
    const url = absUrl(href);
    out.push({ date, addressee, subject, url, answerUrl: null });
  }
  return out;
}

export function parseQuestionsList(html: string): ScrapedQuestion[] {
  const $ = cheerio.load(html);
  const out: ScrapedQuestion[] = [];
  // Columns observed: [Stav, Dátum, Predkladateľ, Adresát, Otázka]
  const rows = parseTabZoznamRows($, "table.tab_zoznam");
  for (const r of rows) {
    if (r.cells.length < 5) continue;
    const date = parseSlovakDate(r.cells[1]);
    if (!date) continue;
    const subject = r.cells[4];
    const $link = r.row.find("a[href*='ho_detail']").first();
    const href = $link.attr("href") ?? "";
    if (!href) continue;
    out.push({ date, subject, url: absUrl(href) });
  }
  return out;
}

export function parseLegislationList(html: string): ScrapedLegislationItem[] {
  const $ = cheerio.load(html);
  const out: ScrapedLegislationItem[] = [];
  // SSLP result grid columns (observed from POST response):
  //   [0] Návrh zákona (title, long text with link to zakon/zakon)
  //   [1] ČPT (cisloTlace, numeric, with link to cpt)
  //   [2] Stav (status, short text e.g. "Evidencia")
  //   [3] Doručený (date submitted)
  //   [4] Schválený (date approved, may be empty)
  //   [5] Predkladateľ  [6] Kategória
  // "nie sú evidované" message = no legislation → returns []
  const rows = parseTabZoznamRows($, "table.tab_zoznam");
  for (const r of rows) {
    if (r.cells.length < 3) continue;
    // col 0 = title (first cell with link to zakon)
    const title = r.cells[0];
    if (!title || title.length < 5) continue;
    // col 1 = cisloTlace (numeric)
    const cisloTlace = /^\d{1,5}$/.test(r.cells[1]) ? r.cells[1] : null;
    // col 2 = status
    const status = r.cells[2] || null;
    // col 3 = date submitted (Doručený)
    const date = parseSlovakDate(r.cells[3]);
    if (!date) continue;
    const $link = r.row.find("a[href*='zakon']").first();
    const href = $link.attr("href") ?? "";
    if (!href) continue;
    out.push({ cisloTlace, title, date, status, url: absUrl(href) });
  }
  return out;
}

export function parseAmendmentsList(html: string): ScrapedAmendment[] {
  const $ = cheerio.load(html);
  const out: ScrapedAmendment[] = [];
  // Columns observed: [Dátum podania, Predkladateľ, K ČPT, Názov, Č. schôdze, Hlasovanie]
  const rows = parseTabZoznamRows($, "table.tab_zoznam");
  for (const r of rows) {
    if (r.cells.length < 4) continue;
    const date = parseSlovakDate(r.cells[0]);
    if (!date) continue;
    const toLaw = r.cells[3];
    const $link = r.row.find("a[href*='nrepdn_detail']").first();
    const href = $link.attr("href") ?? "";
    if (!href || !toLaw) continue;
    out.push({ toLaw, date, url: absUrl(href) });
  }
  return out;
}

export function parseForeignTripsList(html: string, sourceUrl: string): ScrapedForeignTrip[] {
  const $ = cheerio.load(html);
  const msg = $("#_sectionLayoutContainer_ctl01__Message").text();
  if (msg && /nie je evidovan/i.test(msg)) return [];
  const out: ScrapedForeignTrip[] = [];
  // Columns observed: [Dátum, Popis pracovnej cesty]. Date may be a range
  // ("12. - 15. 1. 2025"); country is the first segment of Popis before " - ".
  const rows = parseTabZoznamRows($, "table.tab_zoznam");
  for (const r of rows) {
    if (r.cells.length < 2) continue;
    const dateRaw = r.cells[0];
    const popis = r.cells[1];
    if (!dateRaw || !popis) continue;
    // Pick the LAST date token in the range — that's the canonical d.m.y.
    const lastDateMatch = dateRaw.match(/(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/g);
    const date = lastDateMatch
      ? parseSlovakDate(lastDateMatch[lastDateMatch.length - 1])
      : parseSlovakDate(dateRaw);
    if (!date) continue;
    const dashIdx = popis.indexOf(" - ");
    const country = (dashIdx > 0 ? popis.slice(0, dashIdx) : popis).trim();
    const purpose = dashIdx > 0 ? popis.slice(dashIdx + 3).trim() : null;
    if (!country) continue;
    out.push({ date, country, purpose, costEur: null, sourceUrl });
  }
  return out;
}

export function parseAssistantsList(html: string): ScrapedAssistant[] {
  const $ = cheerio.load(html);
  const out: ScrapedAssistant[] = [];
  const rows = parseTabZoznamRows($, "table.tab_zoznam");
  // Columns observed: [Asistenti, Od, Do, Mesačná odmena]
  for (const r of rows) {
    const name = r.cells[0];
    if (!name) continue;
    out.push({ name, type: null });
  }
  return out;
}

export function parseOfficesList(html: string): ScrapedOffice[] {
  const $ = cheerio.load(html);
  const msg = $("#_sectionLayoutContainer_ctl01__Message").text();
  if (msg && /nie sú evidované/i.test(msg)) return [];
  const out: ScrapedOffice[] = [];
  const rows = parseTabZoznamRows($, "table.tab_zoznam");
  for (const r of rows) {
    if (r.cells.length === 0) continue;
    const address = r.cells[0];
    const city = r.cells[1] || null;
    if (!address || address.length < 3) continue;
    out.push({ address, city });
  }
  return out;
}

export async function scrapeMpActivities(
  nrsrPersonId: string,
  term: number = 9,
  fetcher: Fetcher = defaultFetcher
): Promise<ScrapedMpActivities> {
  const urls = MP_ACTIVITY_URLS(nrsrPersonId, term);
  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); }
    catch (err) {
      console.error(`[nrsr] mp ${nrsrPersonId} ${label} error:`, err);
      return fallback;
    }
  };
  // Sequential to be polite
  const interpellations = await safe("interpellations",
    async () => parseInterpellationsList(await fetcher(urls.interpellations)), []);
  await sleep(400);
  const questions = await safe("questions",
    async () => parseQuestionsList(await fetcher(urls.questions)), []);
  await sleep(400);
  const legislation = await safe("legislation",
    async () => parseLegislationList(await fetcher(urls.legislation)), []);
  await sleep(400);
  const amendments = await safe("amendments",
    async () => parseAmendmentsList(await fetcher(urls.amendments)), []);
  await sleep(400);
  const trips = await safe("trips",
    async () => parseForeignTripsList(await fetcher(urls.trips), urls.trips), []);
  await sleep(400);
  const assistants = await safe("assistants",
    async () => parseAssistantsList(await fetcher(urls.assistants)), []);
  await sleep(400);
  const offices = await safe("offices",
    async () => parseOfficesList(await fetcher(urls.offices)), []);

  return { interpellations, questions, legislation, amendments, trips, assistants, offices };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
