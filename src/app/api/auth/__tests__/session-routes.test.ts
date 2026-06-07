import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as meGet } from "../me/route";
import { POST as logoutPost } from "../logout/route";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(() => ({ mocked: "db" })),
  deleteSession: vi.fn(async () => undefined),
  validateSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "pt_session",
  deleteSession: mocks.deleteSession,
  validateSession: mocks.validateSession,
}));

describe("auth session routes", () => {
  beforeEach(() => {
    mocks.getDb.mockClear();
    mocks.deleteSession.mockClear();
    mocks.validateSession.mockReset();
  });

  it("returns 401 from /me when session cookie is missing before database access", async () => {
    const response = await meGet(new NextRequest("https://volimto.test/api/auth/me"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.validateSession).not.toHaveBeenCalled();
  });

  it("logs out without database access when session cookie is missing", async () => {
    const response = await logoutPost(new NextRequest("https://volimto.test/api/auth/logout"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(response.headers.get("set-cookie")).toContain("pt_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });

  it("deletes the server session when logging out with a session cookie", async () => {
    const response = await logoutPost(
      new NextRequest("https://volimto.test/api/auth/logout", {
        headers: { cookie: "pt_session=session-token" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mocks.getDb).toHaveBeenCalledOnce();
    expect(mocks.deleteSession).toHaveBeenCalledWith("session-token", { mocked: "db" });
  });
});
