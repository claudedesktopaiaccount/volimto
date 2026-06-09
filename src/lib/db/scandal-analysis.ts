import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  mps,
  scandalAnalysisDrafts,
  scandalClaims,
  scandalClaimSources,
  scandalPoliticianLinks,
  scandals,
  scandalSources,
} from "@/lib/db/schema";
import {
  createScandalAnalysisDraft,
  parseActorClaimsJson,
  serializeActorClaims,
  sourceUrlsFromJson,
  type ScandalAnalysisDraftInput,
  type ScandalDraftReviewStatus,
} from "@/lib/scandals/analysis";
import { fetchTrustedScandalPageText } from "@/lib/scandals/fetch-page";
import {
  reviewScandalDraftWithGemini,
  type ScandalGeminiDecision,
} from "@/lib/scandals/gemini-review";
import { GEMINI_REVIEW_MODEL_DEFAULT } from "@/lib/scandals/review-criteria";
import { classifyScandalSource } from "@/lib/scandals/trusted-sources";

export interface ScandalAnalysisDraftRow {
  id: number;
  scandalId: number;
  scandalTitle: string;
  scandalSlug: string;
  caseSummarySk: string;
  publicInterestSk: string;
  legalStatusSk: string;
  openQuestionsSk: string;
  actorClaimsJson: string;
  sourceUrlsJson: string;
  reviewStatus: string;
  model: string;
  createdAt: string;
  reviewedAt: string | null;
}

export interface ScandalAutoReviewResult {
  id: number;
  decision: ScandalGeminiDecision;
  confidence: number;
  reasonSk: string;
  model: string;
  error?: string;
}

export async function listScandalAnalysisDrafts(
  db: Database,
  status?: ScandalDraftReviewStatus | "all"
): Promise<ScandalAnalysisDraftRow[]> {
  const base = db
    .select({
      id: scandalAnalysisDrafts.id,
      scandalId: scandalAnalysisDrafts.scandalId,
      scandalTitle: scandals.titleSk,
      scandalSlug: scandals.slug,
      caseSummarySk: scandalAnalysisDrafts.caseSummarySk,
      publicInterestSk: scandalAnalysisDrafts.publicInterestSk,
      legalStatusSk: scandalAnalysisDrafts.legalStatusSk,
      openQuestionsSk: scandalAnalysisDrafts.openQuestionsSk,
      actorClaimsJson: scandalAnalysisDrafts.actorClaimsJson,
      sourceUrlsJson: scandalAnalysisDrafts.sourceUrlsJson,
      reviewStatus: scandalAnalysisDrafts.reviewStatus,
      model: scandalAnalysisDrafts.model,
      createdAt: scandalAnalysisDrafts.createdAt,
      reviewedAt: scandalAnalysisDrafts.reviewedAt,
    })
    .from(scandalAnalysisDrafts)
    .innerJoin(scandals, eq(scandalAnalysisDrafts.scandalId, scandals.id));

  const rows = status && status !== "all"
    ? await base
      .where(eq(scandalAnalysisDrafts.reviewStatus, status))
      .orderBy(desc(scandalAnalysisDrafts.createdAt))
    : await base.orderBy(desc(scandalAnalysisDrafts.createdAt));

  return rows;
}

export async function saveScandalAnalysisDraft(
  db: Database,
  draftId: number,
  patch: Partial<Omit<ScandalAnalysisDraftInput, "actorClaims" | "sourceUrls">> & {
    actorClaimsJson?: string;
    sourceUrlsJson?: string;
  }
) {
  const set: Partial<typeof scandalAnalysisDrafts.$inferInsert> = {};
  if (patch.caseSummarySk != null) set.caseSummarySk = patch.caseSummarySk;
  if (patch.publicInterestSk != null) set.publicInterestSk = patch.publicInterestSk;
  if (patch.legalStatusSk != null) set.legalStatusSk = patch.legalStatusSk;
  if (patch.openQuestionsSk != null) set.openQuestionsSk = patch.openQuestionsSk;
  if (patch.actorClaimsJson != null) set.actorClaimsJson = serializeActorClaims(parseActorClaimsJson(patch.actorClaimsJson));
  if (patch.sourceUrlsJson != null) set.sourceUrlsJson = JSON.stringify(sourceUrlsFromJson(patch.sourceUrlsJson));
  if (patch.model != null) set.model = patch.model;

  await db.update(scandalAnalysisDrafts).set(set).where(eq(scandalAnalysisDrafts.id, draftId));
}

