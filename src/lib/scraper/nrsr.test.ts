import { describe, it, expect } from "vitest";
import {
  makeSlug,
  mapTopicCategory,
  mapResult,
  mapChoice,
  parseMpList,
  parseVoteIds,
  parseVoteDetail,
  parseSpeechesList,
  scrapeMps,
  scrapeRecentVotes,
  scrapeRecentSpeeches,
  scrapeMpSpeeches,
  parseRetryAfterMs,
} from "./nrsr";

// ─── makeSlug ─────────────────────────────────────────────

describe("makeSlug", () => {
  it("converts Slovak chars", () => {
    expect(makeSlug("Róbert Fico")).toBe("robert-fico");
    expect(makeSlug("Michal Šimečka")).toBe("michal-simecka");
    expect(makeSlug("Ľudovít Ódor")).toBe("ludovit-odor");
  });

  it("lowercases and collapses spaces", () => {
    expect(makeSlug("Jana  Žitňanská")).toBe("jana-zitnanska");
  });

  it("trims leading/trailing dashes", () => {
    expect(makeSlug("  Fico  ")).toBe("fico");
  });
});

describe("scrapeMpSpeeches fetcher injection", () => {
  it("returns only speeches for the requested MP", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      return SPEECHES_HTML;
    };

    const result = await scrapeMpSpeeches("802", 9, 10, fetcher);

    expect(calls[0]).toContain("PoslanecID=802");
    expect(result).toHaveLength(1);
    expect(result[0].nrsrPersonId).toBe("802");
    expect(result[0].nrsrSpeechId).toBe("9002");
  });

  it("returns empty on network error", async () => {
    const fetcher = async (): Promise<string> => {
      throw new Error("network error");
    };
    const result = await scrapeMpSpeeches("802", 9, 10, fetcher);
    expect(result).toEqual([]);
  });
});

// ─── mapTopicCategory ─────────────────────────────────────

describe("mapTopicCategory", () => {
  it("maps zákon", () => {
    expect(mapTopicCategory("Novela zákona o zdravotníctve")).toBe("zákon");
  });

  it("maps rozpočet", () => {
    expect(mapTopicCategory("Schválenie štátneho rozpočtu")).toBe("rozpočet");
  });

  it("maps personálne via voľba", () => {
    expect(mapTopicCategory("Voľba predsedu NR SR")).toBe("personálne");
  });

  it("defaults to iné", () => {
    expect(mapTopicCategory("Procedurálny návrh")).toBe("iné");
  });
});

// ─── mapResult ────────────────────────────────────────────

describe("mapResult", () => {
  it("maps schválené", () => {
    expect(mapResult("Schválené")).toBe("schválené");
    expect(mapResult("Návrh bol prijatý")).toBe("schválené");
  });

  it("maps zamietnuté", () => {
    expect(mapResult("Zamietnutý")).toBe("zamietnuté");
    expect(mapResult("Neprijatý")).toBe("zamietnuté");
  });

  it("maps odročené", () => {
    expect(mapResult("Odročené")).toBe("odročené");
  });

  it("defaults to neznámy for unknown", () => {
    expect(mapResult("")).toBe("neznámy");
  });
});

// ─── mapChoice ────────────────────────────────────────────

describe("mapChoice", () => {
  it("maps Z → za", () => expect(mapChoice("Z")).toBe("za"));
  it("maps P → proti", () => expect(mapChoice("P")).toBe("proti"));
  it("maps N → zdržal_sa", () => expect(mapChoice("N")).toBe("zdržal_sa"));
  it("maps B → neprítomný", () => expect(mapChoice("B")).toBe("neprítomný"));
  it("maps ? → nehlasoval", () => expect(mapChoice("?")).toBe("nehlasoval"));
  it("maps unknown → nehlasoval", () => expect(mapChoice("X")).toBe("nehlasoval"));
  it("handles lowercase z", () => expect(mapChoice("z")).toBe("za"));
});

describe("parseRetryAfterMs", () => {
  it("parses seconds", () => {
    expect(parseRetryAfterMs("120", 1_000)).toBe(120_000);
  });

  it("parses HTTP date", () => {
    expect(
      parseRetryAfterMs(
        "Tue, 19 May 2026 10:05:00 GMT",
        Date.parse("Tue, 19 May 2026 10:00:00 GMT")
      )
    ).toBe(300_000);
  });

  it("returns null for invalid values", () => {
    expect(parseRetryAfterMs("later", 1_000)).toBeNull();
  });
});

