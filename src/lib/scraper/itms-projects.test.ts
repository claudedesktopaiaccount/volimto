import { describe, expect, it } from "vitest";
import {
  buildRpvsBeneficialOwnersUrl,
  buildRpvsPartnerRegistrationsUrl,
  fetchAllItmsProjects,
  fetchRpvsBeneficialOwners,
  normalizeSlovakIco,
  normalizeSourceDate,
  parseItmsProjectCollection,
  parseRpvsBeneficialOwners,
  parseRpvsPartnerRegistrations,
  resolveItmsRpvsPoliticianLinks,
  type ItmsProject,
  type RpvsBeneficialOwner,
  type RpvsPartnerRegistration,
  type VerifiedPoliticianIdentity,
} from "./itms-projects";

const ITMS_RECORD = {
  cisloZmluvy: "Z302021M143",
  createdAt: "2017-12-20T08:00:00Z",
  datumPlatnostiZmluvy: "2018-01-30T00:00:00Z",
  datumUcinnostiZmluvy: "2018-01-31T00:00:00Z",
  href: "/v2/projekty/ukoncene/2135",
  id: 2135,
  kod: "302021M143",
  nazov: "Modernizácia nemocnice",
  otvorenaZmena: false,
  otvorenyDodatok: false,
  prijimatel: {
    subjekt: {
      dic: "2021642192",
      href: "/v2/subjekty/110233",
      ico: "37 886 436",
      id: 110233,
    },
  },
  stav: "Projekt riadne ukončený (K)",
  sumaZazmluvnena: 3_816_081.57,
  updatedAt: "2023-04-01T12:34:56Z",
  zameranieProjektu: "Dopytovo-orientovaný projekt",
};

function makeProject(overrides: Partial<ItmsProject> = {}): ItmsProject {
  const [project] = parseItmsProjectCollection([ITMS_RECORD], "ukoncene");
  return { ...project, ...overrides };
}

function makeRegistration(
  overrides: Partial<RpvsPartnerRegistration> = {}
): RpvsPartnerRegistration {
  return {
    registrationId: 72533,
    partnerId: 18145,
    partnerFileNumber: 17818,
    ico: "37886436",
    name: "Nemocnica Dr. Vojtecha Alexandra v Kežmarku n.o.",
    validFrom: "2017-08-03",
    validTo: null,
    sourceUrl: "https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/18145",
    apiSourceUrl: buildRpvsPartnerRegistrationsUrl("37886436"),
    ...overrides,
  };
}

function makeOwner(overrides: Partial<RpvsBeneficialOwner> = {}): RpvsBeneficialOwner {
  return {
    beneficialOwnerId: 72532,
    partnerId: 18145,
    givenName: "Ján",
    familyName: "Ferenčák",
    birthDate: "1974-06-30",
    isPublicOfficial: true,
    validFrom: "2017-08-03",
    validTo: null,
    sourceUrl: buildRpvsBeneficialOwnersUrl(18145),
    ...overrides,
  };
}

function makePolitician(
  overrides: Partial<VerifiedPoliticianIdentity> = {}
): VerifiedPoliticianIdentity {
  return {
    politicianId: 25,
    givenName: "Ján",
    familyName: "Ferenčák",
    birthDate: "1974-06-30",
    sourceUrl: "https://www.nrsr.sk/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=1008",
    ...overrides,
  };
}

describe("parseItmsProjectCollection", () => {
  it("preserves the official project, recipient and contracted-amount fields", () => {
    const [project] = parseItmsProjectCollection([ITMS_RECORD], "ukoncene");

    expect(project).toEqual({
      sourceSystem: "itms2014+",
      sourceCollection: "ukoncene",
      sourceState: "ukoncene",
      sourceRecordId: "2135",
      externalId: 2135,
      code: "302021M143",
      name: "Modernizácia nemocnice",
      contractNumber: "Z302021M143",
      contractValidDate: "2018-01-30",
      contractEffectiveDate: "2018-01-31",
      associationDate: "2018-01-31",
      associationDateBasis: "contract_effective_date",
      contractedAmount: 3_816_081.57,
      recipientSubjectId: 110233,
      recipientIco: "37886436",
      recipientForeignIdentifier: null,
      recipientSourceUrl: "https://opendata.itms2014.sk/v2/subjekty/110233",
      status: "Projekt riadne ukončený (K)",
      focus: "Dopytovo-orientovaný projekt",
      sourceUrl: "https://opendata.itms2014.sk/v2/projekty/ukoncene/2135",
      createdAt: "2017-12-20T08:00:00Z",
      updatedAt: "2023-04-01T12:34:56Z",
    });
  });

  it("uses contract validity only as an explicit fallback date", () => {
    const record = { ...ITMS_RECORD, datumUcinnostiZmluvy: null };
    const [project] = parseItmsProjectCollection([record], "ukoncene");

    expect(project.associationDate).toBe("2018-01-30");
    expect(project.associationDateBasis).toBe("contract_valid_date");
  });

  it("keeps foreign recipients but leaves them ineligible for an IČO join", () => {
    const record = {
      ...ITMS_RECORD,
      prijimatel: {
        subjekt: {
          href: "/v2/subjekty/999",
          id: 999,
          ineIdentifikacneCislo: "CZ-ABC-42",
        },
      },
    };
    const [project] = parseItmsProjectCollection([record], "ukoncene");

    expect(project.recipientIco).toBeNull();
    expect(project.recipientForeignIdentifier).toBe("CZ-ABC-42");
  });

  it("rejects a partial/malformed collection instead of silently importing it", () => {
    expect(() =>
      parseItmsProjectCollection([{ ...ITMS_RECORD, sumaZazmluvnena: "3816081.57" }], "ukoncene")
    ).toThrow("sumaZazmluvnena must be a non-negative finite number");
    expect(() => parseItmsProjectCollection({ value: [] }, "ukoncene")).toThrow(
      "response must be an array"
    );
  });
});