export async function rejectScandalAnalysisDraft(db: Database, draftId: number) {
  await db
    .update(scandalAnalysisDrafts)
    .set({ reviewStatus: "rejected", reviewedAt: new Date().toISOString() })
    .where(eq(scandalAnalysisDrafts.id, draftId));
}

export async function approveScandalAnalysisDraft(db: Database, draftId: number) {
  const draft = await getDraft(db, draftId);
  if (!draft) throw new Error("draft_not_found");

  const claims = parseActorClaimsJson(draft.actorClaimsJson);
  const sourceUrls = sourceUrlsFromJson(draft.sourceUrlsJson);
  const allSourceUrls = [...new Set([...sourceUrls, ...claims.map((claim) => claim.sourceUrl)])]
    .filter((url) => classifyScandalSource(url).trusted);

  await db
    .update(scandals)
    .set({
      summarySk: [
        draft.caseSummarySk,
        draft.publicInterestSk,
        draft.legalStatusSk,
      ].filter(Boolean).join(" "),
      isEditorialOpinion: false,
    })
    .where(eq(scandals.id, draft.scandalId));

  const existingClaims = await db
    .select({ id: scandalClaims.id })
    .from(scandalClaims)
    .where(eq(scandalClaims.scandalId, draft.scandalId));

  const existingClaimIds = existingClaims.map((claim) => claim.id);
  if (existingClaimIds.length > 0) {
    await db.delete(scandalClaimSources).where(inArray(scandalClaimSources.claimId, existingClaimIds));
    await db.delete(scandalClaims).where(eq(scandalClaims.scandalId, draft.scandalId));
  }

  const sourceIdByUrl = await ensureScandalSources(db, draft.scandalId, allSourceUrls);

  for (const [index, claim] of claims.entries()) {
    const [insertedClaim] = await db
      .insert(scandalClaims)
      .values({
        scandalId: draft.scandalId,
        mpId: claim.mpId,
        targetLabel: claim.targetLabel,
        claimKind: claim.claimKind,
        processStatus: claim.processStatus,
        responsibilityKind: claim.responsibilityKind,
        statementSk: claim.statementSk,
        whyRelevantSk: claim.whyRelevantSk,
        evidenceExcerptSk: claim.evidenceExcerptSk,
        sourceType: claim.sourceType,
        counterpointSk: claim.counterpointSk,
        sortOrder: index,
      })
      .returning({ id: scandalClaims.id });

    const sourceId = sourceIdByUrl.get(claim.sourceUrl);
    if (insertedClaim && sourceId) {
      await db
        .insert(scandalClaimSources)
        .values({ claimId: insertedClaim.id, sourceId })
        .onConflictDoNothing({
          target: [scandalClaimSources.claimId, scandalClaimSources.sourceId],
        });
    }

    if (claim.mpId != null) {
      await db
        .insert(scandalPoliticianLinks)
        .values({
          scandalId: draft.scandalId,
          mpId: claim.mpId,
          roleInScandal: claim.roleInScandal,
        })
        .onConflictDoUpdate({
          target: [scandalPoliticianLinks.scandalId, scandalPoliticianLinks.mpId],
          set: { roleInScandal: sql.raw(`excluded.${scandalPoliticianLinks.roleInScandal.name}`) },
        });
    }
  }

  await db
    .update(scandalAnalysisDrafts)
    .set({ reviewStatus: "approved", reviewedAt: new Date().toISOString() })
    .where(eq(scandalAnalysisDrafts.id, draftId));
}

