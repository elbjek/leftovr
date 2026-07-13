import { getSupabaseClient } from "@/lib/supabase";

import { Household, Profile } from "@/features/auth/types";

export type OnboardingPersonalization = {
  cookingForSeed: string;
  defaultServings: number;
  shoppingStyle: string;
  primaryGoal: string;
  avoidances: string[];
  currencyCode: string;
};

export async function getCurrentProfile() {
  const supabase = getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  // RLS also exposes household co-members' profiles, so the own-row
  // filter is required for .single() to hold once a household has 2+ members.
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_initials, language, default_servings, cooking_for_seed, shopping_style, primary_goal, avoidances, tier, active_household_id, onboarding_completed_at, cooked_coachmark_seen_at, prototype_day, free_receipt_scan_used_at, free_recipe_generation_used_at",
    )
    .eq("id", userResult.user.id)
    .single<Profile>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getHouseholdById(householdId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("households")
    .select("id, name, status, plan_tier, default_servings, currency_code, first_fill_completed_at")
    .eq("id", householdId)
    .single<Household>();

  if (error) {
    throw error;
  }

  return data;
}

export async function completeCurrentProfileOnboarding(
  input: OnboardingPersonalization,
  options: { seedActiveHouseholdDefault?: boolean } = {},
) {
  const supabase = getSupabaseClient();
  const seedActiveHouseholdDefault = options.seedActiveHouseholdDefault ?? true;

  const profile = await getCurrentProfile();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      default_servings: input.defaultServings,
      cooking_for_seed: input.cookingForSeed,
      shopping_style: input.shoppingStyle,
      primary_goal: input.primaryGoal,
      avoidances: input.avoidances,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (profileError) {
    throw profileError;
  }

  if (seedActiveHouseholdDefault && profile.active_household_id) {
    const { error: householdError } = await supabase
      .from("households")
      .update({ default_servings: input.defaultServings, currency_code: input.currencyCode })
      .eq("id", profile.active_household_id);

    if (householdError) {
      throw householdError;
    }
  }
}


export async function completeHouseholdFirstFill(householdId: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("households")
    .update({ first_fill_completed_at: new Date().toISOString() })
    .eq("id", householdId);

  if (error) {
    throw error;
  }
}


export async function updateProfileField(
  field: "display_name" | "primary_goal" | "shopping_style",
  value: string,
) {
  const supabase = getSupabaseClient();
  const profile = await getCurrentProfile();

  const { error } = await supabase
    .from("profiles")
    .update({ [field]: value })
    .eq("id", profile.id);

  if (error) throw error;

  if (field === "display_name") {
    const { error: initialsError } = await supabase.rpc("make_avatar_initials", {
      display_name: value,
    });
    if (!initialsError) {
      await supabase
        .from("profiles")
        .update({ avatar_initials: value.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) })
        .eq("id", profile.id);
    }
  }
}

export async function updateProfileAvoidances(avoidances: string[]) {
  const supabase = getSupabaseClient();
  const profile = await getCurrentProfile();

  const { error } = await supabase
    .from("profiles")
    .update({ avoidances })
    .eq("id", profile.id);

  if (error) throw error;
}

export async function updateHouseholdDefaultServings(
  householdId: string,
  servings: number,
) {
  const supabase = getSupabaseClient();
  const clamped = Math.max(1, Math.min(12, servings));

  const { error } = await supabase
    .from("households")
    .update({ default_servings: clamped })
    .eq("id", householdId);

  if (error) throw error;
}
