import { describe, it, expect, vi } from "vitest";
import { createSession, validateSession, deleteSession, hashToken } from "../session";

// Mock Database
function makeMockDb() {
  const sessions: Map<string, { id: string; userId: string; createdAt: string; expiresAt: string }> =
    new Map();

  return {
    _sessions: sessions,
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((values: { id: string; userId: string; createdAt: string; expiresAt: string }) => {
        sessions.set(values.id, values);
        return Promise.resolve();
      }),
    })),
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockImplementation(() => {
          // Return the last queried session — tests control this via the token
          return Promise.resolve([...sessions.values()].slice(-1));
        }),
      })),
    })),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        return Promise.resolve();
      }),
    })),
  };
}

describe("createSession", () => {
  it("returns a token and expiresAt date roughly 30 days out", async () => {
    const db = makeMockDb();
    const { token, expiresAt } = await createSession("user-123", db as never);

    expect(typeof token).toBe("string");
    expect(token).toHaveLength(36); // UUID format

    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(diff).toBeGreaterThan(thirtyDays - 5000);
    expect(diff).toBeLessThan(thirtyDays + 5000);
  });

  it("inserts a session row into the DB", async () => {
    const db = makeMockDb();
    await createSession("user-456", db as never);
    expect(db.insert).toHaveBeenCalled();
  });

  it("stores SHA-256 hash of token in DB, not plaintext", async () => {
    const db = makeMockDb();
    const { token } = await createSession("user-hash", db as never);
    const stored = [...db._sessions.values()][0];
    expect(stored.id).not.toBe(token);
    expect(stored.id).toHaveLength(64);
    expect(stored.id).toBe(await hashToken(token));
  });
});

describe("hashToken", () => {
  it("produces deterministic 64-char hex SHA-256", async () => {
    const a = await hashToken("foo");
    const b = await hashToken("foo");
    const c = await hashToken("bar");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("validateSession", () => {
  it("returns userId for a valid session", async () => {
    const db = makeMockDb();
    const future = new Date(Date.now() + 1_000_000).toISOString();

    // Directly seed the session store
    db._sessions.set("test-token", {
      id: "test-token",
      userId: "user-789",
      createdAt: new Date().toISOString(),
      expiresAt: future,
    });

    // Override select to find by token
    db.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([db._sessions.get("test-token")]),
      }),
    });

    const result = await validateSession("test-token", db as never);
    expect(result).toEqual({ userId: "user-789" });
  });

  it("returns null for a non-existent token", async () => {
    const db = makeMockDb();
    db.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await validateSession("nonexistent", db as never);
    expect(result).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const db = makeMockDb();
    const past = new Date(Date.now() - 1000).toISOString();

    db.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          { id: "expired-token", userId: "user-x", createdAt: "2025-01-01T00:00:00Z", expiresAt: past },
        ]),
      }),
    });

    const result = await validateSession("expired-token", db as never);
    expect(result).toBeNull();
  });

  it("returns null for empty token", async () => {
    const db = makeMockDb();
    const result = await validateSession("", db as never);
    expect(result).toBeNull();
  });
});

describe("deleteSession", () => {
  it("calls db.delete", async () => {
    const db = makeMockDb();
    await deleteSession("some-token", db as never);
    expect(db.delete).toHaveBeenCalled();
  });
});
