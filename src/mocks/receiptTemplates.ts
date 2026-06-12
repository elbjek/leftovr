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
    key: "demo-shop",
    label: "Demo shop",
    description: "Simulated receipt with forty varied fridge and pantry ingredients.",
    receiptSignature: "demo-shop-v2",
    items: [
      { name: "Eggs", category: "dairy_eggs", quantity: 12, unit: "egg", confidence: 0.98, urgency: "safe" },
      { name: "Milk", category: "dairy_eggs", quantity: 1, unit: "carton", confidence: 0.97, urgency: "use_soon" },
      { name: "Greek yogurt", category: "dairy_eggs", quantity: 2, unit: "tub", confidence: 0.96, urgency: "use_soon" },
      { name: "Cheddar", category: "dairy_eggs", quantity: 1, unit: "block", confidence: 0.95, urgency: "safe" },
      { name: "Butter", category: "dairy_eggs", quantity: 1, unit: "block", confidence: 0.97, urgency: "safe" },
      { name: "Feta", category: "dairy_eggs", quantity: 1, unit: "pack", confidence: 0.94, urgency: "use_soon" },
      { name: "Chicken breast", category: "meat", quantity: 2, unit: "pack", confidence: 0.94, urgency: "urgent" },
      { name: "Ground beef", category: "meat", quantity: 1, unit: "pack", confidence: 0.95, urgency: "urgent" },
      { name: "Turkey slices", category: "meat", quantity: 1, unit: "pack", confidence: 0.92, urgency: "use_soon" },
      { name: "Salmon", category: "fish", quantity: 2, unit: "fillet", confidence: 0.93, urgency: "urgent" },
      { name: "Tuna", category: "fish", quantity: 2, unit: "can", confidence: 0.96, urgency: "safe" },
      { name: "Spinach", category: "vegetables", quantity: 1, unit: "bag", confidence: 0.93, urgency: "urgent" },
      { name: "Tomatoes", category: "vegetables", quantity: 6, unit: "item", confidence: 0.91, urgency: "use_soon" },
      { name: "Carrots", category: "vegetables", quantity: 1, unit: "bag", confidence: 0.96, urgency: "safe" },
      { name: "Broccoli", category: "vegetables", quantity: 2, unit: "head", confidence: 0.94, urgency: "use_soon" },
      { name: "Bell peppers", category: "vegetables", quantity: 3, unit: "item", confidence: 0.95, urgency: "use_soon" },
      { name: "Zucchini", category: "vegetables", quantity: 2, unit: "item", confidence: 0.93, urgency: "use_soon" },
      { name: "Mushrooms", category: "vegetables", quantity: 1, unit: "box", confidence: 0.92, urgency: "urgent" },
      { name: "Red onion", category: "vegetables", quantity: 3, unit: "item", confidence: 0.95, urgency: "safe" },
      { name: "Garlic", category: "vegetables", quantity: 1, unit: "bulb", confidence: 0.96, urgency: "safe" },
      { name: "Bananas", category: "fruit", quantity: 5, unit: "item", confidence: 0.95, urgency: "use_soon" },
      { name: "Apples", category: "fruit", quantity: 6, unit: "item", confidence: 0.97, urgency: "safe" },
      { name: "Lemons", category: "fruit", quantity: 3, unit: "item", confidence: 0.96, urgency: "safe" },
      { name: "Blueberries", category: "fruit", quantity: 1, unit: "punnet", confidence: 0.93, urgency: "urgent" },
      { name: "Sourdough", category: "bakery", quantity: 1, unit: "loaf", confidence: 0.94, urgency: "urgent" },
      { name: "Tortillas", category: "bakery", quantity: 1, unit: "pack", confidence: 0.94, urgency: "safe" },
      { name: "Pita bread", category: "bakery", quantity: 1, unit: "pack", confidence: 0.93, urgency: "use_soon" },
      { name: "Rice", category: "pantry", quantity: 1, unit: "bag", confidence: 0.97, urgency: "safe" },
      { name: "Pasta", category: "pantry", quantity: 1, unit: "box", confidence: 0.98, urgency: "safe" },
      { name: "Chickpeas", category: "pantry", quantity: 2, unit: "can", confidence: 0.97, urgency: "safe" },
      { name: "Black beans", category: "pantry", quantity: 2, unit: "can", confidence: 0.97, urgency: "safe" },
      { name: "Coconut milk", category: "pantry", quantity: 1, unit: "can", confidence: 0.96, urgency: "safe" },
      { name: "Olive oil", category: "pantry", quantity: 1, unit: "bottle", confidence: 0.98, urgency: "safe" },
      { name: "Oats", category: "pantry", quantity: 1, unit: "bag", confidence: 0.96, urgency: "safe" },
      { name: "Frozen peas", category: "frozen", quantity: 1, unit: "bag", confidence: 0.97, urgency: "safe" },
      { name: "Frozen berries", category: "frozen", quantity: 1, unit: "bag", confidence: 0.95, urgency: "safe" },
      { name: "Orange juice", category: "drinks", quantity: 1, unit: "bottle", confidence: 0.96, urgency: "use_soon" },
      { name: "Sparkling water", category: "drinks", quantity: 6, unit: "can", confidence: 0.95, urgency: "safe" },
      { name: "Hummus", category: "snacks", quantity: 1, unit: "tub", confidence: 0.94, urgency: "use_soon" },
      { name: "Almonds", category: "snacks", quantity: 1, unit: "bag", confidence: 0.96, urgency: "safe" },
      // Low-confidence OCR-style lines: surfaced with a "Check this" badge on
      // the scan confirmation list so the user fixes or excludes them.
      { name: "Avcado", category: "fruit", quantity: 2, unit: "item", confidence: 0.58 },
      { name: "Ot Mlk 1L", category: "drinks", quantity: 1, unit: "carton", confidence: 0.52 },
    ],
  },
];
