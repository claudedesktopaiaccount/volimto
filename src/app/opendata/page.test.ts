import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("opendata analytics page contract", () => {
  const page = source("src/app/opendata/page.tsx");
  const views = source("src/app/opendata/OpendataViews.tsx");
  const filters = source("src/app/opendata/OpendataFilters.tsx");
  const analytics = source("src/lib/db/opendata-analytics.ts");
  const verifiedContractLinks = source("src/lib/db/verified-contract-links.ts");

  it("renders a server-loaded analytical explorer instead of two raw previews", () => {
    expect(page).toContain("getOpendataAnalytics");
    expect(page).toContain("<OpendataFilters");
    expect(page).toContain("<OverviewView");
    expect(page).toContain("<ContractsView");
    expect(page).toContain("<CompaniesView");
    expect(page).toContain("<PoliticsView");
    expect(page).toContain("<ItmsStats");
    expect(page).not.toContain(".limit(8)");
  });

  it("offers useful filters, ranking views, and paginated source records", () => {
    expect(filters).toContain("Predmet, dodávateľ, IČO alebo objednávateľ");
    expect(filters).toContain("DODÁVATEĽ V RPVS");
    expect(filters).toContain("POLITICKÁ VÄZBA");
    expect(filters).toContain("SÚČASNÁ STRANA");
    expect(filters).toContain("useSearchParams");
    expect(views).toContain("Najväčší dodávatelia");
    expect(views).toContain("Najväčší verejní objednávatelia");
    expect(views).toContain("PaginationNav");
  });

  it("joins CRZ and RPVS only by exact company identifier", () => {
    expect(analytics).toContain("eq(contracts.supplierIco, companies.ico)");
    expect(views).toContain("presnou zhodou IČO");
    expect(views).toContain("podľa IČO, nie podľa názvu");
  });

  it("builds political summaries only from already verified contract links", () => {
    expect(analytics).toContain("verifiedContractPoliticianJoinCondition");
    expect(analytics).toContain("verifiedContractLinkCondition");
    expect(verifiedContractLinks).toContain("eq(contracts.linkedPoliticianId, mps.id)");
    expect(verifiedContractLinks).toContain("politicianCompanyLinks.reviewStatus");
    expect(verifiedContractLinks).toContain("politicianCompanyLinks.startDate");
    expect(verifiedContractLinks).toContain("politicianCompanyLinks.endDate");
    expect(analytics).not.toContain("donations");
    expect(analytics).not.toContain("politicianCompanyLinks");
  });

  it("does not claim that contract money was paid to political parties", () => {
    expect(views).toContain("neznamená peniaze prijaté politickou stranou");
    expect(views).toContain("Nejde o platby stranám");
    expect(views).toContain("žiadnu zazmluvnenú sumu strane nepripisujeme");
    expect(views).toContain("Zhodu mena");
    expect(views).not.toContain("Najväčšie dary stranám");
    expect(views).not.toMatch(/strana dostala/i);
  });

  it("opens contracts through a local detail and exposes evidence-complete ITMS links", () => {
    expect(views).toContain("`/opendata/contracts/${contract.id}`");
    expect(views).toContain("presné IČO prijímateľa");
    expect(views).toContain("celého mena a dátumu narodenia");
    expect(views).toContain("Zazmluvnená suma ITMS");
    expect(analytics).toContain("itmsProjectPoliticianLinks");
    expect(analytics).toContain("partyRegistryIdentities.ico");
  });

  it("distinguishes database failure from a genuine empty result", () => {
    expect(page).toContain('status: "unavailable"');
    expect(page).toContain("Toto nie je nulový výsledok");
    expect(page).toContain("Dáta sa teraz nepodarilo načítať");
  });
});
