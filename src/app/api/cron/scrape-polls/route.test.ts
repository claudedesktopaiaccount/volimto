import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(() => ({ mocked: "db" })),
  importPollRows: vi.fn(),
  scrapeWikipediaPolls: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/db/polls", () => ({
  importPollRows: mocks.importPollRows,
}));

vi.mock("@/lib/scraper/wikipedia", () => ({
  scrapeWikipediaPolls: mocks.scrapeWikipediaPolls,
}));

describe("scrape polls cron route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    mocks.getDb.mockClear();
    mocks.importPollRows.mockReset();
    mocks.scrapeWikipediaPolls.mockReset();
  });

  it("rejects requests without the cron secret", async () => {
    const response = await GET(new NextRequest("https://volimto.test/api/cron/scrape-polls"));

    expect(response.status).toBe(401);
    expect(mocks.scrapeWikipediaPolls).not.toHaveBeenCalled();
    expect(mocks.importPollRows).not.toHaveBeenCalled();
  });

  it("scrapes and imports polls for an authenticated request", async () => {
    const scrapedPolls = [
      {
        agency: "Focus",
        publishedDate: "2026-06-01",
        sampleSize: 1000,
        results: { ps: 25, "smer-sd": 20 },
      },
    ];
    mocks.scrapeWikipediaPolls.mockResolvedValue(scrapedPolls);
    mocks.importPollRows.mockResolvedValue({
      scraped: 1,
      inserted: 1,
      repaired: 0,
      skipped: 0,
      latest: { agency: "Focus", publishedDate: "2026-06-01" },
    });

    const response = await GET(
      new NextRequest("https://volimto.test/api/cron/scrape-polls", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.scrapeWikipediaPolls).toHaveBeenCalledOnce();
    expect(mocks.importPollRows).toHaveBeenCalledWith({ mocked: "db" }, scrapedPolls);
    expect(body).toMatchObject({ ok: true, scraped: 1, inserted: 1 });
  });
});
