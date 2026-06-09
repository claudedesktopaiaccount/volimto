import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const mocks = vi.hoisted(() => {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const db = {
    update: vi.fn(() => ({ set })),
  };

  return {
    db,
    set,
    where,
    getDb: vi.fn(() => db),
    verifyUnsubToken: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/email/tokens", () => ({
  verifyUnsubToken: mocks.verifyUnsubToken,
}));

function unsubscribeRequest(query = "") {
  return new NextRequest(`https://volimto.test/api/newsletter/unsubscribe${query}`);
}

describe("newsletter unsubscribe route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    mocks.getDb.mockClear();
    mocks.verifyUnsubToken.mockReset();
    mocks.verifyUnsubToken.mockResolvedValue(true);
    mocks.db.update.mockClear();
    mocks.set.mockClear();
    mocks.where.mockClear();
  });

  it("rejects missing email or token before database access", async () => {
    const response = await GET(unsubscribeRequest());

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Neplatn");
    expect(mocks.verifyUnsubToken).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens before database access", async () => {
    mocks.verifyUnsubToken.mockResolvedValue(false);

    const response = await GET(
      unsubscribeRequest("?email=user%40example.com&token=bad-token")
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Neplatn");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("unsubscribes a valid email and escapes the HTML response", async () => {
    const response = await GET(
      unsubscribeRequest("?email=USER%2B%3Ctag%3E%40example.com&token=good-token")
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(mocks.verifyUnsubToken).toHaveBeenCalledWith(
      "good-token",
      "USER+<tag>@example.com",
      "cron-secret"
    );
    expect(mocks.set).toHaveBeenCalledWith({
      unsubscribedAt: expect.any(String),
    });
    expect(html).toContain("USER+&lt;tag&gt;@example.com");
    expect(html).not.toContain("<tag>@example.com");
  });
});
