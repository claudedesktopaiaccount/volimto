import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SpeechesTab from "./SpeechesTab";
import type { SpeechRow } from "@/lib/db/mps";

describe("SpeechesTab", () => {
  it("renders digest cards instead of raw stenographic dump", () => {
    const rawTitle =
      "5. 5. 2026 17:19:14 - 17:19:47 49. schôdza NR SR - 14.deň - B. popoludní Šimečka, Michal - poslanec NR SR Vystúpenie s procedurálnym návrhom";
    const speech: SpeechRow = {
      id: 1,
      date: "2026-05-05",
      titleSk: rawTitle,
      textSk:
        "Šimečka, Michal - poslanec NR SR Vystúpenie s procedurálnym návrhom Pekne, pán predseda. Ja iba by som bol rád, aby bolo zaprotokolované, že som omylom hlasoval za, hoci som sa chcel zdržať.",
      excerpt:
        "Šimečka, Michal - poslanec NR SR Vystúpenie s procedurálnym návrhom Pekne, pán predseda.",
      sourceUrl: "https://www.nrsr.sk/web/Default.aspx?sid=schodze/rozprava/vyhladavanie",
      cleanTitleSk: "Procedurálna oprava hlasovania",
      speechType: "Procedurálne vystúpenie",
      summarySk: "Poslanec požiadal o zaprotokolovanie opravy hlasovania.",
      keyPointsSk: JSON.stringify(["Oznámil omyl pri hlasovaní.", "Chcel sa zdržať."]),
      summaryStatus: "done",
    };

    render(
      <SpeechesTab
        activeSub="reci"
        mpSlug="michal-simecka"
        page={1}
        speeches={[speech]}
        speechesTotal={1}
        interpellations={null}
        interpellationsTotal={0}
        questions={null}
        questionsTotal={0}
      />
    );

    expect(screen.getByText("Procedurálna oprava hlasovania")).toBeInTheDocument();
    expect(screen.getByText("Procedurálne vystúpenie")).toBeInTheDocument();
    expect(
      screen.getByText("Poslanec požiadal o zaprotokolovanie opravy hlasovania.")
    ).toBeInTheDocument();
    expect(screen.getByText("Čo povedal/a")).toBeInTheDocument();
    expect(screen.getByText("Zdroj NR SR")).toBeInTheDocument();
    expect(screen.queryByText(rawTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(speech.excerpt as string)).not.toBeInTheDocument();
  });
});
