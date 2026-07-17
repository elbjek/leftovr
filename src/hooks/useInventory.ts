import { useCallback, useEffect, useMemo, useState } from "react";

import {
  advanceInventoryPartialState,
  listActiveHouseholdInventory,
  removeInventoryGroup,
  setInventoryLotsExpiry,
  updateInventoryItem,
  UpdateInventoryItemInput,
} from "@/repositories";
import { groupInventoryLots, InventoryGroup, InventoryLot, stillGoodExpiryDate } from "@/services";
import { friendlyMessage } from "@/services/edgeErrors";
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
        error: friendlyMessage(error, "Could not load inventory."),
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
      markFirstLotPartial: async (group: InventoryGroup) => {
        const lot = group.lots[0];
        if (!lot) return;
        await advanceInventoryPartialState(lot.id);
        await reloadAndBroadcast();
      },
      updateFirstLot: async (group: InventoryGroup, input: UpdateInventoryItemInput) => {
        const lot = group.lots[0];
        if (!lot) return;
        await updateInventoryItem(lot.id, { category: group.category, ...input });
        await reloadAndBroadcast();
      },
      markGroupStillGood: async (group: InventoryGroup) => {
        await setInventoryLotsExpiry(group.lots.map((lot) => lot.id), stillGoodExpiryDate());
        await reloadAndBroadcast();
      },
      // Bulk variant (batch "still good" in Check these): one expiry write
      // and one reload for the whole selection.
      markGroupsStillGood: async (groups: InventoryGroup[]) => {
        if (groups.length === 0) return;
        const lotIds = groups.flatMap((group) => group.lots.map((lot) => lot.id));
        await setInventoryLotsExpiry(lotIds, stillGoodExpiryDate());
        await reloadAndBroadcast();
      },
      removeGroup: async (group: InventoryGroup, reason: "used" | "discarded") => {
        if (!householdId) return;
        await removeInventoryGroup(group.lots, reason, householdId);
        await reloadAndBroadcast();
      },
      // Bulk variant ("toss all" in Check these): one removal call and one
      // reload for the whole pile instead of one per group.
      removeGroups: async (groups: InventoryGroup[], reason: "used" | "discarded") => {
        if (!householdId || groups.length === 0) return;
        await removeInventoryGroup(groups.flatMap((group) => group.lots), reason, householdId);
        await reloadAndBroadcast();
      },
    }),
    [load, reloadAndBroadcast, householdId],
  );

  // Group at render so the metric/imperial toggle re-formats labels live,
  // without re-fetching inventory.
  const groups = useMemo(() => groupInventoryLots(state.lots, system), [state.lots, system]);

  return { ...state, groups, ...actions };
}
