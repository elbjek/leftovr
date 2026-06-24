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
