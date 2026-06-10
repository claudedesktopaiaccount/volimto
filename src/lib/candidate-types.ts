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
