/**
 * Scrape the current Slovak cabinet (Štvrtá vláda Roberta Fica) from Slovak
 * Wikipedia and upsert ministers into mps with role = post (e.g.
 * "Minister vnútra"). Active ministers only (empty "Odchod z úradu" cell).
 *
 * Usage: npx tsx scripts/seed-ministers.ts
 */
import "dotenv/config";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolvePartyId } from "../src/lib/db/nrsr";
import { makeSlug } from "../src/lib/scraper/nrsr";

const PORTRAITS_DIR = path.resolve(__dirname, "..", "public", "portraits");

const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_DB = process.env.CLOUDFLARE_DATABASE_ID!;
const CF_TOKEN = process.env.CLOUDFLARE_D1_TOKEN!;

if (!CF_ACCOUNT || !CF_DB || !CF_TOKEN) {
  console.error("Missing CLOUDFLARE_ACCOUNT_ID / DATABASE_ID / D1_TOKEN env");
  process.exit(1);
}

const QUERY_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${CF_DB}/query`;
const WIKI_URL = "https://sk.wikipedia.org/wiki/Štvrtá_vláda_Roberta_Fica";

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

interface CabinetRow {
  post: string;
  name: string;
  partyLabel: string;
  active: boolean;
  wikiHref: string | null;
}

const POST_PREFIX_RE = /^(predseda|predsední[čc]ka|podpredseda|podpredsední[čc]ka|minister|ministerka|ministri|ministerky)\b/i;

function normalize(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function parseCabinet(html: string): CabinetRow[] {
  const $ = cheerio.load(html);
  const tables = $("table").toArray();
  // Find the cabinet table: contains "Post" header and "Strana" header
  let target: Element | null = null;
  for (const t of tables) {
    const text = $(t).text();
    if (/Post/.test(text) && /Strana/.test(text) && /Nástup/.test(text)) {
      target = t;
      break;
    }
  }
  if (!target) throw new Error("Cabinet table not found");

  const rows: CabinetRow[] = [];
  let currentPost = "";

  $(target).find("tr").each((i, tr) => {
    if (i === 0) return; // header
    const tds = $(tr).find("th, td").toArray();
    const cells = tds.map((c) => normalize($(c).text()));
    if (cells.length === 0) return;

    // Find wiki href from the name cell's <a>
    const nameCellIndex = POST_PREFIX_RE.test(cells[0]) ? 1 : 0;
    const $nameCell = $(tds[nameCellIndex]);
    const hrefRaw = $nameCell.find("a").first().attr("href") ?? null;
    const wikiHref = hrefRaw
      ? hrefRaw.startsWith("//")
        ? `https:${hrefRaw}`
        : hrefRaw.startsWith("/")
          ? `https://sk.wikipedia.org${hrefRaw}`
          : hrefRaw
      : null;

    let post: string;
    let name: string;
    let partyLabel: string;
    let leftOffice: string;

    if (cells.length >= 5 && POST_PREFIX_RE.test(cells[0])) {
      // New post row: [Post, Name, (img), Party, Start, End?]
      // Wikipedia structure: cells = [Post, Name, "", Party, Start, End]
      post = cells[0];
      name = cells[1];
      partyLabel = cells[3] ?? cells[2];
      leftOffice = cells[5] ?? cells[4] ?? "";
      currentPost = post;
    } else if (cells.length >= 4 && currentPost) {
      // Continuation row: [Name, "", Party, Start, End]
      post = currentPost;
      name = cells[0];
      partyLabel = cells[2] ?? cells[1];
      leftOffice = cells[4] ?? cells[3] ?? "";
    } else {
      return;
    }

    // strip footnote markers like " [ 5 ]"
    name = name.replace(/\s*\[\s*\d+\s*\].*$/, "").replace(/\s*\(poverený.*\)/i, "").trim();
    leftOffice = leftOffice.replace(/\s*\[\s*\d+\s*\].*$/, "").trim();
    post = post.replace(/\s*\[\s*\d+\s*\].*$/, "").replace(/\s*\[\d+\]/g, "").trim();
    post = post.replace(/^Ministri\b/, "Minister").replace(/^Ministerky\b/, "Ministerka");

    if (!name || /^\s*$/.test(name)) return;

    rows.push({
      post,
      name,
      partyLabel,
      active: leftOffice === "",
      wikiHref,
    });
  });

  return rows;
}

