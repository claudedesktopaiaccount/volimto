import { describe, expect, it } from "vitest";
import {
  filtersToSearchParams,
  opendataHref,
  parseOpendataFilters,
} from "./opendata-dashboard";

describe("opendata dashboard filters", () => {
  it("parses supported filters and normalizes pagination", () => {
    expect(
      parseOpendataFilters({
        view: "contracts",
        q: "  ministerstvo  ",
        year: "2026",
        amount: "100k",
        rpvs: "in-rpvs",
        link: "linked",
        party: "ps",
        sort: "highest",
        page: "3",
      })
    ).toMatchObject({
      view: "contracts",
      query: "ministerstvo",
      year: "2026",
      amount: "100k",
      rpvs: "in-rpvs",
      link: "linked",
      partyId: "ps",
      sort: "highest",
      page: 3,
    });
  });

  it("falls back safely for unsupported values", () => {
    expect(
      parseOpendataFilters({
        view: "admin",
        year: "26",
        amount: "everything",
        rpvs: "maybe",
        page: "-5",
      })
    ).toEqual({
      view: "overview",
      query: "",
      year: "",
      amount: "all",
      rpvs: "all",
      link: "all",
      partyId: "",
      sort: "newest",
      legalForm: "",
      companySort: "contracts",
      page: 1,
    });
  });

  it("omits defaults and preserves meaningful URL state", () => {
    const filters = parseOpendataFilters({
      view: "companies",
      q: "energia",
      form: "s.r.o.",
      companySort: "name",
      page: "2",
    });
    const params = filtersToSearchParams(filters);

    expect(params.get("view")).toBe("companies");
    expect(params.get("q")).toBe("energia");
    expect(params.get("form")).toBe("s.r.o.");
    expect(params.get("companySort")).toBe("name");
    expect(params.get("page")).toBe("2");
    expect(params.has("amount")).toBe(false);
  });

  it("builds links with typed overrides", () => {
    const filters = parseOpendataFilters({ q: "obec", page: "8" });
    expect(
      opendataHref(filters, { view: "contracts", sort: "highest", page: 1 })
    ).toBe("/opendata?view=contracts&q=obec&sort=highest");
  });
});