describe("official identifier and endpoint helpers", () => {
  it("normalizes only plausible exact Slovak IČO values", () => {
    expect(normalizeSlovakIco("37 886 436")).toBe("37886436");
    expect(normalizeSlovakIco("586846")).toBe("00586846");
    expect(normalizeSlovakIco("IČO 37886436")).toBeNull();
    expect(normalizeSlovakIco("12345")).toBeNull();
  });

  it("normalizes full dates without a time-zone shift", () => {
    expect(normalizeSourceDate("2017-08-03T00:00:00+02:00")).toBe("2017-08-03");
    expect(normalizeSourceDate("30.06.1974")).toBe("1974-06-30");
    expect(normalizeSourceDate("1974")).toBeNull();
    expect(normalizeSourceDate("2024-02-30T00:00:00Z")).toBeNull();
  });

  it("builds constrained RPVS OData filters with Partner expansion", () => {
    const pvs = new URL(buildRpvsPartnerRegistrationsUrl("37886436"));
    expect(pvs.origin + pvs.pathname).toBe(
      "https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora"
    );
    expect(pvs.searchParams.get("$filter")).toBe("Ico eq '37886436'");
    expect(pvs.searchParams.get("$expand")).toBe("Partner");

    const kuv = new URL(buildRpvsBeneficialOwnersUrl(18145));
    expect(kuv.origin + kuv.pathname).toBe(
      "https://rpvs.gov.sk/opendatav2/KonecniUzivateliaVyhod"
    );
    expect(kuv.searchParams.get("$filter")).toBe("Partner/Id eq 18145");
    expect(kuv.searchParams.get("$expand")).toBe("Partner");
  });
});

