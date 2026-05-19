import { describe, expect, it } from "vitest";
import {
  MP_ACTIVITY_BASE_FAILURE_BACKOFF_MS,
  MP_ACTIVITY_MAX_FAILURE_BACKOFF_MS,
  MP_ACTIVITY_SUCCESS_COOLDOWN_MS,
  mpActivityFailureBackoffMs,
  nextIsoAfter,
  parseMpActivityLimit,
} from "./mp-activity-schedule";

describe("parseMpActivityLimit", () => {
  it("defaults to a small polite batch", () => {
    expect(parseMpActivityLimit(null)).toBe(5);
    expect(parseMpActivityLimit("abc")).toBe(5);
  });

  it("clamps caller supplied values", () => {
    expect(parseMpActivityLimit("0")).toBe(1);
    expect(parseMpActivityLimit("50")).toBe(20);
    expect(parseMpActivityLimit("7.9")).toBe(7);
  });
});

describe("mpActivityFailureBackoffMs", () => {
  it("uses exponential backoff for ordinary failures", () => {
    expect(mpActivityFailureBackoffMs(0)).toBe(MP_ACTIVITY_BASE_FAILURE_BACKOFF_MS);
    expect(mpActivityFailureBackoffMs(2)).toBe(MP_ACTIVITY_BASE_FAILURE_BACKOFF_MS * 4);
  });

  it("caps ordinary failure backoff", () => {
    expect(mpActivityFailureBackoffMs(20)).toBe(MP_ACTIVITY_MAX_FAILURE_BACKOFF_MS);
  });

  it("respects Retry-After with a minimum polite delay", () => {
    expect(mpActivityFailureBackoffMs(0, 1_000)).toBe(MP_ACTIVITY_BASE_FAILURE_BACKOFF_MS);
    expect(mpActivityFailureBackoffMs(0, 2 * MP_ACTIVITY_SUCCESS_COOLDOWN_MS)).toBe(
      2 * MP_ACTIVITY_SUCCESS_COOLDOWN_MS
    );
  });
});

describe("nextIsoAfter", () => {
  it("adds delay to the current timestamp", () => {
    expect(nextIsoAfter(Date.parse("2026-05-19T10:00:00.000Z"), 60_000)).toBe(
      "2026-05-19T10:01:00.000Z"
    );
  });
});
