import { describe, expect, it } from "vitest";
import {
  isContractDateWithinVerifiedLink,
  verifiedLinkMatchesContract,
} from "./opendata";

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
