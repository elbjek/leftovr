import icons from "../../assets/food-icons/icons.json";

// Which bundled food icon (assets/food-icons) stands for an item, by name.
// Names are matched as whole words, longest phrase first, so "cream cheese"
// beats "cream" and "oat milk" beats "oats". An item no phrase matches gets
// its category's icon. ponytail: name matching, no stored icon key; if too many
// items fall back to their category, have the scanners pick an icon instead.

// Names a food goes by beyond its icon's own English and Serbian names.
const EXTRA: Record<string, string[]> = {
  cheese: ["cheddar", "gouda", "edam", "emmental", "parmesan", "parmigiano", "grana padano", "trapist", "gauda"],
  white_cheese: ["feta", "cottage cheese", "mladi sir", "halloumi", "ricotta"],
  yogurt: ["yoghurt", "skyr"],
  cream: ["sour cream", "heavy cream", "whipping cream", "cooking cream", "creme fraiche", "kisela pavlaka", "slatka pavlaka"],
  cream_cheese: ["mascarpone", "philadelphia"],
  kefir: ["buttermilk", "ayran"],
  chicken: ["drumstick", "chicken thigh", "chicken wing", "whole chicken", "turkey"],
  ground_meat: ["ground beef", "ground pork", "minced meat", "minced beef", "mince"],
  beef: ["steak", "sirloin", "ribeye", "veal", "teletina", "junetina"],
  pork: ["pork chop", "pork loin"],
  bacon: ["pancetta", "panceta"],
  ham: ["turkey slices", "deli meat", "cold cuts"],
  sausage: ["hot dog", "frankfurter", "virsla", "kulen", "chorizo"],
  salami: ["pepperoni"],
  fish: ["mackerel", "smoked mackerel", "tuna steak", "trout", "sea bass", "bream", "carp", "pastrmka", "skusa", "saran"],
  white_fish: ["cod", "hake", "pollock", "tilapia", "oslic"],
  shrimp: ["prawn", "scampi", "skampi"],
  tuna: ["canned tuna"],
  tomato: ["cherry tomato"],
  bell_pepper: ["pepper", "capsicum"],
  chili: ["chilli", "jalapeno", "hot pepper", "ljuta paprika"],
  onion: ["shallot"],
  spring_onion: ["green onion", "scallion"],
  lettuce: ["iceberg", "romaine", "rocket", "arugula", "rukola", "salad leaves", "mixed greens"],
  mushrooms: ["champignon", "sampinjoni"],
  corn: ["sweetcorn"],
  parsley: ["cilantro", "coriander"],
  basil: ["mint"],
  mandarin: ["clementine", "tangerine"],
  lemon: ["lemon juice"],
  lime: ["lime juice"],
  bread: ["sourdough", "toast", "bagel", "loaf", "rye bread"],
  roll: ["bun"],
  flatbread: ["pita", "naan"],
  tortilla: ["wrap"],
  pastry: ["croissant", "muffin"],
  pasta: ["penne", "fusilli", "macaroni", "farfalle", "tagliatelle", "lasagne", "lasagna", "gnocchi"],
  noodles: ["ramen", "udon"],
  spices: ["black pepper", "cayenne", "paprika powder", "oregano", "cinnamon", "cumin", "turmeric", "curry", "vanilla", "thyme", "rosemary", "bay leaf", "seasoning", "vegeta", "biber"],
  oil: ["sunflower oil", "vegetable oil", "rapeseed oil", "canola oil"],
  sauce: ["ketchup", "mustard", "mayonnaise", "mayo", "soy sauce", "bbq sauce", "hot sauce", "senf", "kecap"],
  passata: ["tomato sauce", "tomato paste", "tomato puree", "pasta sauce", "pelat"],
  pickles: ["pickle", "gherkin", "pickled", "tursija"],
  jam: ["marmalade", "pekmez"],
  oats: ["oatmeal", "porridge", "muesli"],
  cereal: ["corn flakes", "cornflakes", "granola"],
  beans: ["kidney beans", "baked beans"],
  chickpeas: ["garbanzo"],
  canned_tomatoes: ["chopped tomatoes", "diced tomatoes"],
  nuts: ["walnut", "almond", "hazelnut", "cashew", "peanut", "pistachio", "orasi"],
  coffee: ["espresso", "cold brew"],
  frozen_vegetables: ["mixed vegetables", "frozen veg"],
  fries: ["french fries"],
  frozen_pizza: ["pizza"],
  ice_cream: ["gelato"],
  juice: ["orange juice", "apple juice", "tomato juice", "grape juice"],
  soda: ["cola", "coke", "sprite", "fanta", "soft drink", "lemonade", "tonic"],
  wine: ["prosecco", "champagne"],
  plant_milk: ["oat milk", "soy milk", "almond milk", "rice milk", "coconut milk", "oat drink"],
  chips: ["crisps"],
  biscuits: ["cookie", "wafer"],
  crackers: ["rice cakes", "crispbread", "breadsticks", "grisini"],
};

