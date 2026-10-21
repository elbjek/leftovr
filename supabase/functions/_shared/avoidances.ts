// Dietary avoidance matching for AI recipes (FIXES B16). Profiles store the
// five avoidance keys in English, but recipes are written in the user's
// language, and even English recipes say "cheese", not "dairy". Match each key
// against food words in English and Serbian, on whole words (diacritics
// folded) so "sirće" (vinegar) never matches "sir" (cheese).
//
// exact: the word must equal one of these. prefix: the word starts with it
// (inflections: "piletinom", "almonds"); only stems of 5+ letters.

type AvoidanceWords = { exact: string[]; prefix: string[] };

const AVOIDANCE_WORDS: Record<string, AvoidanceWords> = {
  meat: {
    exact: ["meat", "ham", "beef", "pork", "lamb", "veal", "duck", "meso", "mesa", "mesom", "mesu", "pile", "pileci", "pileca", "pilece", "sunka", "sunke", "sunkom", "prsut", "prsuta"],
    prefix: ["chicken", "turkey", "bacon", "sausage", "salami", "mince", "prosciutto", "steak", "piletin", "svinjetin", "junetin", "teletin", "curetin", "jagnjetin", "slanin", "kobasic", "salam", "cevap", "pljeskavic"],
  },
  fish: {
    exact: ["fish", "cod", "tuna", "riba", "ribe", "ribom", "ribu", "losos", "oslic", "skampi", "skusa", "incuni"],
    prefix: ["salmon", "trout", "sardin", "anchov", "shrimp", "prawn", "seafood", "lososa", "tunjevin", "pastrmk", "skusk"],
  },
  dairy: {
    exact: ["milk", "butter", "buttered", "buttery", "ghee", "feta", "sir", "sira", "sirom", "siru", "sirevi", "mleko", "mleka", "mlekom", "mleku", "puter", "kefir"],
    prefix: ["dairy", "cheese", "cream", "yogurt", "yoghurt", "mozzarel", "parmesan", "cheddar", "ricotta", "mascarpone", "maslac", "pavlak", "jogurt", "kajmak", "mileram", "mlecn"],
  },
  gluten: {
    exact: ["rye", "pita", "hleb", "hleba", "hlebom", "griz", "kifla", "kifle"],
    prefix: ["gluten", "wheat", "flour", "bread", "pasta", "spaghetti", "noodle", "couscous", "barley", "semolina", "tortilla", "brasn", "testenin", "spaget", "kuskus", "jecam", "prezl", "tortilj", "pecivo", "lepinj", "makaron"],
  },
  nuts: {
    exact: ["nut", "nuts", "orah", "oraha", "orasi", "badem", "badema", "kikiriki"],
    prefix: ["almond", "walnut", "hazelnut", "peanut", "cashew", "pistachio", "pecan", "lesnik", "lesnic", "pistac", "indijsk"],
  },
};

function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj")
    .toLowerCase()
    .match(/\p{L}+/gu) ?? [];
}

/** True when `text` mentions food covered by the avoidance key. Unknown keys
 *  (custom text) fall back to a plain substring match. */
export function mentionsAvoidance(text: string, avoidance: string): boolean {
  const key = avoidance.toLowerCase().trim();
  const list = AVOIDANCE_WORDS[key];
  if (!list) return text.toLowerCase().includes(key);
  return words(text).some(
    (word) => list.exact.includes(word) || list.prefix.some((stem) => word.startsWith(stem)),
  );
}