export async function autoReviewScandalAnalysisDraft(
  db: Database,
  draftId: number,
  apiKey: string | undefined
): Promise<ScandalAutoReviewResult> {
  const input = await buildGeminiReviewInput(db, draftId);
  const review = await reviewScandalDraftWithGemini(input, apiKey);

  await saveScandalAnalysisDraft(db, draftId, {
    caseSummarySk: review.revisedDraft.caseSummarySk,
    publicInterestSk: review.revisedDraft.publicInterestSk,
    legalStatusSk: review.revisedDraft.legalStatusSk,
    openQuestionsSk: review.revisedDraft.openQuestionsSk,
    actorClaimsJson: serializeActorClaims(review.revisedDraft.actorClaims),
    sourceUrlsJson: JSON.stringify(review.revisedDraft.sourceUrls),
    model: `${review.model}-auto-review`,
  });

  if (review.decision === "approve") {
    await approveScandalAnalysisDraft(db, draftId);
  } else if (review.decision === "reject") {
    await rejectScandalAnalysisDraft(db, draftId);
  }

  return {
    id: draftId,
    decision: review.decision,
    confidence: review.confidence,
    reasonSk: review.reasonSk,
    model: review.model,
  };
}

export async function autoReviewScandalAnalysisDraftQueue(
  db: Database,
  apiKey: string | undefined,
  limit = 10
): Promise<ScandalAutoReviewResult[]> {
  const drafts = await listScandalAnalysisDrafts(db, "needs_review");
  const results: ScandalAutoReviewResult[] = [];

  for (const draft of drafts.slice(0, Math.max(1, Math.min(25, limit)))) {
    try {
      results.push(await autoReviewScandalAnalysisDraft(db, draft.id, apiKey));
    } catch (error) {
      results.push({
        id: draft.id,
        decision: "needs_review",
        confidence: 0,
        reasonSk: "Automaticka kontrola zlyhala; draft zostava na rucnu kontrolu.",
        model: process.env.GEMINI_KAUZY_MODEL || GEMINI_REVIEW_MODEL_DEFAULT,
        error: errorMessage(error),
      });
    }
  }

  return results;
}

export async function regenerateScandalAnalysisDraft(db: Database, draftId: number, pageText: string) {
  const draft = await getDraft(db, draftId);
  if (!draft) throw new Error("draft_not_found");
  const input = await buildDraftInputForScandal(db, draft.scandalId, pageText);

  await db
    .update(scandalAnalysisDrafts)
    .set({
      caseSummarySk: input.caseSummarySk,
      publicInterestSk: input.publicInterestSk,
      legalStatusSk: input.legalStatusSk,
      openQuestionsSk: input.openQuestionsSk,
      actorClaimsJson: serializeActorClaims(input.actorClaims),
      sourceUrlsJson: JSON.stringify(input.sourceUrls),
      reviewStatus: "needs_review",
      model: input.model,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    })
    .where(eq(scandalAnalysisDrafts.id, draftId));
}

async function createDraftForScandal(db: Database, scandalId: number, pageText: string) {
  const input = await buildDraftInputForScandal(db, scandalId, pageText);
  await db.insert(scandalAnalysisDrafts).values({
    scandalId,
    caseSummarySk: input.caseSummarySk,
    publicInterestSk: input.publicInterestSk,
    legalStatusSk: input.legalStatusSk,
    openQuestionsSk: input.openQuestionsSk,
    actorClaimsJson: serializeActorClaims(input.actorClaims),
    sourceUrlsJson: JSON.stringify(input.sourceUrls),
    reviewStatus: "needs_review",
    model: input.model,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  });
}

async function buildDraftInputForScandal(
  db: Database,
  scandalId: number,
  pageText: string
): Promise<ScandalAnalysisDraftInput> {
  const [scandal] = await db
    .select({
      titleSk: scandals.titleSk,
      summarySk: scandals.summarySk,
      status: scandals.status,
      institutionInvestigating: scandals.institutionInvestigating,
    })
    .from(scandals)
    .where(eq(scandals.id, scandalId));
  if (!scandal) throw new Error("scandal_not_found");

  const [actors, sources] = await Promise.all([
    db
      .select({
        mpId: mps.id,
        nameDisplay: mps.nameDisplay,
        roleInScandal: scandalPoliticianLinks.roleInScandal,
      })
      .from(scandalPoliticianLinks)
      .innerJoin(mps, eq(scandalPoliticianLinks.mpId, mps.id))
      .where(eq(scandalPoliticianLinks.scandalId, scandalId))
      .orderBy(asc(mps.nameDisplay)),
    db
      .select({
        url: scandalSources.url,
        outletName: scandalSources.outletName,
        publishedDate: scandalSources.publishedDate,
        isPrimary: scandalSources.isPrimary,
      })
      .from(scandalSources)
      .where(eq(scandalSources.scandalId, scandalId))
      .orderBy(desc(scandalSources.isPrimary)),
  ]);

  return createScandalAnalysisDraft({ scandal, actors, sources, pageText });
}

