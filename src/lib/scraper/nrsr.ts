import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type {
  ScrapedMp,
  ScrapedVote,
  ScrapedVoteRecord,
  ScrapedSpeech,
  ScrapedMpActivities,
  ScrapedInterpellation,
  ScrapedQuestion,
  ScrapedLegislationItem,
  ScrapedAmendment,
  ScrapedForeignTrip,
  ScrapedAssistant,
  ScrapedOffice,
} from "@/lib/nrsr-types";

export type {
  ScrapedMp,
  ScrapedVote,
  ScrapedVoteRecord,
  ScrapedSpeech,
  ScrapedMpActivities,
  ScrapedInterpellation,
  ScrapedQuestion,
  ScrapedAmendment,
  ScrapedForeignTrip,
  ScrapedAssistant,
  ScrapedOffice,
} from "@/lib/nrsr-types";

// ─── Types ────────────────────────────────────────────────

// ─── Fetcher ──────────────────────────────────────────────

export type Fetcher = (url: string) => Promise<string>;

const BASE_URL = "https://www.nrsr.sk";
const USER_AGENT =
  "Mozilla/5.0 (compatible; VolimTo/1.0; +https://volimto.sk)";
const FETCH_TIMEOUT_MS = 30_000;
const LEGISLATION_TIMEOUT_MS = 45_000;
const FETCH_ATTEMPTS = 3;
const NRSR_MIN_REQUEST_DELAY_MS = 800;
const NRSR_REQUEST_JITTER_MS = 400;
const DEFAULT_RATE_LIMIT_RETRY_MS = 60 * 60 * 1000;

class NrsrRateLimitError extends Error {
  readonly retryAfterMs: number;
  readonly url: string;

  constructor(url: string, retryAfterMs: number) {
    super(`HTTP 429 for ${url}`);
    this.name = "NrsrRateLimitError";
    this.retryAfterMs = retryAfterMs;
    this.url = url;
  }
}

class NrsrHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;
  readonly url: string;

  constructor(url: string, status: number, retryAfterMs: number | null) {
    super(`HTTP ${status} for ${url}`);
    this.name = "NrsrHttpError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.url = url;
  }
}

let nrsrQueue: Promise<void> = Promise.resolve();
let lastNrsrRequestAt = 0;

export function parseRetryAfterMs(raw: string | null, nowMs: number = Date.now()): number | null {
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - nowMs);
  return null;
}

export function isNrsrRateLimitError(error: unknown): error is NrsrRateLimitError {
  return error instanceof NrsrRateLimitError;
}

function retryAfterFromError(error: unknown): number | null {
  if (error instanceof NrsrRateLimitError) return error.retryAfterMs;
  if (error instanceof NrsrHttpError) return error.retryAfterMs;
  return null;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof NrsrRateLimitError) return false;
  if (error instanceof NrsrHttpError) return [502, 503, 504].includes(error.status);
  if (error instanceof DOMException && error.name === "TimeoutError") return true;
  if (error instanceof Error && /timeout|terminated|ECONNRESET|ETIMEDOUT/i.test(error.message)) return true;
  return false;
}

