import { describe, expect, it } from "vitest";
import { parseGeminiFinancialLinks } from "./financial-links";
import type { PreparedScandal } from "./scandals";

const baseItem: Pick<PreparedScandal, "mpMatches" | "pageText" | "startDate" | "sources"> = {
  mpMatches: [
    {
      id: 1,
      slug: "jana-testova",
      nameDisplay: "Jana Testová",
      nameFull: "Jana Testová",
    },
  ],
  pageText:
    "Jana Testová podľa zdroja pôsobila vo firme Test Company, s. r. o., IČO: 12345678, ako konateľka.",
  startDate: "2026-05-30",
  sources: [
    {
      url: "https://www.aktuality.sk/clanok/test",
      outletName: "Aktuality",
      publishedDate: "2026-05-30",
      isPrimary: true,
    },
  ],
};

describe("Gemini financial link parsing", () => {
  it("keeps only links with a known MP slug and ICO present in source text", () => {
    const links = parseGeminiFinancialLinks(
      JSON.stringify({
        links: [
          {
            mpSlug: "jana-testova",
            ico: "12 345 678",
            companyName: "Test Company, s. r. o.",
            relationship: "konateľka",
            evidenceExcerptSk: "Jana Testová podľa zdroja pôsobila vo firme Test Company, s. r. o., IČO: 12345678",
          },
          {
            mpSlug: "iny-politik",
            ico: "12345678",
            companyName: "Test Company, s. r. o.",
            relationship: "konateľ",
          },
          {
            mpSlug: "jana-testova",
            ico: "87654321",
            companyName: "Halucinovaná firma",
            relationship: "spoločník",
          },
        ],
      }),
      baseItem
    );

    expect(links).toEqual([
      {
        mpSlug: "jana-testova",
        ico: "12345678",
        companyName: "Test Company, s. r. o.",
        relationship: "konatelka",
        startDate: "2026-05-30",
        endDate: null,
        sourceUrl: "https://www.aktuality.sk/clanok/test",
      },
    ]);
  });

  it("returns no links for invalid JSON", () => {
    expect(parseGeminiFinancialLinks("nie je json", baseItem)).toEqual([]);
  });
});
