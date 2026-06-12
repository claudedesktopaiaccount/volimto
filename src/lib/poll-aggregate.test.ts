import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculatePollAgeWeight, getAggregatedPolls } from "./poll-aggregate";

// Mock the scraper
vi.mock("./scraper/wikipedia", () => ({
  scrapeWikipediaPolls: vi.fn(),
}));

import { scrapeWikipediaPolls } from "./scraper/wikipedia";
const mockScrape = vi.mocked(scrapeWikipediaPolls);

const TODAY = "2026-04-05";

// Helper: make a poll row dated N days ago
function pollDaysAgo(days: number, results: Record<string, number>, agency = "AgeX") {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - days);
  return {
    agency,
    publishedDate: d.toISOString().split("T")[0],
    sampleSize: 1000,
    results,
  };
}

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY));
  mockScrape.mockReset();
});

describe("getAggregatedPolls", () => {
  it("returns weighted mean: recent poll outweighs old one", async () => {
    mockScrape.mockResolvedValue([
      pollDaysAgo(0,  { ps: 30 }, "A"), // today: weight ≈ 1.0
      pollDaysAgo(30, { ps: 10 }, "B"), // 30 days: weight ≈ 0.5
    ]);
    const result = await getAggregatedPolls();
    const ps = result.find((p) => p.partyId === "ps")!;
    // weighted mean = (1.0*30 + 0.5*10) / (1.0 + 0.5) = 35/1.5 ≈ 23.33
    expect(ps.meanPct).toBeCloseTo(23.33, 0);
    expect(ps.pollCount).toBe(2);
  });

  it("excludes polls older than 12 months", async () => {
    mockScrape.mockResolvedValue([
      pollDaysAgo(10,  { ps: 25 }, "A"),  // within window
      pollDaysAgo(400, { ps: 5  }, "B"),  // outside window
    ]);
    const result = await getAggregatedPolls();
    const ps = result.find((p) => p.partyId === "ps")!;
    expect(ps.pollCount).toBe(1);
    expect(ps.meanPct).toBeCloseTo(25, 1);
  });

  it("falls back to all polls if no polls within 12 months", async () => {
    mockScrape.mockResolvedValue([
      pollDaysAgo(400, { ps: 20 }, "A"),
      pollDaysAgo(500, { ps: 18 }, "B"),
    ]);
    const result = await getAggregatedPolls();
    // Should return something rather than empty array
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty array when scraper throws and no fallback", async () => {
    mockScrape.mockRejectedValue(new Error("network error"));
    const result = await getAggregatedPolls();
    expect(result).toEqual([]);
  });

  it("provides correct oldestPollDate and newestPollDate", async () => {
    mockScrape.mockResolvedValue([
      pollDaysAgo(5,  { smer: 22 }, "A"),
      pollDaysAgo(15, { smer: 20 }, "B"),
      pollDaysAgo(60, { smer: 18 }, "C"),
    ]);
    const result = await getAggregatedPolls();
    const smer = result.find((p) => p.partyId === "smer")!;
    expect(smer.oldestPollDate).toBe(pollDaysAgo(60, {}).publishedDate);
    expect(smer.newestPollDate).toBe(pollDaysAgo(5, {}).publishedDate);
  });

  it("output shape is compatible with PartyInput[]", async () => {
    mockScrape.mockResolvedValue([pollDaysAgo(5, { ps: 25, "smer-sd": 20 }, "A")]);
    const result = await getAggregatedPolls();
    for (const p of result) {
      expect(p).toHaveProperty("partyId");
      expect(p).toHaveProperty("meanPct");
      expect(p).toHaveProperty("stdDev");
      expect(typeof p.meanPct).toBe("number");
      expect(typeof p.stdDev).toBe("number");
    }
  });
});

describe("calculatePollAgeWeight", () => {
  it("returns full weight for a current poll", () => {
    expect(calculatePollAgeWeight(0)).toBe(1);
  });

  it("applies roughly a 30-day half-life", () => {
    expect(calculatePollAgeWeight(30)).toBeCloseTo(0.5, 1);
  });

  it("heavily discounts polls after 90 days", () => {
    expect(calculatePollAgeWeight(90)).toBeCloseTo(0.126, 2);
  });
});
