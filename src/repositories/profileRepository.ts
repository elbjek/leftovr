import { getSupabaseClient } from "@/lib/supabase";

import { Household, Profile } from "@/features/auth/types";

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

