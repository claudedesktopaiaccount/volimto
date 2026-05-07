import type { Database } from "./index";
import { mps, votes, voteRecords, speeches } from "./schema";
import { eq, inArray } from "drizzle-orm";
import type {
  ScrapedMp,
  ScrapedVote,
  ScrapedVoteRecord,
  ScrapedSpeech,
} from "@/lib/scraper/nrsr";

const CHUNK = 50;

/**
 * Manual NRSR person ID → internal party ID overrides.
 * Use for MPs whose NRSR record doesn't reflect their real political affiliation
 * (e.g. defectors who founded a new party but NRSR still files them under
 * their original ticket or in the "nezavisli" club).
 *
 * Applied BEFORE the independent-flip logic — these MPs will NOT get NULL
 * party_id even if NRSR's "nezavisli" page lists them.
 */
export const MANUAL_PARTY_OVERRIDES: Record<string, string> = {
  // Strana vidieka — Huliak's faction (formally in NRSR's "nezavisli" club).
  // Huliak (NRSR ID 1148) is omitted: minister with suspended mandate, not a sitting MP.
  "1150": "vidieka", // Ivan Ševčík
  "1152": "vidieka", // Pavol Ľupták
  "1173": "vidieka", // Roman Malatinec
};

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function normalizePartyKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
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
    .replace(/\s+a\s+priatelia.*$/, "")
    .replace(/^\s*\(nom\.?\s*/, "")
    .replace(/\)\s*$/, "")
    .replace(/[^a-z]/g, "")
    .replace(/(ssd|sd)$/, "");
}

const PARTY_ALIASES: Record<string, string> = {
  smer: "smer",
  smerssd: "smer",
  smersd: "smer",
  hlas: "hlas",
  hlasssd: "hlas",
  hlassd: "hlas",
  ps: "ps",
  progresivneslovensko: "ps",
  sas: "sas",
  slobodaasolidarita: "sas",
  kdh: "kdh",
  krestanskodemokratickehnutie: "kdh",
  sns: "sns",
  slovenskanarodnastrana: "sns",
  rep: "rep",
  republika: "rep",
  slov: "slov",
  slovensko: "slov",
  olano: "slov",
  dem: "dem",
  demokrati: "dem",
  al: "al",
  aliancia: "al",
  szovetseg: "al",
};

export function resolvePartyId(
  rawAbbr: string | null,
  partySlugToId: Record<string, string>
): string | null {
  if (!rawAbbr) return null;
  const key = normalizePartyKey(rawAbbr);
  if (!key) return null;

  const aliased = PARTY_ALIASES[key];
  if (aliased && partySlugToId[aliased]) return partySlugToId[aliased];

  if (partySlugToId[key]) return partySlugToId[key];

  for (const k of Object.keys(partySlugToId)) {
    if (key.startsWith(k) || k.startsWith(key)) return partySlugToId[k];
  }
  return null;
}

// ─── MPs ──────────────────────────────────────────────────

/**
 * Upsert MPs. partySlugToId maps party abbreviation → party DB id.
 * Returns count of inserted/updated rows.
 */
export async function upsertMps(
  db: Database,
  items: ScrapedMp[],
  partySlugToId: Record<string, string>,
  independentIds?: Set<string>
): Promise<number> {
  if (!items.length) return 0;
  let count = 0;

  for (const batch of chunks(items, CHUNK)) {
    const values = batch.map((mp) => {
      const override = MANUAL_PARTY_OVERRIDES[mp.nrsrPersonId];
      const partyId = override
        ? override
        : independentIds?.has(mp.nrsrPersonId)
          ? null
          : resolvePartyId(mp.partyAbbr, partySlugToId);
      return {
        slug: mp.slug,
        nameFull: mp.nameFull,
        nameDisplay: mp.nameDisplay,
        partyId,
        role: mp.role,
        constituency: mp.constituency ?? null,
        birthYear: mp.birthYear ?? null,
        photoUrl: mp.photoUrl ?? null,
        activeFrom: null,
        activeTo: null,
        nrsrPersonId: mp.nrsrPersonId,
      };
    });

    const result = await db
      .insert(mps)
      .values(values)
      .onConflictDoUpdate({
        target: mps.slug,
        set: {
          nameFull: mps.nameFull,
          nameDisplay: mps.nameDisplay,
          partyId: mps.partyId,
          role: mps.role,
          constituency: mps.constituency,
          birthYear: mps.birthYear,
          photoUrl: mps.photoUrl,
          nrsrPersonId: mps.nrsrPersonId,
        },
      })
      .returning({ id: mps.id });

    count += result.length;
  }

  return count;
}

// ─── Votes + Records ─────────────────────────────────────

/**
 * Upsert votes and vote records.
 * Returns { votes: number, records: number } inserted/updated counts.
 */
