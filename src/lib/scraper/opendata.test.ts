import { describe, it, expect } from "vitest";
import {
  parseSlovakNumber,
  parseCsvLine,
  parseCrzExportXml,
  scrapeRpvsCompanies,
  scrapePublicContracts,
  getKnownDonations,
} from "./opendata";
import { PARTY_IDS } from "@/lib/parties";

// ─── parseSlovakNumber ────────────────────────────────────

describe("parseSlovakNumber", () => {
  it("parses SK format with space thousands separator", () => {
    expect(parseSlovakNumber("1 234,56")).toBeCloseTo(1234.56);
  });

  it("parses plain dot decimal", () => {
    expect(parseSlovakNumber("1234.56")).toBeCloseTo(1234.56);
  });

  it("parses integer string", () => {
    expect(parseSlovakNumber("50000")).toBe(50000);
  });

  it("parses comma-only decimal (no thousands)", () => {
    expect(parseSlovakNumber("999,99")).toBeCloseTo(999.99);
  });

  it("returns 0 for empty string", () => {
    expect(parseSlovakNumber("")).toBe(0);
  });

  it("returns 0 for non-numeric", () => {
    expect(parseSlovakNumber("N/A")).toBe(0);
  });
});

// ─── parseCsvLine ─────────────────────────────────────────

describe("parseCsvLine", () => {
  it("splits semicolon-delimited line", () => {
    expect(parseCsvLine("a;b;c", ";")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with semicolons inside", () => {
    expect(parseCsvLine('"a;b";c;d', ";")).toEqual(["a;b", "c", "d"]);
  });

  it("handles escaped double-quotes inside quoted field", () => {
    expect(parseCsvLine('"say ""hello""";x', ";")).toEqual([
      'say "hello"',
      "x",
    ]);
  });

  it("splits comma-delimited line", () => {
    expect(parseCsvLine("x,y,z", ",")).toEqual(["x", "y", "z"]);
  });

  it("handles empty fields", () => {
    expect(parseCsvLine("a;;c", ";")).toEqual(["a", "", "c"]);
  });
});

// ─── scrapeRpvsCompanies ──────────────────────────────────

describe("scrapeRpvsCompanies", () => {
  const mockJson = JSON.stringify([
    {
      Ico: "12345678",
      ObchodneMeno: "Testová firma, s.r.o.",
      Sidlo: "Bratislava 1, Hlavná 1",
      Url: "https://rpvs.gov.sk/rpvs/Partner/PartnerPublicDetail/12345678",
    },
    {
      Ico: "87654321",
      ObchodneMeno: "Druhá firma, a.s.",
      Sidlo: "Košice, Kováčska 5",
      Url: null,
    },
  ]);

  it("parses JSON array and returns ScrapedCompany[]", async () => {
    const fetcher = async () => mockJson;
    const result = await scrapeRpvsCompanies(10, fetcher);

    expect(result).toHaveLength(2);
    expect(result[0].ico).toBe("12345678");
    expect(result[0].name).toBe("Testová firma, s.r.o.");
    expect(result[0].addressSk).toBe("Bratislava 1, Hlavná 1");
    expect(result[0].rpvsUboUrl).toBe(
      "https://rpvs.gov.sk/rpvs/Partner/PartnerPublicDetail/12345678"
    );
    expect(result[0].legalForm).toBe("s.r.o.");
  });

  it("respects limit parameter", async () => {
    const fetcher = async () => mockJson;
    const result = await scrapeRpvsCompanies(1, fetcher);
    expect(result).toHaveLength(1);
  });

  it("returns [] and warns when fetcher throws", async () => {
    const fetcher = async (): Promise<string> => {
      throw new Error("network error");
    };
    const result = await scrapeRpvsCompanies(10, fetcher);
    expect(result).toEqual([]);
  });

  it("returns [] when response is not JSON", async () => {
    const fetcher = async () => "not json at all";
    const result = await scrapeRpvsCompanies(10, fetcher);
    expect(result).toEqual([]);
  });

  it("returns [] when JSON is not an array", async () => {
    const fetcher = async () => JSON.stringify({ error: "oops" });
    const result = await scrapeRpvsCompanies(10, fetcher);
    expect(result).toEqual([]);
  });

  it("parses current RPVS OData wrapper and follows nextLink", async () => {
    const responses = new Map([
      [
        "https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora",
        JSON.stringify({
          value: [
            {
              Id: 123,
              ObchodneMeno: "ZELEX, s.r.o.",
              Ico: "47 559 870",
              FormaOsoby: "PravnickaOsoba",
            },
          ],
          "@odata.nextLink": "https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?$skiptoken=Id-123",
        }),
      ],
      [
        "https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?$skiptoken=Id-123",
        JSON.stringify({
          value: [
            {
              Id: 456,
              ObchodneMeno: "FECOM ICT s.r.o.",
              Ico: "36823457",
            },
          ],
        }),
      ],
    ]);
    const fetcher = async (url: string) => responses.get(url) ?? "[]";

    const result = await scrapeRpvsCompanies(10, fetcher);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      ico: "47559870",
      name: "ZELEX, s.r.o.",
      legalForm: "s.r.o.",
      rpvsUboUrl: "https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/123",
    });
  });

  it("skips records missing ico or name", async () => {
    const json = JSON.stringify([
      { Ico: "", ObchodneMeno: "No ICO firm" },
      { Ico: "99999999", ObchodneMeno: "" },
      { Ico: "11111111", ObchodneMeno: "Valid firm" },
    ]);
    const fetcher = async () => json;
    const result = await scrapeRpvsCompanies(10, fetcher);
    expect(result).toHaveLength(1);
    expect(result[0].ico).toBe("11111111");
  });
});

