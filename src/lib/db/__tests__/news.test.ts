import { describe, it, expect, vi } from "vitest";
import { getLatestNews } from "../news";
import type { Database } from "@/lib/db";

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([
    { id: 1, title: "Test", url: "https://example.com", source: "SME", publishedAt: "2026-03-01", scrapedAt: "2026-03-01T10:00:00Z" },
  ]),
};

describe("getLatestNews", () => {
  it("returns an array of news items", async () => {
    const result = await getLatestNews(mockDb as unknown as Database, 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("title");
    expect(result[0]).toHaveProperty("url");
  });

  it("uses default limit of 10", async () => {
    await getLatestNews(mockDb as unknown as Database);
    expect(mockDb.limit).toHaveBeenCalledWith(10);
  });
});
