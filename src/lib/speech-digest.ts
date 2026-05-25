export type SpeechSummaryStatus = "pending" | "done" | "skipped" | "failed";

export interface SpeechDigestInput {
  titleSk: string | null;
  textSk: string;
  date: string;
}

export interface CleanedSpeech {
  cleanTitleSk: string;
  speechType: string;
  cleanedText: string;
  timeRange: string | null;
  sessionLabel: string | null;
}

export interface SpeechDigest {
  cleanTitleSk: string;
  speechType: string;
  summarySk: string;
  keyPointsSk: string[];
  summaryStatus: Exclude<SpeechSummaryStatus, "pending">;
  summaryModel: string | null;
}

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const EMPTY_PROCEDURAL_SUMMARY = "Krátke procedurálne vystúpenie bez širšieho vecného obsahu.";
const LANGUAGE_NOTE = "text neprešiel jazykovou úpravou";

export function cleanSpeechForDigest(input: SpeechDigestInput): CleanedSpeech {
  const rawTitle = normalizeWhitespace(input.titleSk ?? "");
  const rawText = normalizeWhitespace(input.textSk);
  const combined = normalizeWhitespace(`${rawTitle} ${rawText}`);
  const timeRange = extractTimeRange(combined);
  const sessionLabel = extractSessionLabel(combined);
  const speechType = extractSpeechType(combined);
  const cleanedText = stripSpeechMetadata(rawText || rawTitle, speechType);

  return {
    cleanTitleSk: fallbackTitle(cleanedText, speechType),
    speechType,
    cleanedText,
    timeRange,
    sessionLabel,
  };
}

export function fallbackSpeechDigest(
  input: SpeechDigestInput,
  status: Exclude<SpeechSummaryStatus, "pending"> = "skipped"
): SpeechDigest {
  const cleaned = cleanSpeechForDigest(input);
  const meaningfulSentences = splitSentences(cleaned.cleanedText).filter(isMeaningfulSentence);
  const keyPoints = meaningfulSentences.slice(0, 3);

  return {
    cleanTitleSk: cleaned.cleanTitleSk,
    speechType: cleaned.speechType,
    summarySk: fallbackSummary(cleaned, keyPoints[0]),
    keyPointsSk: keyPoints,
    summaryStatus: status,
    summaryModel: null,
  };
}

export async function summarizeSpeechWithGemini(
  input: SpeechDigestInput,
  apiKey: string | undefined
): Promise<SpeechDigest> {
  const cleaned = cleanSpeechForDigest(input);
  if (!apiKey) return fallbackSpeechDigest(input, "skipped");

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(cleaned),
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 350,
        temperature: 0.2,
      },
    });

    const parsed = parseGeminiDigest(response.text ?? "");
    if (!parsed) return fallbackSpeechDigest(input, "failed");

    return {
      cleanTitleSk: parsed.cleanTitleSk || cleaned.cleanTitleSk,
      speechType: parsed.speechType || cleaned.speechType,
      summarySk: parsed.summarySk || fallbackSpeechDigest(input, "failed").summarySk,
      keyPointsSk: parsed.keyPointsSk.slice(0, 3),
      summaryStatus: "done",
      summaryModel: GEMINI_MODEL,
    };
  } catch (error) {
    console.error("[speech-digest] Gemini failed:", error);
    return fallbackSpeechDigest(input, "failed");
  }
}

