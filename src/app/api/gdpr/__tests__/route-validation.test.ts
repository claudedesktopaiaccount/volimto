import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as deletePost } from "../delete/route";
import { POST as exportPost } from "../export/route";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(() => ({ mocked: "db" })),
  validateSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "pt_session",
  validateSession: mocks.validateSession,
}));

function gdprRequest(path: string, csrf?: string, cookie = "") {
  const headers = new Headers();
  if (csrf) {
    headers.set("x-csrf-token", csrf);
    headers.set("cookie", [`pt_csrf=${csrf}`, cookie].filter(Boolean).join("; "));
  } else if (cookie) {
    headers.set("cookie", cookie);
  }

  return new NextRequest(`https://volimto.test${path}`, {
    method: "POST",
    headers,
  });
}

describe("GDPR route validation", () => {
  beforeEach(() => {
    mocks.getDb.mockClear();
    mocks.validateSession.mockReset();
  });

  it("rejects export without matching CSRF before database access", async () => {
    const response = await exportPost(gdprRequest("/api/gdpr/export"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("CSRF validation failed");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects delete without matching CSRF before database access", async () => {
    const response = await deletePost(gdprRequest("/api/gdpr/delete"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("CSRF validation failed");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("returns 404 from export when neither visitor nor authenticated user exists", async () => {
    const response = await exportPost(gdprRequest("/api/gdpr/export", "csrf-token"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("No visitor data found");
    expect(mocks.getDb).toHaveBeenCalledOnce();
    expect(mocks.validateSession).not.toHaveBeenCalled();
  });

  it("returns 404 from delete when neither visitor nor authenticated user exists", async () => {
    const response = await deletePost(gdprRequest("/api/gdpr/delete", "csrf-token"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("No visitor data found");
    expect(mocks.getDb).toHaveBeenCalledOnce();
    expect(mocks.validateSession).not.toHaveBeenCalled();
  });
});
