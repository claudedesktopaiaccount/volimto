import { and, eq, inArray } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import {
  isContractDateWithinVerifiedLink,
  linkContractsToStoredPoliticianCompanyLinks,
  upsertCompanies,
  upsertContracts,
  upsertVerifiedPoliticianCompanyLinks,
} from "@/lib/db/opendata";
import {
  clearVerifiedItmsProjectPoliticianLinks,
  removeItmsProjectsMissingFromSnapshot,
  replaceVerifiedPartyRegistryIdentities,
  replaceVerifiedItmsProjectPoliticianLinks,
  upsertItmsProjects,
} from "@/lib/db/itms-projects";
import {
  companies,
  contracts,
  donations,
  politicianCompanyLinks,
} from "@/lib/db/schema";
import { revalidateCacheTag } from "@/lib/cache/tags";
import {
  scrapePublicContracts,
  scrapeRpvsCompanies,
} from "@/lib/scraper/opendata";
import { fetchAllItmsProjects } from "@/lib/scraper/itms-projects";
import { discoverVerifiedItmsPoliticalLinks } from "@/lib/itms-political-linking";
import {
  LEGACY_UNVERIFIED_RPVS_NAME_MATCH_RELATIONSHIP,
  VERIFIED_POLITICIAN_COMPANY_LINKS,
} from "@/lib/verified-financial-links";
import { VERIFIED_PARTY_REGISTRY_IDENTITIES } from "@/lib/verified-party-identities";

const RPVS_COMPANY_IMPORT_LIMIT = 500;
const CRZ_CONTRACT_IMPORT_LIMIT = 5_000;
const DB_CHUNK_SIZE = 50;

// These generic party-register pages were used by the old fabricated seed.
// They do not identify an annual report or an individual donation record.
const LEGACY_UNVERIFIED_DONATION_URLS = [
  "https://rez.vs.minv.sk/PolitickeStrany/detail?id_spolok=153097",
  "https://rez.vs.minv.sk/PolitickeStrany/detail?id_spolok=218725",
  "https://rez.vs.minv.sk/PolitickeStrany/detail?id_spolok=227017",
  "https://rez.vs.minv.sk/PolitickeStrany/detail?id_spolok=152973",
  "https://rez.vs.minv.sk/PolitickeStrany/detail?id_spolok=152976",
  "https://rez.vs.minv.sk/PolitickeStrany/detail?id_spolok=153180",
  "https://rez.vs.minv.sk/PolitickeStrany/detail?id_spolok=201471",
] as const;

export type OpendataSource = "rpvs_companies" | "crz_contracts" | "itms_projects";

export class OpendataImportError extends Error {
  readonly code = "empty_source";

  constructor(readonly sources: OpendataSource[]) {
    super(`OpenData sources returned no usable records: ${sources.join(", ")}`);
    this.name = "OpendataImportError";
  }
}

export interface OpendataImportSummary {
  companies: {
    scraped: number;
    upserted: number;
  };
  contracts: {
    scraped: number;
    upserted: number;
  };
  itmsProjects: {
    scraped: number;
    upserted: number;
    staleRemoved: number;
    active: number;
    completed: number;
  };
  partyIdentities: {
    available: number;
    upserted: number;
  };
  politicalLinks: {
    available: number;
    verifiedCompanyLinks: number;
    linkedContracts: number;
    unlinkedContracts: number;
    ambiguousContracts: number;
    linkedItmsProjects: number;
    ambiguousItmsIdentities: number;
    missingPoliticians: string[];
  };
  cleanup: {
    unverifiedDonationsRemoved: number;
    unverifiedRpvsNameLinksRemoved: number;
    unverifiedRpvsContractLinksRemoved: number;
  };
}

export interface UnverifiedRpvsNameLinkRow {
  mpId: number;
  companyIco: string;
  startDate: string | null;
  endDate: string | null;
}

export interface PotentialRpvsNameLinkedContractRow {
  id: number;
  supplierIco: string;
  signedDate: string;
  linkedPoliticianId: number | null;
}

