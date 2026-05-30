import { InventoryGroup } from "./inventoryRules";

export type DailySuggestion = {
  title: string;
  body: string;
  items: string[];
};

export function registerDevice(_token: string, _platform: string): void {
  // Stub for future FCM/Expo push registration
}

export function scheduleSmartSuggestion(_householdId: string): void {
  // Stub for future backend-generated scheduling
}

export function previewDailySuggestion(
  groups: InventoryGroup[],
  primaryGoal: string | null,
): DailySuggestion | null {
  const urgentItems = groups
    .filter((g) => g.urgency === "urgent")
    .map((g) => g.name);
  const useSoonItems = groups
    .filter((g) => g.urgency === "use_soon")
    .map((g) => g.name);

  const priorityItems = [...urgentItems, ...useSoonItems];

  if (priorityItems.length === 0) return null;

  const topItems = priorityItems.slice(0, 3);

  const goalFraming =
    primaryGoal === "money"
      ? "Save money tonight"
      : primaryGoal === "quick"
        ? "Quick dinner idea"
        : "Use it before it goes";

  return {
    title: goalFraming,
    body: `Tonight: cook with ${topItems.join(", ")}${priorityItems.length > 3 ? ` and ${priorityItems.length - 3} more` : ""}.`,
    items: topItems,
  };
}