// ─── scrapePublicContracts ────────────────────────────────

const mockCsv = [
  "ID;ZmluvaCislo;Predmet;ObjednavatelNazov;ObjednavatelICO;DodavatelNazov;DodavatelICO;CenaSEDPH;CenaSDPH;DatumZverejnenia;DatumPlatnosti;Url",
  "1;CRZ-2023-001;Dodávka kancelárskeho papiera;Ministerstvo financií SR;00151742;Paperex, s.r.o.;44123456;1 200,00;1 440,00;15.03.2023;31.12.2023;https://www.crz.gov.sk/zmluva/123",
  "2;;Rekonštrukcia budovy;Úrad vlády SR;00151005;Stavby Plus, a.s.;35967123;50 000,00;60 000,00;01.06.2023;30.06.2024;https://www.crz.gov.sk/zmluva/456",
].join("\n");

describe("scrapePublicContracts", () => {
  it("parses CSV and returns ScrapedContract[]", async () => {
    const fetcher = async () => mockCsv;
    const result = await scrapePublicContracts(10, fetcher);

    expect(result).toHaveLength(2);
    expect(result[0].contractNumber).toBe("CRZ-2023-001");
    expect(result[0].titleSk).toBe("Dodávka kancelárskeho papiera");
    expect(result[0].supplierIco).toBe("44123456");
    expect(result[0].supplierName).toBe("Paperex, s.r.o.");
    expect(result[0].amountEur).toBeCloseTo(1440);
    expect(result[0].signedDate).toBe("2023-03-15");
    expect(result[0].sourceUrl).toBe("https://www.crz.gov.sk/zmluva/123");
    expect(result[0].cpvCode).toBeNull();
  });

  it("second row has null contractNumber", async () => {
    const fetcher = async () => mockCsv;
    const result = await scrapePublicContracts(10, fetcher);
    expect(result[1].contractNumber).toBeNull();
  });

  it("respects limit parameter", async () => {
    const fetcher = async () => mockCsv;
    const result = await scrapePublicContracts(1, fetcher);
    expect(result).toHaveLength(1);
  });

  it("returns [] and warns when fetcher throws", async () => {
    const fetcher = async (): Promise<string> => {
      throw new Error("timeout");
    };
    const result = await scrapePublicContracts(10, fetcher);
    expect(result).toEqual([]);
  });

  it("returns [] when CSV has no data rows", async () => {
    const fetcher = async () =>
      "ID;ZmluvaCislo;Predmet;DodavatelICO;DatumZverejnenia";
    const result = await scrapePublicContracts(10, fetcher);
    expect(result).toEqual([]);
  });

  it("skips rows with missing required fields", async () => {
    const csv = [
      "ID;ZmluvaCislo;Predmet;DodavatelICO;DodavatelNazov;CenaSDPH;DatumZverejnenia;Url",
      ";; ;; ; ;01.01.2023;https://x", // empty title and ico → skip
      "2;X;Valid title;55555555;Good firm;100,00;02.02.2023;https://y",
    ].join("\n");
    const fetcher = async () => csv;
    const result = await scrapePublicContracts(10, fetcher);
    expect(result).toHaveLength(1);
    expect(result[0].titleSk).toBe("Valid title");
  });
});

