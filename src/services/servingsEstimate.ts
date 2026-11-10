import type { InventoryLot } from "./inventoryRules";
import { getGramsPerItem } from "./inventoryRules";
import { BASE_MATCHERS, type BasePreference } from "./recipeService";
import { ingredientUse, toMetric } from "./units";

// How many people the kitchen (or one recipe) can feed, worked out on the
// device from amounts we already store. No AI, no network: it is a guide for a
// warning, never a gate, so every figure is "about".

type Meal = "breakfast" | "lunch" | "dinner" | "snack" | "side";

/** One dinner portion, in grams, of each base. */
const PORTION_G: Record<BasePreference, number> = {
  protein: 150,
  vegetables: 200,
  pasta: 90, // dry
  rice: 75, // dry
  potatoes: 250,
  bread: 100,
  cheese: 60,
};

/** Smaller plates for lighter meals. */
const MEAL_FACTOR: Record<Meal, number> = { breakfast: 0.7, lunch: 1, dinner: 1, snack: 0.4, side: 0.5 };

/** A counted item's weight when the catalog doesn't know it: a loose piece, or a pack/bag/box/can. */
const ITEM_G: Record<BasePreference, { piece: number; pack: number }> = {
  protein: { piece: 200, pack: 500 },
  vegetables: { piece: 150, pack: 500 },
  pasta: { piece: 500, pack: 500 },
  rice: { piece: 1000, pack: 1000 },
  potatoes: { piece: 200, pack: 2000 },
  bread: { piece: 500, pack: 400 },
  cheese: { piece: 250, pack: 250 },
};

// Two eggs make a protein portion; a bun, roll or wrap is about one portion of bread.
const EGG_G = 75;
const SMALL_BREAD = ["bun", "roll", "tortilla", "wrap", "pita"];

const PARTIAL_FACTOR = { full: 1, some_used: 0.5, low: 0.25 } as const;

type LotAmount = Pick<InventoryLot, "normalized_name" | "category" | "quantity" | "unit" | "net_amount" | "net_unit" | "partial_state">;

function baseOf(lot: LotAmount): BasePreference | null {
  const name = lot.normalized_name?.toLowerCase() ?? "";
  // One base per food, so nothing is counted twice. A name match beats a
  // category match: potatoes are filed under vegetables but are a potato base.
  const byName = BASE_MATCHERS.find((m) => m.keywords?.some((k) => name.includes(k)));
  const byCategory = BASE_MATCHERS.find((m) => m.categories?.includes(lot.category));
  return (byName ?? byCategory)?.base ?? null;
}

/** About how many grams a lot holds; null for liquids. */
export function lotGrams(lot: LotAmount, base: BasePreference | null): number | null {
  const partial = PARTIAL_FACTOR[lot.partial_state] ?? 1;
  if (lot.net_unit === "ml") return null;
  if (lot.net_amount != null && lot.net_unit === "g") return lot.net_amount * partial;
  const unit = lot.unit?.trim().toLowerCase();
  if (unit === "kg") return lot.quantity * 1000 * partial;
  if (unit === "g") return lot.quantity * partial;
  if (unit === "bottle" || unit === "carton") return null;
  const name = lot.normalized_name?.toLowerCase() ?? "";
  const known = getGramsPerItem(lot.normalized_name);
  let each: number;
  if (known) each = known;
  else if (name.includes("egg")) each = EGG_G;
  else if (base === "bread" && SMALL_BREAD.some((k) => name.includes(k))) each = PORTION_G.bread;
  else if (base) each = unit === "pcs" || !unit ? ITEM_G[base].piece : ITEM_G[base].pack;
  else return null;
  return lot.quantity * each * partial;
}

/**
 * About how many people the kitchen can feed for this meal. A dish needs a
 * main: with protein, its portions, stretched by up to half again when there
 * are carbs to bulk it out; otherwise the single best base (a pasta dish, a
 * potato dish). A chosen "build around" base counts on its own.
 * ponytail: one dish at a time, from bases only; sauces, spices and liquids
 * don't feed anyone here.
 */
export function estimateServings(lots: LotAmount[], opts: { meal?: Meal; base?: BasePreference } = {}): number {
  const factor = MEAL_FACTOR[opts.meal ?? "dinner"];
  const grams: Partial<Record<BasePreference, number>> = {};
  for (const lot of lots) {
    const base = baseOf(lot);
    if (!base) continue;
    const g = lotGrams(lot, base);
    if (g) grams[base] = (grams[base] ?? 0) + g;
  }
  const portions = (base: BasePreference) => (grams[base] ?? 0) / (PORTION_G[base] * factor);
  const carbs = portions("pasta") + portions("rice") + portions("potatoes") + portions("bread");
  const protein = portions("protein");
  const stretched = Math.min(protein * 1.5, protein + carbs);
  if (opts.base) {
    return Math.floor(opts.base === "protein" ? stretched : portions(opts.base));
  }
  return Math.floor(
    Math.max(stretched, portions("pasta"), portions("rice"), portions("potatoes"), portions("bread"), portions("vegetables")),
  );
}

/** One recipe ingredient against the kitchen lots that match it. */
export type IngredientCoverage = {
  /** Have ÷ need; 1 or more means enough. */
  ratio: number;
  /** How much is missing, in grams or items; 0 when there's enough. */
  short: number;
  dimension: "mass" | "count";
};

/**
 * Compares a recipe amount ("600 g", "4 eggs") with what the matching lots
 * hold. Null when it can't be compared: liquids, spoonfuls, pinches, or a
 * counted lot against grams with no known item weight.
 */
export function ingredientCoverage(amount: string, lots: LotAmount[], name: string): IngredientCoverage | null {
  const use = ingredientUse(amount);
  const need = toMetric(use.quantity, use.unit);
  if (need.dimension !== "mass" && need.dimension !== "count") return null;
  if (need.value <= 0 || lots.length === 0) return null;
  const perItem = getGramsPerItem(name);
  let have = 0;
  for (const lot of lots) {
    const partial = PARTIAL_FACTOR[lot.partial_state] ?? 1;
    const unit = lot.unit?.trim().toLowerCase();
    const lotG =
      lot.net_amount != null && lot.net_unit === "g"
        ? lot.net_amount * partial
        : unit === "kg"
          ? lot.quantity * 1000 * partial
          : unit === "g"
            ? lot.quantity * partial
            : null;
    if (need.dimension === "mass") {
      if (lotG != null) have += lotG;
      else if (perItem) have += lot.quantity * perItem * partial;
      else return null;
    } else {
      if (lotG == null) have += lot.quantity * partial;
      else if (perItem) have += lotG / perItem;
      else return null;
    }
  }
  const ratio = have / need.value;
  return { ratio, short: ratio >= 1 ? 0 : need.value - have, dimension: need.dimension };
}

/** "Enough for about N" across a recipe: the tightest ingredient decides. Null when nothing is short. */
export function recipeFeeds(coverages: (IngredientCoverage | null)[], servings: number): number | null {
  const ratios = coverages.filter((c): c is IngredientCoverage => c !== null).map((c) => c.ratio);
  if (ratios.length === 0) return null;
  const tightest = Math.min(...ratios);
  return tightest >= 1 ? null : Math.floor(tightest * servings);
}