export async function upsertVotes(
  db: Database,
  voteItems: ScrapedVote[],
  recordItems: ScrapedVoteRecord[]
): Promise<{ votes: number; records: number }> {
  if (!voteItems.length) return { votes: 0, records: 0 };

  let voteCount = 0;

  // Upsert votes first to get internal IDs
  for (const batch of chunks(voteItems, CHUNK)) {
    const values = batch.map((v) => ({
      nrsrVoteId: v.nrsrVoteId,
      date: v.date,
      titleSk: v.titleSk,
      topicCategory: v.topicCategory,
      result: v.result,
      votesFor: v.votesFor,
      votesAgainst: v.votesAgainst,
      votesAbstain: v.votesAbstain,
      votesAbsent: v.votesAbsent,
      sourceUrl: v.sourceUrl,
    }));

    const result = await db
      .insert(votes)
      .values(values)
      .onConflictDoUpdate({
        target: votes.nrsrVoteId,
        set: {
          date: votes.date,
          titleSk: votes.titleSk,
          topicCategory: votes.topicCategory,
          result: votes.result,
          votesFor: votes.votesFor,
          votesAgainst: votes.votesAgainst,
          votesAbstain: votes.votesAbstain,
          votesAbsent: votes.votesAbsent,
          sourceUrl: votes.sourceUrl,
        },
      })
      .returning({ id: votes.id, nrsrVoteId: votes.nrsrVoteId });

    voteCount += result.length;
  }

  if (!recordItems.length) return { votes: voteCount, records: 0 };

  // Build nrsrVoteId → DB voteId map
  const nrsrVoteIds = [...new Set(recordItems.map((r) => r.nrsrVoteId))];
  const existingVotes = await db
    .select({ id: votes.id, nrsrVoteId: votes.nrsrVoteId })
    .from(votes)
    .where(inArray(votes.nrsrVoteId, nrsrVoteIds));

  const voteIdMap = new Map(existingVotes.map((v) => [v.nrsrVoteId, v.id]));

  // Build nrsrPersonId → MP DB id map
  const nrsrPersonIds = [...new Set(recordItems.map((r) => r.nrsrPersonId))];
  const existingMps = await db
    .select({ id: mps.id, nrsrPersonId: mps.nrsrPersonId })
    .from(mps)
    .where(inArray(mps.nrsrPersonId, nrsrPersonIds));

  const mpIdMap = new Map(existingMps.map((m) => [m.nrsrPersonId, m.id]));

  // Filter records where we have both voteId and mpId
  const validRecords = recordItems
    .map((r) => {
      const voteId = voteIdMap.get(r.nrsrVoteId);
      const mpId = mpIdMap.get(r.nrsrPersonId);
      if (!voteId || !mpId) return null;
      return { voteId, mpId, choice: r.choice };
    })
    .filter((r): r is { voteId: number; mpId: number; choice: string } => r !== null);

  let recordCount = 0;
  for (const batch of chunks(validRecords, CHUNK)) {
    const result = await db
      .insert(voteRecords)
      .values(batch)
      .onConflictDoUpdate({
        target: [voteRecords.voteId, voteRecords.mpId],
        set: { choice: voteRecords.choice },
      })
      .returning({ id: voteRecords.id });

    recordCount += result.length;
  }

  return { votes: voteCount, records: recordCount };
}

// ─── Speeches ─────────────────────────────────────────────

/**
 * Upsert speeches. Returns count inserted/updated.
 */
export async function upsertSpeeches(
  db: Database,
  items: ScrapedSpeech[]
): Promise<number> {
  if (!items.length) return 0;

  // Build nrsrPersonId → MP DB id map
  const nrsrPersonIds = [...new Set(items.map((s) => s.nrsrPersonId))];
  const existingMps = await db
    .select({ id: mps.id, nrsrPersonId: mps.nrsrPersonId })
    .from(mps)
    .where(inArray(mps.nrsrPersonId, nrsrPersonIds));

  const mpIdMap = new Map(existingMps.map((m) => [m.nrsrPersonId, m.id]));

  const validItems = items
    .map((s) => {
      const mpId = mpIdMap.get(s.nrsrPersonId);
      if (!mpId) return null;
      return {
        mpId,
        date: s.date,
        titleSk: s.titleSk ?? null,
        textSk: s.textSk,
        sourceUrl: s.sourceUrl,
        nrsrSpeechId: s.nrsrSpeechId,
      };
    })
    .filter(
      (
        s
      ): s is {
        mpId: number;
        date: string;
        titleSk: string | null;
        textSk: string;
        sourceUrl: string;
        nrsrSpeechId: string;
      } => s !== null
    );

  let count = 0;
  for (const batch of chunks(validItems, CHUNK)) {
    // speeches has no unique index on nrsrSpeechId — insert only
    // (duplicates handled by app logic; nrsrSpeechId nullable in schema)
    const result = await db
      .insert(speeches)
      .values(batch)
      .onConflictDoNothing()
      .returning({ id: speeches.id });

    count += result.length;
  }

  return count;
}
