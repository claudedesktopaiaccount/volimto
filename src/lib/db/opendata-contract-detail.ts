import { eq } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import { companies, contracts, mps, parties } from "@/lib/db/schema";
import { verifiedContractPoliticianJoinCondition } from "@/lib/db/verified-contract-links";

export interface OpenDataContractDetail {
  id: number;
  contractNumber: string | null;
  titleSk: string;
  contractingAuthority: string;
  supplierIco: string;
  supplierName: string;
  amountEur: number;
  signedDate: string;
  cpvCode: string | null;
  sourceUrl: string;
  rpvsCompanyName: string | null;
  rpvsLegalForm: string | null;
  rpvsAddress: string | null;
  rpvsUrl: string | null;
  linkedPoliticianId: number | null;
  linkedPoliticianName: string | null;
  linkedPoliticianSlug: string | null;
  partyId: string | null;
  partyName: string | null;
  partyAbbreviation: string | null;
}

export async function getOpenDataContractDetail(
  id: number,
  database?: Database
): Promise<OpenDataContractDetail | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const db = database ?? getDb();
  const rows = await db
    .select({
      id: contracts.id,
      contractNumber: contracts.contractNumber,
      titleSk: contracts.titleSk,
      contractingAuthority: contracts.contractingAuthority,
      supplierIco: contracts.supplierIco,
      supplierName: contracts.supplierName,
      amountEur: contracts.amountEur,
      signedDate: contracts.signedDate,
      cpvCode: contracts.cpvCode,
      sourceUrl: contracts.sourceUrl,
      rpvsCompanyName: companies.name,
      rpvsLegalForm: companies.legalForm,
      rpvsAddress: companies.addressSk,
      rpvsUrl: companies.rpvsUboUrl,
      linkedPoliticianId: mps.id,
      linkedPoliticianName: mps.nameDisplay,
      linkedPoliticianSlug: mps.slug,
      partyId: parties.id,
      partyName: parties.name,
      partyAbbreviation: parties.abbreviation,
    })
    .from(contracts)
    .leftJoin(companies, eq(contracts.supplierIco, companies.ico))
    .leftJoin(mps, verifiedContractPoliticianJoinCondition())
    .leftJoin(parties, eq(mps.partyId, parties.id))
    .where(eq(contracts.id, id))
    .limit(1);

  return rows[0] ?? null;
}
