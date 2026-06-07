const TOTAL_SEATS = 150;
const PARLIAMENTARY_THRESHOLD = 5.0;

interface PartyVote {
  partyId: string;
  percentage: number;
}

interface SeatAllocation {
  partyId: string;
  seats: number;
  percentage: number;
}

/**
 * D'Hondt method for Slovak parliament seat allocation.
 * Only parties above 5% threshold participate.
 * Total: 150 seats.
 */
export function allocateSeats(votes: PartyVote[]): SeatAllocation[] {
  // Filter parties above threshold
  const eligible = votes.filter((v) => v.percentage >= PARLIAMENTARY_THRESHOLD);
  if (eligible.length === 0) return [];

  // Normalize percentages among eligible parties
  const totalPct = eligible.reduce((sum, v) => sum + v.percentage, 0);

  const allocation: Record<string, number> = {};
  eligible.forEach((v) => (allocation[v.partyId] = 0));

  // Allocate seats using D'Hondt divisor method
  for (let seat = 0; seat < TOTAL_SEATS; seat++) {
    let maxQuotient = -1;
    let winner = "";

    for (const party of eligible) {
      const normalizedPct = (party.percentage / totalPct) * 100;
      const quotient = normalizedPct / (allocation[party.partyId] + 1);
      if (quotient > maxQuotient) {
        maxQuotient = quotient;
        winner = party.partyId;
      }
    }

    allocation[winner]++;
  }

  return eligible.map((v) => ({
    partyId: v.partyId,
    seats: allocation[v.partyId],
    percentage: v.percentage,
  }));
}

export { type PartyVote, type SeatAllocation };
