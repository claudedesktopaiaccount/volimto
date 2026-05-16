import { describe, it, expect, vi, beforeEach } from "vitest";
import { subscribeEmail, isAlreadySubscribed } from "../newsletter";
import type { Database } from "@/lib/db";

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  limit: vi.fn(),
};

describe("subscribeEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts a new subscriber", async () => {
    mockDb.values.mockResolvedValue(undefined);
    await expect(subscribeEmail(mockDb as unknown as Database, "test@example.com", "homepage")).resolves.not.toThrow();
  });

  it("throws if email already subscribed (UNIQUE constraint)", async () => {
    mockDb.values.mockRejectedValue(new Error("UNIQUE constraint failed: newsletter_subscribers.email"));
    await expect(subscribeEmail(mockDb as unknown as Database, "existing@example.com")).rejects.toThrow("already_subscribed");
  });

  it("re-throws non-unique errors", async () => {
    mockDb.values.mockRejectedValue(new Error("database is locked"));
    await expect(subscribeEmail(mockDb as unknown as Database, "test@example.com")).rejects.toThrow("database is locked");
  });
});

describe("isAlreadySubscribed", () => {
  it("returns true when subscriber exists", async () => {
    mockDb.limit.mockResolvedValue([{ id: 1 }]);
    const result = await isAlreadySubscribed(mockDb as unknown as Database, "user@example.com");
    expect(result).toBe(true);
  });

  it("returns false when subscriber does not exist", async () => {
    mockDb.limit.mockResolvedValue([]);
    const result = await isAlreadySubscribed(mockDb as unknown as Database, "new@example.com");
    expect(result).toBe(false);
  });
});
