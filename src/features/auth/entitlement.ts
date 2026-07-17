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

/**
 * Only Household Premium unlocks inviting members. The payer's own profile
 * tier counts too: the webhook writes profile and household rows together,
 * but checking both keeps the gate consistent with the tier pill and unlocks
 * the instant either row has landed.
 */
export function canShareHousehold(
  profile: Pick<Profile, "tier"> | null,
  household: Pick<Household, "plan_tier"> | null,
): boolean {
  return (
    profile?.tier === "household_premium" ||
    household?.plan_tier === "household_premium"
  );
}
