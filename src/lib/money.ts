/** Per-unit price from a total and the amount it covered. Null when unknowable. */
export function deriveUnitPrice(
  total: number | null | undefined,
  basisAmount: number | null | undefined,
): number | null {
  if (total == null || !basisAmount || basisAmount <= 0) return null;
  return total / basisAmount;
}

export type PricedLot = {
  category: string;
  purchase_price: number | null;
  purchase_amount: number | null;
  /** Basis of purchase_amount: "g"/"ml" when net-priced, null when a count. */
  net_unit: string | null;
};

/**
 * Average derived unit price across a category's priced lots sharing the same
 * basis (per g, per ml, or per item — never mixed). Null if none.
 */
export function categoryAverageUnitPrice(
  lots: PricedLot[],
  category: string,
  basisUnit: string | null,
): number | null {
  const unitPrices = lots
    .filter((l) => l.category === category && (l.net_unit ?? null) === basisUnit)
    .map((l) => deriveUnitPrice(l.purchase_price, l.purchase_amount))
    .filter((p): p is number => p != null);
  if (unitPrices.length === 0) return null;
  return unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length;
}

/** Money value of a consumed/discarded amount at a unit price. */
export function valueOfAmount(amount: number, unitPrice: number | null): number {
  if (!unitPrice || amount <= 0) return 0;
  return amount * unitPrice;
}

/** Currency-formatted amount. Uses Intl; falls back to "<code> <value>". */
export function formatMoney(value: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}
