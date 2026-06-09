import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { isCronAuthed } from "./cron-auth";

function cronRequest(headers?: HeadersInit) {
  return new NextRequest("https://volimto.test/api/cron/test", { headers });
}

describe("isCronAuthed", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
  });

  it("rejects requests when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;

    await expect(isCronAuthed(cronRequest({ "x-cron-secret": "cron-secret" }))).resolves.toBe(false);
  });

  it("accepts x-cron-secret header", async () => {
    await expect(isCronAuthed(cronRequest({ "x-cron-secret": "cron-secret" }))).resolves.toBe(true);
  });

  it("accepts Authorization bearer header", async () => {
    await expect(isCronAuthed(cronRequest({ authorization: "Bearer cron-secret" }))).resolves.toBe(true);
  });

  it("rejects invalid secrets", async () => {
    await expect(isCronAuthed(cronRequest({ authorization: "Bearer wrong-secret" }))).resolves.toBe(false);
  });
});
