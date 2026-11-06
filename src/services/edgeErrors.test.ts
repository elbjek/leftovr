import { describe, expect, it } from "vitest";
import { friendlyMessage, readEdgeErrorCode } from "./edgeErrors";

describe("friendlyMessage", () => {
  it("keeps a meaningful error message", () => {
    expect(friendlyMessage(new Error("Duplicate receipt detected"), "fallback"))
      .toBe("Duplicate receipt detected");
  });

  it("replaces transport noise with the fallback", () => {
    expect(friendlyMessage(new Error("Edge Function returned a non-2xx status code"), "fallback"))
      .toBe("fallback");
    expect(friendlyMessage(new Error("Network request failed"), "fallback")).toBe("fallback");
  });

  it("falls back for non-Error values without a message", () => {
    expect(friendlyMessage("boom", "fallback")).toBe("fallback");
    expect(friendlyMessage(null, "fallback")).toBe("fallback");
  });
});

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

describe("offline errors", () => {
  it("prefers the offline fallback when the request never reached the server", () => {
    expect(friendlyMessage(new Error("Network request failed"), "generic", "offline")).toBe("offline");
    expect(friendlyMessage(new Error("TypeError: Failed to fetch"), "generic", "offline")).toBe("offline");
  });

  it("keeps the generic fallback for a server-side failure", () => {
    expect(
      friendlyMessage(new Error("Edge Function returned a non-2xx status code"), "generic", "offline"),
    ).toBe("generic");
  });

  it("still returns a meaningful message untouched", () => {
    expect(friendlyMessage(new Error("Monthly limit reached"), "generic", "offline"))
      .toBe("Monthly limit reached");
  });
});
