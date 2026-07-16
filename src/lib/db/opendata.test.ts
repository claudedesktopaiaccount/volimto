import { describe, expect, it, vi } from "vitest";
import {
  isContractDateWithinVerifiedLink,
  resolveStoredPoliticianCompanyLinks,
  upsertContracts,
  upsertVerifiedPoliticianCompanyLinks,
  verifiedLinkMatchesContract,
} from "./opendata";
import { contracts, politicianCompanyLinks } from "./schema";

describe("verified financial linking", () => {
  const link = {
    ico: "12 345 678",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
  };

  it("matches contracts by exact ICO and valid relationship period", () => {
    expect(
      verifiedLinkMatchesContract(
        { supplierIco: "12345678", signedDate: "2024-06-01" },
        link
      )
    ).toBe(true);
  });

  it("rejects contracts outside the verified relationship period", () => {
    expect(isContractDateWithinVerifiedLink("2023-12-31", link)).toBe(false);
    expect(isContractDateWithinVerifiedLink("2025-01-01", link)).toBe(false);
  });

  it("rejects name-only matches without matching ICO", () => {
    expect(
      verifiedLinkMatchesContract(
        { supplierIco: "87654321", signedDate: "2024-06-01" },
        link
      )
    ).toBe(false);
  });

});

describe("resolveStoredPoliticianCompanyLinks", () => {
  it("matches contracts to the one unique MP with the same normalized ICO", () => {
    const result = resolveStoredPoliticianCompanyLinks(
      [
        { id: 20, supplierIco: "12 345 678", signedDate: "2024-06-01" },
        { id: 10, supplierIco: "87654321", signedDate: "2024-06-01" },
      ],
      [
        { mpId: 7, companyIco: "12345678", startDate: null, endDate: null },
      ]
    );

    expect(result).toEqual({
      assignments: [
        { contractId: 20, mpId: 7, expectedLinkedPoliticianId: null },
      ],
      removals: [],
      ambiguousContractIds: [],
    });
  });

  it("uses inclusive relationship date windows", () => {
    const result = resolveStoredPoliticianCompanyLinks(
      [
        { id: 1, supplierIco: "12345678", signedDate: "2023-12-31" },
        { id: 2, supplierIco: "12345678", signedDate: "2024-01-01" },
        { id: 3, supplierIco: "12345678", signedDate: "2024-12-31" },
        { id: 4, supplierIco: "12345678", signedDate: "2025-01-01" },
      ],
      [
        {
          mpId: 7,
          companyIco: "12345678",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        },
      ]
    );

    expect(result.assignments).toEqual([
      { contractId: 2, mpId: 7, expectedLinkedPoliticianId: null },
      { contractId: 3, mpId: 7, expectedLinkedPoliticianId: null },
    ]);
    expect(result.removals).toEqual([]);
    expect(result.ambiguousContractIds).toEqual([]);
  });

  it("collapses multiple matching relationship rows for the same MP", () => {
    const result = resolveStoredPoliticianCompanyLinks(
      [{ id: 1, supplierIco: "12345678", signedDate: "2024-06-01" }],
      [
        { mpId: 7, companyIco: "12-345-678", startDate: null, endDate: null },
        { mpId: 7, companyIco: "12345678", startDate: "2024-01-01", endDate: null },
      ]
    );

    expect(result).toEqual({
      assignments: [
        { contractId: 1, mpId: 7, expectedLinkedPoliticianId: null },
      ],
      removals: [],
      ambiguousContractIds: [],
    });
  });

  it("reports ambiguous contracts in deterministic ID order without assigning them", () => {
    const result = resolveStoredPoliticianCompanyLinks(
      [
        { id: 20, supplierIco: "12345678", signedDate: "2024-06-01" },
        { id: 10, supplierIco: "12345678", signedDate: "2024-06-01" },
      ],
      [
        { mpId: 9, companyIco: "12345678", startDate: null, endDate: null },
        { mpId: 3, companyIco: "12345678", startDate: null, endDate: null },
      ]
    );

    expect(result).toEqual({
      assignments: [],
      removals: [],
      ambiguousContractIds: [10, 20],
    });
  });

  it("reassigns an importer-managed link when stored date windows change", () => {
    const result = resolveStoredPoliticianCompanyLinks(
      [
        {
          id: 1,
          supplierIco: "12345678",
          signedDate: "2024-06-01",
          linkedPoliticianId: 7,
        },
      ],
      [
        {
          mpId: 7,
          companyIco: "12345678",
          startDate: "2020-01-01",
          endDate: "2023-12-31",
        },
        {
          mpId: 9,
          companyIco: "12345678",
          startDate: "2024-01-01",
          endDate: null,
        },
      ]
    );

    expect(result).toEqual({
      assignments: [
        { contractId: 1, mpId: 9, expectedLinkedPoliticianId: 7 },
      ],
      removals: [],
      ambiguousContractIds: [],
    });
  });

  it("removes an importer-managed link when it becomes stale or ambiguous", () => {
    const result = resolveStoredPoliticianCompanyLinks(
      [
        {
          id: 1,
          supplierIco: "12345678",
          signedDate: "2024-06-01",
          linkedPoliticianId: 7,
        },
        {
          id: 2,
          supplierIco: "87654321",
          signedDate: "2024-06-01",
          linkedPoliticianId: 3,
        },
      ],
      [
        {
          mpId: 7,
          companyIco: "12345678",
          startDate: "2020-01-01",
          endDate: "2023-12-31",
        },
        { mpId: 3, companyIco: "87654321", startDate: null, endDate: null },
        { mpId: 4, companyIco: "87654321", startDate: null, endDate: null },
      ]
    );

    expect(result).toEqual({
      assignments: [],
      removals: [
        { contractId: 1, expectedLinkedPoliticianId: 7 },
        { contractId: 2, expectedLinkedPoliticianId: 3 },
      ],
      ambiguousContractIds: [2],
    });
  });

  it("removes an unsupported legacy or manual link instead of publishing it", () => {
    const result = resolveStoredPoliticianCompanyLinks(
      [
        {
          id: 1,
          supplierIco: "12345678",
          signedDate: "2024-06-01",
          linkedPoliticianId: 99,
        },
      ],
      [
        { mpId: 7, companyIco: "12345678", startDate: null, endDate: null },
        { mpId: 9, companyIco: "12345678", startDate: null, endDate: null },
      ]
    );

    expect(result).toEqual({
      assignments: [],
      removals: [{ contractId: 1, expectedLinkedPoliticianId: 99 }],
      ambiguousContractIds: [1],
    });
  });
});