describe("RPVS historical parsers", () => {
  it("retains multiple historical PVS rows for the same IČO", () => {
    const rows = parseRpvsPartnerRegistrations({
      value: [
        {
          Id: 27881,
          Ico: "31639607",
          ObchodneMeno: "TEMPRA, s.r.o.",
          PlatnostOd: "2017-02-01T00:00:00+01:00",
          PlatnostDo: "2020-04-23T23:59:59.9+02:00",
          Partner: { Id: 10133, CisloVlozky: 10133 },
        },
        {
          Id: 153984,
          Ico: "31639607",
          ObchodneMeno: "TEMPRA, s.r.o.",
          PlatnostOd: "2020-04-24T00:00:00+02:00",
          PlatnostDo: null,
          Partner: { Id: 10133, CisloVlozky: 10133 },
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.registrationId, row.validFrom, row.validTo])).toEqual([
      [27881, "2017-02-01", "2020-04-23"],
      [153984, "2020-04-24", null],
    ]);
  });

  it("retains full DOB, public-official flag, Partner ID and validity on KUV rows", () => {
    const [owner] = parseRpvsBeneficialOwners({
      value: [
        {
          Id: 72532,
          Meno: "Ján",
          Priezvisko: "Ferenčák",
          DatumNarodenia: "1974-06-30T00:00:00+02:00",
          JeVerejnyCinitel: true,
          PlatnostOd: "2017-08-03T00:00:00+02:00",
          PlatnostDo: null,
          Partner: { Id: 18145, CisloVlozky: 17818 },
        },
      ],
    });

    expect(owner).toMatchObject({
      beneficialOwnerId: 72532,
      partnerId: 18145,
      givenName: "Ján",
      familyName: "Ferenčák",
      birthDate: "1974-06-30",
      isPublicOfficial: true,
      validFrom: "2017-08-03",
      validTo: null,
    });
  });
});

describe("resolveItmsRpvsPoliticianLinks", () => {
  it("verifies the complete exact-IČO, temporal, exact-name and full-DOB path", () => {
    const result = resolveItmsRpvsPoliticianLinks({
      projects: [makeProject()],
      registrations: [makeRegistration()],
      beneficialOwners: [makeOwner()],
      politicians: [makePolitician()],
    });

    expect(result.ambiguousIdentities).toEqual([]);
    expect(result.verifiedLinks).toHaveLength(1);
    expect(result.verifiedLinks[0]).toMatchObject({
      pathType: "itms_recipient_rpvs_beneficial_owner",
      projectExternalId: 2135,
      recipientIco: "37886436",
      eventDate: "2018-01-31",
      eventDateBasis: "contract_effective_date",
      rpvsRegistrationId: 72533,
      rpvsPartnerId: 18145,
      rpvsBeneficialOwnerId: 72532,
      politicianId: 25,
    });
  });

  it("rejects known same-name false positives when the full DOB differs", () => {
    const sameNameFalsePositives = [
      {
        owner: makeOwner({
          beneficialOwnerId: 1,
          givenName: "Milan",
          familyName: "Garaj",
          birthDate: "1952-10-02",
        }),
        politician: makePolitician({
          politicianId: 29,
          givenName: "Milan",
          familyName: "Garaj",
          birthDate: "1979-09-09",
        }),
      },
      {
        owner: makeOwner({
          beneficialOwnerId: 2,
          givenName: "Andrea",
          familyName: "Turčanová",
          birthDate: "1966-02-26",
        }),
        politician: makePolitician({
          politicianId: 139,
          givenName: "Andrea",
          familyName: "Turčanová",
          birthDate: "1966-12-26",
        }),
      },
    ];

    for (const fixture of sameNameFalsePositives) {
      const result = resolveItmsRpvsPoliticianLinks({
        projects: [makeProject()],
        registrations: [makeRegistration()],
        beneficialOwners: [fixture.owner],
        politicians: [fixture.politician],
      });
      expect(result.verifiedLinks).toEqual([]);
    }
  });

  it("rejects name-only, birth-year-only and missing-DOB identities", () => {
    for (const birthDate of [null, "1974"] as const) {
      const result = resolveItmsRpvsPoliticianLinks({
        projects: [makeProject()],
        registrations: [makeRegistration()],
        beneficialOwners: [makeOwner()],
        politicians: [makePolitician({ birthDate })],
      });
      expect(result.verifiedLinks).toEqual([]);
    }

    const missingKuvDob = resolveItmsRpvsPoliticianLinks({
      projects: [makeProject()],
      registrations: [makeRegistration()],
      beneficialOwners: [makeOwner({ birthDate: null })],
      politicians: [makePolitician()],
    });
    expect(missingKuvDob.verifiedLinks).toEqual([]);
  });

  it("requires the event date inside both PVS and KUV intervals, inclusively", () => {
    const boundaryProject = makeProject({
      associationDate: "2020-04-23",
      associationDateBasis: "contract_effective_date",
    });
    const onBoundary = resolveItmsRpvsPoliticianLinks({
      projects: [boundaryProject],
      registrations: [makeRegistration({ validTo: "2020-04-23" })],
      beneficialOwners: [makeOwner({ validTo: "2020-04-23" })],
      politicians: [makePolitician()],
    });
    expect(onBoundary.verifiedLinks).toHaveLength(1);

    const afterKuv = resolveItmsRpvsPoliticianLinks({
      projects: [{ ...boundaryProject, associationDate: "2020-04-24" }],
      registrations: [makeRegistration({ validTo: null })],
      beneficialOwners: [makeOwner({ validTo: "2020-04-23" })],
      politicians: [makePolitician()],
    });
    expect(afterKuv.verifiedLinks).toEqual([]);
  });

  it("quarantines duplicate exact politician identities as ambiguous", () => {
    const result = resolveItmsRpvsPoliticianLinks({
      projects: [makeProject()],
      registrations: [makeRegistration()],
      beneficialOwners: [makeOwner()],
      politicians: [
        makePolitician({ politicianId: 25 }),
        makePolitician({ politicianId: 999 }),
      ],
    });

    expect(result.verifiedLinks).toEqual([]);
    expect(result.ambiguousIdentities).toEqual([
      {
        reason: "duplicate_exact_name_and_birth_date",
        projectExternalId: 2135,
        rpvsRegistrationId: 72533,
        rpvsBeneficialOwnerId: 72532,
        candidatePoliticianIds: [25, 999],
      },
    ]);
  });

  it("does not create a political link for the TEMPRA contract-like recipient fixture", () => {
    const tempraProject = makeProject({
      recipientIco: "31639607",
      associationDate: "2024-12-20",
      associationDateBasis: "contract_effective_date",
    });
    const tempraRegistration = makeRegistration({
      registrationId: 153984,
      partnerId: 10133,
      ico: "31639607",
      validFrom: "2020-04-24",
    });
    const tempraOwners = [
      makeOwner({
        beneficialOwnerId: 1,
        partnerId: 10133,
        givenName: "Aleš",
        familyName: "Zeman",
        birthDate: "1955-05-28",
        validFrom: "2020-04-24",
      }),
      makeOwner({
        beneficialOwnerId: 2,
        partnerId: 10133,
        givenName: "Marek",
        familyName: "Unčovský",
        birthDate: "1972-03-14",
        validFrom: "2020-04-24",
      }),
    ];

    const result = resolveItmsRpvsPoliticianLinks({
      projects: [tempraProject],
      registrations: [tempraRegistration],
      beneficialOwners: tempraOwners,
      politicians: [makePolitician()],
    });
    expect(result.verifiedLinks).toEqual([]);
  });
});

describe("fetchAllItmsProjects", () => {
  it("fetches only the two official collections and parses both atomically", async () => {
    const requested: string[] = [];
    const fetcher = async (url: string) => {
      requested.push(url);
      const collection = url.includes("/vrealizacii?") ? "vrealizacii" : "ukoncene";
      return [{ ...ITMS_RECORD, id: collection === "vrealizacii" ? 99 : 2135 }];
    };

    const projects = await fetchAllItmsProjects(fetcher);

    expect(requested.sort()).toEqual([
      "https://opendata.itms2014.sk/v2/projekty/ukoncene?limit=1000000",
      "https://opendata.itms2014.sk/v2/projekty/vrealizacii?limit=1000000",
    ]);
    expect(projects.map((project) => project.sourceCollection)).toEqual([
      "vrealizacii",
      "ukoncene",
    ]);
  });

  it("deduplicates a project transition by stable source ID and keeps ukoncene", async () => {
    const fetcher = async (url: string) => [
      {
        ...ITMS_RECORD,
        id: 2135,
        stav: url.includes("/ukoncene?") ? "Projekt ukončený" : "Projekt v realizácii",
      },
    ];

    const projects = await fetchAllItmsProjects(fetcher);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      sourceRecordId: "2135",
      sourceState: "ukoncene",
      status: "Projekt ukončený",
    });
  });
});

