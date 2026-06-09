import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  validateSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "volimto_session",
  validateSession: mocks.validateSession,
}));

function postTipovanie(body: unknown, csrf?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (csrf) {
    headers.set("cookie", `pt_csrf=${csrf}`);
    headers.set("x-csrf-token", csrf);
  }

  return new NextRequest("https://volimto.test/api/tipovanie", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("tipovanie route validation", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
    mocks.validateSession.mockReset();
    mocks.validateSession.mockResolvedValue(null);
  });

  it("rejects missing CSRF before database access", async () => {
    const response = await POST(postTipovanie({ selectedWinner: "ps" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("CSRF validation failed");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects invalid party ids before database access", async () => {
    const response = await POST(postTipovanie({ selectedWinner: "unknown-party" }, "csrf-token"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid party");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects invalid fingerprints before database access", async () => {
    const response = await POST(
      postTipovanie(
        {
          selectedWinner: "ps",
          fingerprint: "x".repeat(129),
        },
        "csrf-token"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid fingerprint");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects invalid percentage predictions before database access", async () => {
    const response = await POST(
      postTipovanie(
        {
          selectedWinner: "ps",
          predictedPercentages: { ps: 101 },
        },
        "csrf-token"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid percentage prediction");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects invalid coalition picks before database access", async () => {
    const response = await POST(
      postTipovanie(
        {
          selectedWinner: "ps",
          coalitionPick: ["ps", "unknown-party"],
        },
        "csrf-token"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid coalition pick");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("maps PostgreSQL duplicate vote races to already_voted", async () => {
    let selectCall = 0;
    let insertCall = 0;
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => {
          selectCall += 1;
          if (selectCall === 1) return Promise.resolve([{ c: 1 }]);
          if (selectCall === 2) {
            return {
              where: vi.fn(async () => [{ c: 0 }]),
            };
          }
          return {
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          };
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => {
          insertCall += 1;
          if (insertCall === 2) {
            const error = new Error("duplicate key value violates unique constraint");
            (error as Error & { code: string }).code = "23505";
            throw error;
          }
        }),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    };
    mocks.getDb.mockReturnValue(db);

    const response = await POST(
      postTipovanie(
        {
          selectedWinner: "ps",
          fingerprint: "fingerprint-1",
        },
        "csrf-token"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "already_voted" });
  });
});
