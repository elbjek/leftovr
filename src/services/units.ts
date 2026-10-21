export type MetricUnit = "ml" | "g";
export type Dimension = "volume" | "mass" | "count";
export type MeasurementSystem = "metric" | "imperial";

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 240,
};

const MASS_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
};

const COUNT_UNITS = new Set(["item", "items", "egg", "eggs", "piece", "pieces"]);

export function toMetric(
  value: number,
  unit: string,
): { value: number; dimension: Dimension | null } {
  const key = unit.trim().toLowerCase();
  if (key in VOLUME_TO_ML) return { value: value * VOLUME_TO_ML[key], dimension: "volume" };
  if (key in MASS_TO_G) return { value: value * MASS_TO_G[key], dimension: "mass" };
  if (COUNT_UNITS.has(key)) return { value, dimension: "count" };
  return { value, dimension: null };
}

export function dimensionOf(netUnit: MetricUnit): "volume" | "mass" {
  return netUnit === "ml" ? "volume" : "mass";
}

const ML_PER_FL_OZ = 29.5735;
const G_PER_OZ = 28.3495;
const G_PER_LB = 453.592;

function trim(n: number): string {
  return Number(n.toFixed(1)).toString();
}

export function formatAmount(
  metricValue: number,
  netUnit: MetricUnit,
  system: MeasurementSystem,
): string {
  if (system === "imperial") {
    if (netUnit === "ml") return `${trim(metricValue / ML_PER_FL_OZ)} fl oz`;
    if (metricValue >= G_PER_LB) return `${trim(metricValue / G_PER_LB)} lb`;
    return `${trim(metricValue / G_PER_OZ)} oz`;
  }
  if (netUnit === "ml") {
    return metricValue >= 1000 ? `${trim(metricValue / 1000)} l` : `${trim(metricValue)} ml`;
  }
  return metricValue >= 1000 ? `${trim(metricValue / 1000)} kg` : `${trim(metricValue)} g`;
}

// ---- Recipe ingredient amounts ("250 grama", "1/2 cup", "2 kašike") ----
//
// One parser for every amount a recipe can carry (model output, any language).
// A recognized mass/volume unit is converted to a unit toMetric() understands;
// only an amount with no recognized unit is read as an item count, so
// "250 grama" can never become 250 items (FIXES B10).

const FRACTIONS: Record<string, number> = {
  "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4, "⅛": 1 / 8,
};

// Alias (lowercase, diacritics folded) → canonical toMetric unit + factor.
const MEASURE_ALIASES: Record<string, [string, number]> = {};
function measure(unit: string, factor: number, aliases: string[]) {
  for (const alias of aliases) MEASURE_ALIASES[alias] = [unit, factor];
}
measure("g", 1, ["g", "gr", "gram", "grams", "grama", "grame", "grami"]);
measure("g", 10, ["dag", "dkg", "dekagram", "dekagrama"]);
measure("kg", 1, ["kg", "kilo", "kila", "kilogram", "kilograms", "kilograma"]);
measure("g", 28.3495, ["oz", "ounce", "ounces"]);
measure("g", 453.592, ["lb", "lbs", "pound", "pounds"]);
measure("ml", 1, ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "mililitar", "mililitra", "mililitara"]);
measure("ml", 10, ["cl"]);
measure("ml", 100, ["dl", "decilitar", "decilitra", "decilitara"]);
measure("l", 1, ["l", "liter", "liters", "litre", "litres", "litar", "litra", "litara"]);
measure("tsp", 1, ["tsp", "teaspoon", "teaspoons", "kasicica", "kasicice"]);
measure("tbsp", 1, ["tbsp", "tablespoon", "tablespoons", "kasika", "kasike", "kasiku"]);
measure("cup", 1, ["cup", "cups", "solja", "solje", "soljica", "soljice"]);

// Units that are neither convertible nor a whole item: depletion takes one use.
const SINGLE_USE_WORDS = new Set([
  "clove", "cloves", "cen", "cena", "cesanj", "slice", "slices", "kriska", "kriske", "krisku",
  "pinch", "pinches", "prstohvat", "handful", "handfuls", "saka", "sake", "can", "cans",
  "konzerva", "konzerve", "bunch", "bunches", "veza", "vezica", "sprig", "sprigs", "grancica",
  "dash", "splash",
]);

