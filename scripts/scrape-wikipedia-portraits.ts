/**
 * Scrape candidate portraits from Wikipedia for those still missing a photo.
 * - Queries sk.wikipedia.org first, falls back to en.wikipedia.org.
 * - Uses MediaWiki pageimages API to get the infobox thumbnail.
 * - Saves as /public/portraits/{partyId}-{slug}.jpg and updates candidates.portrait_url.
 *
 * Run:
 *   npm run portraits:wiki -- --dry   # plan only
 *   npm run portraits:wiki            # apply
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { eq, isNull } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { candidates } from "../src/lib/db/schema";

const PORTRAITS_DIR = path.join(process.cwd(), "public", "portraits");
const DRY = process.argv.includes("--dry");
const UA = "VolimToBot/1.0 (https://volimto.sk; michal.tar@gmail.com)";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s: string): string {
  return normalize(s).replace(/ /g, "-");
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

interface PageImageResult {
  title: string;
  thumbnail?: string;
  fullTitle?: string;
}

async function findPageImage(
  lang: "sk" | "en",
  query: string
): Promise<PageImageResult | null> {
  // Step 1: search for the page (handles redirects, partial matches)
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&srlimit=3&format=json&origin=*`;
  const searchData = (await fetchJson(searchUrl)) as {
    query?: { search?: Array<{ title: string }> };
  };
  const hits = searchData.query?.search ?? [];
  if (hits.length === 0) return null;

  // Strict filter: title must contain ALL tokens of the query (e.g. "Peter Pellegrini")
  const queryTokens = normalize(query).split(" ").filter((t) => t.length > 1);
  const valid = hits.filter((h) => {
    const t = normalize(h.title);
    return queryTokens.every((tok) => t.includes(tok));
  });
  if (valid.length === 0) return null;

  // Step 2: for each valid hit, ask for pageimages
  for (const hit of valid) {
    const piUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      hit.title
    )}&prop=pageimages&pithumbsize=500&format=json&origin=*`;
    const piData = (await fetchJson(piUrl)) as {
      query?: {
        pages?: Record<
          string,
          { title: string; thumbnail?: { source: string } }
        >;
      };
    };
    const pages = piData.query?.pages ?? {};
    for (const p of Object.values(pages)) {
      if (p.thumbnail?.source) {
        return { title: query, fullTitle: p.title, thumbnail: p.thumbnail.source };
      }
    }
  }
  return null;
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Download failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function main() {
  const db = getDb();
  const rows = await db
    .select({ id: candidates.id, partyId: candidates.partyId, name: candidates.name })
    .from(candidates)
    .where(isNull(candidates.portraitUrl));

  console.log(`Candidates without portrait: ${rows.length}`);
  let ok = 0;
  const missed: string[] = [];

  for (const c of rows) {
    process.stdout.write(`  ${c.name} (${c.partyId}) ... `);
    let hit = await findPageImage("sk", c.name);
    if (!hit) hit = await findPageImage("en", c.name);
    if (!hit?.thumbnail) {
      console.log("no wiki photo");
      missed.push(`${c.name} (${c.partyId})`);
      continue;
    }

    const ext = hit.thumbnail.match(/\.(jpe?g|png)(?:$|\?)/i)?.[1] ?? "jpg";
    const file = `${c.partyId}-${slugify(c.name)}.${ext.toLowerCase().replace("jpeg", "jpg")}`;
    const dest = path.join(PORTRAITS_DIR, file);
    const url = `/portraits/${file}`;
    console.log(`-> ${hit.fullTitle} -> ${file}`);
    if (!DRY) {
      await downloadImage(hit.thumbnail, dest);
      await db.update(candidates).set({ portraitUrl: url }).where(eq(candidates.id, c.id));
    }
    ok++;
    // Be polite to Wikipedia
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(
    `\n${DRY ? "[DRY] " : ""}Done. Found: ${ok}/${rows.length}, missed: ${missed.length}`
  );
  if (missed.length) {
    console.log("Unmatched:");
    missed.forEach((n) => console.log("  - " + n));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
