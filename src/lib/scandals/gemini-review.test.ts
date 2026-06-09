import { beforeEach, describe, expect, it, vi } from "vitest";
import { reviewScandalDraftWithGemini, type ScandalGeminiReviewInput } from "./gemini-review";

const geminiMock = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: geminiMock.generateContent };
  },
  Type: {
    ARRAY: "ARRAY",
    INTEGER: "INTEGER",
    NUMBER: "NUMBER",
    OBJECT: "OBJECT",
    STRING: "STRING",
  },
}));

describe("reviewScandalDraftWithGemini", () => {
  beforeEach(() => {
    geminiMock.generateContent.mockReset();
  });

  it("keeps the draft on manual review when Gemini returns incomplete JSON", async () => {
    geminiMock.generateContent.mockResolvedValue({
      text: '{"decision":"approve","confidence":0.9,"reasonSk":"ok","revisedDraft":{"caseSummarySk":"nedokončené',
    });

    const result = await reviewScandalDraftWithGemini(reviewInput(), "test-key", "test-model");

    expect(result).toMatchObject({
      decision: "needs_review",
      confidence: 0,
      reasonSk: "Gemini vrátil neúplný alebo neplatný JSON; draft zostáva na ručnú kontrolu bez automatickej zmeny.",
      revisedDraft: reviewInput().draft,
      model: "test-model",
    });
  });

  it("allows enough output tokens for structured revised drafts", async () => {
    geminiMock.generateContent.mockResolvedValue({
      text: JSON.stringify({
        decision: "needs_review",
        confidence: 0.4,
        reasonSk: "Vyžaduje editorovu kontrolu.",
        revisedDraft: reviewInput().draft,
      }),
    });

    await reviewScandalDraftWithGemini(reviewInput(), "test-key", "test-model");

    expect(geminiMock.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        }),
      })
    );
  });
});

function reviewInput(): ScandalGeminiReviewInput {
  return {
    scandal: {
      titleSk: "Testovacia kauza",
      summarySk: "Základný opis kauzy.",
      status: "prebieha",
      institutionInvestigating: "Testovacia inštitúcia",
    },
    draft: {
      caseSummarySk: "Základný opis kauzy.",
      publicInterestSk: "Verejný záujem spočíva v kontrole verejných peňazí.",
      legalStatusSk: "Prebiehajúce konanie.",
      openQuestionsSk: "Otvorené zostáva, ako sa konanie skončí.",
      actorClaims: [{
        mpId: 1,
        targetLabel: "Jana Kontrolná",
        claimKind: "zdrojovo doložená rola",
        processStatus: "prebiehajúce konanie",
        responsibilityKind: "zdrojovo doložená rola aktéra",
        statementSk: "Zdroj opisuje rolu Jany Kontrolnej v preverovanej kauze.",
        whyRelevantSk: "Rola je relevantná pre kontrolu výkonu verejnej funkcie.",
        evidenceExcerptSk: "Jana Kontrolná sa podľa zdroja spomína pri rozhodovaní.",
        sourceUrl: "https://zastavmekorupciu.sk/kauzy/test/",
        sourceType: "ngo_investigation",
        roleInScandal: "zdrojovo_dolozena_rola",
        counterpointSk: "Tvrdenie nepredstavuje verdikt aplikácie.",
      }],
      sourceUrls: ["https://zastavmekorupciu.sk/kauzy/test/"],
    },
    actors: [{
      mpId: 1,
      nameDisplay: "Jana Kontrolná",
      roleInScandal: "zdrojovo_dolozena_rola",
    }],
    sourceTexts: [{
      url: "https://zastavmekorupciu.sk/kauzy/test/",
      text: "Jana Kontrolná sa podľa zdroja spomína pri rozhodovaní.",
    }],
  };
}
