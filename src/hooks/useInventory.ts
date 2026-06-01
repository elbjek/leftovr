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
import { useMeasurementSystem } from "@/features/settings/useMeasurementSystem";

type InventoryState = {
  loading: boolean;
  lots: InventoryLot[];
  groups: InventoryGroup[];
  error: string | null;
};

// Each useInventory() call holds its own state, so a mutation in one screen
// (e.g. cooking a recipe) wouldn't refresh the fridge tab's copy. Mounted
// instances subscribe here and re-fetch whenever inventory changes anywhere.
const inventoryListeners = new Set<() => void>();

export function notifyInventoryChanged(except?: () => void) {
  for (const listener of inventoryListeners) {
    if (listener !== except) listener();
  }
}

export function useInventory(householdId?: string | null) {
  const [state, setState] = useState<InventoryState>({
    loading: Boolean(householdId),
    lots: [],
    groups: [],
    error: null,
  });

  const { system } = useMeasurementSystem();

  const load = useCallback(async () => {
    if (!householdId) {
      setState({ loading: false, lots: [], groups: [], error: null });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const lots = await listActiveHouseholdInventory(householdId);
      setState({ loading: false, lots, groups: [], error: null });
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
    inventoryListeners.add(load);
    return () => {
      inventoryListeners.delete(load);
    };
  }, [load]);

  // Refresh this instance, then tell every other mounted instance to refresh.
  const reloadAndBroadcast = useCallback(async () => {
    await load();
    notifyInventoryChanged(load);
  }, [load]);

  const actions = useMemo(
    () => ({
      refresh: load,
      addDemoItem: async (name: string) => {
        if (!householdId) return;
        await addInventoryItem({ householdId, name });
        await reloadAndBroadcast();
      },
      addExpiringDemoItem: async () => {
        if (!householdId) return;
        const addedAt = new Date();
        addedAt.setDate(addedAt.getDate() - 5);
        await addInventoryItem({ householdId, name: "Spinach", addedAt: addedAt.toISOString() });
        await reloadAndBroadcast();
      },
      useFirstLot: async (group: InventoryGroup) => {
        if (!householdId || !group.lots[0]) return;
        await depleteItemQuantity(householdId, group.normalizedName, 1, group.unit);
        await reloadAndBroadcast();
      },
      markFirstLotPartial: async (group: InventoryGroup) => {
        const lot = group.lots[0];
        if (!lot) return;
        await advanceInventoryPartialState(lot.id);
        await reloadAndBroadcast();
      },
      setFirstLotPartialState: async (group: InventoryGroup, partialState: PartialState) => {
        const lot = group.lots[0];
        if (!lot) return;
        await markInventoryPartialState(lot.id, partialState);
        await reloadAndBroadcast();
      },
      removeGroup: async (group: InventoryGroup) => {
        await removeInventoryGroup(group.lots.map((lot) => lot.id));
        await reloadAndBroadcast();
      },
    }),
    [householdId, load, reloadAndBroadcast],
  );

  // Group at render so the metric/imperial toggle re-formats labels live,
  // without re-fetching inventory.
  const groups = useMemo(() => groupInventoryLots(state.lots, system), [state.lots, system]);

  return { ...state, groups, ...actions };
}