describe("RPVS OData fetching", () => {
  it("follows every same-collection nextLink before parsing KUV rows", async () => {
    const firstUrl = buildRpvsBeneficialOwnersUrl(18145);
    const nextUrl =
      "https://rpvs.gov.sk/opendatav2/KonecniUzivateliaVyhod?$skiptoken=Id-72532";
    const requested: string[] = [];
    const fetcher = async (url: string) => {
      requested.push(url);
      if (url === firstUrl) {
        return {
          value: [
            {
              Id: 72532,
              Meno: "Ján",
              Priezvisko: "Ferenčák",
              DatumNarodenia: "1974-06-30T00:00:00+02:00",
              JeVerejnyCinitel: true,
              PlatnostOd: "2017-08-03T00:00:00+02:00",
              PlatnostDo: "2020-01-01T23:59:59+01:00",
              Partner: { Id: 18145 },
            },
          ],
          "@odata.nextLink": nextUrl,
        };
      }
      return {
        value: [
          {
            Id: 127776,
            Meno: "Ján",
            Priezvisko: "Ferenčák",
            DatumNarodenia: "1974-06-30T00:00:00+02:00",
            JeVerejnyCinitel: true,
            PlatnostOd: "2020-01-02T00:00:00+01:00",
            PlatnostDo: null,
            Partner: { Id: 18145 },
          },
        ],
      };
    };

    const rows = await fetchRpvsBeneficialOwners(18145, fetcher);

    expect(requested).toEqual([firstUrl, nextUrl]);
    expect(rows.map((row) => row.beneficialOwnerId)).toEqual([72532, 127776]);
  });

  it("rejects a nextLink that leaves the official RPVS collection", async () => {
    const fetcher = async () => ({
      value: [],
      "@odata.nextLink": "https://example.com/opendatav2/KonecniUzivateliaVyhod?$skip=20",
    });

    await expect(fetchRpvsBeneficialOwners(18145, fetcher)).rejects.toThrow(
      "Unsafe RPVS OData nextLink"
    );
  });
});
