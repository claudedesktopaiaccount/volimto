import { classifyScandalSource, type ScandalSourceType } from "./trusted-sources";

export type ScandalDraftReviewStatus = "needs_review" | "approved" | "rejected";

export interface ScandalDraftActorClaim {
  mpId: number | null;
  targetLabel: string;
  claimKind: string;
  processStatus: string;
  responsibilityKind: string;
  statementSk: string;
  whyRelevantSk: string;
  evidenceExcerptSk: string;
  sourceUrl: string;
  sourceType: ScandalSourceType;
  roleInScandal: string;
  counterpointSk: string | null;
}

export interface ScandalAnalysisDraftInput {
  caseSummarySk: string;
  publicInterestSk: string;
  legalStatusSk: string;
  openQuestionsSk: string;
  actorClaims: ScandalDraftActorClaim[];
  sourceUrls: string[];
  model: string;
}

export interface ScandalDraftActor {
  mpId: number;
  nameDisplay: string;
  roleInScandal?: string;
}

export interface ScandalDraftSource {
  url: string;
  outletName: string;
  publishedDate: string | null;
  isPrimary: boolean;
}

export interface ScandalDraftCase {
  titleSk: string;
  summarySk: string;
  status: string;
  institutionInvestigating: string | null;
}

const ACTION_KEYWORDS = [
  "obvinen",
  "obzalob",
  "vysetruj",
  "prever",
  "podozren",
  "podnet",
  "schval",
  "podpis",
  "dotaci",
  "uplat",
  "kontrol",
  "konflikt",
  "verejne obstar",
  "zmluv",
  "majitel",
  "funkcionar",
  "riadil",
  "rozhod",
];

export function createScandalAnalysisDraft(input: {
  scandal: ScandalDraftCase;
  actors: ScandalDraftActor[];
  sources: ScandalDraftSource[];
  pageText: string;
}): ScandalAnalysisDraftInput {
  const trustedSources = input.sources.filter((source) => classifyScandalSource(source.url).trusted);
  const primarySource = trustedSources[0] ?? input.sources[0];
  const sourceType = primarySource ? classifyScandalSource(primarySource.url).sourceType : "untrusted";
  const sentences = splitSentences(input.pageText);
  const actorClaims = input.actors.flatMap((actor) => {
    const evidence = findActorEvidence(sentences, actor.nameDisplay);
    if (!evidence || !primarySource) return [];

    const roleInScandal = inferRoleInScandal(evidence);
    return [{
      mpId: actor.mpId,
      targetLabel: actor.nameDisplay,
      claimKind: roleInScandal,
      processStatus: humanizeProcessStatus(input.scandal.status),
      responsibilityKind: "zdrojovo dolozena rola aktera",
      statementSk: evidence,
      whyRelevantSk: `${actor.nameDisplay} je relevantny len v rozsahu roly, ktoru opisuje zdroj: ${roleInScandal}.`,
      evidenceExcerptSk: evidence,
      sourceUrl: primarySource.url,
      sourceType,
      roleInScandal,
      counterpointSk: "Tvrdenie je navrh na editorsku kontrolu; po schvaleni stale nepredstavuje verdikt aplikacie.",
    }];
  });

  return {
    caseSummarySk: firstMeaningfulSentences(input.pageText, input.scandal.summarySk, 2),
    publicInterestSk: buildPublicInterest(input.pageText),
    legalStatusSk: buildLegalStatus(input.scandal.status, input.scandal.institutionInvestigating),
    openQuestionsSk: buildOpenQuestions(input.scandal.status),
    actorClaims,
    sourceUrls: trustedSources.map((source) => source.url),
    model: "heuristic-web-review-v1",
  };
}

export function serializeActorClaims(claims: ScandalDraftActorClaim[]) {
  return JSON.stringify(claims);
}

export function parseActorClaimsJson(raw: string): ScandalDraftActorClaim[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("actor_claims_must_be_array");
  return parsed.map(assertPublishableActorClaim);
}

