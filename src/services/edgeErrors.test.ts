import { describe, expect, it } from "vitest";
import { readEdgeErrorCode } from "./edgeErrors";

describe("readEdgeErrorCode", () => {
  it("returns the error code from a FunctionsHttpError-like context body", async () => {
    const err = { context: { json: async () => ({ error: "receipt_scan_monthly_limit" }) } };
    expect(await readEdgeErrorCode(err)).toBe("receipt_scan_monthly_limit");
  });

  it("returns null when there is no context", async () => {
    expect(await readEdgeErrorCode(new Error("boom"))).toBeNull();
  });

  it("returns null when the body has no string error field", async () => {
    const err = { context: { json: async () => ({ notError: 1 }) } };
    expect(await readEdgeErrorCode(err)).toBeNull();
  });

  it("returns null when json() throws", async () => {
    const err = { context: { json: async () => { throw new Error("bad json"); } } };
    expect(await readEdgeErrorCode(err)).toBeNull();
  });
});
