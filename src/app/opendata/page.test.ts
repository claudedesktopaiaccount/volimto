import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("opendata page contract queries", () => {
  const source = readFileSync(join(process.cwd(), "src/app/opendata/page.tsx"), "utf8");

  it("selects only contracts linked to politicians for public display and totals", () => {
    const linkedContractFilters = source.match(
      /where\(isNotNull\(contracts\.linkedPoliticianId\)\)/g
    );

    expect(linkedContractFilters).toHaveLength(2);
    expect(source).toContain("innerJoin(mps");
    expect(source).toContain("politicianName: mps.nameDisplay");
  });

  it("shows an explicit MV SR register link for party donations", () => {
    expect(source).toContain("<SourceLink href={donation.sourceUrl}>Register MV SR</SourceLink>");
  });
});
