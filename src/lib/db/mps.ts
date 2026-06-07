import type { Database } from "@/lib/db";
import {
  mps,
  parties,
  voteRecords,
  votes,
  speeches,
  politicianCompanyLinks,
  companies,
  contracts,
  partyPromises,
  mpInterpellations,
  mpQuestions,
  mpLegislation,
  mpAmendments,
  mpForeignTrips,
  mpAssistants,
  mpOffices,
} from "@/lib/db/schema";
import { eq, desc, count, sum, sql, and, asc, ilike, or } from "drizzle-orm";

// ─── Row Types ───────────────────────────────────────────────────────────────

export interface MpRow {
  id: number;
  slug: string;
  nameDisplay: string;
  nameFull: string;
  partyId: string | null;
  partyAbbr: string | null;
  partyColor: string | null;
  constituency: string | null;
  role: string;
  photoUrl: string | null;
}

export interface MpDetail {
  id: number;
  slug: string;
  nameDisplay: string;
  nameFull: string;
  partyId: string | null;
  partyName: string | null;
  partyAbbr: string | null;
  partyColor: string | null;
  constituency: string | null;
  birthYear: number | null;
  photoUrl: string | null;
  role: string;
}

export interface VoteRow {
  id: number;
  voteId: number;
  date: string;
  titleSk: string;
  topicCategory: string;
  choice: string;
}

export interface SpeechRow {
  id: number;
  date: string;
  titleSk: string | null;
  textSk: string;
  excerpt: string | null;
  sourceUrl: string | null;
  cleanTitleSk: string | null;
  speechType: string | null;
  summarySk: string | null;
  keyPointsSk: string | null;
  summaryStatus: string;
}

