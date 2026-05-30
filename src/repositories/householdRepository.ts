import { getSupabaseClient } from "@/lib/supabase";

export type HouseholdMember = {
  id: string;
  user_id: string;
  role: "owner" | "member";
  status: "active" | "removed";
  joined_at: string;
  display_name: string;
  avatar_initials: string | null;
  avoidances: string[];
};

export type HouseholdInvite = {
  id: string;
  household_id: string;
  code: string;
  status: "active" | "accepted" | "revoked" | "expired";
  max_uses: number;
  used_count: number;
  expires_at: string;
  created_at: string;
};

export type InviteLookup = {
  invite_code: string;
  household_id: string;
  household_name: string;
  member_count: number;
  expires_at: string;
};

export async function listHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("household_members")
    .select(
      "id, user_id, role, status, joined_at, profiles!inner(display_name, avatar_initials, avoidances)",
    )
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    joined_at: row.joined_at,
    display_name: row.profiles.display_name,
    avatar_initials: row.profiles.avatar_initials,
    avoidances: row.profiles.avoidances ?? [],
  }));
}

export async function createHouseholdInvite(householdId: string): Promise<HouseholdInvite> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("create_household_invite", {
    target_household_id: householdId,
  });

  if (error) throw error;
  return data as HouseholdInvite;
}

export async function lookupHouseholdInvite(inviteCode: string): Promise<InviteLookup | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("lookup_household_invite", {
    p_invite_code: inviteCode.trim().toUpperCase(),
  });

  if (error) throw error;

  const rows = data as InviteLookup[];
  return rows.length > 0 ? rows[0] : null;
}

export async function acceptHouseholdInvite(
  inviteCode: string,
  moveExistingItems: boolean,
): Promise<string> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("accept_household_invite", {
    invite_code: inviteCode.trim().toUpperCase(),
    move_existing_items: moveExistingItems,
  });

  if (error) throw error;
  return data as string;
}

export async function getActiveInviteForHousehold(
  householdId: string,
): Promise<HouseholdInvite | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("household_invites")
    .select("id, household_id, code, status, max_uses, used_count, expires_at, created_at")
    .eq("household_id", householdId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as HouseholdInvite | null;
}

export async function getHouseholdItemCount(householdId: string): Promise<number> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .is("removed_at", null);

  if (error) throw error;
  return count ?? 0;
}

export function getCombinedAvoidances(members: HouseholdMember[]): string[] {
  const set = new Set<string>();
  for (const member of members) {
    for (const a of member.avoidances) {
      set.add(a);
    }
  }
  return Array.from(set);
}
