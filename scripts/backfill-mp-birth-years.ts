/**
 * One-shot backfill: populate mps.birth_year.
 *
 * Primary source: NRSR.sk MP detail page
 *   https://www.nrsr.sk/web/Default.aspx?sid=poslanci/poslanec&PoslanecID={id}
 *   contains <strong>Narodený(á)</strong><span>DD. MM. YYYY</span>.
 * Fallback (only when nrsr_person_id is missing): sk.wikipedia.org search.
 *
 * Sanity check: 1920 ≤ year ≤ current_year - 18.
 *
 * Usage: npx tsx scripts/backfill-mp-birth-years.ts [--dry-run] [--limit=N]
 */
import "dotenv/config";

const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_DB = process.env.CLOUDFLARE_DATABASE_ID!;
const CF_TOKEN = process.env.CLOUDFLARE_D1_TOKEN!;

if (!CF_ACCOUNT || !CF_DB || !CF_TOKEN) {
  console.error("Missing CLOUDFLARE_ACCOUNT_ID / DATABASE_ID / D1_TOKEN env");
  process.exit(1);
}

const QUERY_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${CF_DB}/query`;
const WIKI_API = "https://sk.wikipedia.org/w/api.php";
const UA = "VolimTo/1.0 (https://volimto.sk; michal.tar@gmail.com)";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const LIMIT = (() => {
  const a = [...args].find((x) => x.startsWith("--limit="));
  return a ? Number(a.split("=")[1]) : Infinity;
})();

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1920;
const MAX_YEAR = CURRENT_YEAR - 18;

interface D1Result<T> {
  result: { results: T[] }[];
  success: boolean;
  errors: unknown[];
}

async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await fetch(QUERY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) throw new Error(`D1 HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as D1Result<T>;
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}`);
  return json.result[0]?.results ?? [];
}

interface WikiSearchResp {
  query?: { search?: { title: string }[] };
}
interface WikiRevResp {
  query?: {
    pages?: { revisions?: { slots?: { main?: { content?: string } } }[] }[];
  };
}

function normalizeName(raw: string): string {
  // DB stores names as "Surname, FirstName" or "Surname, FirstName MiddleName"
  // Convert to natural "FirstName Surname"
  const m = raw.match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2].trim()} ${m[1].trim()}` : raw.trim();
}

function lastName(raw: string): string {
  const m = raw.match(/^([^,]+),/);
  return (m ? m[1] : raw.split(/\s+/).pop() ?? "").trim();
}