// ─── parseMpList ──────────────────────────────────────────

const MP_LIST_HTML = `
<html><body>
<table>
  <tr><th>Meno</th><th>Klub</th><th>Kraj</th></tr>
  <tr>
    <td><a href="/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=791">Fico Robert</a></td>
    <td>SMER</td>
    <td>Bratislavský kraj</td>
  </tr>
  <tr>
    <td><a href="/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=802">Šimečka Michal</a></td>
    <td>PS</td>
    <td>Trnavský kraj</td>
  </tr>
  <tr>
    <td><a href="/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=803">Danko Andrej</a></td>
    <td>SNS</td>
    <td>Nitrianský kraj</td>
  </tr>
</table>
</body></html>
`;

describe("parseMpList", () => {
  it("parses MP names and IDs", () => {
    const result = parseMpList(MP_LIST_HTML);
    expect(result.length).toBeGreaterThanOrEqual(3);

    const fico = result.find((m) => m.nrsrPersonId === "791");
    expect(fico).toBeDefined();
    expect(fico!.nameFull).toBe("Fico Robert");
    expect(fico!.nrsrPersonId).toBe("791");
    expect(fico!.role).toBe("poslanec");
  });

  it("generates slug from nameDisplay", () => {
    const result = parseMpList(MP_LIST_HTML);
    const simecka = result.find((m) => m.nrsrPersonId === "802");
    expect(simecka).toBeDefined();
    // nameDisplay rearranged: "Michal Šimečka" → slug "michal-simecka"
    expect(simecka!.slug).toMatch(/simecka/);
  });

  it("extracts party abbreviation", () => {
    const result = parseMpList(MP_LIST_HTML);
    const fico = result.find((m) => m.nrsrPersonId === "791");
    expect(fico!.partyAbbr).toBe("SMER");
  });

  it("parses current alphabetical NRSR link list layout", () => {
    const html = `
      <ul>
        <li><a href="Default.aspx?sid=poslanci/poslanec&PoslanecID=1180&CisObdobia=9">Bajo Holečková, Martina</a></li>
        <li><a href="Default.aspx?sid=poslanci/poslanec&PoslanecID=871&CisObdobia=9">Baláž, Vladimír</a></li>
      </ul>
    `;
    const result = parseMpList(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      nrsrPersonId: "1180",
      nameDisplay: "Martina Bajo Holečková",
      slug: "martina-bajo-holeckova",
      partyAbbr: null,
    });
  });

  it("returns empty array for empty HTML", () => {
    expect(parseMpList("<html><body></body></html>")).toEqual([]);
  });
});

// ─── parseVoteIds ─────────────────────────────────────────

const VOTE_LIST_HTML = `
<html><body>
<table>
  <tr>
    <td><a href="/web/Default.aspx?sid=schodze/hlasovanie/hlasovanie&ID=51234">Hlasovanie 1</a></td>
  </tr>
  <tr>
    <td><a href="/web/Default.aspx?sid=schodze/hlasovanie/hlasovanie&ID=51235">Hlasovanie 2</a></td>
  </tr>
  <tr>
    <td><a href="/web/Default.aspx?sid=schodze/hlasovanie/hlasovanie&ID=51236">Hlasovanie 3</a></td>
  </tr>
</table>
</body></html>
`;

describe("parseVoteIds", () => {
  it("extracts vote IDs", () => {
    const ids = parseVoteIds(VOTE_LIST_HTML, 10);
    expect(ids).toContain("51234");
    expect(ids).toContain("51235");
    expect(ids).toContain("51236");
  });

  it("respects limit", () => {
    const ids = parseVoteIds(VOTE_LIST_HTML, 2);
    expect(ids.length).toBe(2);
  });

  it("deduplicates IDs", () => {
    const html = `
      <a href="/web/Default.aspx?sid=schodze/hlasovanie/hlasovanie&ID=100">A</a>
      <a href="/web/Default.aspx?sid=schodze/hlasovanie/hlasovanie&ID=100">B</a>
      <a href="/web/Default.aspx?sid=schodze/hlasovanie/hlasovanie&ID=101">C</a>
    `;
    const ids = parseVoteIds(html, 10);
    expect(ids.filter((id) => id === "100").length).toBe(1);
  });
});

// ─── parseVoteDetail ─────────────────────────────────────

