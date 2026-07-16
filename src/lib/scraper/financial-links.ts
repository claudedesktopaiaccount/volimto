import type { Database } from "@/lib/db";
import type { PreparedScandal } from "./scandals";

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const MAX_TEXT_CHARS = 7000;

export interface FinancialLinkExtractionResult {
  analyzed: number;
  candidates: number;
  upserted: number;
  linkedContracts: number;
  skippedReason: string | null;
}

interface GeminiFinancialLink {
  mpSlug?: unknown;
  ico?: unknown;
  companyName?: unknown;
  relationship?: unknown;
  evidenceExcerptSk?: unknown;
}

interface GeminiFinancialLinkResponse {
  links?: unknown;
}

export interface FinancialLinkCandidate {
  mpSlug: string;
  ico: string;
  companyName: string;
  relationship: string;
  startDate: string;
  endDate: null;
  sourceUrl: string;
}

export async function extractAndStoreFinancialLinksFromScandals(
  _db: Database,
  items: PreparedScandal[],
  apiKey: string | undefined
): Promise<FinancialLinkExtractionResult> {
  if (!apiKey) {
    return {
      analyzed: 0,
      candidates: 0,
      upserted: 0,
      linkedContracts: 0,
      skippedReason: "missing_gemini_api_key",
    };
  }

  const candidates: FinancialLinkCandidate[] = [];
  let analyzed = 0;

  for (const item of items) {
    if (item.mpMatches.length === 0 || !item.pageText.trim()) continue;
    analyzed++;
    const extracted = await extractFinancialLinksWithGemini(item, apiKey);
    candidates.push(...extracted);
  }

  const deduped = dedupeLinks(candidates);

  return {
    analyzed,
    candidates: deduped.length,
    // An LLM extraction is a review candidate, never verified evidence. The
    // public linker only consumes the independently audited RPVS/NRSR path.
    upserted: 0,
    linkedContracts: 0,
    skippedReason: "human_review_required",
  };
}

async function extractFinancialLinksWithGemini(
  item: PreparedScandal,
  apiKey: string
): Promise<FinancialLinkCandidate[]> {
  const sourceUrl = item.sources[0]?.url;
  if (!sourceUrl) return [];

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildFinancialLinkPrompt(item),
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 900,
        temperature: 0,
      },
    });

    return parseGeminiFinancialLinks(response.text ?? "", item);
  } catch (error) {
    console.error("[financial-links] Gemini extraction failed:", error);
    return [];
  }
}

export function parseGeminiFinancialLinks(
  raw: string,
  item: Pick<PreparedScandal, "mpMatches" | "pageText" | "startDate" | "sources">
): FinancialLinkCandidate[] {
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
  let parsed: GeminiFinancialLinkResponse;
  try {
    parsed = JSON.parse(json) as GeminiFinancialLinkResponse;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.links)) return [];

  const allowedMpSlugs = new Set(item.mpMatches.map((mp) => mp.slug));
  const sourceUrl = item.sources[0]?.url;
  if (!sourceUrl) return [];

  return parsed.links.flatMap((value): FinancialLinkCandidate[] => {
    const link = value as GeminiFinancialLink;
    const mpSlug = stringValue(link.mpSlug);
    const ico = normalizeIco(stringValue(link.ico));
    const companyName = stringValue(link.companyName);
    const relationship = normalizeRelationship(stringValue(link.relationship));
    const evidenceExcerptSk = stringValue(link.evidenceExcerptSk);

    if (!mpSlug || !allowedMpSlugs.has(mpSlug)) return [];
    if (!ico || !containsExactIco(item.pageText, ico)) return [];
    if (!companyName || companyName.length < 3) return [];
    if (evidenceExcerptSk && !normalizeForEvidence(item.pageText).includes(normalizeForEvidence(evidenceExcerptSk).slice(0, 40))) {
      return [];
    }

    return [{
      mpSlug,
      ico,
      companyName,
      relationship,
      startDate: item.startDate,
      endDate: null,
      sourceUrl,
    }];
  });
}

function buildFinancialLinkPrompt(item: PreparedScandal) {
  const politicians = item.mpMatches
    .map((mp) => `- ${mp.slug}: ${mp.nameDisplay}`)
    .join("\n");
  const sources = item.sources.map((source) => source.url).join("\n");
  const text = item.pageText.slice(0, MAX_TEXT_CHARS);

  return [
    "Si konzervativny analytik slovenských verejných zdrojov.",
    "Vyťaž iba explicitne doložené prepojenia medzi uvedenými politikmi a firmami.",
    "Vráť prepojenie len vtedy, keď text obsahuje IČO firmy a zároveň opisuje vzťah politika k tejto firme.",
    "Nevymýšľaj IČO, firmu, rolu ani dátumy. Ak IČO nie je v texte, vráť prázdne links.",
    "Použi iba mpSlug zo zoznamu kandidátov.",
    "Vráť iba JSON v tvare {\"links\":[{\"mpSlug\":\"...\",\"ico\":\"12345678\",\"companyName\":\"...\",\"relationship\":\"...\",\"evidenceExcerptSk\":\"...\"}]}",
    "",
    "Kandidáti politici:",
    politicians || "- žiadni",
    "",
    "Zdroje:",
    sources,
    "",
    "Text:",
    text,
  ].join("\n");
}

function dedupeLinks(items: FinancialLinkCandidate[]) {
  return [
    ...new Map(
      items.map((item) => [
        `${item.mpSlug}|${item.ico}|${item.relationship}`,
        item,
      ] as const)
    ).values(),
  ];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIco(value: string) {
  const ico = value.replace(/\D/g, "");
  return ico.length >= 6 && ico.length <= 10 ? ico : "";
}

function normalizeRelationship(value: string) {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "zdrojovo_dolozene_prepojenie";
}

function normalizeForEvidence(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsExactIco(text: string, expectedIco: string) {
  const candidates = text.match(/\d(?:[\d\s.\-/]{4,16}\d)?/g) ?? [];
  return candidates.some((candidate) => normalizeIco(candidate) === expectedIco);
}
