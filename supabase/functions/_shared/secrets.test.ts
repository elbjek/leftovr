import { describe, expect, it } from "vitest";

import { secretsMatch } from "./secrets.ts";

describe("secretsMatch", () => {
  it("accepts an exact match", () => {
    expect(secretsMatch("Bearer abc123", "Bearer abc123")).toBe(true);
  });

  it("rejects a different value, a prefix and a longer value", () => {
    expect(secretsMatch("Bearer abc124", "Bearer abc123")).toBe(false);
    expect(secretsMatch("Bearer abc12", "Bearer abc123")).toBe(false);
    expect(secretsMatch("Bearer abc1234", "Bearer abc123")).toBe(false);
  });

  it("rejects a missing header or unset secret", () => {
    expect(secretsMatch(null, "Bearer abc123")).toBe(false);
    expect(secretsMatch("Bearer abc123", undefined)).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
  });
});
