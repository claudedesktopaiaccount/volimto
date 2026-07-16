import { beforeEach, describe, expect, it, vi } from "vitest";
import { runScraperJob } from "./scraper-jobs";

const mocks = vi.hoisted(() => ({
  runConfiguredOpendataImport: vi.fn(),
  formatOpendataImportError: vi.fn((error: unknown) => ({
    ok: false,
    error: "opendata_import_failed",
    code: "unexpected_error",
    message: error instanceof Error ? error.message : "Unknown error",
  })),
}));

vi.mock("@/lib/opendata-import", () => ({
  runConfiguredOpendataImport: mocks.runConfiguredOpendataImport,
  formatOpendataImportError: mocks.formatOpendataImportError,
}));

describe("manual OpenData scraper job", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    mocks.runConfiguredOpendataImport.mockReset();
    mocks.formatOpendataImportError.mockClear();
  });

  it("runs the shared import without requiring CRON_SECRET", async () => {
    mocks.runConfiguredOpendataImport.mockResolvedValue({
      companies: { scraped: 12, upserted: 12 },
      contracts: { scraped: 34, upserted: 34 },
      politicalLinks: {
        available: 2,
        linkedContracts: 1,
        unlinkedContracts: 0,
        ambiguousContracts: 0,
      },
      cleanup: {
        unverifiedDonationsRemoved: 15,
        unverifiedRpvsNameLinksRemoved: 0,
        unverifiedRpvsContractLinksRemoved: 0,
      },
    });

    const result = await runScraperJob("opendata");

    expect(mocks.runConfiguredOpendataImport).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      data: {
        ok: true,
        companies: { scraped: 12 },
        contracts: { scraped: 34 },
      },
    });
  });

  it("reports a failed source as a failed admin job", async () => {
    mocks.runConfiguredOpendataImport.mockRejectedValue(new Error("RPVS unavailable"));

    const result = await runScraperJob("opendata");

    expect(result).toMatchObject({
      ok: false,
      status: 502,
      data: {
        ok: false,
        error: "opendata_import_failed",
        message: "RPVS unavailable",
      },
    });
  });
});
