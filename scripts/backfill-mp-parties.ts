/**
 * One-shot backfill: populate mps.party_id by fetching each MP's NR SR detail
 * page and parsing the party label from "Kandidoval(a) za" / "Klub …".
 *
 * Usage: npx tsx scripts/backfill-mp-parties.ts
 */
import "dotenv/config";
import { eq, isNotNull } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { MANUAL_PARTY_OVERRIDES, resolvePartyId } from "../src/lib/db/nrsr";
import { mps, parties as partiesTable } from "../src/lib/db/schema";

const NRSR_BASE = "https://www.nrsr.sk";
const UA = "Mozilla/5.0 (compatible; VolimTo/1.0; +https://volimto.sk)";
const TERM = 9; // CisObdobia

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#225;/g, "á")
    .replace(/&#233;/g, "é")
    .replace(/&#237;/g, "í")
    .replace(/&#243;/g, "ó")
    .replace(/&#250;/g, "ú")
    .replace(/&#253;/g, "ý");
}

function extractPartyLabel(html: string): string | null {
  const cleaned = decodeEntities(html);
  // 1) Current "Klub <NAME>" — reflects defections / independents
  const klub = cleaned.match(/<li>\s*Klub\s+([^<(]+?)\s*\(/i);
  if (klub) {
    const v = klub[1].trim();
    if (/nez[aá]visl|nezarad/i.test(v)) return null;
    return v;
  }
  // 2) Fallback to original ticket "Kandidoval(a) za"
  const kand = cleaned.match(
    /Kandidoval\(a\) za\s*<\/strong>\s*<span>([^<]+)<\/span>/i
  );
  if (kand) return kand[1].trim();
  return null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = getDb();

  console.log("Loading parties...");
  const parties = await db
    .select({ id: partiesTable.id, abbreviation: partiesTable.abbreviation })
    .from(partiesTable);
  const partySlugToId: Record<string, string> = {};
  for (const p of parties) partySlugToId[p.abbreviation.toLowerCase()] = p.id;
  console.log(`  ${parties.length} parties: ${Object.keys(partySlugToId).join(", ")}`);

  console.log("Loading MPs...");
  const dbMps = await db
    .select({ id: mps.id, slug: mps.slug, nrsrPersonId: mps.nrsrPersonId })
    .from(mps)
    .where(isNotNull(mps.nrsrPersonId));
  console.log(`  ${dbMps.length} MPs to process`);

  let matched = 0;
  let unmatched = 0;
  const perParty: Record<string, number> = {};
  const unknownLabels = new Set<string>();
  const updates: { slug: string; partyId: string | null; label: string }[] = [];

  for (let i = 0; i < dbMps.length; i++) {
    const mp = dbMps[i];
    const nrsrPersonId = mp.nrsrPersonId!;
    // Manual override takes precedence — skip NRSR fetch
    const override = MANUAL_PARTY_OVERRIDES[nrsrPersonId];
    if (override) {
      matched++;
      perParty[override] = (perParty[override] ?? 0) + 1;
      updates.push({ slug: mp.slug, partyId: override, label: `override→${override}` });
      continue;
    }

    const url = `${NRSR_BASE}/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=${nrsrPersonId}&CisObdobia=${TERM}`;
    try {
      const html = await fetchHtml(url);
      // Detect nezaradený explicitly: no Klub line means independent
      const cleaned = html.replace(/&nbsp;/g, " ");
      const hasKlub = /<li>\s*Klub\s+/i.test(cleaned);
      const label = extractPartyLabel(html);
      const partyId = resolvePartyId(label, partySlugToId);
      if (partyId) {
        matched++;
        perParty[partyId] = (perParty[partyId] ?? 0) + 1;
        updates.push({ slug: mp.slug, partyId, label: label! });
      } else if (!hasKlub || /nez[aá]visl|nezarad/i.test(label ?? "")) {
        matched++;
        perParty["__independent__"] = (perParty["__independent__"] ?? 0) + 1;
        updates.push({ slug: mp.slug, partyId: null, label: "nezaradený" });
      } else {
        unmatched++;
        if (label) unknownLabels.add(label);
        console.log(`  [unmatched] ${mp.slug} → label=${label ?? "<none>"}`);
      }
    } catch (err) {
      unmatched++;
      console.warn(`  [error] ${mp.slug}: ${(err as Error).message}`);
    }
    if ((i + 1) % 10 === 0) console.log(`  scraped ${i + 1}/${dbMps.length}`);
    await sleep(150);
  }

  console.log(`\nMatch: ${matched} matched / ${unmatched} unmatched / ${dbMps.length} total`);
  console.log("Per-party counts:");
  for (const [pid, n] of Object.entries(perParty)) {
    const abbr = parties.find((p) => p.id === pid)?.abbreviation ?? pid;
    console.log(`  ${abbr.padEnd(8)} ${n}`);
  }
  if (unknownLabels.size) {
    console.log("Unknown party labels:", [...unknownLabels]);
  }

  console.log(`\nApplying ${updates.length} UPDATEs...`);
  let written = 0;
  for (const u of updates) {
    await db.update(mps).set({ partyId: u.partyId }).where(eq(mps.slug, u.slug));
    written++;
    if (written % 25 === 0) console.log(`  ${written}/${updates.length}`);
  }
  console.log(`Done. ${written} rows updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
