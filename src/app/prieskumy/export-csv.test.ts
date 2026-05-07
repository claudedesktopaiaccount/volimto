import { describe, expect, it } from "vitest";
import { buildPollCsv } from "./export-csv";

describe("buildPollCsv", () => {
  it("escapes commas, quotes, and preserves headers", () => {
    const csv = buildPollCsv(
      [
        {
          date: "2026-05-01",
          agency: 'Focus, "Special"',
          ps: 21.4,
          hlas: 18.2,
        },
      ],
      [
        { id: "ps", abbreviation: "PS" },
        { id: "hlas", abbreviation: "HLAS" },
      ]
    );

    expect(csv).toBe(
      'Dátum,Agentúra,PS,HLAS\n2026-05-01,"Focus, ""Special""",21.4,18.2'
    );
  });
});

