import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/db";
import {
  getOpenDataContractDetail,
  type OpenDataContractDetail,
} from "@/lib/db/opendata-contract-detail";

const detail: OpenDataContractDetail = {
  id: 19,
  contractNumber: "ZOD/2024/07/01",
  titleSk: "Zmluva o dielo",
  contractingAuthority: "Železnice Slovenskej republiky",
  supplierIco: "31639607",
  supplierName: "TEMPRA, s.r.o.",
  amountEur: 24_097_535.51,
  signedDate: "2024-12-20",
  cpvCode: null,
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

function mockDatabase(rows: OpenDataContractDetail[]) {
  const query = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  query.from.mockReturnValue(query);
  query.leftJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);

  const select = vi.fn().mockReturnValue(query);
  return {
    database: { select } as unknown as Database,
    query,
    select,
  };
}

describe("getOpenDataContractDetail", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "odmietne neplatné ID %s bez databázového dotazu",
    async (id) => {
      const { database, select } = mockDatabase([]);

      await expect(getOpenDataContractDetail(id, database)).resolves.toBeNull();
      expect(select).not.toHaveBeenCalled();
    }
  );

  it("vráti zmluvu spolu s RPVS a overeným politickým kontextom", async () => {
    const { database, query, select } = mockDatabase([detail]);

    await expect(getOpenDataContractDetail(19, database)).resolves.toEqual(detail);
    expect(select).toHaveBeenCalledOnce();
    expect(query.from).toHaveBeenCalledOnce();
    expect(query.leftJoin).toHaveBeenCalledTimes(3);
    expect(query.where).toHaveBeenCalledOnce();
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("vráti null, keď zmluva neexistuje", async () => {
    const { database } = mockDatabase([]);

    await expect(getOpenDataContractDetail(999, database)).resolves.toBeNull();
  });
});