async function runThrottledNrsrRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = nrsrQueue.then(async () => {
    const elapsed = Date.now() - lastNrsrRequestAt;
    const jitter = Math.floor(Math.random() * NRSR_REQUEST_JITTER_MS);
    const waitMs = Math.max(0, NRSR_MIN_REQUEST_DELAY_MS + jitter - elapsed);
    if (waitMs > 0) await sleep(waitMs);

    try {
      return await fn();
    } finally {
      lastNrsrRequestAt = Date.now();
    }
  });

  nrsrQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function throttledFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return runThrottledNrsrRequest(async () => {
    const headers = Object.fromEntries(new Headers(init.headers));
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        ...headers,
        "User-Agent": USER_AGENT,
      },
    });

    if (response.status === 429) {
      const retryAfterMs =
        parseRetryAfterMs(response.headers.get("retry-after")) ?? DEFAULT_RATE_LIMIT_RETRY_MS;
      throw new NrsrRateLimitError(url, retryAfterMs);
    }

    if (!response.ok) {
      throw new NrsrHttpError(url, response.status, parseRetryAfterMs(response.headers.get("retry-after")));
    }

    return response;
  });
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts: number = FETCH_ATTEMPTS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error instanceof NrsrRateLimitError) throw error;
      if (attempt < attempts && isRetryableError(error)) {
        await sleep(retryAfterFromError(error) ?? 800 * attempt);
      } else {
        break;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed`);
}

function defaultFetcher(url: string): Promise<string> {
  return withRetry(`GET ${url}`, async () => {
    const response = await throttledFetch(url, {}, FETCH_TIMEOUT_MS);
    return response.text();
  });
}

/**
 * Fetch legislation list for an MP via ASP.NET form POST.
 * The NRSR sslp GET endpoint (zakony/sslp?PredkladatelPoslanecId=X) hangs —
 * it requires a proper form POST with ViewState extracted from a prior GET.
 * Flow: GET sslp form → extract ViewState → POST with mpsCombo=personId →
 * follow 302 redirect → return result HTML.
 */
function fetchLegislationHtml(
  personId: string,
  term: number
): Promise<string> {
  return withRetry(`sslp ${personId}`, () => fetchLegislationHtmlOnce(personId, term));
}

async function fetchLegislationHtmlOnce(
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
  const formResp = await throttledFetch(sslpUrl, { headers }, LEGISLATION_TIMEOUT_MS);
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

  const postResp = await throttledFetch(sslpUrl, {
    method: "POST",
    redirect: "follow",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": BASE_URL,
      "Referer": sslpUrl,
      ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
    },
    body: params.toString(),
  }, LEGISLATION_TIMEOUT_MS);

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

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function stripDiacritics(raw: string): string {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function stableHash(raw: string): string {
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ─── Category / Result mapping ────────────────────────────

export function mapTopicCategory(title: string): string {
  const t = title.toLowerCase();
  const n = stripDiacritics(t);
  if (n.includes("zakon") || t.includes("novela")) return "zákon";
  if (n.includes("rozpocet") || n.includes("rozpoct")) return "rozpočet";
  if (n.includes("personalne") || n.includes("volba")) return "personálne";
  if (
    n.includes("zahranic") ||
    n.includes("medzinarod")
  )
    return "zahranično-politické";
  return "iné";
}

export function mapResult(raw: string): string {
  const r = raw.toLowerCase().trim();
  const n = stripDiacritics(r);
  if (r.includes("zamietnut") || n.includes("nepresiel") || n.includes("neprijat")) return "zamietnuté";
  if (r.includes("prijat") || n.includes("schvalen") || n.includes("presiel")) return "schválené";
  if (n.includes("odroc")) return "odročené";
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

function parseIndependentIds(html: string): Set<string> {
  const ids = new Set<string>();
  const re = /PoslanecID=(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return ids;
}

// ─── scrapeM ps ──────────────────────────────────────────

/**
 * Scrapes list of MPs from NRSR.
 * Prefer the alphabetical list: the advanced list is slower and can hang.
 */
export async function scrapeMps(fetcher: Fetcher = defaultFetcher): Promise<ScrapedMp[]> {
  const urls = [
    `${BASE_URL}/web/default.aspx?sid=poslanci/zoznam_abc`,
    `${BASE_URL}/web/Default.aspx?sid=poslanci/zoznam_adv`,
  ];
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const html = await fetcher(url);
      const mps = parseMpList(html);
      if (mps.length > 0) return mps;
      errors.push(`${url}: parsed 0 MPs`);
    } catch (err) {
      errors.push(`${url}: ${(err as Error).message}`);
    }
  }

  console.error("[nrsr] scrapeMps error:", errors.join("; "));
  return [];
}

export function parseMpList(html: string): ScrapedMp[] {
  const $ = cheerio.load(html);
  const mps: ScrapedMp[] = [];
  const seenIds = new Set<string>();

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
    if (seenIds.has(nrsrPersonId)) return;

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

    seenIds.add(nrsrPersonId);
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

  if (mps.length === 0) {
    $("a[href*='PoslanecID']").each((_, link) => {
      const $link = $(link);
      const href = $link.attr("href") ?? "";
      const idMatch = href.match(/PoslanecID=(\d+)/i);
      if (!idMatch) return;

      const nrsrPersonId = idMatch[1];
      if (seenIds.has(nrsrPersonId)) return;

      const nameFull = cleanText($link.text());
      if (!nameFull) return;

      const nameParts = nameFull.replace(",", "").split(/\s+/);
      const nameDisplay =
        nameParts.length >= 2
          ? `${nameParts[nameParts.length - 1]} ${nameParts.slice(0, -1).join(" ")}`.trim()
          : nameFull.trim();

      seenIds.add(nrsrPersonId);
      mps.push({
        nrsrPersonId,
        nameFull,
        nameDisplay,
        slug: makeSlug(nameDisplay),
        partyAbbr: null,
        role: "poslanec",
        constituency: null,
        birthYear: null,
        photoUrl: null,
      });
    });
  }

  return mps;
}

// ─── scrapeRecentVotes ────────────────────────────────────

const VOTES_LIST_URL = `${BASE_URL}/web/Default.aspx?sid=schodze/hlasovanie`;
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

  $("a[href*='ID=']").each((_, el) => {
    if (ids.length >= limit) return false;
    const href = $(el).attr("href") ?? "";
    if (!isVoteDetailHref(href)) return;
    const match = href.match(/[?&]ID=(\d+)/i);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      ids.push(match[1]);
    }
  });

  return ids;
}

function isVoteDetailHref(href: string): boolean {
  const normalizedHref = href.toLowerCase();
  return (
    normalizedHref.includes("sid=schodze/hlasovanie/hlasovanie") ||
    normalizedHref.includes("sid=schodze%2fhlasovanie%2fhlasovanie")
  );
}

export function parseVoteDetail(
  html: string,
  nrsrVoteId: string,
  sourceUrl: string
): { vote: ScrapedVote | null; records: ScrapedVoteRecord[] } {
  const $ = cheerio.load(html);
  const records: ScrapedVoteRecord[] = [];

  // Extract vote metadata
  const bodyText = cleanText($("body").text());
  const normalizedBodyText = stripDiacritics(bodyText).toLowerCase();

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

  if (titleSk === "Hlasovanie") titleSk = "";

  if (!titleSk) {
    const currentTitleMatch = bodyText.match(/N[áa]zov hlasovania\s+(.+?)\s+V[ýy]sledok hlasovania/i);
    if (currentTitleMatch?.[1]) titleSk = currentTitleMatch[1].trim();
  }

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
  const forMatch = normalizedBodyText.match(/\bza(?:\s+hlasovalo)?[:\s]+(\d+)/);
  const againstMatch = normalizedBodyText.match(/\bproti(?:\s+hlasovalo)?[:\s]+(\d+)/);
  const abstainMatch = normalizedBodyText.match(/\bzdrzal(?:o sa(?:\s+hlasovania)?)?[:\s]+(\d+)/);
  const absentMatch = normalizedBodyText.match(/\bnepritomni[:\s]+(\d+)/);

  if (forMatch) votesFor = parseInt(forMatch[1], 10);
  if (againstMatch) votesAgainst = parseInt(againstMatch[1], 10);
  if (abstainMatch) votesAbstain = parseInt(abstainMatch[1], 10);
  if (absentMatch?.[1]) votesAbsent = parseInt(absentMatch[1], 10);

  // Result
  let rawResult = "";
  const resultMatch =
    bodyText.match(/V[ýy]sledok hlasovania\s+(.+?)\s+Pr[íi]tomn[íi]/i) ??
    bodyText.match(/[Vv]ýsledok[:\s]+([^\n\r.]+)/);
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
    let choiceRaw: string | null = null;
    $row.find("td").each((_, td) => {
      const t = $(td).text().trim();
      if (/^[ZPNB?]$/.test(t)) {
        choiceRaw = t;
        return false;
      }
    });
    if (!choiceRaw) return;

    records.push({
      nrsrVoteId,
      nrsrPersonId,
      choice: mapChoice(choiceRaw),
    });
  });

  if (records.length === 0) {
    records.push(...parseGroupedVoteRecords($, nrsrVoteId));
  }

  return { vote, records };
}

function parseGroupedVoteRecords(
  $: cheerio.CheerioAPI,
  nrsrVoteId: string
): ScrapedVoteRecord[] {
  const records: ScrapedVoteRecord[] = [];
  let currentChoice: string | null = null;

  $("table.hpo_result_table tr").each((_, row) => {
    const $row = $(row);
    const rowLabel = cleanText($row.text());
    const normalizedRowLabel = stripDiacritics(rowLabel).toLowerCase();
    const $links = $row.find("a[href*='PoslanecID']");

    if ($links.length === 0) {
      if (normalizedRowLabel === "za") currentChoice = "za";
      else if (normalizedRowLabel === "proti") currentChoice = "proti";
      else if (normalizedRowLabel.includes("zdrzal")) currentChoice = "zdržal_sa";
      else if (normalizedRowLabel.includes("nehlasoval")) currentChoice = "nehlasoval";
      else if (normalizedRowLabel.includes("nepritom")) currentChoice = "neprítomný";
      return;
    }

    const choice = currentChoice;
    if (!choice) return;
    $links.each((_, link) => {
      const href = $(link).attr("href") ?? "";
      const personMatch = href.match(/PoslanecID=(\d+)/i);
      if (!personMatch?.[1]) return;
      records.push({
        nrsrVoteId,
        nrsrPersonId: personMatch[1],
        choice,
      });
    });
  });

  return records;
}

// ─── scrapeRecentSpeeches ─────────────────────────────────

const SPEECHES_URL = `${BASE_URL}/web/Default.aspx?CisObdobia=9&ShowTopItems=True&sid=schodze/rozprava/vyhladavanie`;

function mpSpeechesUrl(nrsrPersonId: string, term: number): string {
  const params = new URLSearchParams({
    CisObdobia: String(term),
    ShowTopItems: "True",
    sid: "schodze/rozprava/vyhladavanie",
    PoslanecID: nrsrPersonId,
  });
  return `${BASE_URL}/web/Default.aspx?${params.toString()}`;
}

export async function scrapeRecentSpeeches(
  limit: number = 50,
  fetcher: Fetcher = defaultFetcher
): Promise<ScrapedSpeech[]> {
  try {
    const html = await fetcher(SPEECHES_URL);
    return parseSpeechesList(html, limit, SPEECHES_URL);
  } catch (err) {
    console.error("[nrsr] scrapeRecentSpeeches error:", err);
    return [];
  }
}

export async function scrapeMpSpeeches(
  nrsrPersonId: string,
  term: number = 9,
  limit: number = 50,
  fetcher: Fetcher = defaultFetcher
): Promise<ScrapedSpeech[]> {
  try {
    const url = mpSpeechesUrl(nrsrPersonId, term);
    const html = await fetcher(url);
    return parseSpeechesList(html, limit, url).filter(
      (speech) => speech.nrsrPersonId === nrsrPersonId
    );
  } catch (err) {
    if (isNrsrRateLimitError(err)) throw err;
    console.error(`[nrsr] scrapeMpSpeeches ${nrsrPersonId} error:`, err);
    return [];
  }
}

export function parseSpeechesList(
  html: string,
  limit: number,
  fallbackSourceUrl: string = SPEECHES_URL
): ScrapedSpeech[] {
  const $ = cheerio.load(html);
  const speeches: ScrapedSpeech[] = [];
  const seen = new Set<string>();
  const personIdByName = parsePersonOptionMap($);

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

    if (!$personLink.length && !$speechLink.length && personIdByName.size > 0) {
      const fallback = parseSpeechRowWithoutLinks($row, personIdByName, fallbackSourceUrl);
      if (!fallback) return;
      if (seen.has(fallback.nrsrSpeechId)) return;
      seen.add(fallback.nrsrSpeechId);
      speeches.push(fallback);
      return;
    }

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

    const speechSourceUrl = speechHref
      ? speechHref.startsWith("http")
        ? speechHref
        : `${BASE_URL}${speechHref}`
      : fallbackSourceUrl;

    speeches.push({
      nrsrSpeechId,
      nrsrPersonId,
      date,
      titleSk,
      textSk,
      sourceUrl: speechSourceUrl,
    });
  });

  return speeches;
}

function parsePersonOptionMap($: cheerio.CheerioAPI): Map<string, string> {
  const map = new Map<string, string>();
  $("select option[value]").each((_, option) => {
    const value = $(option).attr("value") ?? "";
    const name = cleanText($(option).text());
    if (/^\d+$/.test(value) && name.includes(",")) map.set(name, value);
  });
  return map;
}

function parseSpeechRowWithoutLinks(
  $row: cheerio.Cheerio<AnyNode>,
  personIdByName: Map<string, string>,
  sourceUrl: string
): ScrapedSpeech | null {
  const rowText = cleanText($row.text());
  if (!rowText) return null;
  const date = parseSlovakDate(rowText);
  if (!date) return null;

  let matchedName: string | null = null;
  let nrsrPersonId: string | null = null;
  for (const [name, id] of personIdByName) {
    if (rowText.includes(name)) {
      matchedName = name;
      nrsrPersonId = id;
      break;
    }
  }
  if (!matchedName || !nrsrPersonId) return null;

  const markerIndex = rowText.indexOf("(text ");
  const textSk =
    markerIndex >= 0
      ? rowText.slice(markerIndex).trim()
      : rowText.slice(rowText.indexOf(matchedName)).trim();
  if (textSk.length < 10) return null;

  return {
    nrsrSpeechId: `rozprava-${stableHash(rowText)}`,
    nrsrPersonId,
    date,
    titleSk: rowText.slice(0, 200),
    textSk,
    sourceUrl,
  };
}

// ─── scrapeMpActivities — per-MP NRSR enrichment ──────────

const MP_ACTIVITY_URLS = (personId: string, term: number) => ({
  speeches: mpSpeechesUrl(personId, term),
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

function parseLegislationList(html: string): ScrapedLegislationItem[] {
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
      if (isNrsrRateLimitError(err)) throw err;
      console.error(`[nrsr] mp ${nrsrPersonId} ${label} error:`, err);
      return fallback;
    }
  };
  // Sequential to be polite
  const speeches = await safe("speeches",
    async () => scrapeMpSpeeches(nrsrPersonId, term, 50, fetcher), []);
  await sleep(400);
  const interpellations = await safe("interpellations",
    async () => parseInterpellationsList(await fetcher(urls.interpellations)), []);
  await sleep(400);
  const questions = await safe("questions",
    async () => parseQuestionsList(await fetcher(urls.questions)), []);
  await sleep(400);
  const legislation = await safe("legislation",
    async () => parseLegislationList(await (
      fetcher === defaultFetcher
        ? fetchLegislationHtml(nrsrPersonId, term)
        : fetcher(urls.legislation)
    )), []);
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

  return { speeches, interpellations, questions, legislation, amendments, trips, assistants, offices };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
