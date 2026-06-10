import { mockBarcodeProducts } from "@/mocks";
import { InventoryCategory } from "./inventoryRules";

export type BarcodeProduct = {
  barcode: string;
  name: string;
  brandName?: string | null;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  netAmount?: number | null;
  netUnit?: "ml" | "g" | null;
};

type OpenFoodFactsProduct = {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  generic_name_en?: string;
  brands?: string;
  quantity?: string;
  categories_tags?: string[];
};

type OpenFoodFactsResponse = {
  status?: string | number;
  product?: OpenFoodFactsProduct;
};

const OPEN_FOOD_FACTS_BASE_URL = "https://world.openfoodfacts.org/api/v3.6/product";
const OPEN_FOOD_FACTS_SEARCH_URL = "https://search.openfoodfacts.org/search";
const OPEN_FOOD_FACTS_SEARCH_TIMEOUT_MS = 6000;
const OPEN_FOOD_FACTS_SEARCH_FIELDS = "code,product_name,brands,quantity,categories_tags";
const OPEN_FOOD_FACTS_FIELDS = [
  "product_name",
  "product_name_en",
  "generic_name",
  "generic_name_en",
  "brands",
  "quantity",
  "categories_tags",
].join(",");

export async function lookupBarcodeProduct(barcode: string): Promise<BarcodeProduct | null> {
  const openFoodFactsProduct = await lookupOpenFoodFactsBarcode(barcode);
  const mockProduct = lookupMockBarcode(barcode);

  if (!openFoodFactsProduct) return mockProduct;
  if (!mockProduct) return openFoodFactsProduct;

  return {
    ...openFoodFactsProduct,
    brandName: openFoodFactsProduct.brandName ?? mockProduct.brandName,
    category: openFoodFactsProduct.category === "other" ? mockProduct.category : openFoodFactsProduct.category,
    unit: openFoodFactsProduct.netAmount ? openFoodFactsProduct.unit : mockProduct.unit,
    netAmount: openFoodFactsProduct.netAmount ?? mockProduct.netAmount ?? null,
    netUnit: openFoodFactsProduct.netUnit ?? mockProduct.netUnit ?? null,
  };
}

export function lookupMockBarcode(barcode: string): BarcodeProduct | null {
  const product = mockBarcodeProducts.find((candidate) => candidate.barcode === barcode);
  return product ? { ...product } : null;
}

