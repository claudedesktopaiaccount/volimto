import { describe, expect, it, vi } from "vitest";
import { discoverVerifiedItmsPoliticalLinks } from "./itms-political-linking";
import { parseItmsProjectCollection } from "./scraper/itms-projects";

describe("discoverVerifiedItmsPoliticalLinks", () => {
  it("uses DB politician IDs and requires the live RPVS full-DOB path", async () => {
    const select = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 25, slug: "jan-ferencak" }]),
    };
    const db = {
      select: vi.fn().mockReturnValue(select),
    } as unknown as Parameters<typeof discoverVerifiedItmsPoliticalLinks>[0];
    const [project] = parseItmsProjectCollection([{
      id: 2135,
      href: "/v2/projekty/ukoncene/2135",
      kod: "302021M143",
      nazov: "Modernizácia nemocnice",
      createdAt: "2017-12-20T08:00:00Z",
      datumUcinnostiZmluvy: "2018-01-31T00:00:00Z",
      prijimatel: { subjekt: { id: 106356, ico: "37886436" } },
      sumaZazmluvnena: 3_816_081.57,
    }], "ukoncene");

    const result = await discoverVerifiedItmsPoliticalLinks(db, [project], {
      fetchRegistrations: vi.fn(async (ico) => ico === "37886436" ? [{
        registrationId: 72533,
        partnerId: 18145,
        partnerFileNumber: 18145,
        ico,
        name: "Nemocnica Dr. Vojtecha Alexandra v Kežmarku n.o.",
        validFrom: "2017-08-03",
        validTo: null,
        sourceUrl: "https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/18145",
        apiSourceUrl: "https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora",
      }] : []),
      fetchOwners: vi.fn(async (partnerId) => partnerId === 18145 ? [{
        beneficialOwnerId: 72532,
        partnerId,
        givenName: "Ján",
        familyName: "Ferenčák",
        birthDate: "1974-06-30",
        isPublicOfficial: true,
        validFrom: "2017-08-03",
        validTo: null,
        sourceUrl: "https://rpvs.gov.sk/opendatav2/KonecniUzivateliaVyhod",
      }] : []),
    });

    expect(result.verifiedLinks).toHaveLength(1);
    expect(result.verifiedLinks[0]).toMatchObject({
      projectExternalId: 2135,
      politicianId: 25,
      rpvsBeneficialOwnerId: 72532,
    });
    expect(result.missingPoliticianSlugs).toEqual([
      "roman-malatinec",
      "peter-sokol",
      "viliam-zahorcak",
    ]);
  });
});
