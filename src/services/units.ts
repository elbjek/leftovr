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
