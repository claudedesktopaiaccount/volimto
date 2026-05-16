import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCandidates, type CandidateWithParty } from "../candidates";

// Mock Drizzle DB
const mockRows: CandidateWithParty[] = [
  {
    id: 1,
    partyId: "smer-sd",
    name: "Robert Fico",
    listRank: 1,
    role: "Predseda vlády",
    portraitUrl: "/portraits/smer-fico.jpg",
    partyColor: "#D82222",
    partyAbbreviation: "SMER",
    partyName: "Smer – sociálna demokracia",
  },
  {
    id: 2,
    partyId: "ps",
    name: "Michal Šimečka",
    listRank: 1,
    role: "Predseda opozície",
    portraitUrl: "/portraits/ps-simecka.jpg",
    partyColor: "#00BDFF",
    partyAbbreviation: "PS",
    partyName: "Progresívne Slovensko",
  },
];

let rows = mockRows;
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn(() => Promise.resolve(rows)),
} as unknown as Parameters<typeof getCandidates>[0];

describe("getCandidates", () => {
  beforeEach(() => {
    rows = mockRows;
    vi.clearAllMocks();
  });

  it("returns candidates joined with party data, ordered by party then rank", async () => {
    const result = await getCandidates(mockDb);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Robert Fico");
    expect(result[0].partyColor).toBe("#D82222");
    expect(result[1].partyAbbreviation).toBe("PS");
  });

  it("returns empty array when no candidates", async () => {
    rows = [];
    const result = await getCandidates(mockDb);
    expect(result).toEqual([]);
  });
});
