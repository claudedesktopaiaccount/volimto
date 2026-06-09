import type { ScandalDraftActorClaim } from "@/lib/scandals/analysis";
import {
  GEMINI_APPROVAL_CRITERIA,
  GEMINI_MANUAL_REVIEW_CRITERIA,
  GEMINI_REJECTION_CRITERIA,
  GEMINI_REVIEW_MODEL_DEFAULT,
  GEMINI_REVIEW_WORKFLOW,
} from "@/lib/scandals/review-criteria";
import { classifyScandalSource, type ScandalSourceType } from "@/lib/scandals/trusted-sources";

export type ScandalGeminiDecision = "approve" | "reject" | "needs_review";

export interface ScandalGeminiReviewInput {
  scandal: {
    titleSk: string;
    summarySk: string;
    status: string;
    institutionInvestigating: string | null;
  };
  draft: {
    caseSummarySk: string;
    publicInterestSk: string;
    legalStatusSk: string;
    openQuestionsSk: string;
    actorClaims: ScandalDraftActorClaim[];
    sourceUrls: string[];
  };
  actors: {
    mpId: number;
    nameDisplay: string;
    roleInScandal: string;
  }[];
  sourceTexts: {
    url: string;
    text: string;
  }[];
}

export interface ScandalGeminiReviewResult {
  decision: ScandalGeminiDecision;
  confidence: number;
  reasonSk: string;
  revisedDraft: {
    caseSummarySk: string;
    publicInterestSk: string;
    legalStatusSk: string;
    openQuestionsSk: string;
    actorClaims: ScandalDraftActorClaim[];
    sourceUrls: string[];
  };
  model: string;
}

export async function reviewScandalDraftWithGemini(
  input: ScandalGeminiReviewInput,
  apiKey: string | undefined,
  model = process.env.GEMINI_KAUZY_MODEL || GEMINI_REVIEW_MODEL_DEFAULT
): Promise<ScandalGeminiReviewResult> {
  if (!apiKey) throw new Error("missing_gemini_api_key");

  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: buildPrompt(input),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["decision", "confidence", "reasonSk", "revisedDraft"],
        properties: {
          decision: {
            type: Type.STRING,
            format: "enum",
            enum: ["approve", "reject", "needs_review"],
          },
          confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
          reasonSk: { type: Type.STRING },
          revisedDraft: {
            type: Type.OBJECT,
            required: [
              "caseSummarySk",
              "publicInterestSk",
              "legalStatusSk",
              "openQuestionsSk",
              "actorClaims",
              "sourceUrls",
            ],
            properties: {
              caseSummarySk: { type: Type.STRING },
              publicInterestSk: { type: Type.STRING },
              legalStatusSk: { type: Type.STRING },
              openQuestionsSk: { type: Type.STRING },
              sourceUrls: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              actorClaims: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: [
                    "mpId",
                    "targetLabel",
                    "claimKind",
                    "processStatus",
                    "responsibilityKind",
                    "statementSk",
                    "whyRelevantSk",
                    "evidenceExcerptSk",
                    "sourceUrl",
                    "roleInScandal",
                  ],
                  properties: {
                    mpId: { type: Type.INTEGER, nullable: true },
                    targetLabel: { type: Type.STRING },
                    claimKind: { type: Type.STRING },
                    processStatus: { type: Type.STRING },
                    responsibilityKind: { type: Type.STRING },
                    statementSk: { type: Type.STRING },
                    whyRelevantSk: { type: Type.STRING },
                    evidenceExcerptSk: { type: Type.STRING },
                    sourceUrl: { type: Type.STRING },
                    roleInScandal: { type: Type.STRING },
                    counterpointSk: { type: Type.STRING, nullable: true },
                  },
                },
              },
            },
          },
        },
      },
      maxOutputTokens: 8192,
      temperature: 0.1,
    },
  });

  const parsed = parseReviewJson(response.text ?? "");
  if (!parsed.ok) {
    return manualReviewFallback(
      input,
      model,
      "Gemini vrátil neúplný alebo neplatný JSON; draft zostáva na ručnú kontrolu bez automatickej zmeny."
    );
  }

  return sanitizeReview(parsed.value, input, model);
}

function buildPrompt(input: ScandalGeminiReviewInput) {
  const payload = {
    pravidla: [
      "Si neutrálny slovenský editor politického trackera.",
      "Nevymýšľaj fakty, osoby, právny stav ani citácie. Použi iba priložené trusted zdroje.",
      "Každý statementSk formuluj ako zdrojovo pripísané tvrdenie, nie ako vlastný záver.",
      "counterpointSk použi na prezumpciu neviny alebo procesné obmedzenie, keď je vec neuzavretá.",
    ],
    workflow: GEMINI_REVIEW_WORKFLOW,
    schvalIbaAk: GEMINI_APPROVAL_CRITERIA,
    zamietniAk: GEMINI_REJECTION_CRITERIA,
    ponechajNaRucnuKontroluAk: GEMINI_MANUAL_REVIEW_CRITERIA,
    allowedSourceUrls: trustedUrls(input.draft.sourceUrls),
    scandal: input.scandal,
    knownActors: input.actors,
    currentDraft: input.draft,
    sourceTexts: input.sourceTexts.map((source) => ({
      url: source.url,
      text: source.text.slice(0, 8_000),
    })),
  };

  return [
    "Vráť iba JSON podľa schema. Nepoužívaj markdown.",
    "Všetky textové polia píš po slovensky.",
    JSON.stringify(payload),
  ].join("\n");
}

function parseReviewJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
  try {
    return { ok: true, value: JSON.parse(json) as unknown };
  } catch {
    return { ok: false };
  }
}

function manualReviewFallback(
  input: ScandalGeminiReviewInput,
  model: string,
  reasonSk: string
): ScandalGeminiReviewResult {
  return {
    decision: "needs_review",
    confidence: 0,
    reasonSk,
    revisedDraft: input.draft,
    model,
  };
}

function sanitizeReview(
  raw: unknown,
  input: ScandalGeminiReviewInput,
  model: string
): ScandalGeminiReviewResult {
  const value = isRecord(raw) ? raw : {};
  const revised = isRecord(value.revisedDraft) ? value.revisedDraft : {};
  const allowedUrls = new Set(trustedUrls([
    ...input.draft.sourceUrls,
    ...input.sourceTexts.map((source) => source.url),
  ]));

  const sourceUrls = toStringArray(revised.sourceUrls)
    .filter((url) => allowedUrls.has(url))
    .slice(0, 8);
  const fallbackUrls = sourceUrls.length > 0 ? sourceUrls : [...allowedUrls].slice(0, 8);
  const actorClaims = toActorClaims(revised.actorClaims, input, allowedUrls);
  const decision = sanitizeDecision(value.decision, actorClaims.length, input.sourceTexts.length > 0);

  return {
    decision,
    confidence: clampNumber(value.confidence, 0, 1, 0),
    reasonSk: normalizeText(value.reasonSk, "Gemini vrátil nekompletný dôvod rozhodnutia.").slice(0, 600),
    revisedDraft: {
      caseSummarySk: normalizeText(revised.caseSummarySk, input.draft.caseSummarySk).slice(0, 1_200),
      publicInterestSk: normalizeText(revised.publicInterestSk, input.draft.publicInterestSk).slice(0, 800),
      legalStatusSk: normalizeText(revised.legalStatusSk, input.draft.legalStatusSk).slice(0, 600),
      openQuestionsSk: normalizeText(revised.openQuestionsSk, input.draft.openQuestionsSk).slice(0, 600),
      actorClaims,
      sourceUrls: fallbackUrls,
    },
    model,
  };
}

function sanitizeDecision(value: unknown, claimCount: number, hasSourceText: boolean): ScandalGeminiDecision {
  if (value === "reject") return "reject";
  if (value === "approve") return claimCount > 0 && hasSourceText ? "approve" : "needs_review";
  return "needs_review";
}

function toActorClaims(
  value: unknown,
  input: ScandalGeminiReviewInput,
  allowedUrls: Set<string>
): ScandalDraftActorClaim[] {
  if (!Array.isArray(value)) return input.draft.actorClaims;
  const actorsById = new Map(input.actors.map((actor) => [actor.mpId, actor]));
  const actorsByName = new Map(input.actors.map((actor) => [normalizeKey(actor.nameDisplay), actor]));

  return value
    .map((item): ScandalDraftActorClaim | null => {
      if (!isRecord(item)) return null;
      const sourceUrl = typeof item.sourceUrl === "string" && allowedUrls.has(item.sourceUrl)
        ? item.sourceUrl
        : null;
      if (!sourceUrl) return null;

      const mpId = typeof item.mpId === "number" && actorsById.has(item.mpId)
        ? item.mpId
        : null;
      const targetLabel = normalizeText(item.targetLabel, "");
      const actor = mpId != null ? actorsById.get(mpId) : actorsByName.get(normalizeKey(targetLabel));
      const classified = classifyScandalSource(sourceUrl);

      return {
        mpId: actor?.mpId ?? mpId,
        targetLabel: actor?.nameDisplay ?? targetLabel,
        claimKind: normalizeText(item.claimKind, "zdrojovo dolozena rola"),
        processStatus: normalizeText(item.processStatus, "podozrenie / preverovanie"),
        responsibilityKind: normalizeText(item.responsibilityKind, "zdrojovo dolozena rola aktera"),
        statementSk: normalizeText(item.statementSk, "").slice(0, 700),
        whyRelevantSk: normalizeText(item.whyRelevantSk, "").slice(0, 700),
        evidenceExcerptSk: normalizeText(item.evidenceExcerptSk, "").slice(0, 700),
        sourceUrl,
        sourceType: classified.sourceType as ScandalSourceType,
        roleInScandal: normalizeText(item.roleInScandal, actor?.roleInScandal || "zdrojovo_dolozena_rola"),
        counterpointSk: typeof item.counterpointSk === "string" && item.counterpointSk.trim()
          ? normalizeText(item.counterpointSk, "").slice(0, 500)
          : null,
      };
    })
    .filter((claim): claim is ScandalDraftActorClaim =>
      Boolean(
        claim &&
        claim.targetLabel.length >= 3 &&
        claim.statementSk.length >= 30 &&
        claim.whyRelevantSk.length >= 30 &&
        claim.evidenceExcerptSk.length >= 20
      )
    )
    .slice(0, 12);
}

function trustedUrls(urls: string[]) {
  return [...new Set(urls)].filter((url) => classifyScandalSource(url).trusted);
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim()
    : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
