import { useCallback, useEffect, useState } from "react";

import {
  addShoppingItem,
  BuyAgainItem,
  deleteShoppingItem,
  dismissShoppingSuggestion,
  getShoppingReminder,
  listBuyAgain,
  listShoppingDismissals,
  listShoppingItems,
  setShoppingItemChecked,
  ShoppingListItem,
  ShoppingReminder,
  updateShoppingReminder,
} from "@/repositories";

type State = {
  loading: boolean;
  items: ShoppingListItem[];
  buyAgain: BuyAgainItem[];
  dismissals: Record<string, string>;
  reminder: ShoppingReminder | null;
};

const EMPTY: State = { loading: false, items: [], buyAgain: [], dismissals: {}, reminder: null };

// Kitchen's card and the list screen each hold a copy; a change in one
// refreshes the other (same pattern as useInventory).
const listeners = new Set<() => void>();

export function useShoppingList(householdId?: string | null) {
  const [state, setState] = useState<State>({ ...EMPTY, loading: Boolean(householdId) });

  const load = useCallback(async () => {
    if (!householdId) {
      setState(EMPTY);
      return;
    }
    const [items, buyAgain, dismissals, reminder] = await Promise.all([
      listShoppingItems(householdId),
      // Suggestions are a nice-to-have: a failure leaves the list working.
      listBuyAgain(householdId).catch(() => [] as BuyAgainItem[]),
      listShoppingDismissals(householdId).catch(() => ({})),
      getShoppingReminder(householdId),
    ]);
    setState({ loading: false, items, buyAgain, dismissals, reminder });
  }, [householdId]);

  useEffect(() => {
    const listener = () => void load().catch(() => undefined);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [load]);

  const mutate = useCallback(async (action: () => Promise<void>) => {
    await action();
    for (const listener of listeners) listener();
  }, []);

  return {
    ...state,
    openCount: state.items.filter((item) => !item.checked_at).length,
    refresh: load,
    add: (name: string) => mutate(() => addShoppingItem(householdId as string, name)),
    setChecked: (id: string, checked: boolean) => mutate(() => setShoppingItemChecked(id, checked)),
    remove: (id: string) => mutate(() => deleteShoppingItem(id)),
    dismiss: (itemKey: string) => mutate(() => dismissShoppingSuggestion(householdId as string, itemKey)),
    setReminder: (reminder: ShoppingReminder) => mutate(() => updateShoppingReminder(householdId as string, reminder)),
  };
}
