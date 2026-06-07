import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as loginPost } from "../login/route";
import { POST as registerPost } from "../register/route";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

function postRequest(path: string, body: unknown, csrf?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (csrf) {
    headers.set("cookie", `pt_csrf=${csrf}`);
    headers.set("x-csrf-token", csrf);
  }

  return new NextRequest(`https://volimto.test${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("auth route CSRF and validation", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
  });

  it("rejects login without matching CSRF before database access", async () => {
    const response = await loginPost(
      postRequest("/api/auth/login", {
        email: "user@example.com",
        password: "correct horse battery staple",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("CSRF validation failed");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects login with missing fields before database access", async () => {
    const response = await loginPost(postRequest("/api/auth/login", {}, "csrf-token"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects registration without matching CSRF before database access", async () => {
    const response = await registerPost(
      postRequest("/api/auth/register", {
        email: "user@example.com",
        password: "correct horse battery staple",
        displayName: "Tester",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("CSRF validation failed");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects invalid registration email before database access", async () => {
    const response = await registerPost(
      postRequest(
        "/api/auth/register",
        {
          email: "not-an-email",
          password: "correct horse battery staple",
          displayName: "Tester",
        },
        "csrf-token"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
