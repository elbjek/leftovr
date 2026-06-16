// Canonical unit tokens offered in unit pickers. Stored as-is on inventory
// rows; the visible label is localized via the `units` i18n namespace.
export const UNIT_OPTIONS = [
  "pcs",
  "pack",
  "bottle",
  "can",
  "jar",
  "carton",
  "bag",
  "box",
  "L",
  "ml",
  "kg",
  "g",
] as const;

export type UnitOption = (typeof UNIT_OPTIONS)[number];

export const DEFAULT_UNIT: UnitOption = "pcs";

// Maps free-form scanned/legacy units (EN + SR aliases) onto a canonical token.
const UNIT_ALIASES: Record<string, UnitOption> = {
  item: "pcs",
  items: "pcs",
  piece: "pcs",
  pieces: "pcs",
  pc: "pcs",
  pcs: "pcs",
  kom: "pcs",
  komad: "pcs",
  egg: "pcs",
  pack: "pack",
  pak: "pack",
  pkg: "pack",
  pakovanje: "pack",
  bottle: "bottle",
  boca: "bottle",
  flasa: "bottle",
  "flaša": "bottle",
  can: "can",
  konzerva: "can",
  limenka: "can",
  jar: "jar",
  tegla: "jar",
  carton: "carton",
  karton: "carton",
  bag: "bag",
  kesa: "bag",
  box: "box",
  kutija: "box",
  l: "L",
  lit: "L",
  litar: "L",
  liter: "L",
  ml: "ml",
  kg: "kg",
  kilogram: "kg",
  g: "g",
  gr: "g",
  gram: "g",
};

export function normalizeUnit(raw: string | null | undefined): UnitOption {
  if (!raw) return DEFAULT_UNIT;
  const key = raw.trim().toLowerCase();
  return UNIT_ALIASES[key] ?? DEFAULT_UNIT;
}
