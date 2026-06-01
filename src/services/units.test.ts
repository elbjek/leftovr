import { describe, expect, it } from "vitest";
import { dimensionOf, formatAmount, toMetric } from "./units";

describe("toMetric", () => {
  it("converts volume units to ml", () => {
    expect(toMetric(1, "l")).toEqual({ value: 1000, dimension: "volume" });
    expect(toMetric(200, "ml")).toEqual({ value: 200, dimension: "volume" });
  });
  it("converts cooking units to ml", () => {
    expect(toMetric(1, "tbsp").value).toBeCloseTo(14.79, 2);
    expect(toMetric(1, "tsp").value).toBeCloseTo(4.93, 2);
    expect(toMetric(1, "cup")).toEqual({ value: 240, dimension: "volume" });
  });
  it("converts mass units to g", () => {
    expect(toMetric(1, "kg")).toEqual({ value: 1000, dimension: "mass" });
    expect(toMetric(100, "g")).toEqual({ value: 100, dimension: "mass" });
  });
  it("treats count units as count", () => {
    expect(toMetric(3, "item").dimension).toBe("count");
    expect(toMetric(2, "egg").dimension).toBe("count");
  });
  it("returns null dimension for unconvertible units", () => {
    expect(toMetric(1, "cloves").dimension).toBeNull();
    expect(toMetric(2, "slices").dimension).toBeNull();
    expect(toMetric(1, "handful").dimension).toBeNull();
  });
});

describe("dimensionOf", () => {
  it("maps net units to dimensions", () => {
    expect(dimensionOf("ml")).toBe("volume");
    expect(dimensionOf("g")).toBe("mass");
  });
});

describe("formatAmount", () => {
  it("formats metric volume", () => {
    expect(formatAmount(800, "ml", "metric")).toBe("800 ml");
    expect(formatAmount(1500, "ml", "metric")).toBe("1.5 l");
  });
  it("formats metric mass", () => {
    expect(formatAmount(200, "g", "metric")).toBe("200 g");
    expect(formatAmount(1200, "g", "metric")).toBe("1.2 kg");
  });
  it("formats imperial volume in fl oz", () => {
    expect(formatAmount(29.57, "ml", "imperial")).toBe("1 fl oz");
  });
  it("formats imperial mass in oz", () => {
    expect(formatAmount(28.35, "g", "imperial")).toBe("1 oz");
  });
});