const VOTE_DETAIL_HTML = `
<html><body>
<h1>Hlasovanie o návrhu zákona o daniach</h1>
<p>Dátum: 15. 3. 2025</p>
<p>Výsledok: Schválené</p>
<p>Za: 76  Proti: 40  Zdržal: 10  Neprítomní: 24</p>
<table>
  <tr>
    <td><a href="/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=791">Fico Robert</a></td>
    <td>Z</td>
  </tr>
  <tr>
    <td><a href="/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=802">Šimečka Michal</a></td>
    <td>P</td>
  </tr>
  <tr>
    <td><a href="/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=803">Danko Andrej</a></td>
    <td>N</td>
  </tr>
</table>
</body></html>
`;

describe("parseVoteDetail", () => {
  const sourceUrl = "https://www.nrsr.sk/web/Default.aspx?sid=schodze/hlasovanie/hlasovanie&ID=51234";

  it("parses vote metadata", () => {
    const { vote } = parseVoteDetail(VOTE_DETAIL_HTML, "51234", sourceUrl);
    expect(vote).not.toBeNull();
    expect(vote!.nrsrVoteId).toBe("51234");
    expect(vote!.titleSk).toContain("zákon");
    expect(vote!.topicCategory).toBe("zákon");
    expect(vote!.result).toBe("schválené");
    expect(vote!.date).toBe("2025-03-15");
    expect(vote!.sourceUrl).toBe(sourceUrl);
  });

  it("parses vote counts", () => {
    const { vote } = parseVoteDetail(VOTE_DETAIL_HTML, "51234", sourceUrl);
    expect(vote!.votesFor).toBe(76);
    expect(vote!.votesAgainst).toBe(40);
    expect(vote!.votesAbstain).toBe(10);
  });

  it("parses per-MP records with correct choice mapping", () => {
    const { records } = parseVoteDetail(VOTE_DETAIL_HTML, "51234", sourceUrl);
    expect(records.length).toBeGreaterThanOrEqual(3);

    const ficoRecord = records.find((r) => r.nrsrPersonId === "791");
    expect(ficoRecord!.choice).toBe("za");

    const simeckaRecord = records.find((r) => r.nrsrPersonId === "802");
    expect(simeckaRecord!.choice).toBe("proti");

    const dankoRecord = records.find((r) => r.nrsrPersonId === "803");
    expect(dankoRecord!.choice).toBe("zdržal_sa");
  });

  it("parses current grouped NRSR vote detail layout", () => {
    const html = `
      <body>
        <h1>Hlasovanie</h1>
        <p>Dátum a čas 7. 5. 2026 11:30</p>
        <p>Názov hlasovania Hlasovanie o procedurálnom návrhu predsedu NR SR R. Rašiho. Výsledok hlasovania Návrh prešiel Prítomní 129</p>
        <p>[Z] Za hlasovalo 78 [P] Proti hlasovalo 51 [?] Zdržalo sa hlasovania 0 [N] Nehlasovalo 0 [0] Neprítomní 21</p>
        <table class="hpo_result_table">
          <tr><td>Za</td></tr>
          <tr>
            <td><a href="Default.aspx?sid=poslanci/poslanec&PoslanecID=871&CisObdobia=9">Baláž, Vladimír</a></td>
            <td><a href="Default.aspx?sid=poslanci/poslanec&PoslanecID=1207&CisObdobia=9">Bartek, Michal</a></td>
          </tr>
          <tr><td>Proti</td></tr>
          <tr><td><a href="Default.aspx?sid=poslanci/poslanec&PoslanecID=1114&CisObdobia=9">Šimečka, Michal</a></td></tr>
          <tr><td>Neprítomní</td></tr>
          <tr><td><a href="Default.aspx?sid=poslanci/poslanec&PoslanecID=1115&CisObdobia=9">Truban, Michal</a></td></tr>
        </table>
      </body>
    `;
    const { vote, records } = parseVoteDetail(html, "57960", sourceUrl);
    expect(vote!.votesFor).toBe(78);
    expect(vote!.votesAgainst).toBe(51);
    expect(vote!.votesAbsent).toBe(21);
    expect(vote!.result).toBe("schválené");
    expect(vote!.titleSk).toContain("procedurálnom návrhu");
    expect(records).toEqual([
      { nrsrVoteId: "57960", nrsrPersonId: "871", choice: "za" },
      { nrsrVoteId: "57960", nrsrPersonId: "1207", choice: "za" },
      { nrsrVoteId: "57960", nrsrPersonId: "1114", choice: "proti" },
      { nrsrVoteId: "57960", nrsrPersonId: "1115", choice: "neprítomný" },
    ]);
  });

  it("all records have correct nrsrVoteId", () => {
    const { records } = parseVoteDetail(VOTE_DETAIL_HTML, "51234", sourceUrl);
    for (const r of records) {
      expect(r.nrsrVoteId).toBe("51234");
    }
  });
});

