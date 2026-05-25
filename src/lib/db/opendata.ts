import type { Database } from "./index";
import { companies, contracts, donations, mps, politicianCompanyLinks } from "./schema";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type {
  ScrapedCompany,
  ScrapedContract,
  ScrapedDonation,
} from "@/lib/scraper/opendata";
import type { VerifiedPoliticianCompanyLink } from "@/lib/verified-financial-links";

const CHUNK = 50;

function excluded(columnName: string) {
  return sql.raw(`excluded.${columnName}`);
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function normalizeIco(ico: string): string {
  return ico.replace(/\D/g, "");
}

export function isContractDateWithinVerifiedLink(
  signedDate: string,
  link: Pick<VerifiedPoliticianCompanyLink, "startDate" | "endDate">
): boolean {
  if (link.startDate && signedDate < link.startDate) return false;
  if (link.endDate && signedDate > link.endDate) return false;
  return true;
}

export function verifiedLinkMatchesContract(
  contract: { supplierIco: string; signedDate: string },
  link: Pick<VerifiedPoliticianCompanyLink, "ico" | "startDate" | "endDate">
): boolean {
  return (
    normalizeIco(contract.supplierIco) === normalizeIco(link.ico) &&
    isContractDateWithinVerifiedLink(contract.signedDate, link)
  );
}

// ─── Companies ────────────────────────────────────────────

/**
 * Upsert companies by ICO (unique key).
 * Returns count of rows inserted/updated.
 */
export async function upsertCompanies(
  db: Database,
  items: ScrapedCompany[]
): Promise<number> {
  if (!items.length) return 0;
  let count = 0;

  for (const batch of chunks(items, CHUNK)) {
    const values = batch.map((c) => ({
      ico: c.ico,
      name: c.name,
      legalForm: c.legalForm ?? null,
      rpvsUboUrl: c.rpvsUboUrl ?? null,
      finstatUrl: null,
      foundedDate: null,
      sector: null,
      addressSk: c.addressSk ?? null,
    }));

    const result = await db
      .insert(companies)
      .values(values)
      .onConflictDoUpdate({
        target: companies.ico,
        set: {
          name: companies.name,
          legalForm: companies.legalForm,
          rpvsUboUrl: companies.rpvsUboUrl,
          addressSk: companies.addressSk,
        },
      })
      .returning({ id: companies.id });

    count += result.length;
  }

  return count;
}

// ─── Contracts ────────────────────────────────────────────

/**
 * Insert contracts. Uses onConflictDoNothing — no reliable unique key.
 * Returns count of rows inserted.
 */
export async function upsertVerifiedPoliticianCompanyLinks(
  db: Database,
  items: VerifiedPoliticianCompanyLink[]
): Promise<number> {
  if (!items.length) return 0;

  const normalized = items
    .map((item) => ({ ...item, ico: normalizeIco(item.ico) }))
    .filter((item) => item.mpSlug && item.ico && item.companyName && item.sourceUrl);
  if (!normalized.length) return 0;

  const companyValues = normalized.map((item) => ({
    ico: item.ico,
    name: item.companyName,
    legalForm: null,
    rpvsUboUrl: null,
    finstatUrl: null,
    foundedDate: null,
    sector: null,
    addressSk: null,
  }));

  for (const batch of chunks(companyValues, CHUNK)) {
    await db
      .insert(companies)
      .values(batch)
      .onConflictDoUpdate({
        target: companies.ico,
        set: {
          name: excluded(companies.name.name),
        },
      });
  }

  const mpRows = await db
    .select({ id: mps.id, slug: mps.slug })
    .from(mps)
    .where(inArray(mps.slug, [...new Set(normalized.map((item) => item.mpSlug))]));
  const companyRows = await db
    .select({ id: companies.id, ico: companies.ico })
    .from(companies)
    .where(inArray(companies.ico, [...new Set(normalized.map((item) => item.ico))]));

  const mpIdBySlug = new Map(mpRows.map((mp) => [mp.slug, mp.id]));
  const companyIdByIco = new Map(companyRows.map((company) => [company.ico, company.id]));
  const rows = normalized
    .map((item) => {
      const mpId = mpIdBySlug.get(item.mpSlug);
      const companyId = companyIdByIco.get(item.ico);
      if (!mpId || !companyId) return null;
      return {
        mpId,
        companyId,
        relationship: item.relationship,
        startDate: item.startDate,
        endDate: item.endDate,
        sourceUrl: item.sourceUrl,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  let count = 0;
  for (const batch of chunks(rows, CHUNK)) {
    const result = await db
      .insert(politicianCompanyLinks)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          politicianCompanyLinks.mpId,
          politicianCompanyLinks.companyId,
          politicianCompanyLinks.relationship,
        ],
        set: {
          startDate: excluded(politicianCompanyLinks.startDate.name),
          endDate: excluded(politicianCompanyLinks.endDate.name),
          sourceUrl: excluded(politicianCompanyLinks.sourceUrl.name),
        },
      })
      .returning({ id: politicianCompanyLinks.id });
    count += result.length;
  }

  return count;
}

export async function linkContractsToVerifiedPoliticians(
  db: Database,
  items: VerifiedPoliticianCompanyLink[]
): Promise<number> {
  if (!items.length) return 0;

  const normalized = items
    .map((item) => ({ ...item, ico: normalizeIco(item.ico) }))
    .filter((item) => item.mpSlug && item.ico);
  if (!normalized.length) return 0;

  const mpRows = await db
    .select({ id: mps.id, slug: mps.slug })
    .from(mps)
    .where(inArray(mps.slug, [...new Set(normalized.map((item) => item.mpSlug))]));
  const mpIdBySlug = new Map(mpRows.map((mp) => [mp.slug, mp.id]));

  let count = 0;
  for (const item of normalized) {
    const mpId = mpIdBySlug.get(item.mpSlug);
    if (!mpId) continue;

    const conditions = [
      eq(contracts.supplierIco, item.ico),
      or(isNull(contracts.linkedPoliticianId), eq(contracts.linkedPoliticianId, mpId)),
    ];
    if (item.startDate) conditions.push(gte(contracts.signedDate, item.startDate));
    if (item.endDate) conditions.push(lte(contracts.signedDate, item.endDate));

    const result = await db
      .update(contracts)
      .set({ linkedPoliticianId: mpId })
      .where(and(...conditions))
      .returning({ id: contracts.id });
    count += result.length;
  }

  return count;
}

export async function upsertContracts(
  db: Database,
  items: ScrapedContract[]
): Promise<number> {
  if (!items.length) return 0;
  let count = 0;

  for (const batch of chunks(items, CHUNK)) {
    const values = batch.map((c) => ({
      contractNumber: c.contractNumber ?? null,
      titleSk: c.titleSk,
      contractingAuthority: c.contractingAuthority,
      supplierIco: c.supplierIco,
      supplierName: c.supplierName,
      amountEur: c.amountEur,
      signedDate: c.signedDate,
      cpvCode: c.cpvCode ?? null,
      sourceUrl: c.sourceUrl,
      linkedPoliticianId: null,
    }));

    const result = await db
      .insert(contracts)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: contracts.id });

    count += result.length;
  }

  return count;
}

// ─── Donations ────────────────────────────────────────────

/**
 * Insert donations. Uses onConflictDoNothing — no unique constraint.
 * Returns count of rows inserted.
 */
export async function upsertDonations(
  db: Database,
  items: ScrapedDonation[]
): Promise<number> {
  if (!items.length) return 0;
  let count = 0;

  for (const batch of chunks(items, CHUNK)) {
    const values = batch.map((d) => ({
      partyId: d.partyId,
      donorName: d.donorName,
      donorIco: d.donorIco ?? null,
      amountEur: d.amountEur,
      donationDate: d.donationDate,
      sourceUrl: d.sourceUrl,
    }));

    const result = await db
      .insert(donations)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: donations.id });

    count += result.length;
  }

  return count;
}
