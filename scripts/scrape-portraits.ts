/**
 * Scrape MP portraits from nrsr.sk and save to /public/portraits/.
 * Naming: mp-{nrsrPersonId}.jpg (stable, joinable to mps.nrsrPersonId)
 * Also writes /public/portraits/manifest.json mapping id -> { name, normalized }.
 * Run: npm run portraits:scrape
 */

import * as fs from "fs";
import * as path from "path";

const PORTRAITS_DIR = path.join(process.cwd(), "public", "portraits");
const MANIFEST_PATH = path.join(PORTRAITS_DIR, "manifest.json");
const NRSR = "https://www.nrsr.sk";
const LIST_URL = `${NRSR}/web/default.aspx?sid=poslanci/zoznam_abc`;
const PHOTO_URL = (id: string) =>
  `${NRSR}/web/dynamic/PoslanecPhoto.aspx?PoslanecID=${id}&ImageWidth=600`;
const UA = "Polis/1.0 (educational project; +https://volimto.sk)";
const CONCURRENCY = 5;
const BATCH_DELAY_MS = 200;

type MP = { id: string; rawName: string; firstLast: string; normalized: string };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Surname, FirstName Middle" -> "FirstName Middle Surname"
function flipName(raw: string): string {
  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length !== 2) return raw.trim();
  return `${parts[1]} ${parts[0]}`.trim();
}

async function fetchList(): Promise<MP[]> {
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`nrsr list ${res.status}`);
  const html = await res.text();
  const rx = /PoslanecID=(\d+)[^"]*">([^<]+)<\/a>/g;
  const seen = new Set<string>();
  const out: MP[] = [];
  for (const m of html.matchAll(rx)) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const rawName = m[2].replace(/&nbsp;/g, " ").trim();
    const firstLast = flipName(rawName);
    out.push({ id, rawName, firstLast, normalized: normalize(firstLast) });
  }
  return out;
}

async function downloadOne(mp: MP): Promise<"saved" | "skipped" | "failed"> {
  const dest = path.join(PORTRAITS_DIR, `mp-${mp.id}.jpg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) return "skipped";
  try {
    const res = await fetch(PHOTO_URL(mp.id), {
      headers: { "User-Agent": UA, Referer: LIST_URL },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return "failed";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 1024) return "failed"; // placeholder/empty
    fs.writeFileSync(dest, buf);
    return "saved";
  } catch {
    return "failed";
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function pump() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i]);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => pump());
  await Promise.all(runners);
  return results;
}

async function main() {
  if (!fs.existsSync(PORTRAITS_DIR)) fs.mkdirSync(PORTRAITS_DIR, { recursive: true });

  console.log("Fetching MP list...");
  const mps = await fetchList();
  console.log(`Parsed ${mps.length} MPs.`);
  if (mps.length === 0) {
    console.error("No MPs parsed — selectors may have broken. Aborting.");
    process.exit(1);
  }

  let saved = 0;
  let skipped = 0;
  const failed: string[] = [];
  // Process in delayed batches for politeness
  for (let i = 0; i < mps.length; i += CONCURRENCY) {
    const batch = mps.slice(i, i + CONCURRENCY);
    const results = await runWithConcurrency(batch, CONCURRENCY, downloadOne);
    results.forEach((r, j) => {
      const mp = batch[j];
      if (r === "saved") {
        saved++;
        console.log(`✓ ${mp.firstLast} (${mp.id})`);
      } else if (r === "skipped") {
        skipped++;
      } else {
        failed.push(`${mp.firstLast} (${mp.id})`);
      }
    });
    if (i + CONCURRENCY < mps.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    total: mps.length,
    mps: mps.map((m) => ({
      id: m.id,
      rawName: m.rawName,
      firstLast: m.firstLast,
      normalized: m.normalized,
      file: `mp-${m.id}.jpg`,
    })),
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(
    `\nDone. Parsed: ${mps.length}, Saved: ${saved}, Skipped: ${skipped}, Failed: ${failed.length}`
  );
  if (failed.length) console.log("Failed:\n  - " + failed.join("\n  - "));
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Next: npm run portraits:match -- --dry`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
