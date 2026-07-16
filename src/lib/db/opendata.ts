import type { Database } from "./index";
import { companies, contracts, donations, mps, parties, politicianCompanyLinks } from "./schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  ScrapedCompany,
  ScrapedContract,
  ScrapedDonation,
} from "@/lib/opendata-types";
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

function donationKey(item: {
  partyId: string;
  donorName: string;
  donorIco: string | null;
  amountEur: number;
  donationDate: string;
}): string {
  return [
    item.partyId,
    item.donorName.trim().toLowerCase(),
    item.donorIco ?? "",
    item.amountEur,
    item.donationDate,
  ].join("|");
}

function donationMatchCondition(item: {
  partyId: string;
  donorName: string;
  donorIco: string | null;
  amountEur: number;
  donationDate: string;
}) {
  return and(
    eq(donations.partyId, item.partyId),
    eq(donations.donorName, item.donorName),
    item.donorIco ? eq(donations.donorIco, item.donorIco) : isNull(donations.donorIco),
    eq(donations.amountEur, item.amountEur),
    eq(donations.donationDate, item.donationDate)
  );
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

export interface StoredPoliticianCompanyLinkRow {
  mpId: number;
  companyIco: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ContractPoliticianLinkRow {
  id: number;
  supplierIco: string;
  signedDate: string;
  linkedPoliticianId?: number | null;
}

export interface StoredPoliticianCompanyLinkResolution {
  assignments: Array<{
    contractId: number;
    mpId: number;
    expectedLinkedPoliticianId: number | null;
  }>;
  removals: Array<{ contractId: number; expectedLinkedPoliticianId: number }>;
  ambiguousContractIds: number[];
}

/**
 * Resolve contracts against persisted politician-company links.
 * Multiple relationship rows for the same MP count as one match; contracts
 * matching more than one unique MP are reported and never assigned.
 *
 * Every public contract attribution must be reproducible from the verified
 * relationship rows. Unsupported legacy or manual IDs are cleared instead of
 * being presented as evidence-backed links.
 */
export function resolveStoredPoliticianCompanyLinks(
  contractRows: ContractPoliticianLinkRow[],
  linkRows: StoredPoliticianCompanyLinkRow[]
): StoredPoliticianCompanyLinkResolution {
  const linksByIco = new Map<string, StoredPoliticianCompanyLinkRow[]>();

  for (const link of linkRows) {
    const ico = normalizeIco(link.companyIco);
    if (!ico) continue;
    const links = linksByIco.get(ico) ?? [];
    links.push(link);
    linksByIco.set(ico, links);
  }

  const assignments: StoredPoliticianCompanyLinkResolution["assignments"] = [];
  const removals: StoredPoliticianCompanyLinkResolution["removals"] = [];
  const ambiguousContractIds: number[] = [];

  for (const contract of [...contractRows].sort((a, b) => a.id - b.id)) {
    const ico = normalizeIco(contract.supplierIco);
    if (!ico) continue;

    const companyLinks = linksByIco.get(ico) ?? [];
    const currentMpId = contract.linkedPoliticianId ?? null;
    const matchingMpIds = [
      ...new Set(
        companyLinks
          .filter((link) => isContractDateWithinVerifiedLink(contract.signedDate, link))
          .map((link) => link.mpId)
      ),
    ].sort((a, b) => a - b);

    if (matchingMpIds.length === 1) {
      const mpId = matchingMpIds[0];
      if (currentMpId !== mpId) {
        assignments.push({
          contractId: contract.id,
          mpId,
          expectedLinkedPoliticianId: currentMpId,
        });
      }
    } else {
      if (matchingMpIds.length > 1) {
        ambiguousContractIds.push(contract.id);
      }
      if (currentMpId !== null) {
        removals.push({
          contractId: contract.id,
          expectedLinkedPoliticianId: currentMpId,
        });
      }
    }
  }

  return { assignments, removals, ambiguousContractIds };
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
  const deduped = [
    ...new Map(
      items
        .map((item) => ({ ...item, ico: normalizeIco(item.ico) }))
        .filter((item) => item.ico && item.name)
        .map((item) => [item.ico, item] as const)
    ).values(),
  ];

  for (const batch of chunks(deduped, CHUNK)) {
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
          name: excluded(companies.name.name),
          legalForm: excluded(companies.legalForm.name),
          rpvsUboUrl: excluded(companies.rpvsUboUrl.name),
          addressSk: excluded(companies.addressSk.name),
        },
      })
      .returning({ id: companies.id });

    count += result.length;
  }

  return count;
}

