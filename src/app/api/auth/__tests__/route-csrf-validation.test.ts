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

describe("legacy auth routes", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
  });

  it("permanently disables password login before database access", async () => {
    const response = await loginPost(
      new NextRequest("https://volimto.test/api/auth/login", { method: "POST" })
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain("Google");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("permanently disables password registration before database access", async () => {
    const response = await registerPost(
      new NextRequest("https://volimto.test/api/auth/register", { method: "POST" })
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain("Google");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
