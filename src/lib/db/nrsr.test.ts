import { describe, expect, it, vi } from "vitest";
import type { Database } from "./index";
import { upsertMpActivities } from "./nrsr";

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
