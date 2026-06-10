export interface ScrapedMp {
  nrsrPersonId: string;
  nameFull: string;
  nameDisplay: string;
  slug: string;
  partyAbbr: string | null;
  role: string;
  constituency: string | null;
  birthYear: number | null;
  photoUrl: string | null;
}

export interface ScrapedVote {
  nrsrVoteId: string;
  date: string;
  titleSk: string;
  topicCategory: string;
  result: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  votesAbsent: number;
  sourceUrl: string;
}

export interface ScrapedVoteRecord {
  nrsrVoteId: string;
  nrsrPersonId: string;
  choice: string;
}

export interface ScrapedSpeech {
  nrsrSpeechId: string;
  nrsrPersonId: string;
  date: string;
  titleSk: string | null;
  textSk: string;
  sourceUrl: string;
}

export interface ScrapedInterpellation {
  date: string;
  addressee: string | null;
  subject: string;
  url: string;
  answerUrl: string | null;
}

export interface ScrapedQuestion {
  date: string;
  subject: string;
  url: string;
}

export interface ScrapedLegislationItem {
  cisloTlace: string | null;
  title: string;
  date: string;
  status: string | null;
  url: string;
}

export interface ScrapedAmendment {
  toLaw: string;
  date: string;
  url: string;
}

export interface ScrapedForeignTrip {
  date: string;
  country: string;
  purpose: string | null;
  costEur: number | null;
  sourceUrl: string;
}

export interface ScrapedAssistant {
  name: string;
  type: string | null;
}

export interface ScrapedOffice {
  address: string;
  city: string | null;
}

export interface ScrapedMpActivities {
  speeches: ScrapedSpeech[];
  interpellations: ScrapedInterpellation[];
  questions: ScrapedQuestion[];
  legislation: ScrapedLegislationItem[];
  amendments: ScrapedAmendment[];
  trips: ScrapedForeignTrip[];
  assistants: ScrapedAssistant[];
  offices: ScrapedOffice[];
}