describe("parseCrzExportXml", () => {
  it("parses current CRZ ZIP XML contract fields", () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<zmluvy>",
      "<zmluva>",
      "<nazov>1125/2013</nazov>",
      "<ID>961292</ID>",
      "<zs1>Úrad vlády SR</zs1>",
      "<zs2>Gaton centrum, s.r.o.</zs2>",
      "<predmet>Zmluva o poskytovaní služieb</predmet>",
      "<datum>2013-06-27</datum>",
      "<suma_zmluva>0.81</suma_zmluva>",
      "<ico>45498652</ico>",
      "<ico1>00151513</ico1>",
      "</zmluva>",
      "</zmluvy>",
    ].join("");

    const result = parseCrzExportXml(xml, "https://www.crz.gov.sk/export/2026-05-29.zip");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      contractNumber: "1125/2013",
      titleSk: "Zmluva o poskytovaní služieb",
      contractingAuthority: "Úrad vlády SR",
      supplierName: "Gaton centrum, s.r.o.",
      supplierIco: "45498652",
      amountEur: 0.81,
      signedDate: "2013-06-27",
      sourceUrl: "https://www.crz.gov.sk/zmluva/961292/",
    });
  });
});

// ─── getKnownDonations ────────────────────────────────────

describe("getKnownDonations", () => {
  it("returns non-empty array", () => {
    const result = getKnownDonations();
    expect(result.length).toBeGreaterThan(0);
  });

  it("each item has required shape", () => {
    const result = getKnownDonations();
    for (const d of result) {
      expect(typeof d.partyId).toBe("string");
      expect(d.partyId.length).toBeGreaterThan(0);
      expect(typeof d.donorName).toBe("string");
      expect(d.donorName.length).toBeGreaterThan(0);
      expect(typeof d.amountEur).toBe("number");
      expect(d.amountEur).toBeGreaterThan(0);
      expect(typeof d.donationDate).toBe("string");
      // ISO date format: YYYY-MM-DD
      expect(d.donationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof d.sourceUrl).toBe("string");
      expect(d.sourceUrl.length).toBeGreaterThan(0);
      // donorIco is string or null
      expect(d.donorIco === null || typeof d.donorIco === "string").toBe(true);
    }
  });

  it("contains entries for multiple parties", () => {
    const result = getKnownDonations();
    const partyIds = new Set(result.map((d) => d.partyId));
    expect(partyIds.size).toBeGreaterThanOrEqual(3);
  });

  it("uses party IDs that exist in the app registry", () => {
    const result = getKnownDonations();
    expect(result.map((d) => d.partyId).filter((id) => !PARTY_IDS.includes(id))).toEqual([]);
  });
});
