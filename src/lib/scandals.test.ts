import { describe, expect, it } from "vitest";
import { getActiveCourtKauzy, getKauzaStats, mapScandalToKauza } from "./scandals";
import type { ScandalForUi } from "./scandals";

const baseScandal: ScandalForUi = {
  id: 1,
  slug: "test-kauza",
  titleSk: "Testovacia kauza verejného obstarávania",
  summarySk:
    "Podľa verejných zdrojov ide o preverovanú kauzu verejného obstarávania. Záznam rozlišuje podozrenie a procesný stav.",
  startDate: "2024-01-15",
  endDate: null,
  status: "vysetruje_sa",
  category: "klientelizmus",
  institutionInvestigating: "ÚVO",
  verdictUrl: null,
  severity: 3,
  isEditorialOpinion: false,
  actors: [
    {
      mpId: 10,
      nameDisplay: "Jana Testová",
      nameFull: "Jana Testová",
      slug: "jana-testova",
      role: "poslanec",
      roleInScandal: "verejne_spomenuty",
      partyAbbr: "TEST",
    },
  ],
  sources: [
    {
      id: 100,
      url: "https://example.com/kauza",
      outletName: "Example",
      publishedDate: "2024-01-15",
      isPrimary: true,
    },
    {
      id: 101,
      url: "https://example.org/archive",
      outletName: "Archive",
      publishedDate: "2024-01-16",
      isPrimary: false,
    },
  ],
};

describe("scandal UI mapping", () => {
  it("maps a database scandal into the Kauzy client shape", () => {
    const kauza = mapScandalToKauza(baseScandal);

    expect(kauza.id).toBe("test-kauza");
    expect(kauza.status).toBe("vysetruje_sa");
    expect(kauza.category).toBe("klientelizmus");
    expect(kauza.actors[0]).toMatchObject({
      name: "Jana Testová",
      slug: "jana-testova",
      party: "TEST",
    });
    expect(kauza.sources).toHaveLength(2);
    expect(kauza.connections.some((connection) => connection.target === "ÚVO")).toBe(true);
    expect(kauza.claims[0]).toMatchObject({
      subjectName: "Jana Testová",
      responsibilityKind: "verejne uvádzané tvrdenie",
    });
  });

  it("maps structured claims and attaches their source links", () => {
    const kauza = mapScandalToKauza({
      ...baseScandal,
      claims: [
        {
          id: 20,
          mpId: 10,
          targetLabel: "Jana Testová",
          claimKind: "obžaloba",
          processStatus: "podozrenie",
          responsibilityKind: "procesná zodpovednosť",
          statementSk: "Podľa zdroja mala figurovať v rozhodnutí úradu.",
          counterpointSk: "Rozhodnutie nie je verdikt aplikácie.",
          sortOrder: 1,
          sourceIds: [101],
        },
      ],
    });

    expect(kauza.claims).toHaveLength(1);
    expect(kauza.claims[0]).toMatchObject({
      subjectName: "Jana Testová",
      statement: "Podľa zdroja mala figurovať v rozhodnutí úradu.",
      processStatus: "podozrenie",
      responsibilityKind: "procesná zodpovednosť",
      counterpoint: "Rozhodnutie nie je verdikt aplikácie.",
    });
    expect(kauza.claims[0].sources).toEqual([
      expect.objectContaining({ outlet: "Archive", url: "https://example.org/archive" }),
    ]);
  });

  it("uses fallback claims only when structured claims are missing", () => {
    const structured = mapScandalToKauza({
      ...baseScandal,
      claims: [
        {
          id: 21,
          mpId: 10,
          targetLabel: "Jana Testová",
          claimKind: "rozhodnutie",
          processStatus: "zastavené",
          responsibilityKind: "procesný výsledok",
          statementSk: "Štruktúrované tvrdenie má prednosť.",
          counterpointSk: null,
          sortOrder: 0,
          sourceIds: [],
        },
      ],
    });

    expect(structured.claims).toHaveLength(1);
    expect(structured.claims[0].statement).toBe("Štruktúrované tvrdenie má prednosť.");
    expect(structured.claims[0].statement).not.toContain("Podľa priložených zdrojov");
  });

  it("removes imported scraper body text from generated summaries", () => {
    const kauza = mapScandalToKauza({
      ...baseScandal,
      titleSk: "Rušenie NAKA je viac politický ako profesionálny krok",
      summarySk:
        "Verejne zdokumentovaná kauza z kurátorovaného archívu Nadácie Zastavme korupciu: Rušenie NAKA je viac politický ako profesionálny krok. Z dostupného textu: Rušenie NAKA je viac politický ako profesionálny krok Zavrieť Deje sa toho veľa. Ľubomír Daňko 07.08.2024 Kauzy, Nezaradené. Verejne rozpoznané prepojenia na politikov v databáze: Andrej Danko, Tibor Gašpar. Záznam nepredstavuje vlastný právny záver aplikácie.",
    });

    expect(kauza.summary).not.toContain("Z dostupného textu");
    expect(kauza.summary).not.toContain("Zavrieť");
    expect(kauza.summary).not.toContain("Kauzy, Nezaradené");
    expect(kauza.summary).toContain("archívu Nadácie Zastavme korupciu");
    expect(kauza.summary).toContain("Andrej Danko, Tibor Gašpar");
  });

  it("uses neutral case names instead of imported article headlines", () => {
    const kauza = mapScandalToKauza({
      ...baseScandal,
      slug: "zk-na-simeckovu-mali-u-daniarov-spis-smotanka-nasli-aj-prevody-s-lidrom-ps",
      titleSk: "Šimečkovú zrejme lustrovali nezákonne. Daniari na ňu mali spis Smotánka",
    });

    expect(kauza.title).toBe("Spis Smotánka u daniarov");
    expect(kauza.shortTitle).toBe("Spis Smotánka u daniarov");
  });

  it("falls back to the named kauza when a new source headline contains one", () => {
    const kauza = mapScandalToKauza({
      ...baseScandal,
      slug: "nova-kauza",
      titleSk: "Polícia preveruje nové zistenia v kauze Testovanie: ďalší vývoj",
    });

    expect(kauza.title).toBe("Kauza Testovanie");
  });

  it("computes active and aggregate stats from mapped scandals", () => {
    const active = mapScandalToKauza(baseScandal);
    const closed = mapScandalToKauza({
      ...baseScandal,
      id: 2,
      slug: "uzavreta-kauza",
      status: "zastavene",
      actors: [],
    });

    expect(getActiveCourtKauzy([closed, active]).map((kauza) => kauza.id)).toEqual([
      "test-kauza",
    ]);
    expect(getKauzaStats([closed, active])).toMatchObject({
      total: 2,
      activeCourt: 1,
      sources: 4,
    });
  });
});
