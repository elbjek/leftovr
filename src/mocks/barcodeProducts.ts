import { InventoryCategory } from "@/services";

export type MockBarcodeProduct = {
  barcode: string;
  name: string;
  brandName?: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  netAmount?: number;
  netUnit?: "ml" | "g";
};

export const mockBarcodeProducts: MockBarcodeProduct[] = [
  {
    barcode: "5901234123457",
    name: "Milk",
    brandName: "Leftovr Dairy",
    category: "dairy_eggs",
    quantity: 1,
    unit: "carton",
    netAmount: 1000,
    netUnit: "ml",
  },
  {
    barcode: "5012345678900",
    name: "Greek yogurt",
    brandName: "Leftovr Dairy",
    category: "dairy_eggs",
    quantity: 1,
    unit: "tub",
    netAmount: 500,
    netUnit: "g",
  },
  {
    barcode: "0048500005729",
    name: "Orange juice",
    brandName: "Tropicana",
    category: "drinks",
    quantity: 1,
    unit: "bottle",
    netAmount: 1892.71,
    netUnit: "ml",
  },
  {
    barcode: "012345678905",
    name: "Hummus",
    brandName: "Leftovr Kitchen",
    category: "snacks",
    quantity: 1,
    unit: "tub",
    netAmount: 200,
    netUnit: "g",
  },
];
