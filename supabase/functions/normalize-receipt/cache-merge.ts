// Pure cache-merge logic for receipt line normalization. Deno-free so the
// vitest suite can exercise it directly.

export const CACHE_WRITE_CONFIDENCE = 0.8;

export type NormalizedItem = {
  name: string;
  normalizedName: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  netAmount: number | null;
  netUnit: string | null;
  // Per-purchase, so never cached: price stays with the live scan, not the
  // canonical item identity (the same product costs differently over time).
  price: number | null;
  priceApproximate: boolean;
};

export type NormalizedLine = {
  rawText: string;
  confidence: number;
  item: NormalizedItem;
};

export type ReceiptLineCacheRow = {
  store_chain: string;
  raw_line_text: string;
  name: string;
  normalized_name: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  net_amount: number | null;
  net_unit: string | null;
  confidence: number;
};

export type CacheMergeResult = {
  lines: NormalizedLine[];
  /** Rows to upsert: confident model output for lines the cache didn't know. */
  writes: ReceiptLineCacheRow[];
  /** raw_line_text values served from cache (for hit_count bookkeeping). */
  hits: string[];
};

// Lines from receipts whose store couldn't be read all share this chain, so
// across households one key would mean unrelated products (B8).
export const UNKNOWN_STORE = "unknown";

/**
 * Cached entries override the model's item identity (name, match key,
 * category, printed pack size) so the same receipt line always normalizes to
 * the same item. Quantity, unit and price are per purchase and always come
 * from the live scan (B8). Misses qualify for write-back only when the model
 * was confident, to avoid poisoning the cache with guesses. The "unknown"
 * store is never read or written.
 */
export function mergeWithCache(
  storeChain: string,
  lines: NormalizedLine[],
  cacheRows: ReceiptLineCacheRow[],
): CacheMergeResult {
  if (storeChain === UNKNOWN_STORE) return { lines, writes: [], hits: [] };
  const cacheByLine = new Map(cacheRows.map((row) => [row.raw_line_text, row]));
  const merged: NormalizedLine[] = [];
  const writes: ReceiptLineCacheRow[] = [];
  const hits: string[] = [];
  const written = new Set<string>();

  for (const line of lines) {
    const cached = cacheByLine.get(line.rawText);
    if (cached) {
      hits.push(line.rawText);
      merged.push({
        rawText: line.rawText,
        confidence: cached.confidence,
        item: {
          name: cached.name,
          normalizedName: cached.normalized_name,
          category: cached.category,
          // Per purchase: "2 x" this time doesn't mean 2 next time.
          quantity: line.item.quantity,
          unit: line.item.unit,
          netAmount: cached.net_amount,
          netUnit: cached.net_unit,
          // Price comes from the current scan, not the cache.
          price: line.item.price,
          priceApproximate: line.item.priceApproximate,
        },
      });
      continue;
    }

    merged.push(line);
    if (line.confidence >= CACHE_WRITE_CONFIDENCE && !written.has(line.rawText)) {
      written.add(line.rawText);
      writes.push({
        store_chain: storeChain,
        raw_line_text: line.rawText,
        name: line.item.name,
        normalized_name: line.item.normalizedName,
        category: line.item.category,
        quantity: line.item.quantity,
        unit: line.item.unit,
        net_amount: line.item.netAmount,
        net_unit: line.item.netUnit,
        confidence: line.confidence,
      });
    }
  }

  return { lines: merged, writes, hits };
}
