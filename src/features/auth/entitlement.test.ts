import { describe, expect, it } from "vitest";

import { canShareHousehold, isPremium } from "./entitlement";

const profile = (tier: "free" | "premium" | "household_premium") => ({ tier });
const household = (plan_tier: "free" | "premium" | "household_premium") => ({ plan_tier });

describe("isPremium", () => {
  it("is false when profile free and household free", () => {
    expect(isPremium(profile("free"), household("free"))).toBe(false);
  });
  it("is true when own profile is individual premium", () => {
    expect(isPremium(profile("premium"), household("free"))).toBe(true);
  });
  it("is true when own profile is household_premium", () => {
    expect(isPremium(profile("household_premium"), household("free"))).toBe(true);
  });
  it("is true for a free member of a household_premium household (inherited)", () => {
    expect(isPremium(profile("free"), household("household_premium"))).toBe(true);
  });
  it("is false when household is only 'premium' (not a sharing tier)", () => {
    expect(isPremium(profile("free"), household("premium"))).toBe(false);
  });
  it("is false for nulls", () => {
    expect(isPremium(null, null)).toBe(false);
  });
  it("downgrade: reverts to free when household drops household_premium -> free", () => {
    expect(isPremium(profile("free"), household("household_premium"))).toBe(true);
    expect(isPremium(profile("free"), household("free"))).toBe(false);
  });
});

describe("canShareHousehold", () => {
  it("is true when the household is household_premium", () => {
    expect(canShareHousehold(profile("free"), household("household_premium"))).toBe(true);
  });
  it("is true when own profile is household_premium (household row not yet synced)", () => {
    expect(canShareHousehold(profile("household_premium"), household("free"))).toBe(true);
    expect(canShareHousehold(profile("household_premium"), null)).toBe(true);
  });
  it("is false for individual premium", () => {
    expect(canShareHousehold(profile("premium"), household("premium"))).toBe(false);
  });
  it("is false for free and null", () => {
    expect(canShareHousehold(profile("free"), household("free"))).toBe(false);
    expect(canShareHousehold(null, null)).toBe(false);
  });
});
