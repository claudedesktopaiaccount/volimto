import { describe, it, expect, vi } from "vitest";
import { getPromisesForParty } from "../party-promises";
import type { Database } from "@/lib/db";

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([
    { id: 1, partyId: "ps", promiseText: "Ochrana demokracie", category: "Politika", isPro: true, sourceUrl: "https://ps.sk" },
  ]),
};

describe("getPromisesForParty", () => {
  it("returns promises for a party", async () => {
    const result = await getPromisesForParty(mockDb as unknown as Database, "ps");
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("promiseText");
    expect(result[0]).toHaveProperty("category");
  });
});