async function nrsrBirthYear(personId: string): Promise<number | null> {
  const url = `https://www.nrsr.sk/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=${encodeURIComponent(
    personId
  )}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(
    /Narodený\(á\)<\/strong>\s*<span>\s*\d{1,2}\.\s*\d{1,2}\.\s*(\d{4})/i
  );
  if (!m) return null;
  const y = Number(m[1]);
  return inRange(y) ? y : null;
}

async function wikiSearch(name: string, surname: string): Promise<string | null> {
  const url = new URL(WIKI_API);
  url.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `${name} slovenský politik`,
    srlimit: "5",
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as WikiSearchResp;
  const hits = json.query?.search ?? [];
  if (hits.length === 0) return null;
  const nameLower = name.toLowerCase();
  const surnameLower = surname.toLowerCase();
  const firstName = name.split(/\s+/)[0]?.toLowerCase() ?? "";

  // 1. Exact full-name match (case-insensitive)
  const exact = hits.find((h) => h.title.toLowerCase() === nameLower);
  if (exact) return exact.title;
  // 2. Title contains BOTH first name and surname (handles "Name Surname (politik)")
  const both = hits.find((h) => {
    const t = h.title.toLowerCase();
    return t.includes(firstName) && t.includes(surnameLower);
  });
  if (both) return both.title;
  return null;
}

async function wikiWikitext(title: string): Promise<string | null> {
  const url = new URL(WIKI_API);
  url.search = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: title,
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as WikiRevResp;
  const pages = json.query?.pages ?? [];
  return pages[0]?.revisions?.[0]?.slots?.main?.content ?? null;
}

function inRange(y: number): boolean {
  return y >= MIN_YEAR && y <= MAX_YEAR;
}

function extractYear(wikitext: string): number | null {
  if (/\{\{(rozlišovacia stránka|disambig|rozlišovacia)/i.test(wikitext)) return null;

  // Pattern A: infobox line containing a birth-date label, then any year on same line.
  for (const line of wikitext.split("\n")) {
    if (!/D[áa]tum[\s_]*narodenia|narodenie|narodený|narodená/i.test(line)) continue;
    const ym = line.match(/\b(19|20)\d{2}\b/);
    if (ym) {
      const y = Number(ym[0]);
      if (inRange(y)) return y;
    }
  }

  // Pattern B: birth-date templates anywhere
  //   {{dnv|YYYY|MM|DD}} / {{dni narodenia a veku|YYYY|...}} / {{vek|YYYY|...}}
  //   {{narod|YYYY|...}} / {{birth date|YYYY|...}}
  const tplRe =
    /\{\{\s*(?:dnv|dni narodenia a veku|vek|narod[^|}\s]*|birth[\s_]?date[^|}\s]*)\s*\|\s*(\d{4})/i;
  const tm = wikitext.match(tplRe);
  if (tm) {
    const y = Number(tm[1]);
    if (inRange(y)) return y;
  }

  // Pattern C: prose lede "(* DD. mesiac YYYY," within the first 1000 chars
  const lede = wikitext.slice(0, 1000);
  const proseRe = /\(\s*\*\s*(?:\[\[)?\d{1,2}\.\s*\w+(?:\]\])?\s*(?:\[\[)?(\d{4})/;
  const pm = lede.match(proseRe);
  if (pm) {
    const y = Number(pm[1]);
    if (inRange(y)) return y;
  }

  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("Loading MPs without birth_year...");
  const mps = await d1Query<{
    slug: string;
    name_full: string;
    name_display: string;
    nrsr_person_id: string | null;
  }>(
    "SELECT slug, name_full, name_display, nrsr_person_id FROM mps WHERE birth_year IS NULL ORDER BY name_full"
  );
  console.log(`  ${mps.length} MPs to process${LIMIT < Infinity ? ` (limit ${LIMIT})` : ""}`);

  const updates: { slug: string; year: number; name: string; title: string }[] = [];
  const failed: { slug: string; name: string; reason: string }[] = [];

  const list = mps.slice(0, LIMIT);
  for (let i = 0; i < list.length; i++) {
    const mp = list[i];
    const rawName = mp.name_full || mp.name_display;
    const name = normalizeName(rawName);
    const surname = lastName(rawName);
    try {
      let year: number | null = null;
      let title = "";
      if (mp.nrsr_person_id) {
        year = await nrsrBirthYear(mp.nrsr_person_id);
        title = `nrsr:${mp.nrsr_person_id}`;
      }
      if (!year) {
        const wt = await wikiSearch(name, surname);
        if (wt) {
          const text = await wikiWikitext(wt);
          if (text) {
            year = extractYear(text);
            title = wt;
          }
        }
      }
      if (year) {
        updates.push({ slug: mp.slug, year, name, title });
      } else {
        failed.push({
          slug: mp.slug,
          name,
          reason: mp.nrsr_person_id ? "no birth date on NRSR page" : "no nrsr_person_id, wiki miss",
        });
      }
    } catch (err) {
      failed.push({ slug: mp.slug, name, reason: (err as Error).message });
    }
    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${list.length} (matched ${updates.length})`);
    }
    await sleep(120); // be polite to wikipedia
  }

  console.log(`\nFound: ${updates.length} years / ${failed.length} unmatched`);
  if (failed.length) {
    console.log("Unmatched (first 20):");
    for (const f of failed.slice(0, 20)) {
      console.log(`  - ${f.name} (${f.slug}): ${f.reason}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n--dry-run set, not writing.");
    console.log("Sample matches:");
    for (const u of updates.slice(0, 10)) {
      console.log(`  ${u.year}  ${u.name}  →  ${u.title}`);
    }
    return;
  }

  console.log(`\nApplying ${updates.length} UPDATEs...`);
  let written = 0;
  for (const u of updates) {
    await d1Query("UPDATE mps SET birth_year = ? WHERE slug = ? AND birth_year IS NULL", [
      u.year,
      u.slug,
    ]);
    written++;
    if (written % 25 === 0) console.log(`  ${written}/${updates.length}`);
  }
  console.log(`Done. ${written} rows updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
