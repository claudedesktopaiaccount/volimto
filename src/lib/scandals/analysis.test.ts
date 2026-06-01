import { describe, expect, it } from "vitest";
import { createScandalAnalysisDraft, parseActorClaimsJson } from "./analysis";

describe("scandal analysis drafts", () => {
  it("creates reviewed actor claims only when evidence explains the actor role", () => {
    const draft = createScandalAnalysisDraft({
      scandal: {
        titleSk: "Penzionove dotacie PPA",
        summarySk: "Zakladny opis kauzy.",
        status: "vysetruje_sa",
        institutionInvestigating: "Europska prokuratura",
      },
      actors: [
        { mpId: 1, nameDisplay: "Jana Kontrolna" },
        { mpId: 2, nameDisplay: "Peter IbaSpomenuty" },
      ],
      sources: [
        {
          url: "https://zastavmekorupciu.sk/kauzy/europrokuratura-riesi-pre-penziony-uz-zamestnancov-statnej-ppa/",
          outletName: "Nadacia Zastavme korupciu",
          publishedDate: "2026-05-21",
          isPrimary: true,
        },
      ],
      pageText:
        "Europska prokuratura preveruje postup PPA pri penzionovej dotacii. Jana Kontrolna mala podla zdroja schvalovat spornu dotaciu. Peter IbaSpomenuty bol uvedeny v zozname mien.",
    });

    expect(draft.actorClaims).toHaveLength(1);
    expect(draft.actorClaims[0]).toMatchObject({
      mpId: 1,
      targetLabel: "Jana Kontrolna",
      roleInScandal: "schvalovanie_alebo_rozhodovanie",
    });
  });

  it("rejects publishable claims without trusted source, evidence, or relevance", () => {
    expect(() => parseActorClaimsJson(JSON.stringify([
      {
        mpId: 1,
        targetLabel: "Jana Testova",
        statementSk: "Kratke.",
        whyRelevantSk: "",
        evidenceExcerptSk: "",
        sourceUrl: "https://spravy.stvr.sk/test",
      },
    ]))).toThrow();
  });
});
