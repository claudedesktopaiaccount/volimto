import { describe, expect, it } from "vitest";
import {
  OpendataImportError,
  formatOpendataImportError,
  resolveUnverifiedRpvsContractLinkRemovals,
} from "./opendata-import";

describe("resolveUnverifiedRpvsContractLinkRemovals", () => {
  const links = [
    {
      mpId: 7,
      companyIco: "12 345 678",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    },
  ];

  it("removes only the exact MP, ICO, and validity-window attribution", () => {
    const result = resolveUnverifiedRpvsContractLinkRemovals(
      [
        { id: 1, supplierIco: "12345678", signedDate: "2024-06-01", linkedPoliticianId: 7 },
        { id: 2, supplierIco: "12345678", signedDate: "2023-06-01", linkedPoliticianId: 7 },
        { id: 3, supplierIco: "12345678", signedDate: "2024-06-01", linkedPoliticianId: 8 },
        { id: 4, supplierIco: "87654321", signedDate: "2024-06-01", linkedPoliticianId: 7 },
        { id: 5, supplierIco: "12345678", signedDate: "2024-06-01", linkedPoliticianId: null },
      ],
      links
    );

    expect(result).toEqual([{ contractId: 1, mpId: 7 }]);
  });
});

describe("OpenData import failures", () => {
  it("reports every required source that returned no usable records", () => {
    const error = new OpendataImportError(["rpvs_companies", "crz_contracts"]);

    expect(formatOpendataImportError(error)).toEqual({
      ok: false,
      error: "opendata_import_failed",
      code: "empty_source",
      sources: ["rpvs_companies", "crz_contracts"],
      message: "OpenData sources returned no usable records: rpvs_companies, crz_contracts",
    });
  });
});
