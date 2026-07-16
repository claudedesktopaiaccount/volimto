import { describe, expect, it, vi } from "vitest";
import {
  clearVerifiedItmsProjectPoliticianLinks,
  removeItmsProjectsMissingFromSnapshot,
  upsertItmsProjects,
  upsertVerifiedPartyRegistryIdentities,
} from "./itms-projects";
import { itmsProjects, partyRegistryIdentities } from "./schema";
import { parseItmsProjectCollection } from "@/lib/scraper/itms-projects";

describe("ITMS persistence", () => {
  it("upserts projects by the stable numeric ITMS ID", async () => {
    const insert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    };
    const db = {
      insert: vi.fn().mockReturnValue(insert),
    } as unknown as Parameters<typeof upsertItmsProjects>[0];
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

    await expect(upsertItmsProjects(db, [project])).resolves.toBe(1);
    expect(insert.onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      target: itmsProjects.itmsId,
    }));
    expect(insert.values).toHaveBeenCalledWith([
      expect.objectContaining({
        itmsId: 2135,
        recipientIco: "37886436",
        contractedAmount: 3_816_081.57,
        effectiveDate: "2018-01-31",
      }),
    ]);
  });

  it("upserts official party identities on the interval-aware key", async () => {
    const insert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    };
    const db = {
      insert: vi.fn().mockReturnValue(insert),
    } as unknown as Parameters<typeof upsertVerifiedPartyRegistryIdentities>[0];

    await expect(upsertVerifiedPartyRegistryIdentities(db, [{
      partyId: "smer-sd",
      ico: "31801242",
      registeredFrom: "1999-11-08",
      registeredTo: null,
      sourceUrl: "https://rez.vs.minv.sk/PolitickeStrany/detail?id_spolok=153097",
    }])).resolves.toBe(1);

    expect(insert.onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      target: [
        partyRegistryIdentities.partyId,
        partyRegistryIdentities.ico,
        partyRegistryIdentities.registeredFrom,
      ],
    }));
  });

  it("clears generated evidence before mutable project refreshes", async () => {
    const deletion = {
      returning: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    };
    const db = {
      delete: vi.fn().mockReturnValue(deletion),
    } as unknown as Parameters<typeof clearVerifiedItmsProjectPoliticianLinks>[0];

    await expect(clearVerifiedItmsProjectPoliticianLinks(db)).resolves.toBe(2);
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it("prunes only projects absent from a complete non-empty snapshot", async () => {
    const selection = {
      from: vi.fn().mockResolvedValue([
        { id: 1, itmsId: 100 },
        { id: 2, itmsId: 200 },
        { id: 3, itmsId: 300 },
      ]),
    };
    const deletion = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 2 }]),
    };
    const db = {
      select: vi.fn().mockReturnValue(selection),
      delete: vi.fn().mockReturnValue(deletion),
    } as unknown as Parameters<typeof removeItmsProjectsMissingFromSnapshot>[0];

    await expect(removeItmsProjectsMissingFromSnapshot(db, [100, 300])).resolves.toBe(1);
    expect(db.delete).toHaveBeenCalledWith(itmsProjects);
  });

  it("refuses to prune from an empty upstream snapshot", async () => {
    const db = {} as Parameters<typeof removeItmsProjectsMissingFromSnapshot>[0];
    await expect(removeItmsProjectsMissingFromSnapshot(db, [])).rejects.toThrow(
      "Refusing to prune ITMS projects from an empty snapshot"
    );
  });
});
