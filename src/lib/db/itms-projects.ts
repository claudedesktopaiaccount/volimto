import { eq, inArray, sql } from "drizzle-orm";
import type { Database } from "./index";
import {
  itmsProjectPoliticianLinks,
  itmsProjects,
  partyRegistryIdentities,
} from "./schema";
import type {
  ItmsProject,
  VerifiedItmsRpvsPoliticianLink,
} from "@/lib/scraper/itms-projects";
import type { VerifiedPartyRegistryIdentity } from "@/lib/verified-party-identities";

const CHUNK_SIZE = 100;
const ITMS_CHUNK_SIZE = 500;

function excluded(columnName: string) {
  return sql.raw(`excluded.${columnName}`);
}

export async function upsertItmsProjects(
  db: Database,
  projects: ItmsProject[]
): Promise<number> {
  if (projects.length === 0) return 0;

  const deduped = [
    ...new Map(projects.map((project) => [project.externalId, project] as const)).values(),
  ];
  let count = 0;

  for (const batch of chunks(deduped, ITMS_CHUNK_SIZE)) {
    const rows = batch.map((project) => ({
      itmsId: project.externalId,
      sourceState: project.sourceState,
      projectCode: project.code,
      titleSk: project.name,
      contractNumber: project.contractNumber,
      recipientIco: project.recipientIco,
      recipientSubjectId: project.recipientSubjectId,
      contractedAmount: project.contractedAmount,
      effectiveDate: project.associationDate,
      status: project.status,
      sourceUpdatedAt: project.updatedAt,
      sourceUrl: project.sourceUrl,
    }));

    const result = await db
      .insert(itmsProjects)
      .values(rows)
      .onConflictDoUpdate({
        target: itmsProjects.itmsId,
        set: {
          sourceState: excluded(itmsProjects.sourceState.name),
          projectCode: excluded(itmsProjects.projectCode.name),
          titleSk: excluded(itmsProjects.titleSk.name),
          contractNumber: excluded(itmsProjects.contractNumber.name),
          recipientIco: excluded(itmsProjects.recipientIco.name),
          recipientSubjectId: excluded(itmsProjects.recipientSubjectId.name),
          contractedAmount: excluded(itmsProjects.contractedAmount.name),
          effectiveDate: excluded(itmsProjects.effectiveDate.name),
          status: excluded(itmsProjects.status.name),
          sourceUpdatedAt: excluded(itmsProjects.sourceUpdatedAt.name),
          sourceUrl: excluded(itmsProjects.sourceUrl.name),
        },
      })
      .returning({ id: itmsProjects.id });
    count += result.length;
  }

  return count;
}

export async function upsertVerifiedPartyRegistryIdentities(
  db: Database,
  identities: VerifiedPartyRegistryIdentity[]
): Promise<number> {
  if (identities.length === 0) return 0;

  let count = 0;
  for (const batch of chunks(identities, CHUNK_SIZE)) {
    const result = await db
      .insert(partyRegistryIdentities)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          partyRegistryIdentities.partyId,
          partyRegistryIdentities.ico,
          partyRegistryIdentities.registeredFrom,
        ],
        set: {
          registeredTo: excluded(partyRegistryIdentities.registeredTo.name),
          sourceUrl: excluded(partyRegistryIdentities.sourceUrl.name),
        },
      })
      .returning({ id: partyRegistryIdentities.id });
    count += result.length;
  }

  return count;
}

/** The registry identity table is a generated snapshot, not a manual ledger. */
export async function replaceVerifiedPartyRegistryIdentities(
  db: Database,
  identities: VerifiedPartyRegistryIdentity[]
): Promise<number> {
  await db.delete(partyRegistryIdentities);
  return upsertVerifiedPartyRegistryIdentities(db, identities);
}

/** Clear public evidence before any mutable ITMS project row is refreshed. */
export async function clearVerifiedItmsProjectPoliticianLinks(
  db: Database
): Promise<number> {
  const deleted = await db
    .delete(itmsProjectPoliticianLinks)
    .returning({ id: itmsProjectPoliticianLinks.id });
  return deleted.length;
}

export async function removeItmsProjectsMissingFromSnapshot(
  db: Database,
  importedExternalIds: number[]
): Promise<number> {
  if (importedExternalIds.length === 0) {
    throw new Error("Refusing to prune ITMS projects from an empty snapshot");
  }

  const imported = new Set(importedExternalIds);
  const stored = await db
    .select({ id: itmsProjects.id, itmsId: itmsProjects.itmsId })
    .from(itmsProjects);
  const staleIds = stored
    .filter((row) => !imported.has(row.itmsId))
    .map((row) => row.id);

  let count = 0;
  for (const batch of chunks(staleIds, ITMS_CHUNK_SIZE)) {
    const deleted = await db
      .delete(itmsProjects)
      .where(inArray(itmsProjects.id, batch))
      .returning({ id: itmsProjects.id });
    count += deleted.length;
  }
  return count;
}

