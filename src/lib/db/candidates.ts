import { eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
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

export async function getCandidates(db: Database): Promise<CandidateWithParty[]> {
  return await db
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
    .orderBy(candidates.partyId, candidates.listRank);
}
