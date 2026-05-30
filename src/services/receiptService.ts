import { mockReceiptTemplates } from "@/mocks";

const HIGH_CONFIDENCE_THRESHOLD = 0.75;

export function getMockReceiptTemplate(key: string) {
  return mockReceiptTemplates.find((template) => template.key === key) ?? mockReceiptTemplates[0];
}

export function normalizeMockReceipt(templateKey: string) {
  const template = getMockReceiptTemplate(templateKey);
  const highConfidenceItems = template.items.filter(
    (item) => item.confidence >= HIGH_CONFIDENCE_THRESHOLD,
  );
  const reviewItems = template.items.filter((item) => item.confidence < HIGH_CONFIDENCE_THRESHOLD);

  return {
    template,
    highConfidenceItems,
    reviewItems,
  };
}

