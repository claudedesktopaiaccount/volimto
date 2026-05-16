import { beforeEach, describe, it, expect, vi } from "vitest";
import { checkAndIncrement } from "./rate-limit";

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  all: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  run: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkAndIncrement", () => {
  it("allows paid tier without count check", async () => {
    // @ts-expect-error mock
    const result = await checkAndIncrement("key-1", "paid", mockDb);
    expect(result.allowed).toBe(true);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("allows free tier under limit", async () => {
    mockDb.where.mockResolvedValueOnce([{ count: 50 }]);
    // @ts-expect-error mock
    const result = await checkAndIncrement("key-1", "free", mockDb);
    expect(result.allowed).toBe(true);
  });

  it("blocks free tier at limit", async () => {
    mockDb.where.mockResolvedValueOnce([{ count: 100 }]);
    // @ts-expect-error mock
    const result = await checkAndIncrement("key-1", "free", mockDb);
    expect(result.allowed).toBe(false);
  });

  it("allows free tier with no usage row yet", async () => {
    mockDb.where.mockResolvedValueOnce([]);
    // @ts-expect-error mock
    const result = await checkAndIncrement("key-1", "free", mockDb);
    expect(result.allowed).toBe(true);
  });
});
