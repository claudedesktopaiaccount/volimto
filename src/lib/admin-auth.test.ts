import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAdminAuthed } from "./admin-auth";

const mocks = vi.hoisted(() => {
  const db = {
    select: vi.fn(),
  };

  return {
    db,
    getDb: vi.fn(() => db),
    validateSession: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "volimto_session",
  validateSession: mocks.validateSession,
}));

function adminRequest(cookie?: string) {
  return new NextRequest("https://volimto.test/api/admin/promises", {
    headers: cookie ? { cookie } : undefined,
  });
}

function mockUserRows(rows: Array<{ role: string }>) {
  mocks.db.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

describe("admin auth", () => {
  beforeEach(() => {
    mocks.getDb.mockClear();
    mocks.validateSession.mockReset();
    mocks.db.select.mockReset();
  });

  it("rejects missing session cookies before database access", async () => {
    await expect(isAdminAuthed(adminRequest())).resolves.toBe(false);

    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.validateSession).not.toHaveBeenCalled();
  });

  it("rejects invalid sessions", async () => {
    mocks.validateSession.mockResolvedValue(null);

    await expect(isAdminAuthed(adminRequest("volimto_session=session-token"))).resolves.toBe(false);

    expect(mocks.getDb).toHaveBeenCalledOnce();
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("rejects non-admin users", async () => {
    mocks.validateSession.mockResolvedValue({ userId: "user-1" });
    mockUserRows([{ role: "user" }]);

    await expect(isAdminAuthed(adminRequest("volimto_session=session-token"))).resolves.toBe(false);
  });

  it("allows admin users", async () => {
    mocks.validateSession.mockResolvedValue({ userId: "admin-1" });
    mockUserRows([{ role: "admin" }]);

    await expect(isAdminAuthed(adminRequest("volimto_session=session-token"))).resolves.toBe(true);
  });
});
