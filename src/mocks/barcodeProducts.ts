import { InventoryCategory } from "@/services";

export type MockBarcodeProduct = {
  barcode: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
};

export const mockBarcodeProducts: MockBarcodeProduct[] = [
  {
    barcode: "5901234123457",
    name: "Milk",
    category: "dairy_eggs",
    quantity: 1,
    unit: "carton",
  },
  {
    barcode: "5012345678900",
    name: "Greek yogurt",
    category: "dairy_eggs",
    quantity: 1,
    unit: "tub",
  },
  {
    barcode: "4006381333931",
    name: "Orange juice",
    category: "drinks",
    quantity: 1,
    unit: "bottle",
  },
  {
    barcode: "012345678905",
    name: "Hummus",
    category: "snacks",
    quantity: 1,
    unit: "tub",
  },
];

