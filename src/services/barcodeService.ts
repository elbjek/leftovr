import { mockBarcodeProducts } from "@/mocks";

export function lookupMockBarcode(barcode: string) {
  return mockBarcodeProducts.find((product) => product.barcode === barcode) ?? null;
}

