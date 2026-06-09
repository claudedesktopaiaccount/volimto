import { describe, it, expect } from "vitest";
import { newsletterSubscribers, users } from "../schema";

describe("newsletterSubscribers schema", () => {
  it("has required columns", () => {
    const cols = Object.keys(newsletterSubscribers);
    expect(cols).toContain("email");
    expect(cols).toContain("createdAt");
    expect(cols).toContain("source");
  });
});

describe("users schema", () => {
  it("has an authorization role column", () => {
    const cols = Object.keys(users);
    expect(cols).toContain("role");
  });

  it("supports Google-only auth columns", () => {
    const cols = Object.keys(users);
    expect(cols).toContain("googleSub");
    expect(cols).toContain("passwordHash");
  });
});
