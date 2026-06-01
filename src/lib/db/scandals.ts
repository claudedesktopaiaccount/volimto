import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  mps,
  parties,
  scandalClaims,
  scandalClaimSources,
  scandalEvents,
  scandals,
  scandalPoliticianLinks,
  scandalSources,
} from "@/lib/db/schema";
import { mapScandalToKauza, type Kauza, type ScandalForUi } from "@/lib/scandals";

export async function getScandalKauzy(db: Database): Promise<Kauza[]> {
  const scandalRows = await db
    .select({
      id: scandals.id,
      slug: scandals.slug,
      titleSk: scandals.titleSk,
      summarySk: scandals.summarySk,
      startDate: scandals.startDate,
      endDate: scandals.endDate,
      status: scandals.status,
      category: scandals.category,
      institutionInvestigating: scandals.institutionInvestigating,
      verdictUrl: scandals.verdictUrl,
      severity: scandals.severity,
      isEditorialOpinion: scandals.isEditorialOpinion,
    })
    .from(scandals)
    .orderBy(desc(scandals.severity), desc(scandals.startDate));

  if (scandalRows.length === 0) return [];

  const ids = scandalRows.map((row) => row.id);

  const [sourceRows, actorRows, eventRows] = await Promise.all([
    db
      .select({
        id: scandalSources.id,
        scandalId: scandalSources.scandalId,
        url: scandalSources.url,
        outletName: scandalSources.outletName,
        publishedDate: scandalSources.publishedDate,
        isPrimary: scandalSources.isPrimary,
      })
      .from(scandalSources)
      .where(inArray(scandalSources.scandalId, ids))
      .orderBy(desc(scandalSources.isPrimary), asc(scandalSources.outletName)),
    db
      .select({
        scandalId: scandalPoliticianLinks.scandalId,
        mpId: mps.id,
        nameDisplay: mps.nameDisplay,
        nameFull: mps.nameFull,
        slug: mps.slug,
        role: mps.role,
        roleInScandal: scandalPoliticianLinks.roleInScandal,
        partyAbbr: parties.abbreviation,
      })
      .from(scandalPoliticianLinks)
      .innerJoin(mps, eq(scandalPoliticianLinks.mpId, mps.id))
      .leftJoin(parties, eq(mps.partyId, parties.id))
      .where(inArray(scandalPoliticianLinks.scandalId, ids))
      .orderBy(asc(mps.nameDisplay)),
    getEventRows(db, ids),
  ]);

  const claimRows = await getClaimRows(db, ids);
  const claimIds = claimRows.map((row) => row.id);
  const claimSourceRows = claimIds.length > 0
    ? await db
      .select({
        claimId: scandalClaimSources.claimId,
        sourceId: scandalClaimSources.sourceId,
      })
      .from(scandalClaimSources)
      .where(inArray(scandalClaimSources.claimId, claimIds))
    : [];

  const sourcesByScandal = new Map<number, ScandalForUi["sources"]>();
  for (const source of sourceRows) {
    const existing = sourcesByScandal.get(source.scandalId) ?? [];
    existing.push({
      id: source.id,
      url: source.url,
      outletName: source.outletName,
      publishedDate: source.publishedDate,
      isPrimary: source.isPrimary,
    });
    sourcesByScandal.set(source.scandalId, existing);
  }

  const sourceIdsByClaim = new Map<number, number[]>();
  for (const row of claimSourceRows) {
    const existing = sourceIdsByClaim.get(row.claimId) ?? [];
    existing.push(row.sourceId);
    sourceIdsByClaim.set(row.claimId, existing);
  }

  const claimsByScandal = new Map<number, NonNullable<ScandalForUi["claims"]>>();
  for (const claim of claimRows) {
    const existing = claimsByScandal.get(claim.scandalId) ?? [];
    existing.push({
      ...claim,
      sourceIds: sourceIdsByClaim.get(claim.id) ?? [],
    });
    claimsByScandal.set(claim.scandalId, existing);
  }

  const eventsByScandal = new Map<number, NonNullable<ScandalForUi["events"]>>();
  for (const event of eventRows) {
    const existing = eventsByScandal.get(event.scandalId) ?? [];
    existing.push({
      eventDate: event.eventDate,
      titleSk: event.titleSk,
      descriptionSk: event.descriptionSk,
      eventType: event.eventType,
      sourceUrl: event.sourceUrl,
      sortOrder: event.sortOrder,
    });
    eventsByScandal.set(event.scandalId, existing);
  }

  const actorsByScandal = new Map<number, ScandalForUi["actors"]>();
  for (const actor of actorRows) {
    const claims = claimsByScandal.get(actor.scandalId) ?? [];
    const hasReviewedClaim = claims.some((claim) => claim.mpId === actor.mpId || normalize(claim.targetLabel) === normalize(actor.nameDisplay));
    if (!hasReviewedClaim) continue;

    const existing = actorsByScandal.get(actor.scandalId) ?? [];
    existing.push({
      mpId: actor.mpId,
      nameDisplay: actor.nameDisplay,
      nameFull: actor.nameFull,
      slug: actor.slug,
      role: actor.role,
      roleInScandal: actor.roleInScandal,
      partyAbbr: actor.partyAbbr,
    });
    actorsByScandal.set(actor.scandalId, existing);
  }

  return scandalRows.map((scandal) =>
    mapScandalToKauza({
      ...scandal,
      actors: actorsByScandal.get(scandal.id) ?? [],
      sources: sourcesByScandal.get(scandal.id) ?? [],
      claims: claimsByScandal.get(scandal.id) ?? [],
      events: eventsByScandal.get(scandal.id) ?? [],
    })
  );
}

async function getClaimRows(db: Database, scandalIds: number[]) {
  try {
    return await db
      .select({
        id: scandalClaims.id,
        scandalId: scandalClaims.scandalId,
        mpId: scandalClaims.mpId,
        targetLabel: scandalClaims.targetLabel,
        claimKind: scandalClaims.claimKind,
        processStatus: scandalClaims.processStatus,
        responsibilityKind: scandalClaims.responsibilityKind,
        statementSk: scandalClaims.statementSk,
        whyRelevantSk: scandalClaims.whyRelevantSk,
        evidenceExcerptSk: scandalClaims.evidenceExcerptSk,
        sourceType: scandalClaims.sourceType,
        counterpointSk: scandalClaims.counterpointSk,
        sortOrder: scandalClaims.sortOrder,
      })
      .from(scandalClaims)
      .where(inArray(scandalClaims.scandalId, scandalIds))
      .orderBy(asc(scandalClaims.scandalId), asc(scandalClaims.sortOrder), asc(scandalClaims.id));
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

async function getEventRows(db: Database, scandalIds: number[]) {
  try {
    return await db
      .select({
        scandalId: scandalEvents.scandalId,
        eventDate: scandalEvents.eventDate,
        titleSk: scandalEvents.titleSk,
        descriptionSk: scandalEvents.descriptionSk,
        eventType: scandalEvents.eventType,
        sourceUrl: scandalEvents.sourceUrl,
        sortOrder: scandalEvents.sortOrder,
      })
      .from(scandalEvents)
      .where(inArray(scandalEvents.scandalId, scandalIds))
      .orderBy(asc(scandalEvents.scandalId), asc(scandalEvents.eventDate), asc(scandalEvents.sortOrder));
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

function isMissingRelationError(error: unknown) {
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : null;
  const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
  return code === "42P01";
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
