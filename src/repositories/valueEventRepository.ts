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
}) {
  if (input.value <= 0) return; // skip unpriced/zero — keeps insight totals clean
  const { error } = await getSupabaseClient().from("value_events").insert({
    household_id: input.householdId,
    kind: input.kind,
    value: input.value,
    normalized_name: input.normalizedName,
    category: input.category,
    created_by: input.createdBy ?? null,
  });
  if (error) throw error;
}

type PricedLot = { category: string; purchase_price: number | null; purchase_amount: number | null; net_unit: string | null };

/** Household's priced lots (active or historical) for cold-start approximation. */
export async function fetchPricedLots(householdId: string): Promise<PricedLot[]> {
  const { data, error } = await getSupabaseClient()
    .from("inventory_items")
    .select("category, purchase_price, purchase_amount, net_unit")
    .eq("household_id", householdId)
    .not("purchase_price", "is", null);
  if (error) throw error;
  return (data ?? []) as PricedLot[];
}
