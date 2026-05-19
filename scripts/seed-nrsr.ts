/**
 * One-shot seed for the MP database.
 *
 * Run after schema creation:
 *   npx tsx scripts/seed-nrsr.ts
 *
 * Options:
 *   --skip-party-backfill  Do not fetch MP detail pages for current party/club
 *   --skip-recent          Do not scrape recent votes and speeches
 *   --votes=N              Recent vote sessions to scrape (default: 30)
 *   --speeches=N           Recent speeches to scrape (default: 20)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { seedParties } from "../src/lib/db/seed";
import {
  MANUAL_PARTY_OVERRIDES,
  resolvePartyId,
  upsertMps,
  upsertSpeeches,
  upsertVotes,
} from "../src/lib/db/nrsr";
import { mps, parties } from "../src/lib/db/schema";
import {
  makeSlug,
  scrapeIndependentMps,
  scrapeMps,
  scrapeRecentSpeeches,
  scrapeRecentVotes,
  type ScrapedMp,
} from "../src/lib/scraper/nrsr";

const NRSR_BASE = "https://www.nrsr.sk";
const TERM = 9;
const UA = "Mozilla/5.0 (compatible; VolimTo/1.0; +https://volimto.sk)";

const args = new Set(process.argv.slice(2));
const SKIP_PARTY_BACKFILL = args.has("--skip-party-backfill");
const SKIP_RECENT = args.has("--skip-recent");

function numericArg(name: string, fallback: number): number {
  const raw = [...args].find((arg) => arg.startsWith(`--${name}=`));
  const value = raw ? Number(raw.split("=")[1]) : fallback;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const VOTE_LIMIT = numericArg("votes", 30);
const SPEECH_LIMIT = numericArg("speeches", 20);

interface PortraitManifest {
  mps: {
    id: string;
    rawName: string;
    firstLast: string;
    file: string;
  }[];
}

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL. Add Neon Postgres connection string to .env first.");
  }
}

function maybeFixMojibake(value: string): string {
  if (!/[ÃÄÅÂ]/.test(value)) return value;

  const fixed = Buffer.from(value, "latin1").toString("utf8");
  return fixed.includes("�") ? value : fixed;
}

function loadMpsFromPortraitManifest(): ScrapedMp[] {
  const manifestPath = join(process.cwd(), "public", "portraits", "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PortraitManifest;

  return manifest.mps.map((mp) => {
    const nameDisplay = maybeFixMojibake(mp.firstLast).trim();
    const nameFull = maybeFixMojibake(mp.rawName).trim() || nameDisplay;

    return {
      nrsrPersonId: mp.id,
      nameFull,
      nameDisplay,
      slug: makeSlug(nameDisplay),
      partyAbbr: null,
      role: "poslanec",
      constituency: null,
      birthYear: null,
      photoUrl: `/portraits/${mp.file}`,
    };
  });
}

async function buildPartySlugMap(db: ReturnType<typeof getDb>): Promise<Record<string, string>> {
  const rows = await db
    .select({ id: parties.id, abbreviation: parties.abbreviation })
    .from(parties);

  const partySlugToId: Record<string, string> = {};
  for (const party of rows) {
    partySlugToId[party.abbreviation.toLowerCase()] = party.id;
    partySlugToId[party.id.toLowerCase()] = party.id;
  }

  return partySlugToId;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#225;/g, "á")
    .replace(/&#228;/g, "ä")
    .replace(/&#232;/g, "č")
    .replace(/&#233;/g, "é")
    .replace(/&#237;/g, "í")
    .replace(/&#244;/g, "ô")
    .replace(/&#250;/g, "ú")
    .replace(/&#253;/g, "ý");
}

function extractPartyLabel(html: string): string | null {
  const cleaned = decodeEntities(html);

  const club = cleaned.match(/<li>\s*Klub\s+([^<(]+?)\s*\(/i);
  if (club) {
    const label = club[1].trim();
    if (/nez[aá]visl|nezarad/i.test(label)) return null;
    return label;
  }

  const candidacy = cleaned.match(
    /Kandidoval\(a\) za\s*<\/strong>\s*<span>([^<]+)<\/span>/i
  );
  return candidacy?.[1]?.trim() ?? null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function backfillPartyIds(
  db: ReturnType<typeof getDb>,
  partySlugToId: Record<string, string>
) {
  const rows = await db
    .select({ id: mps.id, slug: mps.slug, nrsrPersonId: mps.nrsrPersonId })
    .from(mps)
    .where(isNotNull(mps.nrsrPersonId));

  let updated = 0;
  let unresolved = 0;
  const overrideIds = new Set(Object.keys(MANUAL_PARTY_OVERRIDES));

  for (let i = 0; i < rows.length; i++) {
    const mp = rows[i];
    const nrsrPersonId = mp.nrsrPersonId;
    if (!nrsrPersonId) continue;

    const override = MANUAL_PARTY_OVERRIDES[nrsrPersonId];
    if (override) {
      await db.update(mps).set({ partyId: override }).where(eq(mps.id, mp.id));
      updated++;
      continue;
    }

    try {
      const url = `${NRSR_BASE}/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=${nrsrPersonId}&CisObdobia=${TERM}`;
      const html = await fetchHtml(url);
      const label = extractPartyLabel(html);
      const partyId = resolvePartyId(label, partySlugToId);
      const hasClub = /<li>\s*Klub\s+/i.test(html.replace(/&nbsp;/g, " "));

      if (partyId) {
        await db.update(mps).set({ partyId }).where(eq(mps.id, mp.id));
        updated++;
      } else if (!hasClub || /nez[aá]visl|nezarad/i.test(label ?? "")) {
        await db.update(mps).set({ partyId: null }).where(eq(mps.id, mp.id));
        updated++;
      } else {
        unresolved++;
        console.warn(`[seed:nrsr] unresolved party for ${mp.slug}: ${label ?? "<none>"}`);
      }
    } catch (error) {
      unresolved++;
      console.warn(`[seed:nrsr] party backfill failed for ${mp.slug}: ${(error as Error).message}`);
    }

    if ((i + 1) % 25 === 0) {
      console.log(`[seed:nrsr] party backfill ${i + 1}/${rows.length}`);
    }
    await sleep(120);
  }

  const idsToNull = Array.from(await scrapeIndependentMps()).filter((id) => !overrideIds.has(id));
  if (idsToNull.length > 0) {
    const res = await db
      .update(mps)
      .set({ partyId: null })
      .where(and(inArray(mps.nrsrPersonId, idsToNull), isNotNull(mps.partyId)))
      .returning({ id: mps.id });
    updated += res.length;
  }

  for (const [nrsrId, partyId] of Object.entries(MANUAL_PARTY_OVERRIDES)) {
    const res = await db
      .update(mps)
      .set({ partyId })
      .where(
        and(
          eq(mps.nrsrPersonId, nrsrId),
          or(isNull(mps.partyId), ne(mps.partyId, partyId))
        )
      )
      .returning({ id: mps.id });
    updated += res.length;
  }

  return { updated, unresolved };
}

async function main() {
  requireDatabaseUrl();
  const db = getDb();

  console.log("[seed:nrsr] seeding parties");
  await seedParties(db);
  const partySlugToId = await buildPartySlugMap(db);

  console.log("[seed:nrsr] scraping MPs");
  let mpItems = await scrapeMps();
  if (mpItems.length === 0) {
    console.warn("[seed:nrsr] NRSR list returned 0 MPs, using portraits manifest fallback");
    mpItems = loadMpsFromPortraitManifest();
  }

  const independentIds = await scrapeIndependentMps();
  const mpCount = await upsertMps(db, mpItems, partySlugToId, independentIds);
  console.log(`[seed:nrsr] MPs upserted: ${mpCount}`);

  if (!SKIP_PARTY_BACKFILL) {
    const partyBackfill = await backfillPartyIds(db, partySlugToId);
    console.log(
      `[seed:nrsr] party backfill updated: ${partyBackfill.updated}, unresolved: ${partyBackfill.unresolved}`
    );
  }

  if (!SKIP_RECENT) {
    console.log(`[seed:nrsr] scraping recent votes (${VOTE_LIMIT})`);
    const { votes: voteItems, records: recordItems } = await scrapeRecentVotes(VOTE_LIMIT);
    const voteResult = await upsertVotes(db, voteItems, recordItems);
    console.log(
      `[seed:nrsr] votes upserted: ${voteResult.votes}, vote records upserted: ${voteResult.records}`
    );

    console.log(`[seed:nrsr] scraping recent speeches (${SPEECH_LIMIT})`);
    const speechItems = await scrapeRecentSpeeches(SPEECH_LIMIT);
    const speechCount = await upsertSpeeches(db, speechItems);
    console.log(`[seed:nrsr] speeches inserted: ${speechCount}`);
  }

  console.log("[seed:nrsr] done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
