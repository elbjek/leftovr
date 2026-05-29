import { Session, User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  display_name: string;
  avatar_initials: string | null;
  language: string;
  default_servings: number;
  cooking_for_seed: string | null;
  shopping_style: string | null;
  primary_goal: string | null;
  avoidances: string[];
  tier: "free" | "premium" | "household_premium";
  active_household_id: string | null;
  onboarding_completed_at: string | null;
  prototype_day: number;
};

export type Household = {
  id: string;
  name: string;
  status: "active" | "archived";
  plan_tier: "free" | "premium" | "household_premium";
  default_servings: number;
  first_fill_completed_at: string | null;
};

export type AuthState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  activeHousehold: Household | null;
  error: string | null;
};

