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
    description: "Simulated receipt with ten staple ingredients.",
    receiptSignature: "demo-shop-v1",
    items: [
      { name: "Eggs", category: "dairy_eggs", quantity: 12, unit: "egg", confidence: 0.98, urgency: "safe" },
      { name: "Milk", category: "dairy_eggs", quantity: 1, unit: "carton", confidence: 0.97, urgency: "use_soon" },
      { name: "Greek yogurt", category: "dairy_eggs", quantity: 2, unit: "tub", confidence: 0.96, urgency: "use_soon" },
      { name: "Cheddar", category: "dairy_eggs", quantity: 1, unit: "block", confidence: 0.95, urgency: "safe" },
      { name: "Chicken breast", category: "meat", quantity: 2, unit: "pack", confidence: 0.94, urgency: "urgent" },
      { name: "Spinach", category: "vegetables", quantity: 1, unit: "bag", confidence: 0.93, urgency: "urgent" },
      { name: "Tomatoes", category: "vegetables", quantity: 6, unit: "item", confidence: 0.91, urgency: "use_soon" },
      { name: "Bananas", category: "fruit", quantity: 5, unit: "item", confidence: 0.95, urgency: "use_soon" },
      { name: "Sourdough", category: "bakery", quantity: 1, unit: "loaf", confidence: 0.94, urgency: "urgent" },
      { name: "Rice", category: "pantry", quantity: 1, unit: "bag", confidence: 0.97, urgency: "safe" },
      // Low-confidence OCR-style lines: surfaced with a "Check this" badge on
      // the scan confirmation list so the user fixes or excludes them.
      { name: "Avcado", category: "fruit", quantity: 2, unit: "item", confidence: 0.58 },
      { name: "Ot Mlk 1L", category: "drinks", quantity: 1, unit: "carton", confidence: 0.52 },
    ],
  },
];