export async function lookupOpenFoodFactsBarcode(barcode: string): Promise<BarcodeProduct | null> {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) return null;

  try {
    const params = new URLSearchParams({ fields: OPEN_FOOD_FACTS_FIELDS });
    const response = await fetch(`${OPEN_FOOD_FACTS_BASE_URL}/${encodeURIComponent(normalizedBarcode)}.json?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Chomp/1.0 (local-dev@chomp.app)",
      },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as OpenFoodFactsResponse;
    if (!isFoundStatus(payload.status) || !payload.product) return null;

    const name = getProductName(payload.product);
    if (!name) return null;
    const packageAmount = parseOpenFoodFactsQuantity(payload.product.quantity);

    return {
      barcode: normalizedBarcode,
      name,
      brandName: getBrandName(payload.product.brands),
      category: inferOpenFoodFactsCategory(payload.product.categories_tags ?? []),
      quantity: 1,
      unit: packageAmount ? "package" : "item",
      netAmount: packageAmount?.netAmount ?? null,
      netUnit: packageAmount?.netUnit ?? null,
    };
  } catch {
    return null;
  }
}

export function inferOpenFoodFactsCategory(tags: string[]): InventoryCategory {
  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  const includes = (needles: string[]) =>
    normalizedTags.some((tag) => needles.some((needle) => tag.includes(needle)));

  if (includes(["dair", "milk", "yogurt", "cheese", "egg"])) return "dairy_eggs";
  if (includes(["meat", "poultry", "beef", "pork", "chicken", "sausage"])) return "meat";
  if (includes(["fish", "seafood", "salmon", "tuna"])) return "fish";
  if (includes(["vegetable", "legume", "salad"])) return "vegetables";
  if (includes(["beverage", "drink", "juice", "water", "soda"])) return "drinks";
  if (includes(["fruit"])) return "fruit";
  if (includes(["bread", "bakery", "pastry"])) return "bakery";
  if (includes(["frozen"])) return "frozen";
  if (includes(["snack", "chip", "crisp", "biscuit", "cookie", "confection", "chocolate"])) return "snacks";
  if (includes(["pasta", "rice", "cereal", "sauce", "oil", "condiment", "canned", "grocery"])) return "pantry";
  return "other";
}

function getProductName(product: OpenFoodFactsProduct) {
  return [
    product.product_name_en,
    product.product_name,
    product.generic_name_en,
    product.generic_name,
  ].find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

function getBrandName(brands?: string) {
  return brands?.split(",").map((brand) => brand.trim()).find(Boolean) ?? null;
}

function isFoundStatus(status: OpenFoodFactsResponse["status"]) {
  return status === "success" || status === 1 || status === "1";
}

export function parseOpenFoodFactsQuantity(quantity?: string): { netAmount: number; netUnit: "ml" | "g" } | null {
  if (!quantity) return null;

  const normalized = quantity
    .toLowerCase()
    .replace(",", ".")
    .replace(/\bfl\.?\s*oz\.?\b/g, "fl oz")
    .replace(/\boz\.?\b/g, "oz");
  const multipackMatch = normalized.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(fl oz|ml|cl|l|g|kg|oz|lb)\b/);
  const match = multipackMatch ?? normalized.match(/(\d+(?:\.\d+)?)\s*(fl oz|ml|cl|l|g|kg|oz|lb)\b/);
  if (!match) return null;

  const value = multipackMatch ? Number(match[1]) * Number(match[2]) : Number(match[1]);
  const unit = multipackMatch ? match[3] : match[2];
  if (!(value > 0)) return null;

  switch (unit) {
    case "ml":
      return { netAmount: roundAmount(value), netUnit: "ml" };
    case "cl":
      return { netAmount: roundAmount(value * 10), netUnit: "ml" };
    case "l":
      return { netAmount: roundAmount(value * 1000), netUnit: "ml" };
    case "fl oz":
      return { netAmount: roundAmount(value * 29.5735), netUnit: "ml" };
    case "g":
      return { netAmount: roundAmount(value), netUnit: "g" };
    case "kg":
      return { netAmount: roundAmount(value * 1000), netUnit: "g" };
    case "oz":
      return { netAmount: roundAmount(value * 28.3495), netUnit: "g" };
    case "lb":
      return { netAmount: roundAmount(value * 453.592), netUnit: "g" };
    default:
      return null;
  }
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}

type OpenFoodFactsSearchHit = {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  quantity?: string;
  categories_tags?: string[];
};

type OpenFoodFactsSearchResponse = {
  hits?: OpenFoodFactsSearchHit[];
};

export async function searchOpenFoodFactsProducts(query: string): Promise<BarcodeProduct[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPEN_FOOD_FACTS_SEARCH_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      q: normalizedQuery,
      page_size: "8",
      fields: OPEN_FOOD_FACTS_SEARCH_FIELDS,
    });
    const response = await fetch(`${OPEN_FOOD_FACTS_SEARCH_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Chomp/1.0 (local-dev@chomp.app)",
      },
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as OpenFoodFactsSearchResponse;
    return (payload.hits ?? [])
      .map(mapSearchHit)
      .filter((product): product is BarcodeProduct => product !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function mapSearchHit(hit: OpenFoodFactsSearchHit): BarcodeProduct | null {
  const name = hit.product_name?.trim();
  if (!hit.code || !name) return null;

  const brands = Array.isArray(hit.brands) ? hit.brands.join(",") : hit.brands;
  const packageAmount = parseOpenFoodFactsQuantity(hit.quantity);

  return {
    barcode: hit.code,
    name,
    brandName: getBrandName(brands),
    category: inferOpenFoodFactsCategory(hit.categories_tags ?? []),
    quantity: 1,
    unit: packageAmount ? "package" : "item",
    netAmount: packageAmount?.netAmount ?? null,
    netUnit: packageAmount?.netUnit ?? null,
  };
}
