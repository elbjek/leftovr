import { describe, expect, it } from "vitest";
import { newClientId } from "./ids";

describe("newClientId", () => {
  it("is a Postgres-valid uuid and unique", () => {
    const ids = new Set(Array.from({ length: 1000 }, newClientId));
    expect(ids.size).toBe(1000);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});
