import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenDataContractDetail } from "@/lib/db/opendata-contract-detail";

const mocks = vi.hoisted(() => ({
  getOpenDataContractDetail: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/db/opendata-contract-detail", () => ({
  getOpenDataContractDetail: mocks.getOpenDataContractDetail,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import OpenDataContractDetailPage from "./page";

const detail: OpenDataContractDetail = {
  id: 19,
  contractNumber: "ZOD/2024/07/01",
  titleSk: "Zmluva o dielo",
  contractingAuthority: "Železnice Slovenskej republiky",
  supplierIco: "31639607",
  supplierName: "TEMPRA, s.r.o.",
  amountEur: 24_097_535.51,
  signedDate: "2024-12-20",
  cpvCode: "45234100-7",
  sourceUrl: "https://www.crz.gov.sk/zmluva/10245862/",
  rpvsCompanyName: "TEMPRA, s.r.o.",
  rpvsLegalForm: "Spoločnosť s ručením obmedzeným",
  rpvsAddress: "Banská Bystrica",
  rpvsUrl: "https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/1",
  linkedPoliticianId: 7,
  linkedPoliticianName: "Ján Politik",
  linkedPoliticianSlug: "jan-politik",
  partyId: "strana",
  partyName: "Strana",
  partyAbbreviation: "S",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("OpenDataContractDetailPage", () => {
  it("zobrazí všetky polia a same-tab odkazy na CRZ aj späť", async () => {
    mocks.getOpenDataContractDetail.mockResolvedValue(detail);

    const page = await OpenDataContractDetailPage({
      params: Promise.resolve({ id: "19" }),
    });
    render(page);

    expect(mocks.getOpenDataContractDetail).toHaveBeenCalledWith(19);
    expect(screen.getByRole("heading", { level: 1, name: "Zmluva o dielo" })).toBeInTheDocument();
    expect(screen.getByText("ZOD/2024/07/01")).toBeInTheDocument();
    expect(screen.getByText("20. 12. 2024")).toBeInTheDocument();
    expect(screen.getByText(/24.097.535,51/)).toBeInTheDocument();
    expect(screen.getByText("45234100-7")).toBeInTheDocument();
    expect(screen.getByText("31639607")).toBeInTheDocument();
    expect(screen.getByText(/Právna forma:/)).toHaveTextContent(
      "Právna forma: Spoločnosť s ručením obmedzeným"
    );
    expect(screen.getByText(/Súčasná strana:/)).toHaveTextContent("Súčasná strana: S");

    expect(screen.getByRole("link", { name: "← Späť na zmluvy CRZ" })).toHaveAttribute(
      "href",
      "/opendata?view=contracts"
    );
    const source = screen.getByRole("link", { name: "Otvoriť zdroj v CRZ →" });
    expect(source).toHaveAttribute("href", detail.sourceUrl);
    expect(source).not.toHaveAttribute("target");
    expect(screen.getByRole("link", { name: "Detail firmy v RPVS →" })).not.toHaveAttribute(
      "target"
    );
    expect(screen.getByRole("link", { name: "Ján Politik" })).toHaveAttribute(
      "href",
      "/poslanci/jan-politik"
    );
  });

  it.each(["abc", "0", "01", "-1", "1.5", "9007199254740992"])(
    "pošle neplatné ID %s na not-found bez dotazu",
    async (id) => {
      await expect(
        OpenDataContractDetailPage({ params: Promise.resolve({ id }) })
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(mocks.notFound).toHaveBeenCalledOnce();
      expect(mocks.getOpenDataContractDetail).not.toHaveBeenCalled();
    }
  );

  it("použije not-found, keď zmluva v databáze neexistuje", async () => {
    mocks.getOpenDataContractDetail.mockResolvedValue(null);

    await expect(
      OpenDataContractDetailPage({ params: Promise.resolve({ id: "999" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getOpenDataContractDetail).toHaveBeenCalledWith(999);
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