export function parseKeyPoints(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

export function speechMeta(input: SpeechDigestInput): {
  timeRange: string | null;
  sessionLabel: string | null;
  speechType: string;
} {
  const cleaned = cleanSpeechForDigest(input);
  return {
    timeRange: cleaned.timeRange,
    sessionLabel: cleaned.sessionLabel,
    speechType: cleaned.speechType,
  };
}

interface GeminiDigestResponse {
  cleanTitleSk: string;
  speechType: string;
  summarySk: string;
  keyPointsSk: string[];
}

function parseGeminiDigest(raw: string): GeminiDigestResponse | null {
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
  try {
    const parsed = JSON.parse(json) as Partial<GeminiDigestResponse>;
    if (
      typeof parsed.cleanTitleSk !== "string" ||
      typeof parsed.speechType !== "string" ||
      typeof parsed.summarySk !== "string" ||
      !Array.isArray(parsed.keyPointsSk)
    ) {
      return null;
    }
    return {
      cleanTitleSk: parsed.cleanTitleSk.trim(),
      speechType: parsed.speechType.trim(),
      summarySk: parsed.summarySk.trim(),
      keyPointsSk: parsed.keyPointsSk
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    };
  } catch {
    return null;
  }
}

function buildPrompt(cleaned: CleanedSpeech): string {
  const clippedText = cleaned.cleanedText.slice(0, 2400);
  return [
    "Si neutrálny editor slovenského parlamentného trackera.",
    "Zhrň verejné vystúpenie poslanca pre bežného voliča.",
    "Nevymýšľaj fakty. Ak je vystúpenie iba procedurálne alebo bez obsahu, povedz to jasne.",
    "Vráť iba JSON s poľami cleanTitleSk, speechType, summarySk, keyPointsSk.",
    "",
    `Typ odhadom: ${cleaned.speechType}`,
    `Text: ${clippedText}`,
  ].join("\n");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTimeRange(value: string): string | null {
  const match = value.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(\d{1,2}:\d{2}(?::\d{2})?)/);
  return match ? `${match[1]} - ${match[2]}` : null;
}

function extractSessionLabel(value: string): string | null {
  const match = value.match(/(\d+\.\s*schôdza\s+NR\s+SR(?:\s*[-–]\s*[^ŠŽČĽĎŤÁÉÍÓÚÝÔÄ]+?)?)(?=\s+[A-ZÁÄČĎÉÍĽŇÓÔŔŠŤÚÝŽ][a-záäčďéíľĺňóôŕšťúýž]+,|\s+Vystúpenie|\s+\(|$)/);
  return match ? normalizeWhitespace(match[1]) : null;
}

function extractSpeechType(value: string): string {
  const typeMatch = value.match(
    /(Vystúpenie\s+s\s+procedurálnym\s+návrhom|Faktická\s+poznámka|Vystúpenie\s+v\s+rozprave|Vystúpenie|Procedurálny\s+návrh)/i
  );
  if (!typeMatch) return "Parlamentné vystúpenie";
  const raw = normalizeWhitespace(typeMatch[1]).toLowerCase();
  if (raw.includes("procedur")) return "Procedurálne vystúpenie";
  if (raw.includes("faktick")) return "Faktická poznámka";
  if (raw.includes("rozprave")) return "Vystúpenie v rozprave";
  return "Parlamentné vystúpenie";
}

function stripSpeechMetadata(value: string, speechType: string): string {
  let text = normalizeWhitespace(value);
  text = text.replace(/^\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[-–]\s*\d{1,2}:\d{2}(?::\d{2})?\s*/u, "");
  text = text.replace(/^\d+\.\s*schôdza\s+NR\s+SR\s*[-–][^-–]+[-–]\s*/u, "");
  text = text.replace(/^[A-ZÁÄČĎÉÍĽŇÓÔŔŠŤÚÝŽ][^,.]{1,60},\s*[A-ZÁÄČĎÉÍĽŇÓÔŔŠŤÚÝŽ][^-]{1,60}\s*-\s*poslanec\s+NR\s+SR\s*/u, "");
  text = text.replace(/^(Vystúpenie\s+s\s+procedurálnym\s+návrhom|Faktická\s+poznámka|Vystúpenie\s+v\s+rozprave|Vystúpenie)\s*/iu, "");
  if (speechType.toLowerCase().includes("procedur")) {
    text = text.replace(/\s*Dobre,\s*ďakujem pekne\..*$/iu, "");
  }
  return normalizeWhitespace(text);
}

function fallbackTitle(cleanedText: string, speechType: string): string {
  const lower = cleanedText.toLowerCase();
  if (lower.includes("omylom hlasoval") || lower.includes("chcel zdržať")) {
    return "Procedurálna oprava hlasovania";
  }
  if (lower.includes(LANGUAGE_NOTE)) return "Prepis bez jazykovej úpravy";
  if (speechType.toLowerCase().includes("procedur")) return "Procedurálne vystúpenie";
  return speechType;
}

function fallbackSummary(cleaned: CleanedSpeech, firstMeaningfulSentence: string | undefined): string {
  const lower = cleaned.cleanedText.toLowerCase();
  if (lower.includes("omylom hlasoval") || lower.includes("chcel zdržať")) {
    return "Poslanec uviedol, že pri hlasovaní omylom hlasoval za a chcel sa zdržať.";
  }
  if (firstMeaningfulSentence?.length) return firstMeaningfulSentence;
  if (cleaned.speechType.toLowerCase().includes("procedur")) return EMPTY_PROCEDURAL_SUMMARY;
  return "Prepis neobsahuje dostatok vecného obsahu na zhrnutie.";
}

function splitSentences(value: string): string[] {
  return normalizeWhitespace(value)
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20)
    .slice(0, 5);
}

function isMeaningfulSentence(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  if (lower.includes(LANGUAGE_NOTE)) return false;
  return ![
    /^pekne,\s*pán predseda\./iu,
    /^ďakujem(?:\s+pekne)?\./iu,
    /^dobr[ée],?\s*ďakujem/iu,
    /^vážen[áý]\s+pán/i,
  ].some((pattern) => pattern.test(sentence));
}
