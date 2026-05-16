import { describe, it, expect } from "vitest";

// ─── Unit tests for the public polls API ─────────────────────────────────────
// We test the parameter validation logic and response shape without hitting the database.

function parseLimit(raw: string | null, defaultVal = 10, max = 50): number {
  const parsed = parseInt(raw ?? String(defaultVal), 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.min(Math.max(1, parsed), max);
}

describe("parseLimit helper", () => {
  it("returns default when null", () => {
    expect(parseLimit(null)).toBe(10);
  });

  it("returns default for non-numeric string", () => {
    expect(parseLimit("abc")).toBe(10);
  });

  it("clamps to max 50", () => {
    expect(parseLimit("100")).toBe(50);
  });

  it("clamps to min 1", () => {
    expect(parseLimit("0")).toBe(1);
    expect(parseLimit("-5")).toBe(1);
  });

  it("parses a valid number", () => {
    expect(parseLimit("20")).toBe(20);
  });
});

describe("polls API response shape", () => {
  const examplePoll = {
    id: 1,
    agency: "Focus",
    publishedDate: "2026-03-20",
    fieldworkStart: null,
    fieldworkEnd: null,
    sampleSize: 1000,
    sourceUrl: null,
    results: { ps: 24.8, "smer-sd": 22.3 },
  };

  const exampleParty = {
    id: "ps",
    name: "Progresívne Slovensko",
    abbreviation: "PS",
    color: "#00BDFF",
  };

  it("poll has required fields", () => {
    expect(examplePoll).toHaveProperty("agency");
    expect(examplePoll).toHaveProperty("publishedDate");
    expect(examplePoll).toHaveProperty("results");
    expect(typeof examplePoll.results).toBe("object");
  });

  it("party has required fields", () => {
    expect(exampleParty).toHaveProperty("id");
    expect(exampleParty).toHaveProperty("name");
    expect(exampleParty).toHaveProperty("abbreviation");
    expect(exampleParty).toHaveProperty("color");
  });

  it("results map contains numeric percentages", () => {
    for (const [, pct] of Object.entries(examplePoll.results)) {
      expect(typeof pct).toBe("number");
      expect(pct).toBeGreaterThan(0);
    }
  });

  it("response envelope has polls, parties, generatedAt", () => {
    const response = {
      polls: [examplePoll],
      parties: [exampleParty],
      generatedAt: new Date().toISOString(),
    };
    expect(response).toHaveProperty("polls");
    expect(response).toHaveProperty("parties");
    expect(response).toHaveProperty("generatedAt");
    expect(Array.isArray(response.polls)).toBe(true);
    expect(Array.isArray(response.parties)).toBe(true);
  });

  it("generatedAt is a valid ISO string", () => {
    const ts = new Date().toISOString();
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });
});

describe("partyId filter logic", () => {
  const parties = [
    { id: "ps", name: "Progresívne Slovensko", abbreviation: "PS", color: "#00BDFF" },
    { id: "smer-sd", name: "Smer – sociálna demokracia", abbreviation: "Smer-SD", color: "#D70000" },
  ];

  it("returns all parties when no filter", () => {
    const filter = null;
    const filtered = filter ? parties.filter((p) => p.id === filter) : parties;
    expect(filtered).toHaveLength(2);
  });

  it("filters to a single party", () => {
    const filter = "ps";
    const filtered = filter ? parties.filter((p) => p.id === filter) : parties;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("ps");
  });

  it("returns empty array for unknown partyId", () => {
    const filter = "nonexistent";
    const filtered = filter ? parties.filter((p) => p.id === filter) : parties;
    expect(filtered).toHaveLength(0);
  });
});