export interface CompanyRow {
  id: number;
  ico: string;
  name: string;
  relationship: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ContractRow {
  id: number;
  titleSk: string;
  supplierName: string;
  supplierIco: string;
  amountEur: number;
  signedDate: string;
}

export interface MpDetailOverview {
  speeches: SpeechRow[];
  speechTotal: number;
  interpellations: InterpellationRow[];
  interpellationTotal: number;
  companies: CompanyRow[];
  contractPreview: ContractRow[];
  contractTotal: number;
  contractTotalAmount: number;
}

export interface PromiseRow {
  id: number;
  promiseText: string;
  category: string;
  status: string;
  isPro: boolean;
}

// ─── 1. getMps — paginated list ──────────────────────────────────────────────

async function getMps(
  db: Database,
  opts: {
    party?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ mps: MpRow[]; total: number }> {
  const { party, search, page = 1, pageSize = 24 } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (party) {
    conditions.push(eq(parties.abbreviation, party));
  }
  if (search) {
    const safeSearch = search.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${safeSearch}%`;
    conditions.push(
      or(
        ilike(mps.nameDisplay, pattern),
        ilike(mps.nameFull, pattern),
        ilike(mps.slug, pattern)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: mps.id,
      slug: mps.slug,
      nameDisplay: mps.nameDisplay,
      nameFull: mps.nameFull,
      partyId: mps.partyId,
      partyAbbr: parties.abbreviation,
      partyColor: parties.color,
      constituency: mps.constituency,
      role: mps.role,
      photoUrl: mps.photoUrl,
    })
    .from(mps)
    .leftJoin(parties, eq(mps.partyId, parties.id))
    .where(whereClause)
    .orderBy(asc(mps.nameDisplay))
    .limit(pageSize)
    .offset(offset);

  const [totalRow] = await db
    .select({ total: count() })
    .from(mps)
    .leftJoin(parties, eq(mps.partyId, parties.id))
    .where(whereClause);

  return {
    mps: rows,
    total: totalRow?.total ?? 0,
  };
}

// ─── 2. getMpBySlug — single MP with party info ──────────────────────────────

export async function getMpBySlug(
  db: Database,
  slug: string
): Promise<MpDetail | null> {
  const [row] = await db
    .select({
      id: mps.id,
      slug: mps.slug,
      nameDisplay: mps.nameDisplay,
      nameFull: mps.nameFull,
      partyId: mps.partyId,
      partyName: parties.name,
      partyAbbr: parties.abbreviation,
      partyColor: parties.color,
      constituency: mps.constituency,
      birthYear: mps.birthYear,
      photoUrl: mps.photoUrl,
      role: mps.role,
    })
    .from(mps)
    .leftJoin(parties, eq(mps.partyId, parties.id))
    .where(eq(mps.slug, slug));

  return row ?? null;
}

// ─── 3. getMpVotes — paginated vote records for an MP ────────────────────────

export async function getMpVotes(
  db: Database,
  mpId: number,
  opts: { page?: number; pageSize?: number } = {}
): Promise<{ records: VoteRow[]; total: number }> {
  const { page = 1, pageSize = 20 } = opts;
  const offset = (page - 1) * pageSize;

  const records = await db
    .select({
      id: voteRecords.id,
      voteId: voteRecords.voteId,
      date: votes.date,
      titleSk: votes.titleSk,
      topicCategory: votes.topicCategory,
      choice: voteRecords.choice,
    })
    .from(voteRecords)
    .innerJoin(votes, eq(voteRecords.voteId, votes.id))
    .where(eq(voteRecords.mpId, mpId))
    .orderBy(desc(votes.date))
    .limit(pageSize)
    .offset(offset);

  const [totalRow] = await db
    .select({ total: count() })
    .from(voteRecords)
    .where(eq(voteRecords.mpId, mpId));

  return {
    records,
    total: totalRow?.total ?? 0,
  };
}

// ─── 4. getMpSpeeches — paginated speeches ───────────────────────────────────

export async function getMpSpeeches(
  db: Database,
  mpId: number,
  opts: { page?: number; pageSize?: number } = {}
): Promise<{ speeches: SpeechRow[]; total: number }> {
  const { page = 1, pageSize = 10 } = opts;
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: speeches.id,
      date: speeches.date,
      titleSk: speeches.titleSk,
      textSk: speeches.textSk,
      excerpt: sql<string>`substr(${speeches.textSk}, 1, 300)`,
      sourceUrl: speeches.sourceUrl,
      cleanTitleSk: speeches.cleanTitleSk,
      speechType: speeches.speechType,
      summarySk: speeches.summarySk,
      keyPointsSk: speeches.keyPointsSk,
      summaryStatus: speeches.summaryStatus,
    })
    .from(speeches)
    .where(eq(speeches.mpId, mpId))
    .orderBy(desc(speeches.date))
    .limit(pageSize)
    .offset(offset);

  const [totalRow] = await db
    .select({ total: count() })
    .from(speeches)
    .where(eq(speeches.mpId, mpId));

  return {
    speeches: rows,
    total: totalRow?.total ?? 0,
  };
}

// ─── 5. getMpCompanies — company links for MP ────────────────────────────────

export async function getMpCompanies(
  db: Database,
  mpId: number
): Promise<CompanyRow[]> {
  const rows = await db
    .select({
      id: politicianCompanyLinks.id,
      ico: companies.ico,
      name: companies.name,
      relationship: politicianCompanyLinks.relationship,
      startDate: politicianCompanyLinks.startDate,
      endDate: politicianCompanyLinks.endDate,
    })
    .from(politicianCompanyLinks)
    .innerJoin(companies, eq(politicianCompanyLinks.companyId, companies.id))
    .where(eq(politicianCompanyLinks.mpId, mpId));

  return rows;
}

// ─── 6. getMpContracts — paginated contracts linked to MP ────────────────────

export async function getMpContracts(
  db: Database,
  mpId: number,
  opts: { page?: number; pageSize?: number } = {}
): Promise<{ contracts: ContractRow[]; total: number; totalAmount: number }> {
  const { page = 1, pageSize = 20 } = opts;
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: contracts.id,
      titleSk: contracts.titleSk,
      supplierName: contracts.supplierName,
      supplierIco: contracts.supplierIco,
      amountEur: contracts.amountEur,
      signedDate: contracts.signedDate,
    })
    .from(contracts)
    .where(eq(contracts.linkedPoliticianId, mpId))
    .orderBy(desc(contracts.signedDate))
    .limit(pageSize)
    .offset(offset);

  const [aggRow] = await db
    .select({
      total: count(),
      totalAmount: sum(contracts.amountEur),
    })
    .from(contracts)
    .where(eq(contracts.linkedPoliticianId, mpId));

  return {
    contracts: rows,
    total: aggRow?.total ?? 0,
    totalAmount: Number(aggRow?.totalAmount ?? 0),
  };
}

// ─── 7. getMpPartyPromises — promises for a party ────────────────────────────

export async function getMpDetailOverview(
  db: Database,
  mpId: number
): Promise<MpDetailOverview> {
  const [speechData, interpellationData, companyRows, contractData] = await Promise.all([
    getMpSpeeches(db, mpId, { pageSize: 3 }),
    getMpInterpellations(db, mpId, { pageSize: 3 }),
    getMpCompanies(db, mpId),
    getMpContracts(db, mpId, { pageSize: 3 }),
  ]);

  return {
    speeches: speechData.speeches,
    speechTotal: speechData.total,
    interpellations: interpellationData.rows,
    interpellationTotal: interpellationData.total,
    companies: companyRows,
    contractPreview: contractData.contracts,
    contractTotal: contractData.total,
    contractTotalAmount: contractData.totalAmount,
  };
}

async function getMpPartyPromises(
  db: Database,
  partyId: string
): Promise<PromiseRow[]> {
  const rows = await db
    .select({
      id: partyPromises.id,
      promiseText: partyPromises.promiseText,
      category: partyPromises.category,
      status: partyPromises.status,
      isPro: partyPromises.isPro,
    })
    .from(partyPromises)
    .where(eq(partyPromises.partyId, partyId))
    .orderBy(asc(partyPromises.status), asc(partyPromises.category));

  return rows;
}

// ─── MP Activities (interpellations / questions / legislation / amendments / trips / assistants / offices)

export interface MpActivityStats {
  voteCount: number;
  attendancePct: number;
  speechCount: number;
  interpellationCount: number;
  questionCount: number;
  legislationCount: number;
  amendmentCount: number;
  tripCount: number;
}

export async function getMpActivityStats(
  db: Database,
  mpId: number
): Promise<MpActivityStats> {
  const [voteRow] = await db
    .select({
      total: count(),
      present: sum(sql<number>`CASE WHEN ${voteRecords.choice} = 'neprítomný' THEN 0 ELSE 1 END`).mapWith(Number),
    })
    .from(voteRecords)
    .where(eq(voteRecords.mpId, mpId));

  const total = voteRow?.total ?? 0;
  const present = voteRow?.present ?? 0;
  const attendancePct = total > 0 ? Math.round((present / total) * 100) : 0;

  const counts = await Promise.all([
    db.select({ c: count() }).from(speeches).where(eq(speeches.mpId, mpId)),
    db.select({ c: count() }).from(mpInterpellations).where(eq(mpInterpellations.mpId, mpId)),
    db.select({ c: count() }).from(mpQuestions).where(eq(mpQuestions.mpId, mpId)),
    db.select({ c: count() }).from(mpLegislation).where(eq(mpLegislation.mpId, mpId)),
    db.select({ c: count() }).from(mpAmendments).where(eq(mpAmendments.mpId, mpId)),
    db.select({ c: count() }).from(mpForeignTrips).where(eq(mpForeignTrips.mpId, mpId)),
  ]);

  return {
    voteCount: total,
    attendancePct,
    speechCount: counts[0][0]?.c ?? 0,
    interpellationCount: counts[1][0]?.c ?? 0,
    questionCount: counts[2][0]?.c ?? 0,
    legislationCount: counts[3][0]?.c ?? 0,
    amendmentCount: counts[4][0]?.c ?? 0,
    tripCount: counts[5][0]?.c ?? 0,
  };
}

export interface InterpellationRow { id: number; date: string; addressee: string | null; subject: string; url: string; answerUrl: string | null; }
export interface QuestionRow { id: number; date: string; subject: string; url: string; }
export interface LegislationRow { id: number; cisloTlace: string | null; title: string; date: string; status: string | null; url: string; }
export interface AmendmentRow { id: number; toLaw: string; date: string; url: string; }
export interface TripRow { id: number; date: string; country: string; purpose: string | null; costEur: number | null; sourceUrl: string | null; }
export interface AssistantRow { id: number; name: string; type: string | null; }
export interface OfficeRow { id: number; address: string; city: string | null; }

export async function getMpInterpellations(
  db: Database, mpId: number, opts: { page?: number; pageSize?: number } = {}
): Promise<{ rows: InterpellationRow[]; total: number }> {
  const { page = 1, pageSize = 20 } = opts;
  const rows = await db.select({
    id: mpInterpellations.id, date: mpInterpellations.date,
    addressee: mpInterpellations.addressee, subject: mpInterpellations.subject,
    url: mpInterpellations.url, answerUrl: mpInterpellations.answerUrl,
  })
    .from(mpInterpellations).where(eq(mpInterpellations.mpId, mpId))
    .orderBy(desc(mpInterpellations.date)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ total: count() }).from(mpInterpellations).where(eq(mpInterpellations.mpId, mpId));
  return { rows, total: t?.total ?? 0 };
}

export async function getMpQuestions(
  db: Database, mpId: number, opts: { page?: number; pageSize?: number } = {}
): Promise<{ rows: QuestionRow[]; total: number }> {
  const { page = 1, pageSize = 20 } = opts;
  const rows = await db.select({
    id: mpQuestions.id, date: mpQuestions.date,
    subject: mpQuestions.subject, url: mpQuestions.url,
  })
    .from(mpQuestions).where(eq(mpQuestions.mpId, mpId))
    .orderBy(desc(mpQuestions.date)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ total: count() }).from(mpQuestions).where(eq(mpQuestions.mpId, mpId));
  return { rows, total: t?.total ?? 0 };
}

export async function getMpLegislation(
  db: Database, mpId: number, opts: { page?: number; pageSize?: number } = {}
): Promise<{ rows: LegislationRow[]; total: number }> {
  const { page = 1, pageSize = 20 } = opts;
  const rows = await db.select({
    id: mpLegislation.id, cisloTlace: mpLegislation.cisloTlace,
    title: mpLegislation.title, date: mpLegislation.date,
    status: mpLegislation.status, url: mpLegislation.url,
  })
    .from(mpLegislation).where(eq(mpLegislation.mpId, mpId))
    .orderBy(desc(mpLegislation.date)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ total: count() }).from(mpLegislation).where(eq(mpLegislation.mpId, mpId));
  return { rows, total: t?.total ?? 0 };
}

export async function getMpAmendments(
  db: Database, mpId: number, opts: { page?: number; pageSize?: number } = {}
): Promise<{ rows: AmendmentRow[]; total: number }> {
  const { page = 1, pageSize = 20 } = opts;
  const rows = await db.select({
    id: mpAmendments.id, toLaw: mpAmendments.toLaw,
    date: mpAmendments.date, url: mpAmendments.url,
  })
    .from(mpAmendments).where(eq(mpAmendments.mpId, mpId))
    .orderBy(desc(mpAmendments.date)).limit(pageSize).offset((page - 1) * pageSize);
  const [t] = await db.select({ total: count() }).from(mpAmendments).where(eq(mpAmendments.mpId, mpId));
  return { rows, total: t?.total ?? 0 };
}

async function getMpForeignTrips(db: Database, mpId: number): Promise<TripRow[]> {
  return db.select({
    id: mpForeignTrips.id, date: mpForeignTrips.date,
    country: mpForeignTrips.country, purpose: mpForeignTrips.purpose,
    costEur: mpForeignTrips.costEur, sourceUrl: mpForeignTrips.sourceUrl,
  })
    .from(mpForeignTrips).where(eq(mpForeignTrips.mpId, mpId))
    .orderBy(desc(mpForeignTrips.date));
}

async function getMpAssistants(db: Database, mpId: number): Promise<AssistantRow[]> {
  return db.select({
    id: mpAssistants.id, name: mpAssistants.name, type: mpAssistants.type,
  })
    .from(mpAssistants).where(eq(mpAssistants.mpId, mpId))
    .orderBy(asc(mpAssistants.name));
}

async function getMpOffices(db: Database, mpId: number): Promise<OfficeRow[]> {
  return db.select({
    id: mpOffices.id, address: mpOffices.address, city: mpOffices.city,
  })
    .from(mpOffices).where(eq(mpOffices.mpId, mpId))
    .orderBy(asc(mpOffices.city));
}
