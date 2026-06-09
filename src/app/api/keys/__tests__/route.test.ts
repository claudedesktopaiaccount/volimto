import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";

const mocks = vi.hoisted(() => {
  const state = {
    selectRows: [] as unknown[],
  };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => state.selectRows),
      })),
    })),
  };

  return {
    db,
    state,
    getDb: vi.fn(() => db),
    validateSession: vi.fn(),
    createApiKey: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: mocks.validateSession,
}));

vi.mock("@/lib/api-keys/keys", () => ({
  createApiKey: mocks.createApiKey,
}));

function authedRequest() {
  return new NextRequest("https://volimto.test/api/keys", {
    method: "POST",
    headers: {
      cookie: "volimto_session=session-token",
    },
  });
}

describe("API keys route", () => {
  beforeEach(() => {
    mocks.state.selectRows = [];
    mocks.getDb.mockClear();
    mocks.validateSession.mockReset();
    mocks.validateSession.mockResolvedValue({ userId: "user-1" });
    mocks.createApiKey.mockReset();
    mocks.createApiKey.mockResolvedValue({
      rawKey: "volimto_raw_key",
      record: { id: "key-1", tier: "free" },
    });
    mocks.db.select.mockClear();
  });

  it("rejects unauthenticated requests", async () => {
    const response = await GET(new NextRequest("https://volimto.test/api/keys"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mocks.validateSession).not.toHaveBeenCalled();
  });

  it("lists key metadata without raw keys or key hashes", async () => {
    mocks.state.selectRows = [
      {
        id: "key-1",
        tier: "free",
        createdAt: "2026-01-01T00:00:00.000Z",
        revokedAt: null,
      },
    ];

    const response = await GET(authedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.keys[0]).toMatchObject({ id: "key-1", tier: "free", revokedAt: null });
    expect(JSON.stringify(body)).not.toContain("rawKey");
    expect(JSON.stringify(body)).not.toContain("keyHash");
  });

  it("returns the raw key once when creating a key", async () => {
    const response = await POST(authedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ rawKey: "volimto_raw_key", id: "key-1", tier: "free" });
    expect(mocks.createApiKey).toHaveBeenCalledWith("user-1", mocks.db);
  });

  it("enforces the active free key limit before creating a key", async () => {
    mocks.state.selectRows = [
      { id: "key-1", revokedAt: null },
      { id: "key-2", revokedAt: null },
      { id: "key-3", revokedAt: null },
    ];

    const response = await POST(authedRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(mocks.createApiKey).not.toHaveBeenCalled();
  });
});
