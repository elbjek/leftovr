import { describe, expect, it } from "vitest";
import { asCountedPack, normalizeUnit } from "./units";

describe("asCountedPack", () => {
  it("collapses a printed volume to one pack", () => {
    expect(asCountedPack(600, "ml")).toEqual({ quantity: 1, unit: "bottle" });
    expect(asCountedPack(0.6, " L ")).toEqual({ quantity: 1, unit: "bottle" });
  });

  it("leaves counted packs alone", () => {
    expect(asCountedPack(2, "carton")).toEqual({ quantity: 2, unit: "carton" });
    expect(asCountedPack(500, "g")).toEqual({ quantity: 500, unit: "g" });
  });
});

describe("normalizeUnit", () => {
  it("maps legacy volume units onto a countable one", () => {
    expect(normalizeUnit("l")).toBe("bottle");
    expect(normalizeUnit("ml")).toBe("bottle");
  });
});
