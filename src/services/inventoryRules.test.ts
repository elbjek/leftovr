import { describe, expect, it } from "vitest";
import { getShelfLifeDays, isMetricAmountRunningLow, urgencyFromExpiry } from "./inventoryRules";

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

describe("getShelfLifeDays", () => {
  it("returns catalog days for known foods and category defaults otherwise", () => {
    expect(getShelfLifeDays("Salmon", "fish")).toEqual([1, 2]);
    expect(getShelfLifeDays("Mystery item", "meat")).toEqual([1, 3]);
  });
});

describe("urgencyFromExpiry", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("maps days left to urgency bands", () => {
    expect(urgencyFromExpiry("2026-06-11", now)).toBe("urgent");
    expect(urgencyFromExpiry("2026-06-14", now)).toBe("use_soon");
    expect(urgencyFromExpiry("2026-06-20", now)).toBe("safe");
  });

  it("treats past dates as urgent", () => {
    expect(urgencyFromExpiry("2026-06-01", now)).toBe("urgent");
  });
});