export function resolveUnverifiedRpvsContractLinkRemovals(
  contractRows: PotentialRpvsNameLinkedContractRow[],
  nameMatchLinks: UnverifiedRpvsNameLinkRow[]
): Array<{ contractId: number; mpId: number }> {
  return contractRows.flatMap((contract) => {
    const mpId = contract.linkedPoliticianId;
    if (mpId === null) return [];

    const wasLinkedByNameMatch = nameMatchLinks.some((link) =>
      link.mpId === mpId &&
      normalizeIco(link.companyIco) === normalizeIco(contract.supplierIco) &&
      isContractDateWithinVerifiedLink(contract.signedDate, link)
    );

    return wasLinkedByNameMatch ? [{ contractId: contract.id, mpId }] : [];
  });
}

export async function runOpendataImport(db: Database): Promise<OpendataImportSummary> {
  const [companyItems, contractItems, itmsItems] = await Promise.all([
    scrapeRpvsCompanies(RPVS_COMPANY_IMPORT_LIMIT),
    scrapePublicContracts(CRZ_CONTRACT_IMPORT_LIMIT),
    fetchAllItmsProjects(),
  ]);

  const emptySources: OpendataSource[] = [];
  if (companyItems.length === 0) emptySources.push("rpvs_companies");
  if (contractItems.length === 0) emptySources.push("crz_contracts");
  if (itmsItems.length === 0) emptySources.push("itms_projects");
  if (emptySources.length > 0) throw new OpendataImportError(emptySources);

  // Re-check every curated identity against the live RPVS history before any
  // public project link is persisted.
  const itmsDiscovery = await discoverVerifiedItmsPoliticalLinks(db, itmsItems);

  // Fail closed: remove old public evidence before changing any project fields.
  // If a later database step fails, the page shows no attribution rather than
  // joining stale evidence to a newly changed IČO or contract date.
  await clearVerifiedItmsProjectPoliticianLinks(db);

  const [companyCount, contractCount, itmsCount, partyIdentityCount] = await Promise.all([
    upsertCompanies(db, companyItems),
    upsertContracts(db, contractItems),
    upsertItmsProjects(db, itmsItems),
    replaceVerifiedPartyRegistryIdentities(db, VERIFIED_PARTY_REGISTRY_IDENTITIES),
  ]);
  const staleItmsProjectsRemoved = await removeItmsProjectsMissingFromSnapshot(
    db,
    itmsItems.map((item) => item.externalId)
  );
  const rpvsNameMatchCleanup = await removeUnverifiedRpvsNameMatches(db);
  const verifiedCompanyLinkCount = await upsertVerifiedPoliticianCompanyLinks(
    db,
    VERIFIED_POLITICIAN_COMPANY_LINKS
  );
  const linkSummary = await linkContractsToStoredPoliticianCompanyLinks(db);
  const verifiedItmsPathCount = await replaceVerifiedItmsProjectPoliticianLinks(
    db,
    itmsDiscovery.verifiedLinks,
    new Date().toISOString()
  );
  const unverifiedDonationsRemoved = await removeLegacyUnverifiedDonations(db);

  return {
    companies: {
      scraped: companyItems.length,
      upserted: companyCount,
    },
    contracts: {
      scraped: contractItems.length,
      upserted: contractCount,
    },
    itmsProjects: {
      scraped: itmsItems.length,
      upserted: itmsCount,
      staleRemoved: staleItmsProjectsRemoved,
      active: itmsItems.filter((item) => item.sourceState === "vrealizacii").length,
      completed: itmsItems.filter((item) => item.sourceState === "ukoncene").length,
    },
    partyIdentities: {
      available: VERIFIED_PARTY_REGISTRY_IDENTITIES.length,
      upserted: partyIdentityCount,
    },
    politicalLinks: {
      available: linkSummary.availableLinks,
      verifiedCompanyLinks: verifiedCompanyLinkCount,
      linkedContracts: linkSummary.linkedContracts,
      unlinkedContracts: linkSummary.unlinkedContracts,
      ambiguousContracts: linkSummary.ambiguousContracts,
      linkedItmsProjects: verifiedItmsPathCount,
      ambiguousItmsIdentities: itmsDiscovery.ambiguousIdentities.length,
      missingPoliticians: itmsDiscovery.missingPoliticianSlugs,
    },
    cleanup: {
      unverifiedDonationsRemoved,
      ...rpvsNameMatchCleanup,
    },
  };
}

export async function runConfiguredOpendataImport() {
  const result = await runOpendataImport(getDb());

  // The import is an explicit mutation: the next page request should block for
  // fresh data instead of receiving one stale-while-revalidate response.
  revalidateCacheTag("opendata", { expire: 0 });
  revalidateCacheTag("poslanci", { expire: 0 });

  return result;
}

