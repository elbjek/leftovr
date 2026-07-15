import {
  buildReceiptConfirmItemsFromLines,
  NormalizedReceiptLine,
  ReceiptConfirmItem,
} from "./receiptService";

/**
 * Pantry photos overlap (the same shelf shows up in more than one shot), so the
 * model can still return the same product twice even though the prompt asks it
 * to merge. Deterministic guard: collapse lines that normalize to the same food,
 * keeping the sighting the model was most confident about. Quantities take the
 * max, not the sum — duplicate lines are overlapping views of the same shelf,
 * not extra stock.
 */
export function mergePantryLines(lines: NormalizedReceiptLine[]): NormalizedReceiptLine[] {
  const byFood = new Map<string, NormalizedReceiptLine>();
  for (const line of lines) {
    const key = line.item.normalizedName.trim().toLowerCase();
    const existing = byFood.get(key);
    if (!existing) {
      byFood.set(key, line);
      continue;
    }
    const best = line.confidence > existing.confidence ? line : existing;
    const quantity = Math.max(existing.item.quantity ?? 1, line.item.quantity ?? 1);
    byFood.set(key, {
      ...best,
      item: { ...best.item, quantity },
    });
  }
  return [...byFood.values()];
}

/** Detected pantry lines → the same editable confirm rows a receipt scan uses. */
export function buildPantryConfirmItems(lines: NormalizedReceiptLine[]): ReceiptConfirmItem[] {
  return buildReceiptConfirmItemsFromLines(mergePantryLines(lines));
}
