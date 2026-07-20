// Annual price → per-month currency string (e.g. "$5.83"). Falls back to the
// provided string when there's no package or the currency code is unusable.
export function formatPerMonth(
  pkg: { product: { price: number; currencyCode: string } } | null,
  fallback: string,
): string {
  if (!pkg) return fallback;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: pkg.product.currencyCode,
    }).format(pkg.product.price / 12);
  } catch {
    return fallback;
  }
}

// Discount of the yearly plan vs paying monthly for 12 months, as a rounded
// whole percent. Returns null when either package is missing or the math isn't
// a real saving (drives whether the "Save X%" badge shows at all).
export function savePercent(
  monthly: { product: { price: number } } | null,
  yearly: { product: { price: number } } | null,
): number | null {
  if (!monthly || !yearly) return null;
  const fullYear = monthly.product.price * 12;
  if (!fullYear) return null;
  const pct = Math.round((1 - yearly.product.price / fullYear) * 100);
  return pct > 0 ? pct : null;
}