export type ParsedAmount = {
  value: number;
  /** Canonical unit for "measure", the raw word for "other", null for "count". */
  unit: string | null;
  kind: "measure" | "count" | "other";
};

function foldDiacritics(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");
}

function parseNumber(text: string): { value: number; rest: string } | null {
  const patterns: [RegExp, (m: RegExpMatchArray) => number][] = [
    [/(\d+)\s+(\d+)\s*\/\s*(\d+)/, (m) => Number(m[1]) + Number(m[2]) / Number(m[3])],
    [/(\d+)\s*\/\s*(\d+)/, (m) => Number(m[1]) / Number(m[2])],
    [/(\d+(?:[.,]\d+)?)\s*([½⅓⅔¼¾⅛])?/, (m) => Number(m[1].replace(",", ".")) + (m[2] ? FRACTIONS[m[2]] : 0)],
    [/([½⅓⅔¼¾⅛])/, (m) => FRACTIONS[m[1]]],
  ];
  // The amount is the earliest number in the text, so "2 cups (1/2 lb)" is
  // 2 cups; at the same position the longest form wins ("1 1/2" over "1").
  let best: { index: number; length: number; value: number } | null = null;
  for (const [pattern, toValue] of patterns) {
    const match = text.match(pattern);
    if (match?.index === undefined) continue;
    if (!best || match.index < best.index || (match.index === best.index && match[0].length > best.length)) {
      best = { index: match.index, length: match[0].length, value: toValue(match) };
    }
  }
  return best ? { value: best.value, rest: text.slice(best.index + best.length) } : null;
}

export function parseIngredientAmount(amount: string): ParsedAmount {
  const text = amount.trim().toLowerCase();
  const number = parseNumber(text);
  const raw = number?.value ?? 1;
  const value = Number.isFinite(raw) && raw > 0 ? raw : 1;
  // Ranges ("2-3 tbsp", "2-3 carrots") keep the first number and the unit.
  const rest = number ? number.rest.replace(/^\s*[-–]\s*\d+(?:[.,]\d+)?/, "") : text;
  const word = rest.match(/^\s*(\p{L}+)/u)?.[1] ?? null;
  if (!word) return { value, unit: null, kind: "count" };
  // No number at all ("a pinch of salt", "salt to taste"): one use, not one
  // whole item.
  if (!number) {
    const key = foldDiacritics(word);
    return { value: 1, unit: word, kind: SINGLE_USE_WORDS.has(key) || !MEASURE_ALIASES[key] ? "other" : "measure" };
  }

  const key = foldDiacritics(word);
  const measured = MEASURE_ALIASES[key];
  if (measured) return { value: value * measured[1], unit: measured[0], kind: "measure" };
  if (SINGLE_USE_WORDS.has(key)) return { value, unit: word, kind: "other" };
  // Anything else is a count word ("kom", "pieces") or the ingredient noun
  // itself ("2 tomatoes", "3 jaja").
  return { value, unit: null, kind: "count" };
}

/** Amount + unit to deplete when a recipe is cooked. */
export function ingredientUse(amount: string): { quantity: number; unit: string } {
  const parsed = parseIngredientAmount(amount);
  return { quantity: parsed.value, unit: parsed.kind === "count" ? "item" : (parsed.unit as string) };
}

/**
 * Sum two ingredient amounts for one food (duplicate recipe rows). Same
 * dimension → added in g/ml; same unit → added as is; otherwise the first is
 * kept rather than adding a cup to grams (C18).
 * ponytail: mixed dimensions drop the second amount; convert via a per-food
 * density table if that ever matters.
 */
export function addAmounts(
  a: { amount: number; unit: string },
  b: { amount: number; unit: string },
): { amount: number; unit: string } {
  const ma = toMetric(a.amount, a.unit);
  const mb = toMetric(b.amount, b.unit);
  if (ma.dimension && ma.dimension === mb.dimension) {
    if (ma.dimension === "count") return { amount: a.amount + b.amount, unit: a.unit };
    return { amount: ma.value + mb.value, unit: ma.dimension === "mass" ? "g" : "ml" };
  }
  if (a.unit.trim().toLowerCase() === b.unit.trim().toLowerCase()) {
    return { amount: a.amount + b.amount, unit: a.unit };
  }
  return a;
}
