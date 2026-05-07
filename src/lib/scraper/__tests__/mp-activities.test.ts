import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseInterpellationsList,
  parseQuestionsList,
  parseAmendmentsList,
  parseAssistantsList,
  parseOfficesList,
  parseForeignTripsList,
} from "@/lib/scraper/nrsr";

const F = (name: string) =>
  readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");

describe("scrapeMpActivities parsers (PoslanecID=1114)", () => {
  it("parses questions list", () => {
    const rows = parseQuestionsList(F("mp_questions_1114.html"));
    expect(rows.length).toBeGreaterThan(0);
    const q = rows[0];
    expect(q.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(q.subject.length).toBeGreaterThan(10);
    expect(q.url).toContain("ho_detail");
  });

  it("parses amendments list", () => {
    const rows = parseAmendmentsList(F("mp_amendments_1114.html"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].toLaw.length).toBeGreaterThan(10);
    expect(rows[0].url).toContain("nrepdn_detail");
    expect(rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses assistants list", () => {
    const rows = parseAssistantsList(F("mp_assistants_1114.html"));
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBeTruthy();
  });

  it("returns empty array for empty interpellations page", () => {
    expect(parseInterpellationsList(F("mp_interpellations_1114.html"))).toEqual([]);
  });

  it("returns empty array for offices 'no records' message", () => {
    expect(parseOfficesList(F("mp_offices_1114.html"))).toEqual([]);
  });

  it("returns empty array for trips 'no records' message", () => {
    expect(parseForeignTripsList(F("mp_trips_1114.html"), "x")).toEqual([]);
  });

  it("parses populated interpellations list (MP 1116)", () => {
    const rows = parseInterpellationsList(F("mp_interpellations_1116.html"));
    expect(rows.length).toBeGreaterThan(0);
    const r = rows[0];
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.subject.length).toBeGreaterThan(5);
    expect(r.url).toContain("schodze/interpelacia");
    expect(r.addressee).toBeTruthy();
  });

  it("parses populated foreign trips list (MP 929)", () => {
    const rows = parseForeignTripsList(F("mp_trips_929.html"), "x");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rows[0].country.length).toBeGreaterThan(0);
  });
});
