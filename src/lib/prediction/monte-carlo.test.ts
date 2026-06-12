import { describe, it, expect } from "vitest";
import { runSimulation, runSimulationWithOptions, estimateStdDev } from "./monte-carlo";

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("estimateStdDev", () => {
  it("returns 2.5 for single poll", () => {
    expect(estimateStdDev([{ agency: "A", percentage: 20 }])).toBe(2.5);
  });

  it("returns 2.5 for empty array", () => {
    expect(estimateStdDev([])).toBe(2.5);
  });

  it("clamps to floor 1.5 for identical polls", () => {
    const polls = [
      { agency: "A", percentage: 20 },
      { agency: "B", percentage: 20 },
      { agency: "C", percentage: 20 },
    ];
    expect(estimateStdDev(polls)).toBe(1.5);
  });

  it("clamps to ceiling 4.0 for high spread", () => {
    const polls = [
      { agency: "A", percentage: 10 },
      { agency: "B", percentage: 30 },
      { agency: "C", percentage: 5 },
      { agency: "D", percentage: 35 },
    ];
    expect(estimateStdDev(polls)).toBe(4.0);
  });
});

describe("runSimulation", () => {
  it("returns one result per party", () => {
    const parties = [
      { partyId: "a", meanPct: 25, stdDev: 2 },
      { partyId: "b", meanPct: 20, stdDev: 2 },
    ];
    const results = runSimulation(parties);
    expect(results).toHaveLength(2);
    expect(results[0].partyId).toBe("a");
    expect(results[1].partyId).toBe("b");
  });

  it("mean seats sum to approximately 150", () => {
    const parties = [
      { partyId: "a", meanPct: 25, stdDev: 2 },
      { partyId: "b", meanPct: 20, stdDev: 2 },
      { partyId: "c", meanPct: 15, stdDev: 2 },
      { partyId: "d", meanPct: 10, stdDev: 2 },
    ];
    const results = runSimulation(parties);
    const totalMeanSeats = results.reduce((s, r) => s + r.meanSeats, 0);
    expect(totalMeanSeats).toBeCloseTo(150, -1);
  });

  it("strong party has high parliament probability", () => {
    const parties = [
      { partyId: "strong", meanPct: 25, stdDev: 1 },
      { partyId: "weak", meanPct: 2, stdDev: 0.5 },
    ];
    const results = runSimulation(parties);
    const strong = results.find((r) => r.partyId === "strong")!;
    const weak = results.find((r) => r.partyId === "weak")!;
    expect(strong.parliamentProbability).toBeGreaterThan(0.99);
    expect(weak.parliamentProbability).toBeLessThan(0.05);
  });

  it("win probabilities sum to approximately 1.0", () => {
    const parties = [
      { partyId: "a", meanPct: 22, stdDev: 2 },
      { partyId: "b", meanPct: 20, stdDev: 2 },
      { partyId: "c", meanPct: 15, stdDev: 2 },
    ];
    const results = runSimulation(parties);
    const totalWinProb = results.reduce((s, r) => s + r.winProbability, 0);
    expect(totalWinProb).toBeCloseTo(1.0, 1);
  });

  it("keeps runSimulation as the compatible default wrapper", () => {
    const parties = [
      { partyId: "a", meanPct: 22, stdDev: 2 },
      { partyId: "b", meanPct: 20, stdDev: 2 },
    ];
    const results = runSimulation(parties);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      partyId: "a",
      meanPct: expect.any(Number),
      meanSeats: expect.any(Number),
      winProbability: expect.any(Number),
      parliamentProbability: expect.any(Number),
    });
  });
});

describe("runSimulationWithOptions", () => {
  it("supports deterministic runs with an injected rng", () => {
    const parties = [
      { partyId: "a", meanPct: 25, stdDev: 2 },
      { partyId: "b", meanPct: 20, stdDev: 2 },
      { partyId: "c", meanPct: 8, stdDev: 1.5 },
    ];

    const first = runSimulationWithOptions(parties, {
      simulations: 250,
      rng: seededRandom(42),
    });
    const second = runSimulationWithOptions(parties, {
      simulations: 250,
      rng: seededRandom(42),
    });

    expect(first).toEqual(second);
  });
});
