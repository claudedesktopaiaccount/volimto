import { describe, expect, it, vi } from "vitest";
import type { Database } from "./index";
import { upsertMpActivities, upsertMps } from "./nrsr";

function containsText(value: unknown, needle: string): boolean {
  if (typeof value === "string") return value.toLowerCase().includes(needle);
  if (Array.isArray(value)) return value.some((item) => containsText(item, needle));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsText(item, needle));
  }
  return false;
}

describe("upsertMps", () => {
  it("preserves existing party and photo when the NRSR list omits them", async () => {
    const insertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    };
    const db = {
      insert: vi.fn().mockReturnValue(insertBuilder),
    } as unknown as Database;

    await upsertMps(
      db,
      [
        {
          nrsrPersonId: "1114",
          slug: "michal-simecka",
          nameFull: "Simecka Michal",
          nameDisplay: "Michal Simecka",
          partyAbbr: null,
          role: "poslanec",
          constituency: null,
          birthYear: null,
          photoUrl: null,
        },
      ],
      { ps: "ps" },
      new Set()
    );

    const conflictConfig = insertBuilder.onConflictDoUpdate.mock.calls[0]?.[0];
    const partyIdSql = conflictConfig?.set.partyId as { queryChunks?: unknown[] };
    const photoUrlSql = conflictConfig?.set.photoUrl as { queryChunks?: unknown[] };

    expect(insertBuilder.values).toHaveBeenCalledWith([
      expect.objectContaining({ partyId: null, photoUrl: null }),
    ]);
    expect(containsText(partyIdSql.queryChunks, "coalesce")).toBe(true);
    expect(containsText(photoUrlSql.queryChunks, "coalesce")).toBe(true);
  });
});

describe("upsertMpActivities", () => {
  it("stores MP speeches through conflict-safe upsert", async () => {
    const insertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    };
    const deleteBuilder = {
      where: vi.fn().mockResolvedValue([]),
    };
    const db = {
      insert: vi.fn().mockReturnValue(insertBuilder),
      delete: vi.fn().mockReturnValue(deleteBuilder),
    } as unknown as Database;

    const result = await upsertMpActivities(db, 42, {
      speeches: [
        {
          nrsrSpeechId: "speech-1",
          nrsrPersonId: "1114",
          date: "2026-05-05",
          titleSk: "Procedurálny návrh",
          textSk: "Text prejavu",
          sourceUrl: "https://www.nrsr.sk/web/Default.aspx?sid=schodze/rozprava/vyhladavanie",
        },
      ],
      interpellations: [],
      questions: [],
      legislation: [],
      amendments: [],
      trips: [],
      assistants: [],
      offices: [],
    });

    expect(result.speeches).toBe(1);
    expect(insertBuilder.values).toHaveBeenCalledWith([
      expect.objectContaining({
        mpId: 42,
        nrsrSpeechId: "speech-1",
        textSk: "Text prejavu",
        summaryStatus: "pending",
      }),
    ]);
    expect(insertBuilder.onConflictDoUpdate).toHaveBeenCalled();
    expect(insertBuilder.onConflictDoUpdate.mock.calls[0]?.[0].set).not.toHaveProperty("summarySk");
  });
});