/** Lowercase, Serbian letters folded to ASCII, words space-padded. */
function words(text: string): string {
  const folded = text
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "dj")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return ` ${folded} `;
}

const IDS = new Set([...icons.foods, ...icons.categories].map((icon) => icon.id));

// [phrase, icon id], longest phrase first. Category icons are reached by
// category, never by name.
const PHRASES: [string, string][] = (() => {
  const pairs = new Map<string, string>();
  const add = (phrase: string, id: string) => {
    const key = words(phrase).trim();
    if (key && !pairs.has(key)) pairs.set(key, id);
  };
  for (const icon of icons.foods) {
    add(icon.name, icon.id);
    add(icon.sr, icon.id);
    for (const alias of EXTRA[icon.id] ?? []) add(alias, icon.id);
    // Singular of plural names ("cherries" → "cherry", "eggs" → "egg").
    const en = words(icon.name).trim();
    if (en.endsWith("ies")) add(`${en.slice(0, -3)}y`, icon.id);
    else if (en.endsWith("s") && !en.endsWith("ss")) add(en.slice(0, -1), icon.id);
  }
  return [...pairs].sort((a, b) => b[0].length - a[0].length);
})();

const cache = new Map<string, string | null>();

/** The icon id for a food name (or an icon id itself), else the category's
 *  icon, else null. */
export function foodIconKey(name: string | null | undefined, category?: string | null): string | null {
  const raw = (name ?? "").trim().toLowerCase();
  if (IDS.has(raw)) return raw;
  const cacheKey = `${raw}|${category ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const text = words(raw);
  let hit: string | null = null;
  for (const [phrase, id] of PHRASES) {
    if (text.includes(` ${phrase} `) || text.includes(` ${phrase}s `) || text.includes(` ${phrase}es `)) {
      hit = id;
      break;
    }
  }
  // Screens pass the DB form ("dairy_eggs") or the UI form ("dairy-eggs").
  const categoryId = category ? `category_${category.replace("-", "_")}` : "";
  if (!hit && IDS.has(categoryId)) hit = categoryId;
  cache.set(cacheKey, hit);
  return hit;
}

// For matching one food across names (shopping list ticks, Buy again
// grouping): only each icon's own English and Serbian names, never the EXTRA
// aliases, which lump distinct products under one icon (ketchup and mustard
// are both "sauce"). English plurals fold as above; a Serbian name ending in a
// vowel also matches its other endings ("jaja" ~ "jaje", "jabuka" ~ "jabuke").
// ponytail: last-vowel swap only, so "hleb" ~ "hlebovi" doesn't match.
const OWN_PHRASES: [string, string][] = (() => {
  const pairs = new Map<string, string>();
  const add = (phrase: string, id: string) => {
    const key = words(phrase).trim();
    if (key && !pairs.has(key)) pairs.set(key, id);
  };
  for (const icon of icons.foods) {
    const en = words(icon.name).trim();
    add(en, icon.id);
    if (en.endsWith("ies")) add(`${en.slice(0, -3)}y`, icon.id);
    else if (en.endsWith("s") && !en.endsWith("ss")) add(en.slice(0, -1), icon.id);
    const sr = words(icon.sr).trim();
    add(sr, icon.id);
    // Skip 2-3 letter names: "so" (salt) would turn into "sa"/"se", which are
    // everyday Serbian words.
    if (sr.length >= 4 && /[aeiou]$/.test(sr)) {
      for (const vowel of "aeiou") add(`${sr.slice(0, -1)}${vowel}`, icon.id);
    }
  }
  return [...pairs].sort((a, b) => b[0].length - a[0].length);
})();

/** Catalog foods whose English or Serbian name has a word starting with the
 *  query, names starting with it first; named in the app's language. Aliases
 *  are left out ("feta" shouldn't offer "White cheese"). */
export function searchFoods(query: string, language: string, limit = 5): { id: string; name: string }[] {
  const q = words(query).trim();
  if (!q) return [];
  const hits: { id: string; name: string; rank: number }[] = [];
  for (const icon of icons.foods) {
    const names = [words(icon.name), words(icon.sr)];
    const rank = names.some((n) => n.startsWith(` ${q}`)) ? 0 : names.some((n) => n.includes(` ${q}`)) ? 1 : -1;
    if (rank >= 0) hits.push({ id: icon.id, name: language.startsWith("sr") ? icon.sr : icon.name, rank });
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ id, name }) => ({ id, name }));
}

/** The catalog food a name is, by the icon's own names only; null if none. */
export function foodMatchKey(name: string | null | undefined): string | null {
  const text = words(name ?? "");
  for (const [phrase, id] of OWN_PHRASES) {
    if (text.includes(` ${phrase} `) || text.includes(` ${phrase}s `) || text.includes(` ${phrase}es `)) return id;
  }
  return null;
}