// ─── Contracts ────────────────────────────────────────────

/** Insert contracts once per canonical CRZ source URL. */
export async function upsertVerifiedPoliticianCompanyLinks(
  db: Database,
  items: VerifiedPoliticianCompanyLink[]
): Promise<number> {
  if (!items.length) return 0;

  const normalized = items
    .map((item) => ({ ...item, ico: normalizeIco(item.ico) }))
    .filter((item) => item.mpSlug && item.ico && item.companyName && item.sourceUrl);
  if (!normalized.length) return 0;

  const companyValues = [
    ...new Map(
      normalized.map((item) => [
        item.ico,
        {
          ico: item.ico,
          name: item.companyName,
          legalForm: null,
          rpvsUboUrl: item.sourceUrl,
          finstatUrl: null,
          foundedDate: null,
          sector: null,
          addressSk: null,
        },
      ] as const)
    ).values(),
  ];

  for (const batch of chunks(companyValues, CHUNK)) {
    await db
      .insert(companies)
      .values(batch)
      .onConflictDoUpdate({
        target: companies.ico,
        set: {
          name: excluded(companies.name.name),
          rpvsUboUrl: excluded(companies.rpvsUboUrl.name),
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
  const rows = [
    ...new Map(
      normalized.map((item) => [
        [item.mpSlug, item.ico, item.relationship, item.startDate ?? ""].join("|"),
        item,
      ] as const)
    ).values(),
  ]
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
        identitySourceUrl: item.identitySourceUrl,
        identityBirthDate: item.identityBirthDate,
        verificationMethod: item.verificationMethod,
        reviewStatus: "verified",
        verifiedAt: item.verifiedAt,
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
          politicianCompanyLinks.startDate,
        ],
        set: {
          startDate: excluded(politicianCompanyLinks.startDate.name),
          endDate: excluded(politicianCompanyLinks.endDate.name),
          sourceUrl: excluded(politicianCompanyLinks.sourceUrl.name),
          identitySourceUrl: excluded(politicianCompanyLinks.identitySourceUrl.name),
          identityBirthDate: excluded(politicianCompanyLinks.identityBirthDate.name),
          verificationMethod: excluded(politicianCompanyLinks.verificationMethod.name),
          reviewStatus: excluded(politicianCompanyLinks.reviewStatus.name),
          verifiedAt: excluded(politicianCompanyLinks.verifiedAt.name),
        },
      })
      .returning({ id: politicianCompanyLinks.id });
    count += result.length;
  }

  return count;
}

export async function linkContractsToStoredPoliticianCompanyLinks(
  db: Database
): Promise<{
  availableLinks: number;
  linkedContracts: number;
  unlinkedContracts: number;
  ambiguousContracts: number;
}> {
  const linkRows = await db
    .select({
      mpId: politicianCompanyLinks.mpId,
      companyIco: companies.ico,
      startDate: politicianCompanyLinks.startDate,
      endDate: politicianCompanyLinks.endDate,
    })
    .from(politicianCompanyLinks)
    .innerJoin(companies, eq(politicianCompanyLinks.companyId, companies.id))
    .where(eq(politicianCompanyLinks.reviewStatus, "verified"));

  if (!linkRows.length) {
    return {
      availableLinks: 0,
      linkedContracts: 0,
      unlinkedContracts: 0,
      ambiguousContracts: 0,
    };
  }

  const contractRows = await db
    .select({
      id: contracts.id,
      supplierIco: contracts.supplierIco,
      signedDate: contracts.signedDate,
      linkedPoliticianId: contracts.linkedPoliticianId,
    })
    .from(contracts);

  const resolution = resolveStoredPoliticianCompanyLinks(contractRows, linkRows);
  const assignmentBatches = new Map<
    string,
    {
      mpId: number;
      expectedLinkedPoliticianId: number | null;
      contractIds: number[];
    }
  >();
  for (const assignment of resolution.assignments) {
    const key = `${assignment.mpId}|${assignment.expectedLinkedPoliticianId ?? "null"}`;
    const assignmentBatch = assignmentBatches.get(key) ?? {
      mpId: assignment.mpId,
      expectedLinkedPoliticianId: assignment.expectedLinkedPoliticianId,
      contractIds: [],
    };
    assignmentBatch.contractIds.push(assignment.contractId);
    assignmentBatches.set(key, assignmentBatch);
  }

  let linkedContracts = 0;
  const sortedAssignmentBatches = [...assignmentBatches.values()].sort((left, right) =>
    left.mpId - right.mpId ||
    (left.expectedLinkedPoliticianId ?? -1) - (right.expectedLinkedPoliticianId ?? -1)
  );
  for (const { mpId, expectedLinkedPoliticianId, contractIds } of sortedAssignmentBatches) {
    for (const batch of chunks(contractIds, CHUNK)) {
      const result = await db
        .update(contracts)
        .set({ linkedPoliticianId: mpId })
        .where(and(
          expectedLinkedPoliticianId === null
            ? isNull(contracts.linkedPoliticianId)
            : eq(contracts.linkedPoliticianId, expectedLinkedPoliticianId),
          inArray(contracts.id, batch)
        ))
        .returning({ id: contracts.id });
      linkedContracts += result.length;
    }
  }

  let unlinkedContracts = 0;
  const removalsByExpectedMp = new Map<number, number[]>();
  for (const removal of resolution.removals) {
    const contractIds = removalsByExpectedMp.get(removal.expectedLinkedPoliticianId) ?? [];
    contractIds.push(removal.contractId);
    removalsByExpectedMp.set(removal.expectedLinkedPoliticianId, contractIds);
  }
  for (const [expectedLinkedPoliticianId, contractIds] of removalsByExpectedMp) {
    for (const batch of chunks(contractIds, CHUNK)) {
      const result = await db
        .update(contracts)
        .set({ linkedPoliticianId: null })
        .where(and(
          eq(contracts.linkedPoliticianId, expectedLinkedPoliticianId),
          inArray(contracts.id, batch)
        ))
        .returning({ id: contracts.id });
      unlinkedContracts += result.length;
    }
  }

  return {
    availableLinks: linkRows.length,
    linkedContracts,
    unlinkedContracts,
    ambiguousContracts: resolution.ambiguousContractIds.length,
  };
}

