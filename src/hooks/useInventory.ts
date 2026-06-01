import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addInventoryItem,
  advanceInventoryPartialState,
  depleteItemQuantity,
  listActiveHouseholdInventory,
  markInventoryPartialState,
  removeInventoryGroup,
} from "@/repositories";
import { groupInventoryLots, InventoryGroup, InventoryLot, PartialState } from "@/services";

type InventoryState = {
  loading: boolean;
  lots: InventoryLot[];
  groups: InventoryGroup[];
  error: string | null;
};

export function useInventory(householdId?: string | null) {
  const [state, setState] = useState<InventoryState>({
    loading: Boolean(householdId),
    lots: [],
    groups: [],
    error: null,
  });

  const load = useCallback(async () => {
    if (!householdId) {
      setState({ loading: false, lots: [], groups: [], error: null });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const lots = await listActiveHouseholdInventory(householdId);
      setState({ loading: false, lots, groups: groupInventoryLots(lots), error: null });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Could not load inventory.",
      }));
    }
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useMemo(
    () => ({
      refresh: load,
      addDemoItem: async (name: string) => {
        if (!householdId) return;
        await addInventoryItem({ householdId, name });
        await load();
      },
      addExpiringDemoItem: async () => {
        if (!householdId) return;
        const addedAt = new Date();
        addedAt.setDate(addedAt.getDate() - 5);
        await addInventoryItem({ householdId, name: "Spinach", addedAt: addedAt.toISOString() });
        await load();
      },
      useFirstLot: async (group: InventoryGroup) => {
        if (!householdId || !group.lots[0]) return;
        await depleteItemQuantity(householdId, group.normalizedName, 1);
        await load();
      },
      markFirstLotPartial: async (group: InventoryGroup) => {
        const lot = group.lots[0];
        if (!lot) return;
        await advanceInventoryPartialState(lot.id);
        await load();
      },
      setFirstLotPartialState: async (group: InventoryGroup, partialState: PartialState) => {
        const lot = group.lots[0];
        if (!lot) return;
        await markInventoryPartialState(lot.id, partialState);
        await load();
      },
      removeGroup: async (group: InventoryGroup) => {
        await removeInventoryGroup(group.lots.map((lot) => lot.id));
        await load();
      },
    }),
    [householdId, load],
  );

  return { ...state, ...actions };
}
