import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanSpeechForDigest,
  fallbackSpeechDigest,
  summarizeSpeechWithGemini,
} from "./speech-digest";

const geminiMock = vi.hoisted(() => ({
  responseText: "",
  prompts: [] as string[],
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: vi.fn(async (args: { contents: string }) => {
          geminiMock.prompts.push(args.contents);
          return { text: geminiMock.responseText };
        }),
      },
    };
  }),
}));

describe("speech digest", () => {
  beforeEach(() => {
    geminiMock.responseText = "";
    geminiMock.prompts = [];
  });

  it("removes stenographic metadata from Smecka procedural speech", () => {
    const cleaned = cleanSpeechForDigest({
      date: "2026-05-05",
      titleSk:
        "5. 5. 2026 17:19:14 - 17:19:47 49. schôdza NR SR - 14.deň - B. popoludní Šimečka, Michal - poslanec NR SR Vystúpenie s procedurálnym návrhom",
      textSk:
        "Šimečka, Michal - poslanec NR SR Vystúpenie s procedurálnym návrhom Pekne, pán predseda. Ja iba by som bol rád, aby bolo zaprotokolované, že tlač 1171, hlasovanie 278, som omylom hlasoval za, hoci som sa chcel zdržať.",
    });

    expect(cleaned.cleanTitleSk).toBe("Procedurálna oprava hlasovania");
    expect(cleaned.speechType).toBe("Procedurálne vystúpenie");
    expect(cleaned.timeRange).toBe("17:19:14 - 17:19:47");
    expect(cleaned.sessionLabel).toContain("49. schôdza NR SR");
    expect(cleaned.cleanedText).not.toContain("Šimečka, Michal - poslanec NR SR");
    expect(cleaned.cleanedText).toContain("omylom hlasoval za");
  });

  it("uses deterministic fallback when no Gemini key is configured", async () => {
    const digest = await summarizeSpeechWithGemini(
      {
        date: "2026-04-21",
        titleSk: "Vystúpenie s procedurálnym návrhom",
        textSk: "(text neprešiel jazykovou úpravou).",
      },
      undefined
    );

    expect(digest.summaryStatus).toBe("skipped");
    expect(digest.cleanTitleSk).toBe("Prepis bez jazykovej úpravy");
    expect(digest.summarySk).toBe(
      "Krátke procedurálne vystúpenie bez širšieho vecného obsahu."
    );
  });

  it("validates Gemini JSON and stores a useful digest shape", async () => {
    geminiMock.responseText = JSON.stringify({
      cleanTitleSk: "Procedurálna oprava hlasovania",
      speechType: "Procedurálne vystúpenie",
      summarySk: "Poslanec požiadal, aby sa do zápisnice opravilo jeho hlasovanie.",
      keyPointsSk: ["Oznámil omyl pri hlasovaní.", "Chcel sa zdržať."],
    });

    const digest = await summarizeSpeechWithGemini(
      {
        date: "2026-05-05",
        titleSk: "Vystúpenie s procedurálnym návrhom",
        textSk: "Pekne, pán predseda. Ja iba by som bol rád, aby bolo zaprotokolované, že som omylom hlasoval za, hoci som sa chcel zdržať.",
      },
      "test-key"
    );

    expect(digest.summaryStatus).toBe("done");
    expect(digest.summaryModel).toBe("gemini-2.5-flash-lite");
    expect(digest.keyPointsSk).toHaveLength(2);
    expect(geminiMock.prompts[0]).toContain("Vráť iba JSON");
  });

  it("falls back without raw dump when Gemini returns invalid JSON", async () => {
    geminiMock.responseText = "nie je json";
    const digest = await summarizeSpeechWithGemini(
      {
        date: "2026-05-05",
        titleSk: "Vystúpenie s procedurálnym návrhom",
        textSk: "Pekne, pán predseda. Som omylom hlasoval za, hoci som sa chcel zdržať.",
      },
      "test-key"
    );

    expect(digest.summaryStatus).toBe("failed");
    expect(digest.cleanTitleSk).toBe("Procedurálna oprava hlasovania");
  });

  it("creates a fallback digest from the first meaningful sentence", () => {
    const digest = fallbackSpeechDigest({
      date: "2026-05-05",
      titleSk: "Vystúpenie",
      textSk: "Krátka veta. V druhej vete vysvetlil návrh pre voličov a jeho dopad.",
    });

    expect(digest.summarySk).toBe(
      "V druhej vete vysvetlil návrh pre voličov a jeho dopad."
    );
  });

  it("skips greeting-only sentences in fallback summaries", () => {
    const digest = fallbackSpeechDigest({
      date: "2026-05-05",
      titleSk: "Vystúpenie s procedurálnym návrhom",
      textSk:
        "Pekne, pán predseda. Ja iba by som bol rád, aby bolo zaprotokolované, že som omylom hlasoval za, hoci som sa chcel zdržať.",
    });

    expect(digest.summarySk).toContain("omylom hlasoval za");
  });
});
