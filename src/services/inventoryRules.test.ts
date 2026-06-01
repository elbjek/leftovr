import { describe, expect, it } from "vitest";
import { isMetricAmountRunningLow } from "./inventoryRules";

const baseGroup = {
  normalizedName: "milk",
  quantity: 1,
  netAmount: 1000,
  netUnit: "ml" as const,
};

describe("isMetricAmountRunningLow", () => {
  it("returns true when measured amount is at or below 25 percent of catalog net", () => {
    expect(isMetricAmountRunningLow({ ...baseGroup, netAmount: 250 })).toBe(true);
  });

  it("returns false when measured amount is above 25 percent of catalog net", () => {
    expect(isMetricAmountRunningLow({ ...baseGroup, netAmount: 300 })).toBe(false);
  });

  it("scales threshold by quantity", () => {
    expect(isMetricAmountRunningLow({ ...baseGroup, quantity: 2, netAmount: 500 })).toBe(true);
    expect(isMetricAmountRunningLow({ ...baseGroup, quantity: 2, netAmount: 600 })).toBe(false);
  });

  it("ignores items without known metric amount", () => {
    expect(isMetricAmountRunningLow({ ...baseGroup, netAmount: null, netUnit: null })).toBe(false);
  });
});
