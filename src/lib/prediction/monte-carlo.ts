import { allocateSeats } from "./dhondt";

const SIMULATIONS = 10_000;

interface PartyInput {
  partyId: string;
  meanPct: number;
  stdDev: number; // uncertainty, e.g. 1.5-3.0
}

interface SimulationResult {
  partyId: string;
  meanPct: number;
  medianPct: number;
  lowerBound: number; // 5th percentile
  upperBound: number; // 95th percentile
  meanSeats: number;
  winProbability: number; // Probability of being #1
  parliamentProbability: number; // Probability of >5%
}

interface SimulationOptions {
  simulations?: number;
  rng?: () => number;
}

/**
 * Box-Muller transform for generating normally distributed random values.
 */
function gaussianRandom(mean: number, stdDev: number, rng: () => number): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Run Monte Carlo simulation over polling data.
 * Each iteration perturbs each party's polling average by a random amount
 * drawn from N(0, stdDev), then runs D'Hondt allocation.
 */
export function runSimulation(parties: PartyInput[]): SimulationResult[] {
  return runSimulationWithOptions(parties);
}

export function runSimulationWithOptions(
  parties: PartyInput[],
  options: SimulationOptions = {}
): SimulationResult[] {
  const simulations = Math.max(1, Math.floor(options.simulations ?? SIMULATIONS));
  const rng = options.rng ?? Math.random;
  const allPcts: Record<string, number[]> = {};
  const allSeats: Record<string, number[]> = {};
  const winCounts: Record<string, number> = {};
  const parliamentCounts: Record<string, number> = {};

  for (const party of parties) {
    allPcts[party.partyId] = [];
    allSeats[party.partyId] = [];
    winCounts[party.partyId] = 0;
    parliamentCounts[party.partyId] = 0;
  }

  for (let i = 0; i < simulations; i++) {
    // Generate perturbed percentages
    const simVotes = parties.map((p) => {
      const pct = Math.max(0, gaussianRandom(p.meanPct, p.stdDev, rng));
      return { partyId: p.partyId, percentage: pct };
    });

    // Track winner
    let maxPct = -1;
    let winnerId = "";
    for (const v of simVotes) {
      allPcts[v.partyId].push(v.percentage);
      if (v.percentage >= 5) parliamentCounts[v.partyId]++;
      if (v.percentage > maxPct) {
        maxPct = v.percentage;
        winnerId = v.partyId;
      }
    }
    winCounts[winnerId]++;

    // Run seat allocation
    const seats = allocateSeats(simVotes);
    const seatMap: Record<string, number> = {};
    for (const s of seats) seatMap[s.partyId] = s.seats;
    for (const party of parties) {
      allSeats[party.partyId].push(seatMap[party.partyId] ?? 0);
    }
  }

  return parties.map((party) => {
    const pcts = allPcts[party.partyId].sort((a, b) => a - b);
    const seats = allSeats[party.partyId];

    const meanPct = pcts.reduce((s, v) => s + v, 0) / pcts.length;
    const medianPct = pcts[Math.floor(pcts.length / 2)];
    const lowerBound = pcts[Math.floor(pcts.length * 0.05)];
    const upperBound = pcts[Math.floor(pcts.length * 0.95)];
    const meanSeats = seats.reduce((s, v) => s + v, 0) / seats.length;
    const winProbability = winCounts[party.partyId] / simulations;
    const parliamentProbability = parliamentCounts[party.partyId] / simulations;

    return {
      partyId: party.partyId,
      meanPct: Math.round(meanPct * 100) / 100,
      medianPct: Math.round(medianPct * 100) / 100,
      lowerBound: Math.round(lowerBound * 100) / 100,
      upperBound: Math.round(upperBound * 100) / 100,
      meanSeats: Math.round(meanSeats * 10) / 10,
      winProbability: Math.round(winProbability * 1000) / 1000,
      parliamentProbability: Math.round(parliamentProbability * 1000) / 1000,
    };
  });
}

/**
 * Estimate standard deviation from polling data.
 * Uses inter-agency spread + base uncertainty.
 */
export function estimateStdDev(
  recentPolls: { agency: string; percentage: number }[]
): number {
  if (recentPolls.length <= 1) return 2.5; // Default uncertainty

  const mean = recentPolls.reduce((s, p) => s + p.percentage, 0) / recentPolls.length;
  const variance =
    recentPolls.reduce((s, p) => s + Math.pow(p.percentage - mean, 2), 0) /
    (recentPolls.length - 1);
  const empiricalStd = Math.sqrt(variance);

  // Floor at 1.5, cap at 4.0
  return Math.min(4.0, Math.max(1.5, empiricalStd));
}

export { type PartyInput, type SimulationOptions, type SimulationResult };
