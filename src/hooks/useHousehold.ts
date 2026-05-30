import { useCallback, useEffect, useState } from "react";

import {
  createHouseholdInvite,
  getActiveInviteForHousehold,
  getHouseholdItemCount,
  HouseholdInvite,
  HouseholdMember,
  listHouseholdMembers,
  lookupHouseholdInvite,
  acceptHouseholdInvite,
  InviteLookup,
  getCombinedAvoidances,
} from "@/repositories/householdRepository";

type HouseholdState = {
  loading: boolean;
  members: HouseholdMember[];
  activeInvite: HouseholdInvite | null;
  error: string | null;
};

export function useHousehold(householdId: string | null | undefined) {
  const [state, setState] = useState<HouseholdState>({
    loading: Boolean(householdId),
    members: [],
    activeInvite: null,
    error: null,
  });

  const load = useCallback(async () => {
    if (!householdId) {
      setState({ loading: false, members: [], activeInvite: null, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const [members, invite] = await Promise.all([
        listHouseholdMembers(householdId),
        getActiveInviteForHousehold(householdId),
      ]);
      setState({ loading: false, members, activeInvite: invite, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Could not load household.",
      }));
    }
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  const combinedAvoidances = getCombinedAvoidances(state.members);

  return {
    ...state,
    combinedAvoidances,
    refresh: load,

    createInvite: async () => {
      if (!householdId) return null;
      const invite = await createHouseholdInvite(householdId);
      setState((s) => ({ ...s, activeInvite: invite }));
      return invite;
    },

    lookupCode: async (code: string): Promise<InviteLookup | null> => {
      return lookupHouseholdInvite(code);
    },

    joinHousehold: async (code: string, moveItems: boolean): Promise<string> => {
      const newId = await acceptHouseholdInvite(code, moveItems);
      return newId;
    },

    getItemCount: async (): Promise<number> => {
      if (!householdId) return 0;
      return getHouseholdItemCount(householdId);
    },
  };
}
