import { eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { candidates, parties } from "./schema";

export interface CandidateWithParty {
  id: number;
  partyId: string;
  name: string;
  listRank: number;
  role: string | null;
  portraitUrl: string | null;
  partyColor: string;
  partyAbbreviation: string;
  partyName: string;
}

export async function getCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: DrizzleD1Database<any>
): Promise<CandidateWithParty[]> {
  return db
    .select({
      id: candidates.id,
      partyId: candidates.partyId,
      name: candidates.name,
      listRank: candidates.listRank,
      role: candidates.role,
      portraitUrl: candidates.portraitUrl,
      partyColor: sql<string>`${parties.color}`.as("party_color"),
      partyAbbreviation: sql<string>`${parties.abbreviation}`.as("party_abbreviation"),
      partyName: sql<string>`${parties.name}`.as("party_name"),
    })
    .from(candidates)
    .innerJoin(parties, eq(candidates.partyId, parties.id))
    .orderBy(candidates.partyId, candidates.listRank)
    .all();
}
