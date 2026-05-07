/**
 * Match scraped MP portraits to candidates and mps tables.
 * - Reads /public/portraits/manifest.json (produced by scrape-portraits.ts)
 * - For each candidate where portraitUrl IS NULL: fuzzy-match name against manifest,
 *   copy mp-{id}.jpg -> {partyId}-{slug}.jpg, update candidates.portrait_url.
 * - For each MP whose nrsrPersonId matches a manifest id: update mps.photoUrl.
 *
 * Run:
 *   npm run portraits:match -- --dry   # plan only
 *   npm run portraits:match            # apply
 *
 * Env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_D1_TOKEN
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { candidates, mps } from "../src/lib/db/schema";

const PORTRAITS_DIR = path.join(process.cwd(), "public", "portraits");
const MANIFEST_PATH = path.join(PORTRAITS_DIR, "manifest.json");
const DRY = process.argv.includes("--dry");

type ManifestEntry = {
  id: string;
  rawName: string;
  firstLast: string;
  normalized: string;
  file: string;
};

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

// Token-set match: every token in `a` must appear in `b` and vice versa.
// Handles "Robert Fico" vs "Fico, Robert" (after flip both normalize to same set).
function tokensEqual(a: string, b: string): boolean {
  const ta = new Set(a.split(" ").filter(Boolean));
  const tb = new Set(b.split(" ").filter(Boolean));
  if (ta.size !== tb.size) return false;
  for (const t of ta) if (!tb.has(t)) return false;
  return true;
}

function findMatch(candidateName: string, entries: ManifestEntry[]): ManifestEntry | null {
  const target = normalize(candidateName);
  const exact = entries.find((e) => e.normalized === target);
  if (exact) return exact;
  const tokenMatch = entries.find((e) => tokensEqual(e.normalized, target));
  if (tokenMatch) return tokenMatch;
  // Fallback: surname + first-name initial
  const targetTokens = target.split(" ");
  if (targetTokens.length < 2) return null;
  const lastTarget = targetTokens[targetTokens.length - 1];
  const firstInitial = targetTokens[0][0];
  const surnameMatches = entries.filter((e) => {
    const t = e.normalized.split(" ");
    return t[t.length - 1] === lastTarget && t[0]?.[0] === firstInitial;
  });
  return surnameMatches.length === 1 ? surnameMatches[0] : null;
}

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Missing ${MANIFEST_PATH}. Run "npm run portraits:scrape" first.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as {
    mps: ManifestEntry[];
  };
  const entries = manifest.mps.filter((e) =>
    fs.existsSync(path.join(PORTRAITS_DIR, e.file))
  );
  console.log(`Manifest entries with downloaded files: ${entries.length}`);

  const db = getDb();

  // ── Candidates: only those without a portrait yet ─────────
  const candidateRows = await db
    .select({ id: candidates.id, partyId: candidates.partyId, name: candidates.name })
    .from(candidates)
    .where(isNull(candidates.portraitUrl));
  console.log(`Candidates needing portrait: ${candidateRows.length}`);

  let candMatched = 0;
  const candMissed: string[] = [];
  for (const c of candidateRows) {
    const slug = slugify(c.name);

    // Fallback 1: existing {party}-{slug}.{jpg,png} or minister-{slug}.{jpg,png} on disk
    const fallbackFiles = [
      `${c.partyId}-${slug}.jpg`,
      `${c.partyId}-${slug}.png`,
      `minister-${slug}.jpg`,
      `minister-${slug}.png`,
    ];
    const existing = fallbackFiles.find((f) => fs.existsSync(path.join(PORTRAITS_DIR, f)));
    if (existing) {
      const targetUrl = `/portraits/${existing}`;
      console.log(`  ${c.name} -> existing ${existing}`);
      candMatched++;
      if (!DRY) {
        await db.update(candidates).set({ portraitUrl: targetUrl }).where(eq(candidates.id, c.id));
      }
      continue;
    }

    const m = findMatch(c.name, entries);
    if (!m) {
      candMissed.push(`${c.name} (${c.partyId})`);
      continue;
    }
    const targetFile = `${c.partyId}-${slug}.jpg`;
    const targetPath = path.join(PORTRAITS_DIR, targetFile);
    const targetUrl = `/portraits/${targetFile}`;
    console.log(`  ${c.name} -> ${m.firstLast} (id=${m.id}) -> ${targetFile}`);
    candMatched++;
    if (!DRY) {
      fs.copyFileSync(path.join(PORTRAITS_DIR, m.file), targetPath);
      await db
        .update(candidates)
        .set({ portraitUrl: targetUrl })
        .where(eq(candidates.id, c.id));
    }
  }

  // ── MPs: backfill photoUrl by nrsrPersonId ────────────────
  const mpRows = await db
    .select({ id: mps.id, nrsrPersonId: mps.nrsrPersonId, photoUrl: mps.photoUrl })
    .from(mps);
  const mpUpdates = mpRows.filter(
    (r) => r.nrsrPersonId && entries.some((e) => e.id === r.nrsrPersonId)
  );
  console.log(`MPs to update photoUrl: ${mpUpdates.length}`);
  if (!DRY) {
    for (const r of mpUpdates) {
      await db
        .update(mps)
        .set({ photoUrl: `/portraits/mp-${r.nrsrPersonId}.jpg` })
        .where(eq(mps.id, r.id));
    }
  }

  // ── Ministers: match by slug to minister-{slug}.{jpg,png} files ──
  const ministerRows = await db
    .select({ id: mps.id, slug: mps.slug, role: mps.role, photoUrl: mps.photoUrl })
    .from(mps)
    .where(
      sql`(lower(${mps.role}) LIKE '%minister%' OR lower(${mps.role}) LIKE '%predseda vl%') AND ${mps.photoUrl} IS NULL`
    );
  console.log(`Ministers needing photo: ${ministerRows.length}`);

  let ministerUpdated = 0;
  const ministerMissed: string[] = [];
  for (const r of ministerRows) {
    const candidatesFiles = [`minister-${r.slug}.jpg`, `minister-${r.slug}.png`];
    const found = candidatesFiles.find((f) => fs.existsSync(path.join(PORTRAITS_DIR, f)));
    if (!found) {
      ministerMissed.push(`${r.slug} (${r.role})`);
      continue;
    }
    console.log(`  ${r.slug} -> ${found}`);
    ministerUpdated++;
    if (!DRY) {
      await db
        .update(mps)
        .set({ photoUrl: `/portraits/${found}` })
        .where(eq(mps.id, r.id));
    }
  }

  console.log(
    `\n${DRY ? "[DRY RUN] " : ""}Done. Candidates matched: ${candMatched}/${candidateRows.length}, missed: ${candMissed.length}, MPs updated: ${mpUpdates.length}, Ministers updated: ${ministerUpdated}/${ministerRows.length}`
  );
  if (ministerMissed.length) {
    console.log("Unmatched ministers:");
    ministerMissed.forEach((n) => console.log("  - " + n));
  }
  if (candMissed.length) {
    console.log("Unmatched candidates:");
    candMissed.forEach((n) => console.log("  - " + n));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
