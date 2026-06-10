import type { Database } from "./index";
import {
  mps,
  votes,
  voteRecords,
  speeches,
  mpInterpellations,
  mpQuestions,
  mpLegislation,
  mpAmendments,
  mpForeignTrips,
  mpAssistants,
  mpOffices,
} from "./schema";
import { eq, inArray, sql } from "drizzle-orm";
import type {
  ScrapedMp,
  ScrapedVote,
  ScrapedVoteRecord,
  ScrapedSpeech,
  ScrapedMpActivities,
} from "@/lib/nrsr-types";

const CHUNK = 50;

function excluded(columnName: string) {
  return sql.raw(`excluded.${columnName}`);
}

function excludedOrExistingPartyId() {
  return sql<string | null>`coalesce(${excluded(mps.partyId.name)}, ${mps.partyId})`;
}

function excludedOrExistingPhotoUrl() {
  return sql<string | null>`coalesce(${excluded(mps.photoUrl.name)}, ${mps.photoUrl})`;
}

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
          nameFull: excluded(mps.nameFull.name),
          nameDisplay: excluded(mps.nameDisplay.name),
          // The current NRSR alphabetical list does not expose party/club in
          // the row. Preserve the last known party instead of clobbering it
          // with NULL; explicit independents are reconciled by the caller.
          partyId: excludedOrExistingPartyId(),
          role: excluded(mps.role.name),
          constituency: excluded(mps.constituency.name),
          birthYear: excluded(mps.birthYear.name),
          photoUrl: excludedOrExistingPhotoUrl(),
          nrsrPersonId: excluded(mps.nrsrPersonId.name),
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
          date: excluded(votes.date.name),
          titleSk: excluded(votes.titleSk.name),
          topicCategory: excluded(votes.topicCategory.name),
          result: excluded(votes.result.name),
          votesFor: excluded(votes.votesFor.name),
          votesAgainst: excluded(votes.votesAgainst.name),
          votesAbstain: excluded(votes.votesAbstain.name),
          votesAbsent: excluded(votes.votesAbsent.name),
          sourceUrl: excluded(votes.sourceUrl.name),
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
        set: { choice: excluded(voteRecords.choice.name) },
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
        summaryStatus: "pending",
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
        summaryStatus: string;
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

// ─── MP Activities upserts ────────────────────────────────

export interface UpsertActivitiesCounts {
  speeches: number;
  interpellations: number;
  questions: number;
  legislation: number;
  amendments: number;
  trips: number;
  assistants: number;
  offices: number;
}

/**
 * Replace this MP's activity rows with the freshly scraped set.
 * Tables with a unique index are upserted via onConflictDoNothing on (mpId, url|name).
 * Tables without a unique index (trips, offices) are wiped-and-reinserted per MP.
 */
export async function upsertMpActivities(
  db: Database,
  mpId: number,
  activities: ScrapedMpActivities
): Promise<UpsertActivitiesCounts> {
  const now = new Date().toISOString();
  const counts: UpsertActivitiesCounts = {
    speeches: 0, interpellations: 0, questions: 0, legislation: 0,
    amendments: 0, trips: 0, assistants: 0, offices: 0,
  };

  if (activities.speeches.length > 0) {
    const rows = activities.speeches.map((s) => ({
      mpId,
      date: s.date,
      titleSk: s.titleSk ?? null,
      textSk: s.textSk,
      sourceUrl: s.sourceUrl,
      nrsrSpeechId: s.nrsrSpeechId,
      summaryStatus: "pending",
    }));
    for (const batch of chunks(rows, CHUNK)) {
      const r = await db.insert(speeches).values(batch)
        .onConflictDoUpdate({
          target: speeches.nrsrSpeechId,
          set: {
            mpId: excluded(speeches.mpId.name),
            date: excluded(speeches.date.name),
            titleSk: excluded(speeches.titleSk.name),
            textSk: excluded(speeches.textSk.name),
            sourceUrl: excluded(speeches.sourceUrl.name),
          },
        })
        .returning({ id: speeches.id });
      counts.speeches += r.length;
    }
  }

  if (activities.interpellations.length > 0) {
    const rows = activities.interpellations.map((i) => ({
      mpId, date: i.date, addressee: i.addressee, subject: i.subject,
      url: i.url, answerUrl: i.answerUrl, createdAt: now,
    }));
    for (const batch of chunks(rows, CHUNK)) {
      const r = await db.insert(mpInterpellations).values(batch)
        .onConflictDoNothing().returning({ id: mpInterpellations.id });
      counts.interpellations += r.length;
    }
  }

  if (activities.questions.length > 0) {
    const rows = activities.questions.map((q) => ({
      mpId, date: q.date, subject: q.subject, url: q.url, createdAt: now,
    }));
    for (const batch of chunks(rows, CHUNK)) {
      const r = await db.insert(mpQuestions).values(batch)
        .onConflictDoNothing().returning({ id: mpQuestions.id });
      counts.questions += r.length;
    }
  }

  if (activities.legislation.length > 0) {
    const rows = activities.legislation.map((l) => ({
      mpId, cisloTlace: l.cisloTlace, title: l.title, date: l.date,
      status: l.status, url: l.url, createdAt: now,
    }));
    for (const batch of chunks(rows, CHUNK)) {
      const r = await db.insert(mpLegislation).values(batch)
        .onConflictDoNothing().returning({ id: mpLegislation.id });
      counts.legislation += r.length;
    }
  }

  if (activities.amendments.length > 0) {
    const rows = activities.amendments.map((a) => ({
      mpId, toLaw: a.toLaw, date: a.date, url: a.url, createdAt: now,
    }));
    for (const batch of chunks(rows, CHUNK)) {
      const r = await db.insert(mpAmendments).values(batch)
        .onConflictDoNothing().returning({ id: mpAmendments.id });
      counts.amendments += r.length;
    }
  }

  // Trips: no unique index — replace
  await db.delete(mpForeignTrips).where(eq(mpForeignTrips.mpId, mpId));
  if (activities.trips.length > 0) {
    const rows = activities.trips.map((t) => ({
      mpId, date: t.date, country: t.country, purpose: t.purpose,
      costEur: t.costEur, sourceUrl: t.sourceUrl, createdAt: now,
    }));
    for (const batch of chunks(rows, CHUNK)) {
      await db.insert(mpForeignTrips).values(batch);
      counts.trips += batch.length;
    }
  }

  if (activities.assistants.length > 0) {
    const rows = activities.assistants.map((a) => ({
      mpId, name: a.name, type: a.type, createdAt: now,
    }));
    for (const batch of chunks(rows, CHUNK)) {
      const r = await db.insert(mpAssistants).values(batch)
        .onConflictDoNothing().returning({ id: mpAssistants.id });
      counts.assistants += r.length;
    }
  }

  // Offices: no unique index — replace
  await db.delete(mpOffices).where(eq(mpOffices.mpId, mpId));
  if (activities.offices.length > 0) {
    const rows = activities.offices.map((o) => ({
      mpId, address: o.address, city: o.city, createdAt: now,
    }));
    for (const batch of chunks(rows, CHUNK)) {
      await db.insert(mpOffices).values(batch);
      counts.offices += batch.length;
    }
  }

  return counts;
}
