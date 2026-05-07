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
} from "@/lib/db/schema";
import { eq, desc, count, sum, sql, and, asc } from "drizzle-orm";

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
  excerpt: string | null;
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

export interface PromiseRow {
  id: number;
  promiseText: string;
  category: string;
  status: string;
  isPro: boolean;
}

// ─── 1. getMps — paginated list ──────────────────────────────────────────────

export async function getMps(
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
    conditions.push(sql`${mps.nameDisplay} LIKE ${"%" + safeSearch + "%"} ESCAPE '\\'`);
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
      excerpt: sql<string>`substr(${speeches.textSk}, 1, 300)`,
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

export async function getMpPartyPromises(
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
