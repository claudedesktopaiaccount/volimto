import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const mocks = vi.hoisted(() => {
  const state = {
    rateLimitRows: [{ c: 0 }],
  };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => state.rateLimitRows),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
  };

  return {
    db,
    state,
    getDb: vi.fn(() => db),
    hashString: vi.fn(async () => "hashed-ip"),
    subscribeEmail: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/hash", () => ({
  hashString: mocks.hashString,
}));

vi.mock("@/lib/db/newsletter", () => ({
  subscribeEmail: mocks.subscribeEmail,
}));

function subscribeRequest(body: string | object) {
  return new NextRequest("https://volimto.test/api/newsletter/subscribe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.10",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("newsletter subscribe route", () => {
  beforeEach(() => {
    mocks.state.rateLimitRows = [{ c: 0 }];
    mocks.getDb.mockClear();
    mocks.hashString.mockClear();
    mocks.subscribeEmail.mockReset();
    mocks.subscribeEmail.mockResolvedValue(undefined);
    mocks.db.select.mockClear();
    mocks.db.insert.mockClear();
    mocks.db.delete.mockClear();
  });

  it("rejects invalid JSON before database access", async () => {
    const response = await POST(subscribeRequest("{"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_body");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects invalid email before database access", async () => {
    const response = await POST(subscribeRequest({ email: "not-an-email" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_email");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rate limits before subscribing", async () => {
    mocks.state.rateLimitRows = [{ c: 5 }];

    const response = await POST(subscribeRequest({ email: "user@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("too_many_requests");
    expect(mocks.subscribeEmail).not.toHaveBeenCalled();
  });

  it("subscribes a valid email and records rate limit state", async () => {
    const response = await POST(
      subscribeRequest({ email: " user@example.com ", source: "footer" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mocks.hashString).toHaveBeenCalledWith("newsletter:203.0.113.10");
    expect(mocks.subscribeEmail).toHaveBeenCalledWith(mocks.db, "user@example.com", "footer");
    expect(mocks.db.insert).toHaveBeenCalled();
    expect(mocks.db.delete).toHaveBeenCalled();
  });

  it("maps duplicate subscription to 409 without leaking raw errors", async () => {
    mocks.subscribeEmail.mockRejectedValue(new Error("already_subscribed"));

    const response = await POST(subscribeRequest({ email: "user@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "already_subscribed" });
  });

  it("maps unexpected subscription failures to a safe 500 response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.subscribeEmail.mockRejectedValue(new Error("provider secret abc123"));

    const response = await POST(subscribeRequest({ email: "user@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "server_error" });
    expect(JSON.stringify(body)).not.toContain("provider secret");

    consoleError.mockRestore();
  });
});
