import type { Database } from "@/lib/db";
import { mps, parties } from "@/lib/db/schema";
import { asc, eq, isNull, or } from "drizzle-orm";
import { COALITION_PARTY_IDS } from "@/lib/coalition";
import type { MpRow } from "@/lib/db/mps";

export interface PartyGroup {
  party: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
    leader: string;
    portraitUrl: string | null;
  };
  mps: MpRow[];
  stats: {
    count: number;
    avgAge: number | null;
    ministerCount: number;
  };
}

export interface GroupedMps {
  coalition: PartyGroup[];
  opposition: PartyGroup[];
  independent: MpRow[];
}

const MINISTER_RE = /minister|predseda vl[aá]dy/i;

export async function getMpsGroupedByParty(db: Database): Promise<GroupedMps> {
  const rows = await db
    .select({
      id: mps.id,
      slug: mps.slug,
      nameDisplay: mps.nameDisplay,
      nameFull: mps.nameFull,
      partyId: mps.partyId,
      partyAbbr: parties.abbreviation,
      partyColor: parties.color,
      partyName: parties.name,
      partyLeader: parties.leader,
      partyPortrait: parties.portraitUrl,
      constituency: mps.constituency,
      role: mps.role,
      photoUrl: mps.photoUrl,
      birthYear: mps.birthYear,
    })
    .from(mps)
    .leftJoin(parties, eq(mps.partyId, parties.id))
    .where(or(isNull(mps.activeTo), eq(mps.activeTo, "")))
    .orderBy(asc(mps.nameDisplay));

  const buckets = new Map<string, PartyGroup>();
  const independent: MpRow[] = [];
  const currentYear = new Date().getFullYear();

  for (const r of rows) {
    const mpRow: MpRow = {
      id: r.id,
      slug: r.slug,
      nameDisplay: r.nameDisplay,
      nameFull: r.nameFull,
      partyId: r.partyId,
      partyAbbr: r.partyAbbr,
      partyColor: r.partyColor,
      constituency: r.constituency,
      role: r.role,
      photoUrl: r.photoUrl,
    };

    if (!r.partyId || !r.partyAbbr) {
      independent.push(mpRow);
      continue;
    }

    let g = buckets.get(r.partyId);
    if (!g) {
      g = {
        party: {
          id: r.partyId,
          name: r.partyName ?? r.partyAbbr,
          abbreviation: r.partyAbbr,
          color: r.partyColor ?? "#555",
          leader: r.partyLeader ?? "",
          portraitUrl: r.partyPortrait ?? null,
        },
        mps: [],
        stats: { count: 0, avgAge: null, ministerCount: 0 },
      };
      buckets.set(r.partyId, g);
    }

    g.mps.push(mpRow);
    g.stats.count++;
    if (MINISTER_RE.test(r.role)) g.stats.ministerCount++;
  }

  // avg age — compute after collecting all rows so we keep the original loop simple
  for (const [partyId, g] of buckets) {
    const ages: number[] = [];
    for (const row of rows) {
      if (row.partyId === partyId && row.birthYear) {
        ages.push(currentYear - row.birthYear);
      }
    }
    g.stats.avgAge = ages.length
      ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
      : null;
  }

  const groups = Array.from(buckets.values()).sort(
    (a, b) => b.stats.count - a.stats.count
  );
  const coalition = groups.filter((g) => COALITION_PARTY_IDS.has(g.party.id));
  const opposition = groups.filter((g) => !COALITION_PARTY_IDS.has(g.party.id));

  return { coalition, opposition, independent };
}
