import { describe, expect, it } from "vitest";
import { classifyScandalSource, isTrustedScandalSource } from "./trusted-sources";

describe("scandal trusted source policy", () => {
  it("trusts primary and approved investigative sources", () => {
    expect(isTrustedScandalSource("https://zastavmekorupciu.sk/kauzy/test")).toBe(true);
    expect(isTrustedScandalSource("https://eppo.europa.eu/sk/news/test")).toBe(true);
    expect(isTrustedScandalSource("https://dennikn.sk/123/test")).toBe(true);
  });

  it("does not treat STVR as a trusted scandal source", () => {
    expect(classifyScandalSource("https://spravy.stvr.sk/2026/05/test")).toMatchObject({
      trusted: false,
      sourceType: "untrusted",
    });
  });
});