describe("upsertVerifiedPoliticianCompanyLinks", () => {
  it("persists separate independently verified periods and targets the period-aware key", async () => {
    const companyInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    };
    const linkInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    };
    const mpSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 7, slug: "milan-majersky" }]),
    };
    const companySelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 11, ico: "42238536" }]),
    };
    const db = {
      insert: vi.fn()
        .mockReturnValueOnce(companyInsert)
        .mockReturnValueOnce(linkInsert),
      select: vi.fn()
        .mockReturnValueOnce(mpSelect)
        .mockReturnValueOnce(companySelect),
    } as unknown as Parameters<typeof upsertVerifiedPoliticianCompanyLinks>[0];

    const count = await upsertVerifiedPoliticianCompanyLinks(db, [
      {
        mpSlug: "milan-majersky",
        ico: "42238536",
        companyName: "Severovýchod Slovenska",
        politicianGivenName: "Milan",
        politicianFamilyName: "Majerský",
        relationship: "štatutár",
        startDate: "2018-04-27",
        endDate: "2026-05-12",
        sourceUrl: "https://example.test/independent-evidence",
        identitySourceUrl: "https://www.nrsr.sk/example",
        identityBirthDate: "1971-01-01",
        verificationMethod: "rpvs_kuv_exact_name_birth_date",
        verifiedAt: "2026-07-16",
      },
      {
        mpSlug: "milan-majersky",
        ico: "42238536",
        companyName: "Prešov Region",
        politicianGivenName: "Milan",
        politicianFamilyName: "Majerský",
        relationship: "štatutár",
        startDate: "2026-05-13",
        endDate: null,
        sourceUrl: "https://example.test/independent-evidence",
        identitySourceUrl: "https://www.nrsr.sk/example",
        identityBirthDate: "1971-01-01",
        verificationMethod: "rpvs_kuv_exact_name_birth_date",
        verifiedAt: "2026-07-16",
      },
    ]);

    expect(count).toBe(2);
    expect(linkInsert.values).toHaveBeenCalledWith([
      expect.objectContaining({ startDate: "2018-04-27", endDate: "2026-05-12" }),
      expect.objectContaining({ startDate: "2026-05-13", endDate: null }),
    ]);
    expect(linkInsert.onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      target: [
        politicianCompanyLinks.mpId,
        politicianCompanyLinks.companyId,
        politicianCompanyLinks.relationship,
        politicianCompanyLinks.startDate,
      ],
    }));
  });
});

describe("upsertContracts", () => {
  it("targets the canonical source URL constraint to stay safe under concurrent imports", async () => {
    const existingSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const contractInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    };
    const db = {
      select: vi.fn().mockReturnValue(existingSelect),
      insert: vi.fn().mockReturnValue(contractInsert),
    } as unknown as Parameters<typeof upsertContracts>[0];

    const count = await upsertContracts(db, [{
      contractNumber: "CRZ-1",
      titleSk: "Zmluva",
      contractingAuthority: "Úrad",
      supplierIco: "12345678",
      supplierName: "Dodávateľ",
      amountEur: 100,
      signedDate: "2026-01-01",
      cpvCode: null,
      sourceUrl: "https://www.crz.gov.sk/zmluva/1/",
    }]);

    expect(count).toBe(1);
    expect(contractInsert.onConflictDoNothing).toHaveBeenCalledWith({
      target: contracts.sourceUrl,
    });
  });
});
