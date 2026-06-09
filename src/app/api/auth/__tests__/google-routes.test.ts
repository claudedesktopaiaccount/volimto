import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as googleStartGet } from "../google/start/route";
import { GET as googleCallbackGet } from "../google/callback/route";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createSession: vi.fn(async () => ({
    token: "session-token",
    expiresAt: "2030-01-01T00:00:00.000Z",
  })),
  verifyIdToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "volimto_session",
  createSession: mocks.createSession,
  sessionCookieOptions: (expiresAt: string) => ({
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    expires: new Date(expiresAt),
  }),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(function OAuth2Client() {
    return { verifyIdToken: mocks.verifyIdToken };
  }),
}));

function mockDb(existingRows: unknown[] = []) {
  const limit = vi.fn(async () => existingRows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const values = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  const db = {
    select: vi.fn(() => ({ from })),
    insert: vi.fn(() => ({ values })),
    update: vi.fn(() => ({ set })),
  };

  return { db, values, set };
}

describe("Google auth routes", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_ALLOWED_EMAILS = "owner@example.com";
    mocks.getDb.mockReset();
    mocks.createSession.mockClear();
    mocks.verifyIdToken.mockReset();
    mocks.fetch.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_ALLOWED_EMAILS;
  });

  it("starts OAuth, sets state cookies, and sanitizes unsafe next paths", async () => {
    const response = await googleStartGet(
      new NextRequest("https://volimto.test/api/auth/google/start?next=//evil.test")
    );

    const location = response.headers.get("location") ?? "";
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(307);
    expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location).toContain("client_id=client-id");
    expect(location).toContain("scope=openid+email+profile");
    expect(setCookie).toContain("volimto_google_oauth_state=");
    expect(setCookie).toContain("volimto_google_oauth_next=%2Fprofil");
  });

  it("rejects provider errors", async () => {
    const response = await googleCallbackGet(
      new NextRequest("https://volimto.test/api/auth/google/callback?error=access_denied")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects missing or mismatched state", async () => {
    const response = await googleCallbackGet(
      new NextRequest("https://volimto.test/api/auth/google/callback?code=code&state=bad", {
        headers: { cookie: "volimto_google_oauth_state=good" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid Google ID tokens", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ id_token: "id-token" }), { status: 200 })
    );
    mocks.verifyIdToken.mockRejectedValue(new Error("invalid"));

    const response = await googleCallbackGet(
      new NextRequest("https://volimto.test/api/auth/google/callback?code=code&state=state", {
        headers: { cookie: "volimto_google_oauth_state=state" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects unverified Google emails", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ id_token: "id-token" }), { status: 200 })
    );
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-sub",
        email: "owner@example.com",
        email_verified: false,
        name: "Owner",
      }),
    });

    const response = await googleCallbackGet(
      new NextRequest("https://volimto.test/api/auth/google/callback?code=code&state=state", {
        headers: { cookie: "volimto_google_oauth_state=state" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBeTruthy();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects Google emails outside the allowlist", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ id_token: "id-token" }), { status: 200 })
    );
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-sub",
        email: "other@example.com",
        email_verified: true,
        name: "Other",
      }),
    });

    const response = await googleCallbackGet(
      new NextRequest("https://volimto.test/api/auth/google/callback?code=code&state=state", {
        headers: { cookie: "volimto_google_oauth_state=state" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBeTruthy();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("creates an admin user session for an allowlisted Google account", async () => {
    const { db, values } = mockDb([]);
    mocks.getDb.mockReturnValue(db);
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ id_token: "id-token" }), { status: 200 })
    );
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-sub",
        email: "owner@example.com",
        email_verified: true,
        name: "Owner",
      }),
    });

    const response = await googleCallbackGet(
      new NextRequest("https://volimto.test/api/auth/google/callback?code=code&state=state", {
        headers: {
          cookie: "volimto_google_oauth_state=state; volimto_google_oauth_next=/admin",
        },
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://volimto.test/admin");
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@example.com",
        googleSub: "google-sub",
        role: "admin",
        passwordHash: null,
      })
    );
    expect(mocks.createSession).toHaveBeenCalledWith(expect.any(String), db);
    expect(response.headers.get("set-cookie")).toContain("volimto_session=session-token");
  });
});
