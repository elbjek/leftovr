import { describe, expect, it } from "vitest";

import { parseDsn } from "./errorReporting";

describe("parseDsn", () => {
  it("splits a sentry.io DSN into its parts", () => {
    expect(parseDsn("https://abc123@o456.ingest.sentry.io/789")).toEqual({
      protocol: "https",
      publicKey: "abc123",
      host: "o456.ingest.sentry.io",
      projectId: "789",
    });
  });

  it("returns null when the DSN is missing or malformed", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not-a-dsn")).toBeNull();
    expect(parseDsn("https://o456.ingest.sentry.io/789")).toBeNull();
  });
});