async function buildGeminiReviewInput(db: Database, draftId: number) {
  const draft = await getDraft(db, draftId);
  if (!draft) throw new Error("draft_not_found");

  const [scandal] = await db
    .select({
      titleSk: scandals.titleSk,
      summarySk: scandals.summarySk,
      status: scandals.status,
      institutionInvestigating: scandals.institutionInvestigating,
    })
    .from(scandals)
    .where(eq(scandals.id, draft.scandalId));
  if (!scandal) throw new Error("scandal_not_found");

  const [actors, sources] = await Promise.all([
    db
      .select({
        mpId: mps.id,
        nameDisplay: mps.nameDisplay,
        roleInScandal: scandalPoliticianLinks.roleInScandal,
      })
      .from(scandalPoliticianLinks)
      .innerJoin(mps, eq(scandalPoliticianLinks.mpId, mps.id))
      .where(eq(scandalPoliticianLinks.scandalId, draft.scandalId))
      .orderBy(asc(mps.nameDisplay)),
    db
      .select({
        url: scandalSources.url,
      })
      .from(scandalSources)
      .where(eq(scandalSources.scandalId, draft.scandalId))
      .orderBy(desc(scandalSources.isPrimary)),
  ]);

  const actorClaims = safeParseActorClaimsJson(draft.actorClaimsJson);
  const sourceUrls = [
    ...sourceUrlsFromJson(draft.sourceUrlsJson),
    ...actorClaims.map((claim) => claim.sourceUrl),
    ...sources.map((source) => source.url),
  ].filter((url) => classifyScandalSource(url).trusted);
  const sourceTexts = await fetchSourceTexts(sourceUrls.slice(0, 3));

  return {
    scandal,
    draft: {
      caseSummarySk: draft.caseSummarySk,
      publicInterestSk: draft.publicInterestSk,
      legalStatusSk: draft.legalStatusSk,
      openQuestionsSk: draft.openQuestionsSk,
      actorClaims,
      sourceUrls: [...new Set(sourceUrls)],
    },
    actors,
    sourceTexts,
  };
}

async function fetchSourceTexts(urls: string[]) {
  const settled = await Promise.allSettled(
    [...new Set(urls)].map(async (url) => ({
      url,
      text: await fetchTrustedScandalPageText(url),
    }))
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<{ url: string; text: string }> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((source) => source.text.trim().length > 0);
}

function safeParseActorClaimsJson(raw: string) {
  try {
    return parseActorClaimsJson(raw);
  } catch {
    return [];
  }
}

async function getDraft(db: Database, draftId: number) {
  const [draft] = await db
    .select()
    .from(scandalAnalysisDrafts)
    .where(eq(scandalAnalysisDrafts.id, draftId));
  return draft;
}

async function ensureScandalSources(db: Database, scandalId: number, urls: string[]) {
  const sourceIdByUrl = new Map<string, number>();
  if (urls.length === 0) return sourceIdByUrl;

  const existing = await db
    .select({ id: scandalSources.id, url: scandalSources.url })
    .from(scandalSources)
    .where(and(eq(scandalSources.scandalId, scandalId), inArray(scandalSources.url, urls)));

  for (const source of existing) sourceIdByUrl.set(source.url, source.id);

  for (const url of urls) {
    if (sourceIdByUrl.has(url)) continue;
    const classified = classifyScandalSource(url);
    if (!classified.trusted) continue;
    const [inserted] = await db
      .insert(scandalSources)
      .values({
        scandalId,
        url,
        outletName: classified.outletName,
        publishedDate: new Date().toISOString().slice(0, 10),
        isPrimary: classified.sourceType !== "trusted_media",
        archiveUrl: null,
      })
      .onConflictDoNothing({
        target: [scandalSources.scandalId, scandalSources.url],
      })
      .returning({ id: scandalSources.id });
    if (inserted) sourceIdByUrl.set(url, inserted.id);
  }

  return sourceIdByUrl;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown_error";
}