function assertPublishableActorClaim(value: unknown): ScandalDraftActorClaim {
  const claim = value as Partial<ScandalDraftActorClaim>;
  if (!claim || typeof claim !== "object") throw new Error("invalid_claim");
  if (typeof claim.targetLabel !== "string" || claim.targetLabel.trim().length < 3) throw new Error("missing_target");
  if (typeof claim.statementSk !== "string" || claim.statementSk.trim().length < 30) throw new Error("missing_statement");
  if (typeof claim.whyRelevantSk !== "string" || claim.whyRelevantSk.trim().length < 30) throw new Error("missing_relevance");
  if (typeof claim.evidenceExcerptSk !== "string" || claim.evidenceExcerptSk.trim().length < 20) throw new Error("missing_evidence");
  if (typeof claim.sourceUrl !== "string" || !classifyScandalSource(claim.sourceUrl).trusted) throw new Error("untrusted_source");
  const classified = classifyScandalSource(claim.sourceUrl);

  return {
    mpId: typeof claim.mpId === "number" ? claim.mpId : null,
    targetLabel: claim.targetLabel.trim(),
    claimKind: stringOrDefault(claim.claimKind, "zdrojovo dolozena rola"),
    processStatus: stringOrDefault(claim.processStatus, "podozrenie / preverovanie"),
    responsibilityKind: stringOrDefault(claim.responsibilityKind, "zdrojovo dolozena rola aktera"),
    statementSk: claim.statementSk.trim(),
    whyRelevantSk: claim.whyRelevantSk.trim(),
    evidenceExcerptSk: claim.evidenceExcerptSk.trim(),
    sourceUrl: claim.sourceUrl,
    sourceType: classified.sourceType,
    roleInScandal: stringOrDefault(claim.roleInScandal, "zdrojovo_dolozena_rola"),
    counterpointSk: typeof claim.counterpointSk === "string" && claim.counterpointSk.trim()
      ? claim.counterpointSk.trim()
      : null,
  };
}

export function sourceUrlsFromJson(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === "string");
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

function findActorEvidence(sentences: string[], actorName: string) {
  const normalizedActor = normalize(actorName);
  const surname = normalizedActor.split(" ").at(-1);
  const matches = sentences.filter((sentence) => {
    const normalizedSentence = normalize(sentence);
    const mentionsActor = normalizedSentence.includes(normalizedActor)
      || Boolean(surname && surname.length >= 4 && normalizedSentence.includes(surname));
    return mentionsActor && ACTION_KEYWORDS.some((keyword) => normalizedSentence.includes(keyword));
  });

  return matches[0]?.slice(0, 420) ?? null;
}

function firstMeaningfulSentences(text: string, fallback: string, count: number) {
  const sentences = splitSentences(text)
    .filter((sentence) => !normalize(sentence).includes("zavriet"))
    .filter((sentence) => !normalize(sentence).includes("newsletter"));
  return (sentences.slice(0, count).join(" ") || fallback).slice(0, 900);
}

function buildPublicInterest(text: string) {
  const value = normalize(text);
  if (value.includes("dotaci") || value.includes("eurofond")) {
    return "Verejny zaujem spociva v kontrole pouzitia verejnych alebo europskych prostriedkov a v tom, ci statne organy postupovali podla pravidiel.";
  }
  if (value.includes("verejne obstar") || value.includes("zakazk")) {
    return "Verejny zaujem spociva v transparentnosti verejneho obstaravania a nakladania so statnymi peniazmi.";
  }
  return "Verejny zaujem spociva v kontrole vykonu verejnej funkcie, institucii a verejne dostupnych podozreni.";
}

function buildLegalStatus(status: string, institution: string | null) {
  return `${humanizeProcessStatus(status)}. Prislusna institucia: ${institution || "nezistena / verejne zdroje"}.`;
}

function buildOpenQuestions(status: string) {
  if (normalize(status).includes("odsuden")) return "Otvorene zostava rozlisenie pravoplatneho vysledku od roly dalsich suvisiacich osob.";
  return "Otvorene zostava, ako sa skonci preverovanie alebo konanie a ktore tvrdenia potvrdia primarne dokumenty.";
}

function humanizeProcessStatus(status: string) {
  const value = normalize(status);
  if (value.includes("odsuden")) return "pravoplatny alebo verejne uvadzany vysledok";
  if (value.includes("zastav")) return "zastavene alebo uzavrete konanie";
  if (value.includes("prebieha")) return "prebiehajuce konanie";
  return "podozrenie / preverovanie";
}

function inferRoleInScandal(evidence: string) {
  const value = normalize(evidence);
  if (value.includes("obvinen")) return "obvineny_akter";
  if (value.includes("obzalob")) return "obzalovany_akter";
  if (value.includes("podpis")) return "podpisovatel_rozhodnutia";
  if (value.includes("schval")) return "schvalovanie_alebo_rozhodovanie";
  if (value.includes("dotaci")) return "prepojenie_na_dotaciu";
  if (value.includes("funkcionar")) return "institucionalna_rola";
  return "zdrojovo_dolozena_rola";
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