/**
 * Replace generated ITMS evidence paths. The table contains no manual rows;
 * a failed or now-empty verification run therefore fails closed instead of
 * leaving stale public attributions behind.
 */
export async function replaceVerifiedItmsProjectPoliticianLinks(
  db: Database,
  links: VerifiedItmsRpvsPoliticianLink[],
  verifiedAt: string
): Promise<number> {
  const externalIds = [...new Set(links.map((link) => link.projectExternalId))];
  const projectRows = externalIds.length === 0
    ? []
    : await db
      .select({ id: itmsProjects.id, itmsId: itmsProjects.itmsId })
      .from(itmsProjects)
      .where(inArray(itmsProjects.itmsId, externalIds));
  const projectIdByItmsId = new Map(projectRows.map((row) => [row.itmsId, row.id]));

  if (projectIdByItmsId.size !== externalIds.length) {
    throw new Error("Cannot persist ITMS political links before every project is imported");
  }

  const rows = links.map((link) => ({
    projectId: projectIdByItmsId.get(link.projectExternalId)!,
    mpId: link.politicianId,
    pathType: link.pathType,
    eventDate: link.eventDate,
    eventDateBasis: link.eventDateBasis,
    rpvsRegistrationId: link.rpvsRegistrationId,
    rpvsPartnerId: link.rpvsPartnerId,
    rpvsBeneficialOwnerId: link.rpvsBeneficialOwnerId,
    rpvsRegistrationSourceUrl: link.rpvsRegistrationSourceUrl,
    rpvsBeneficialOwnerSourceUrl: link.rpvsBeneficialOwnerSourceUrl,
    politicianSourceUrl: link.politicianSourceUrl,
    verifiedAt,
  }));

  await clearVerifiedItmsProjectPoliticianLinks(db);
  let count = 0;
  for (const batch of chunks(rows, CHUNK_SIZE)) {
    const result = await db
      .insert(itmsProjectPoliticianLinks)
      .values(batch)
      .returning({ id: itmsProjectPoliticianLinks.id });
    count += result.length;
  }
  return count;
}

export interface ItmsPoliticalLinkSummary {
  projectCount: number;
  activeProjectCount: number;
  completedProjectCount: number;
  contractedAmount: number;
  linkedProjectCount: number;
  linkedContractedAmount: number;
  directPartyProjectCount: number;
  directPartyContractedAmount: number;
}

export async function getItmsPoliticalLinkSummary(
  db: Database
): Promise<ItmsPoliticalLinkSummary> {
  const [totalRows, linkedRows, directPartyRows] = await Promise.all([
    db
      .select({
        projectCount: sql<number>`count(*)`.mapWith(Number),
        activeProjectCount: sql<number>`count(*) filter (where ${itmsProjects.sourceState} = 'vrealizacii')`.mapWith(Number),
        completedProjectCount: sql<number>`count(*) filter (where ${itmsProjects.sourceState} = 'ukoncene')`.mapWith(Number),
        contractedAmount: sql<number>`coalesce(sum(${itmsProjects.contractedAmount}), 0)`.mapWith(Number),
      })
      .from(itmsProjects),
    db
      .select({
        id: itmsProjects.id,
        amount: itmsProjects.contractedAmount,
      })
      .from(itmsProjects)
      .innerJoin(
        itmsProjectPoliticianLinks,
        eq(itmsProjectPoliticianLinks.projectId, itmsProjects.id)
      )
      .groupBy(itmsProjects.id, itmsProjects.contractedAmount),
    db
      .select({
        id: itmsProjects.id,
        amount: itmsProjects.contractedAmount,
      })
      .from(itmsProjects)
      .innerJoin(
        partyRegistryIdentities,
        sql`${partyRegistryIdentities.ico} = ${itmsProjects.recipientIco}
          and ${itmsProjects.effectiveDate} is not null
          and (${partyRegistryIdentities.registeredFrom} is null
            or ${itmsProjects.effectiveDate} >= ${partyRegistryIdentities.registeredFrom})
          and (${partyRegistryIdentities.registeredTo} is null
            or ${itmsProjects.effectiveDate} <= ${partyRegistryIdentities.registeredTo})`
      )
      .groupBy(itmsProjects.id, itmsProjects.contractedAmount),
  ]);

  const total = totalRows[0] ?? {
    projectCount: 0,
    activeProjectCount: 0,
    completedProjectCount: 0,
    contractedAmount: 0,
  };
  return {
    ...total,
    linkedProjectCount: linkedRows.length,
    linkedContractedAmount: sumAmounts(linkedRows),
    directPartyProjectCount: directPartyRows.length,
    directPartyContractedAmount: sumAmounts(directPartyRows),
  };
}

function sumAmounts(rows: Array<{ amount: number }>): number {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
