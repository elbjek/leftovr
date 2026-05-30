import { InventoryCategory } from "@/services";

export type MockReceiptItem = {
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  confidence: number;
};

export type MockReceiptTemplate = {
  key: string;
  label: string;
  description: string;
  receiptSignature: string;
  items: MockReceiptItem[];
};

export const mockReceiptTemplates: MockReceiptTemplate[] = [
  {
    key: "weekly-family",
    label: "Weekly family shop",
    description: "Bigger shop with dinner staples.",
    receiptSignature: "demo-weekly-family-v1",
    items: [
      { name: "Eggs", category: "dairy_eggs", quantity: 12, unit: "egg", confidence: 0.98 },
      { name: "Greek yogurt", category: "dairy_eggs", quantity: 2, unit: "tub", confidence: 0.96 },
      { name: "Chicken breast", category: "meat", quantity: 2, unit: "pack", confidence: 0.94 },
      { name: "Spinach", category: "vegetables", quantity: 1, unit: "bag", confidence: 0.93 },
      { name: "Tomatoes", category: "vegetables", quantity: 6, unit: "item", confidence: 0.91 },
      { name: "Rice", category: "pantry", quantity: 1, unit: "bag", confidence: 0.97 },
    ],
  },
  {
    key: "quick-top-up",
    label: "Quick top-up",
    description: "Small run for breakfast and snacks.",
    receiptSignature: "demo-quick-top-up-v1",
    items: [
      { name: "Milk", category: "dairy_eggs", quantity: 1, unit: "carton", confidence: 0.98 },
      { name: "Bananas", category: "fruit", quantity: 5, unit: "item", confidence: 0.95 },
      { name: "Sourdough", category: "bakery", quantity: 1, unit: "loaf", confidence: 0.94 },
      { name: "Hummus", category: "snacks", quantity: 1, unit: "tub", confidence: 0.9 },
    ],
  },
  {
    key: "vegetarian-shop",
    label: "Vegetarian shop",
    description: "Mostly produce and pantry.",
    receiptSignature: "demo-vegetarian-shop-v1",
    items: [
      { name: "Spinach", category: "vegetables", quantity: 2, unit: "bag", confidence: 0.95 },
      { name: "Tomatoes", category: "vegetables", quantity: 8, unit: "item", confidence: 0.93 },
      { name: "Frozen peas", category: "frozen", quantity: 1, unit: "bag", confidence: 0.96 },
      { name: "Rice", category: "pantry", quantity: 1, unit: "bag", confidence: 0.97 },
      { name: "Greek yogurt", category: "dairy_eggs", quantity: 1, unit: "tub", confidence: 0.91 },
    ],
  },
  {
    key: "snack-heavy",
    label: "Snack-heavy shop",
    description: "Snacks, drinks, and quick bites.",
    receiptSignature: "demo-snack-heavy-v1",
    items: [
      { name: "Hummus", category: "snacks", quantity: 2, unit: "tub", confidence: 0.92 },
      { name: "Orange juice", category: "drinks", quantity: 1, unit: "bottle", confidence: 0.95 },
      { name: "Sourdough", category: "bakery", quantity: 1, unit: "loaf", confidence: 0.89 },
      { name: "Bananas", category: "fruit", quantity: 4, unit: "item", confidence: 0.9 },
    ],
  },
  {
    key: "low-confidence",
    label: "Low-confidence receipt",
    description: "Shows review queue behavior.",
    receiptSignature: "demo-low-confidence-v1",
    items: [
      { name: "Milk", category: "dairy_eggs", quantity: 1, unit: "carton", confidence: 0.97 },
      { name: "Tomatoes", category: "vegetables", quantity: 4, unit: "item", confidence: 0.91 },
      { name: "Mystery deli item", category: "other", quantity: 1, unit: "item", confidence: 0.48 },
      { name: "Smudged bakery line", category: "bakery", quantity: 1, unit: "item", confidence: 0.52 },
    ],
  },
];