// ─── parseSpeechesList ────────────────────────────────────

const SPEECHES_HTML = `
<html><body>
<table>
  <tr><th>Dátum</th><th>Poslanec</th><th>Prepis</th></tr>
  <tr>
    <td>15. 3. 2025</td>
    <td><a href="/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=791">Fico Robert</a></td>
    <td><a href="/web/Default.aspx?sid=schodze/stenozaznamy&ID=9001">Prejav o bezpečnosti krajiny a zahraničnej politike vlády</a></td>
  </tr>
  <tr>
    <td>16. 3. 2025</td>
    <td><a href="/web/Default.aspx?sid=poslanci/poslanec&PoslanecID=802">Šimečka Michal</a></td>
    <td><a href="/web/Default.aspx?sid=schodze/stenozaznamy&ID=9002">Opozičný príspevok k návrhu zákona</a></td>
  </tr>
</table>
</body></html>
`;

describe("parseSpeechesList", () => {
  it("parses speeches with nrsrPersonId", () => {
    const result = parseSpeechesList(SPEECHES_HTML, 10);
    expect(result.length).toBeGreaterThanOrEqual(2);

    const ficoSpeech = result.find((s) => s.nrsrPersonId === "791");
    expect(ficoSpeech).toBeDefined();
    expect(ficoSpeech!.nrsrSpeechId).toBe("9001");
    expect(ficoSpeech!.date).toBe("2025-03-15");
  });

  it("extracts speech text", () => {
    const result = parseSpeechesList(SPEECHES_HTML, 10);
    const ficoSpeech = result.find((s) => s.nrsrPersonId === "791");
    expect(ficoSpeech!.textSk).toBeTruthy();
  });

  it("respects limit", () => {
    const result = parseSpeechesList(SPEECHES_HTML, 1);
    expect(result.length).toBe(1);
  });

  it("deduplicates by nrsrSpeechId", () => {
    const result = parseSpeechesList(SPEECHES_HTML, 10);
    const ids = result.map((s) => s.nrsrSpeechId);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });
});

// ─── Fetcher injection (graceful error handling) ──────────

describe("scrapeMps — fetcher injection", () => {
  it("returns parsed MPs from mock fetcher", async () => {
    const fetcher = async () => MP_LIST_HTML;
    const result = await scrapeMps(fetcher);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("falls back when the first NRSR list endpoint times out", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string): Promise<string> => {
      calls.push(url);
      if (url.includes("zoznam_abc")) throw new DOMException("timeout", "TimeoutError");
      return MP_LIST_HTML;
    };

    const result = await scrapeMps(fetcher);
    expect(calls[0]).toContain("zoznam_abc");
    expect(calls[1]).toContain("zoznam_adv");
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("returns empty array on network error", async () => {
    const fetcher = async (): Promise<string> => {
      throw new Error("network error");
    };
    const result = await scrapeMps(fetcher);
    expect(result).toEqual([]);
  });
});

describe("scrapeRecentVotes — fetcher injection", () => {
  it("returns votes and records from mock fetcher", async () => {
    const fetcher = async (url: string) => {
      if (url.includes("hlasovanie&ID")) return VOTE_DETAIL_HTML;
      return VOTE_LIST_HTML;
    };
    const { votes, records } = await scrapeRecentVotes(3, fetcher);
    expect(votes.length).toBeGreaterThan(0);
    expect(records.length).toBeGreaterThan(0);
  });

  it("returns empty on network error", async () => {
    const fetcher = async (): Promise<string> => {
      throw new Error("network error");
    };
    const { votes, records } = await scrapeRecentVotes(10, fetcher);
    expect(votes).toEqual([]);
    expect(records).toEqual([]);
  });
});

describe("scrapeRecentSpeeches — fetcher injection", () => {
  it("returns speeches from mock fetcher", async () => {
    const fetcher = async () => SPEECHES_HTML;
    const result = await scrapeRecentSpeeches(10, fetcher);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty on network error", async () => {
    const fetcher = async (): Promise<string> => {
      throw new Error("network error");
    };
    const result = await scrapeRecentSpeeches(10, fetcher);
    expect(result).toEqual([]);
  });
});