async function fetchPortrait(slug: string, wikiHref: string | null): Promise<string | null> {
  if (!wikiHref) return null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(wikiHref, { headers: { "User-Agent": "VolimTo/1.0" } });
      if (!res.ok) {
        console.warn(`  [portrait ${slug}] attempt ${attempt}: HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);
      const src = $(".infobox img").first().attr("src")
        ?? $("table.infobox img").first().attr("src")
        ?? $('img[src*="upload.wikimedia"]').first().attr("src");
      if (!src) {
        console.warn(`  [portrait ${slug}] no img in page`);
        return null;
      }
      const url = src.startsWith("//") ? `https:${src}` : src;
      const imgRes = await fetch(url, { headers: { "User-Agent": "VolimTo/1.0" } });
      if (!imgRes.ok) {
        console.warn(`  [portrait ${slug}] img HTTP ${imgRes.status}`);
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const ext = url.toLowerCase().includes(".png") ? "png" : "jpg";
      const filename = `minister-${slug}.${ext}`;
      await fs.writeFile(path.join(PORTRAITS_DIR, filename), buf);
      return `/portraits/${filename}`;
    } catch (err) {
      console.warn(`  [portrait ${slug}] attempt ${attempt}: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  return null;
}

async function main() {
  console.log("Fetching cabinet table...");
  const res = await fetch(WIKI_URL, { headers: { "User-Agent": "VolimTo/1.0" } });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  const html = await res.text();

  const all = parseCabinet(html);
  const active = all.filter((r) => r.active);
  console.log(`  ${all.length} rows / ${active.length} active`);

  const parties = await d1Query<{ id: string; abbreviation: string }>(
    "SELECT id, abbreviation FROM parties"
  );
  const partySlugToId: Record<string, string> = {};
  for (const p of parties) partySlugToId[p.abbreviation.toLowerCase()] = p.id;

  await fs.mkdir(PORTRAITS_DIR, { recursive: true });

  let upserted = 0;
  let unmatchedParty = 0;
  for (const r of active) {
    const partyId = resolvePartyId(r.partyLabel, partySlugToId);
    if (!partyId) {
      console.warn(`  [unmatched party] ${r.name} → "${r.partyLabel}"`);
      unmatchedParty++;
      continue;
    }
    const slug = makeSlug(r.name);
    const role = r.post;

    const photoUrl = await fetchPortrait(slug, r.wikiHref);
    await new Promise((res) => setTimeout(res, 400));

    // Upsert by slug. Update party_id + role; do not clobber existing
    // nrsr_person_id (some ministers were also MPs).
    const existing = await d1Query<{ id: number }>(
      "SELECT id FROM mps WHERE slug = ? LIMIT 1",
      [slug]
    );
    if (existing.length) {
      if (photoUrl) {
        await d1Query(
          "UPDATE mps SET party_id = ?, role = ?, name_full = ?, name_display = ?, photo_url = ? WHERE slug = ?",
          [partyId, role, r.name, r.name, photoUrl, slug]
        );
      } else {
        await d1Query(
          "UPDATE mps SET party_id = ?, role = ?, name_full = ?, name_display = ? WHERE slug = ?",
          [partyId, role, r.name, r.name, slug]
        );
      }
    } else {
      await d1Query(
        "INSERT INTO mps (slug, name_full, name_display, party_id, role, photo_url) VALUES (?, ?, ?, ?, ?, ?)",
        [slug, r.name, r.name, partyId, role, photoUrl]
      );
    }
    upserted++;
    console.log(`  ${r.name} · ${role} · ${r.partyLabel} · ${photoUrl ?? "no-photo"}`);
  }

  console.log(`\nUpserted ${upserted} ministers (${unmatchedParty} skipped for unknown party).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
