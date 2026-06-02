import { Household, Profile } from "./types";

/**
 * A user is premium if their own profile is premium/household_premium,
 * OR their active household is household_premium (one payer covers members).
 */
export function isPremium(
  profile: Pick<Profile, "tier"> | null,
  household: Pick<Household, "plan_tier"> | null,
): boolean {
  if (profile && (profile.tier === "premium" || profile.tier === "household_premium")) {
    return true;
  }
  return household?.plan_tier === "household_premium";
}

/** Only Household Premium unlocks inviting members. */
export function canShareHousehold(
  household: Pick<Household, "plan_tier"> | null,
): boolean {
  return household?.plan_tier === "household_premium";
}
