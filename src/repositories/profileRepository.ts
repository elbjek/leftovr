import { getSupabaseClient } from "@/lib/supabase";

import { Household, Profile } from "@/features/auth/types";

export type OnboardingPersonalization = {
  cookingForSeed: string;
  defaultServings: number;
  shoppingStyle: string;
  primaryGoal: string;
  avoidances: string[];
};

export async function getCurrentProfile() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_initials, language, default_servings, cooking_for_seed, shopping_style, primary_goal, avoidances, tier, active_household_id, onboarding_completed_at, prototype_day",
    )
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
    .select("id, name, status, plan_tier, default_servings, first_fill_completed_at")
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
      .update({ default_servings: input.defaultServings })
      .eq("id", profile.active_household_id);

    if (householdError) {
      throw householdError;
    }
  }
}

export async function acceptHouseholdInvite(inviteCode: string) {
  const supabase = getSupabaseClient();
  const normalizedCode = inviteCode.trim().toUpperCase();

  if (!normalizedCode) return null;

  const { data, error } = await supabase.rpc("accept_household_invite", {
    invite_code: normalizedCode,
    move_existing_items: false,
  });

  if (error) {
    throw error;
  }

  return data as string;
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