export async function upsertContracts(
  db: Database,
  items: ScrapedContract[]
): Promise<number> {
  if (!items.length) return 0;
  let count = 0;
  const deduped = [
    ...new Map(
      items
        .map((item) => ({ ...item, supplierIco: normalizeIco(item.supplierIco) }))
        .filter((item) => item.titleSk && item.supplierIco && item.signedDate && item.sourceUrl)
        .map((item) => [item.sourceUrl, item] as const)
    ).values(),
  ];
  if (!deduped.length) return 0;

  const existingRows = await db
    .select({ sourceUrl: contracts.sourceUrl })
    .from(contracts)
    .where(inArray(contracts.sourceUrl, deduped.map((item) => item.sourceUrl)));
  const existingUrls = new Set(existingRows.map((row) => row.sourceUrl));

  for (const batch of chunks(
    deduped.filter((item) => !existingUrls.has(item.sourceUrl)),
    CHUNK
  )) {
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
      .onConflictDoNothing({ target: contracts.sourceUrl })
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
  const deduped = [
    ...new Map(
      items
        .filter((item) => item.partyId && item.donorName && item.donationDate)
        .map((item) => [donationKey(item), item] as const)
    ).values(),
  ];
  if (!deduped.length) return 0;

  const partyRows = await db
    .select({ id: parties.id })
    .from(parties)
    .where(inArray(parties.id, [...new Set(deduped.map((item) => item.partyId))]));
  const validPartyIds = new Set(partyRows.map((party) => party.id));
  const validItems = deduped.filter((item) => validPartyIds.has(item.partyId));
  const skipped = deduped.length - validItems.length;
  if (skipped > 0) {
    console.warn(`[db/opendata] skipped ${skipped} donations with unknown party_id`);
  }
  if (!validItems.length) return 0;

  const existingRows = await db
    .select({
      partyId: donations.partyId,
      donorName: donations.donorName,
      donorIco: donations.donorIco,
      amountEur: donations.amountEur,
      donationDate: donations.donationDate,
      sourceUrl: donations.sourceUrl,
    })
    .from(donations)
    .where(inArray(donations.partyId, [...new Set(validItems.map((item) => item.partyId))]));
  const existingSourceUrls = new Map(existingRows.map((item) => [donationKey(item), item.sourceUrl]));
  const existingKeys = new Set(existingSourceUrls.keys());

  for (const item of validItems) {
    if (existingSourceUrls.get(donationKey(item)) === item.sourceUrl) continue;
    if (!existingKeys.has(donationKey(item))) continue;

    await db
      .update(donations)
      .set({ sourceUrl: item.sourceUrl })
      .where(donationMatchCondition(item));
  }

  for (const batch of chunks(
    validItems.filter((item) => !existingKeys.has(donationKey(item))),
    CHUNK
  )) {
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
