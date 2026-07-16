import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

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

describe("scrape OpenData cron route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    mocks.runConfiguredOpendataImport.mockReset();
    mocks.formatOpendataImportError.mockClear();
  });

  it("rejects requests without the cron secret", async () => {
    const response = await GET(
      new NextRequest("https://volimto.test/api/cron/scrape-opendata")
    );

    expect(response.status).toBe(401);
    expect(mocks.runConfiguredOpendataImport).not.toHaveBeenCalled();
  });

  it("returns the source-backed import summary", async () => {
    mocks.runConfiguredOpendataImport.mockResolvedValue({
      companies: { scraped: 500, upserted: 500 },
      contracts: { scraped: 2_328, upserted: 2_328 },
      politicalLinks: {
        available: 3,
        linkedContracts: 0,
        unlinkedContracts: 0,
        ambiguousContracts: 0,
      },
      cleanup: {
        unverifiedDonationsRemoved: 15,
        unverifiedRpvsNameLinksRemoved: 79,
        unverifiedRpvsContractLinksRemoved: 1,
      },
    });

    const response = await GET(
      new NextRequest("https://volimto.test/api/cron/scrape-opendata", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      companies: { scraped: 500 },
      contracts: { scraped: 2_328 },
      politicalLinks: { available: 3 },
      cleanup: {
        unverifiedDonationsRemoved: 15,
        unverifiedRpvsNameLinksRemoved: 79,
      },
    });
  });

  it("returns non-2xx when a required source fails", async () => {
    mocks.runConfiguredOpendataImport.mockRejectedValue(new Error("CRZ returned no rows"));

    const response = await GET(
      new NextRequest("https://volimto.test/api/cron/scrape-opendata", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      ok: false,
      error: "opendata_import_failed",
      message: "CRZ returned no rows",
    });
  });
});
