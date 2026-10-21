import { getSupabaseClient } from "@/lib/supabase";
import { categoryAverageUnitPrice } from "@/lib/money";

export type ValueEventKind = "spend" | "saved" | "wasted";

// Re-exported so price-capture callers get the approximation helper alongside
// the event writer. Pure math lives in @/lib/money (testable without RN).
export { categoryAverageUnitPrice };

export async function insertValueEvent(input: {
  householdId: string;
  kind: ValueEventKind;
  value: number;
  normalizedName: string;
  category: string;
  createdBy?: string | null;
  /** Omit for "today's household currency" (a DB trigger stamps it). */
  currency?: string | null;
}) {
  if (input.value <= 0) return; // skip unpriced/zero — keeps insight totals clean
  const { error } = await getSupabaseClient().from("value_events").insert({
    household_id: input.householdId,
    kind: input.kind,
    value: input.value,
    normalized_name: input.normalizedName,
    category: input.category,
    created_by: input.createdBy ?? null,
    ...(input.currency ? { currency: input.currency } : {}),
  });
  if (error) throw error;
}

type PricedLot = { category: string; purchase_price: number | null; purchase_amount: number | null; net_unit: string | null };

/** Household's priced lots (active or historical) for cold-start approximation,
 *  in the household's current currency only — averages must not mix (C16). */
export async function fetchPricedLots(householdId: string): Promise<PricedLot[]> {
  const { data, error } = await getSupabaseClient()
    .from("inventory_items")
    .select("category, purchase_price, purchase_amount, net_unit, purchase_currency, households!inner(currency_code)")
    .eq("household_id", householdId)
    .not("purchase_price", "is", null);
  if (error) throw error;
  type Row = PricedLot & { purchase_currency: string | null; households: { currency_code: string } };
  return ((data ?? []) as unknown as Row[])
    .filter((row) => row.purchase_currency == null || row.purchase_currency === row.households.currency_code)
    .map(({ category, purchase_price, purchase_amount, net_unit }) => ({ category, purchase_price, purchase_amount, net_unit }));
}