export function formatOpendataImportError(error: unknown) {
  if (error instanceof OpendataImportError) {
    return {
      ok: false as const,
      error: "opendata_import_failed",
      code: error.code,
      sources: error.sources,
      message: error.message,
    };
  }

  const rawMessage = error instanceof Error ? error.message : "";
  const message = rawMessage && !rawMessage.startsWith("Failed query:")
    ? rawMessage
    : "Unexpected OpenData import error";

  return {
    ok: false as const,
    error: "opendata_import_failed",
    code: "unexpected_error",
    message,
  };
}

async function removeLegacyUnverifiedDonations(db: Database): Promise<number> {
  const removed = await db
    .delete(donations)
    .where(inArray(donations.sourceUrl, [...LEGACY_UNVERIFIED_DONATION_URLS]))
    .returning({ id: donations.id });

  return removed.length;
}

/**
 * Remove the short-lived name-only RPVS attribution experiment. The official
 * VerejnyFunkcionar feed has no cross-registry person identifier or birth date,
 * so an equal name is not enough evidence to identify a specific MP.
 */
async function removeUnverifiedRpvsNameMatches(db: Database): Promise<{
  unverifiedRpvsNameLinksRemoved: number;
  unverifiedRpvsContractLinksRemoved: number;
}> {
  const nameMatchLinks = await db
    .select({
      id: politicianCompanyLinks.id,
      mpId: politicianCompanyLinks.mpId,
      companyIco: companies.ico,
      startDate: politicianCompanyLinks.startDate,
      endDate: politicianCompanyLinks.endDate,
    })
    .from(politicianCompanyLinks)
    .innerJoin(companies, eq(politicianCompanyLinks.companyId, companies.id))
    .where(eq(
      politicianCompanyLinks.relationship,
      LEGACY_UNVERIFIED_RPVS_NAME_MATCH_RELATIONSHIP
    ));

  if (nameMatchLinks.length === 0) {
    return {
      unverifiedRpvsNameLinksRemoved: 0,
      unverifiedRpvsContractLinksRemoved: 0,
    };
  }

  const affectedIcos = [
    ...new Set(nameMatchLinks.map((link) => normalizeIco(link.companyIco))),
  ].filter(Boolean);
  const candidateContracts = affectedIcos.length === 0
    ? []
    : await db
      .select({
        id: contracts.id,
        supplierIco: contracts.supplierIco,
        signedDate: contracts.signedDate,
        linkedPoliticianId: contracts.linkedPoliticianId,
      })
      .from(contracts)
      .where(inArray(contracts.supplierIco, affectedIcos));

  const contractIdsByMp = new Map<number, number[]>();
  const removals = resolveUnverifiedRpvsContractLinkRemovals(
    candidateContracts,
    nameMatchLinks
  );
  for (const { contractId, mpId } of removals) {
    const contractIds = contractIdsByMp.get(mpId) ?? [];
    contractIds.push(contractId);
    contractIdsByMp.set(mpId, contractIds);
  }

  let unverifiedRpvsContractLinksRemoved = 0;
  for (const [mpId, contractIds] of contractIdsByMp) {
    for (const batch of chunks(contractIds, DB_CHUNK_SIZE)) {
      const removed = await db
        .update(contracts)
        .set({ linkedPoliticianId: null })
        .where(and(
          eq(contracts.linkedPoliticianId, mpId),
          inArray(contracts.id, batch)
        ))
        .returning({ id: contracts.id });
      unverifiedRpvsContractLinksRemoved += removed.length;
    }
  }

  let unverifiedRpvsNameLinksRemoved = 0;
  for (const batch of chunks(
    nameMatchLinks.map((link) => link.id),
    DB_CHUNK_SIZE
  )) {
    const removed = await db
      .delete(politicianCompanyLinks)
      .where(inArray(politicianCompanyLinks.id, batch))
      .returning({ id: politicianCompanyLinks.id });
    unverifiedRpvsNameLinksRemoved += removed.length;
  }

  return {
    unverifiedRpvsNameLinksRemoved,
    unverifiedRpvsContractLinksRemoved,
  };
}

function normalizeIco(value: string): string {
  return value.replace(/\D/g, "");
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
