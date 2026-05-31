import { InventoryCategory, UrgencyBand } from "@/services";

export type MockReceiptItem = {
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  confidence: number;
  urgency?: UrgencyBand;
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
      { name: "Eggs", category: "dairy_eggs", quantity: 12, unit: "egg", confidence: 0.98, urgency: "urgent" },
      { name: "Greek yogurt", category: "dairy_eggs", quantity: 2, unit: "tub", confidence: 0.96, urgency: "use_soon" },
      { name: "Chicken breast", category: "meat", quantity: 2, unit: "pack", confidence: 0.94, urgency: "urgent" },
      { name: "Spinach", category: "vegetables", quantity: 1, unit: "bag", confidence: 0.93, urgency: "urgent" },
      { name: "Tomatoes", category: "vegetables", quantity: 6, unit: "item", confidence: 0.91, urgency: "use_soon" },
      { name: "Rice", category: "pantry", quantity: 1, unit: "bag", confidence: 0.97, urgency: "safe" },
    ],
  },
  {
    key: "quick-top-up",
    label: "Quick top-up",
    description: "Small run for breakfast and snacks.",
    receiptSignature: "demo-quick-top-up-v1",
    items: [
      { name: "Milk", category: "dairy_eggs", quantity: 1, unit: "carton", confidence: 0.98, urgency: "use_soon" },
      { name: "Bananas", category: "fruit", quantity: 5, unit: "item", confidence: 0.95, urgency: "use_soon" },
      { name: "Sourdough", category: "bakery", quantity: 1, unit: "loaf", confidence: 0.94, urgency: "urgent" },
      { name: "Hummus", category: "snacks", quantity: 1, unit: "tub", confidence: 0.9, urgency: "use_soon" },
    ],
  },
  {
    key: "vegetarian-shop",
    label: "Vegetarian shop",
    description: "Mostly produce and pantry.",
    receiptSignature: "demo-vegetarian-shop-v1",
    items: [
      { name: "Spinach", category: "vegetables", quantity: 2, unit: "bag", confidence: 0.95, urgency: "urgent" },
      { name: "Tomatoes", category: "vegetables", quantity: 8, unit: "item", confidence: 0.93, urgency: "use_soon" },
      { name: "Frozen peas", category: "frozen", quantity: 1, unit: "bag", confidence: 0.96, urgency: "safe" },
      { name: "Rice", category: "pantry", quantity: 1, unit: "bag", confidence: 0.97, urgency: "safe" },
      { name: "Greek yogurt", category: "dairy_eggs", quantity: 1, unit: "tub", confidence: 0.91, urgency: "use_soon" },
    ],
  },
  {
    key: "snack-heavy",
    label: "Snack-heavy shop",
    description: "Snacks, drinks, and quick bites.",
    receiptSignature: "demo-snack-heavy-v1",
    items: [
      { name: "Hummus", category: "snacks", quantity: 2, unit: "tub", confidence: 0.92, urgency: "use_soon" },
      { name: "Orange juice", category: "drinks", quantity: 1, unit: "bottle", confidence: 0.95, urgency: "safe" },
      { name: "Sourdough", category: "bakery", quantity: 1, unit: "loaf", confidence: 0.89, urgency: "urgent" },
      { name: "Bananas", category: "fruit", quantity: 4, unit: "item", confidence: 0.9, urgency: "use_soon" },
    ],
  },
  {
    key: "low-confidence",
    label: "Low-confidence receipt",
    description: "Shows review queue behavior.",
    receiptSignature: "demo-low-confidence-v1",
    items: [
      { name: "Milk", category: "dairy_eggs", quantity: 1, unit: "carton", confidence: 0.97, urgency: "use_soon" },
      { name: "Tomatoes", category: "vegetables", quantity: 4, unit: "item", confidence: 0.91, urgency: "use_soon" },
      { name: "Mystery deli item", category: "other", quantity: 1, unit: "item", confidence: 0.48 },
      { name: "Smudged bakery line", category: "bakery", quantity: 1, unit: "item", confidence: 0.52 },
    ],
  },
];
