import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(() => ({ mocked: "db" })),
  revalidateCacheTag: vi.fn(),
  scrapeAndStoreScandals: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/scraper/scandals", () => ({
  scrapeAndStoreScandals: mocks.scrapeAndStoreScandals,
}));

vi.mock("@/lib/cache/tags", () => ({
  revalidateCacheTag: mocks.revalidateCacheTag,
}));

describe("scrape scandals cron route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.GEMINI_API_KEY = "gemini-secret";
    mocks.getDb.mockClear();
    mocks.revalidateCacheTag.mockClear();
    mocks.scrapeAndStoreScandals.mockReset();
  });

  it("rejects requests without the cron secret", async () => {
    const response = await GET(new NextRequest("https://volimto.test/api/cron/scrape-scandals"));

    expect(response.status).toBe(401);
    expect(mocks.scrapeAndStoreScandals).not.toHaveBeenCalled();
  });

  it("runs the scraper with an authenticated request", async () => {
    mocks.scrapeAndStoreScandals.mockResolvedValue({
      scraped: 2,
      scandalsUpserted: 2,
      sourcesUpserted: 4,
      linksUpserted: 1,
      eventsUpserted: 5,
      draftsCreated: 1,
      financialLinks: {
        analyzed: 1,
        candidates: 1,
        upserted: 1,
        linkedContracts: 0,
        skippedReason: null,
      },
      unresolved: [],
    });

    const response = await GET(
      new NextRequest("https://volimto.test/api/cron/scrape-scandals?limit=12", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.scrapeAndStoreScandals).toHaveBeenCalledWith(
      { mocked: "db" },
      12,
      { geminiApiKey: "gemini-secret" }
    );
    expect(mocks.revalidateCacheTag).toHaveBeenCalledWith("kauzy");
    expect(mocks.revalidateCacheTag).toHaveBeenCalledWith("opendata", { expire: 0 });
    expect(mocks.revalidateCacheTag).toHaveBeenCalledWith("poslanci", { expire: 0 });
    expect(body).toMatchObject({ ok: true, scraped: 2, eventsUpserted: 5, draftsCreated: 1 });
  });
});
