import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { BottomSheet, Button, Card, RecipeGlyph, Text } from "@/components";
import { useAuth } from "@/features";
import { notifyInventoryChanged, useInventory } from "@/hooks";
import { formatComplexity, formatTimeLabel, normalizeFoodName } from "@/services";
import { recordCookedEventAndDepleteInventory } from "@/repositories/inventoryRepository";
import { markCookedCoachmarkSeen } from "@/repositories/notificationRepository";
import { toggleRecipeFavorite } from "@/repositories/recipeRepository";
import { colors, radii, spacing } from "@/theme";

type IngredientItem = {
  name: string;
  amount: string;
  required: boolean;
  countable: boolean;
};

type UsedInventoryItemParam = {
  ingredientName: string;
  itemId: string;
};

export default function RecipeDetailRoute() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    title: string;
    description: string;
    timeMinutes: string;
    complexity: string;
    servings: string;
    ingredients: string;
    steps: string;
    usedInventoryItemIds: string;
    usedInventoryItems: string;
    recipeId: string;
    isFavorite: string;
    cookedCount: string;
    matchedUrgentItems: string;
  }>();

  const { profile, activeHousehold, refresh: refreshAuth } = useAuth();
  const { groups: inventoryGroups } = useInventory(activeHousehold?.id);

  const title = params.title ?? "";
  const description = params.description ?? "";
  const timeMinutes = Number(params.timeMinutes ?? 20);
  const complexity = params.complexity ?? "simple";
  const servings = Number(params.servings ?? 2);
  const recipeId = params.recipeId ?? "";
  const cookedCount = Number(params.cookedCount ?? 0);
  const hasCooked = cookedCount > 0;

  const ingredients: IngredientItem[] = params.ingredients
    ? JSON.parse(params.ingredients)
    : [];
  const steps: string[] = params.steps ? JSON.parse(params.steps) : [];
  const usedInventoryItemIds: string[] = params.usedInventoryItemIds
    ? JSON.parse(params.usedInventoryItemIds)
    : [];
  const usedInventoryItems = parseUsedInventoryItems(params.usedInventoryItems);
  const hasMappedUsedItems = usedInventoryItems.length > 0;
  const usedInventoryItemMap = new Map(
    usedInventoryItems.map((item) => [item.ingredientName, item.itemId]),
  );
  const matchedUrgentItems: string[] = params.matchedUrgentItems
    ? JSON.parse(params.matchedUrgentItems)
    : [];

  const [showCooked, setShowCooked] = useState(false);
  const [cookedItems, setCookedItems] = useState<{
    name: string;
    amount: string;
    itemId: string | null;
    quantityToUse: number;
    unit: string;
    used: boolean;
  }[]>([]);
  const [cooking, setCooking] = useState(false);
  const [favorite, setFavorite] = useState(params.isFavorite === "true");
  const [stepsViewportHeight, setStepsViewportHeight] = useState(0);
  const [stepsContentHeight, setStepsContentHeight] = useState(0);

  const showCookCoachMark =
    (profile?.prototype_day ?? 1) >= 3 && !profile?.cooked_coachmark_seen_at;
  const [coachVisible, setCoachVisible] = useState(showCookCoachMark);

  async function dismissCoachMark() {
    setCoachVisible(false);
    try {
      await markCookedCoachmarkSeen();
      await refreshAuth();
    } catch {
      // Non-critical
    }
  }

  const complexityLabel = formatComplexity(complexity);
  const liveFridgeNames = new Set(inventoryGroups.map((group) => group.normalizedName));
  const fridgeCount = ingredients.filter((ing) =>
    liveFridgeNames.has(normalizeFoodName(ing.name)),
  ).length;

  function getUsedItemId(ingredientName: string, index: number) {
    return usedInventoryItemMap.get(ingredientName) ?? (!hasMappedUsedItems ? usedInventoryItemIds[index] : null) ?? null;
  }

  function handleCookPress() {
    // Pre-tick every ingredient currently in the fridge (live by name),
    // not just the ones matched when the recipe was generated.
    const fridgeNames = new Set(inventoryGroups.map((group) => group.normalizedName));
    const items = ingredients.map((ing, i) => {
      const itemId = getUsedItemId(ing.name, i);
      const parsed = parseIngredientAmount(ing.amount);
      return {
        name: ing.name,
        amount: ing.amount,
        itemId,
        quantityToUse: ing.countable ? parsed.value : (parsed.unit ? parsed.value : 1),
        unit: ing.countable ? "item" : (parsed.unit ?? "item"),
        used: fridgeNames.has(normalizeFoodName(ing.name)),
      };
    });
    setCookedItems(items);
    setShowCooked(true);
  }

  function toggleCookedItem(index: number) {
    setCookedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, used: !item.used } : item)),
    );
  }

  async function confirmCooked() {
    if (!activeHousehold?.id) return;
    setCooking(true);
    try {
      // Deplete by item name against current inventory (spilling across lots,
      // soonest-expiry first) instead of stale snapshot lot ids. Sum duplicate
      // ingredients so each item is depleted by its total amount once.
      const byName = new Map<string, { amount: number; unit: string }>();
      for (const item of cookedItems) {
        if (!item.used) continue;
        const key = normalizeFoodName(item.name);
        const existing = byName.get(key);
        byName.set(key, {
          amount: (existing?.amount ?? 0) + item.quantityToUse,
          unit: existing?.unit ?? item.unit,
        });
      }
      const usedItems = [...byName.entries()].map(([normalizedName, v]) => ({
        normalizedName,
        amount: v.amount,
        unit: v.unit,
      }));
      await recordCookedEventAndDepleteInventory({
        householdId: activeHousehold.id,
        recipeId: recipeId || null,
        servings,
        usedItems,
      });
      notifyInventoryChanged();
      setShowCooked(false);
      router.replace("/(tabs)/fridge");
    } catch (error) {
      Alert.alert(
        t("common.error"),
        error instanceof Error ? error.message : t("common.fridgeUpdateError"),
      );
      setCooking(false);
    }
  }

  async function handleFavoriteToggle() {
    if (!recipeId) return;
    const next = !favorite;
    setFavorite(next);
    try {
      await toggleRecipeFavorite(recipeId, next);
    } catch {
      setFavorite(!next);
    }
  }

  const removedCount = cookedItems.filter((i) => i.used).length;
  const urgentBadge = matchedUrgentItems[0];
  const stepsOverflow = stepsContentHeight > stepsViewportHeight + 1;

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("recipes.detail.backLabel")}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path d="M9 2L3 7L9 12" stroke={colors.primary} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <RecipeGlyph size={48} />
        {urgentBadge ? (
          <View style={styles.urgentChip}>
            <Text variant="small" color={colors.primary}>
              {t("recipes.saves", { item: urgentBadge })}
            </Text>
          </View>
        ) : null}
        {recipeId ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleFavoriteToggle}
            style={styles.favoriteButton}
          >
            <Text variant="body">{favorite ? "★" : "☆"}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text variant="h1">{title}</Text>
        {description ? (
          <Text variant="body" muted style={styles.description}>
            {description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text variant="small" muted>⏱ {formatTimeLabel(timeMinutes)}</Text>
          <Text variant="small" muted>·</Text>
          <Text variant="small" muted>{t("recipes.detail.servings", { count: servings })}</Text>
          <Text variant="small" muted>·</Text>
          <Text variant="small" muted>{complexityLabel}</Text>
        </View>

        {fridgeCount > 0 ? (
          <>
            <Text variant="micro" muted style={styles.sectionLabel}>
              {t("recipes.detail.fromFridgeCount", { count: fridgeCount })}
            </Text>
            <View style={styles.ingredientChips}>
              {ingredients.map((ing, i) => {
                // Live fridge check by name — generation-time lot ids go stale
                // once items are depleted or re-added.
                const inFridge = liveFridgeNames.has(normalizeFoodName(ing.name));
                const isUrgent = matchedUrgentItems.includes(ing.name);
                const missingRequired = !inFridge && ing.required;
                return (
                  <View key={i} style={[styles.ingredientChip, missingRequired && styles.ingredientChipMissing]}>
                    <View style={[styles.dot, { backgroundColor: isUrgent ? colors.red : inFridge ? colors.green : missingRequired ? colors.red : colors.muted2 }]} />
                    <Text
                      variant="small"
                      color={missingRequired ? colors.red : colors.text}
                      style={styles.ingredientName}
                    >
                      {ing.name}
                    </Text>
                    <Text variant="small" muted>· {isUrgent ? t("recipes.detail.bestToday") : ing.amount}</Text>
                    {missingRequired ? (
                      <Text variant="micro" color={colors.red} style={styles.missingLabel}>
                        · {t("recipes.detail.missing")}
                      </Text>
                    ) : !ing.required ? (
                      <Text variant="micro" muted>· {t("recipes.detail.niceToHave")}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text variant="micro" muted style={styles.sectionLabel}>
          {t("recipes.detail.howToCook")}
        </Text>
      </View>

      <ScrollView
        style={styles.stepsScroll}
        contentContainerStyle={styles.stepsContent}
        scrollEnabled={stepsOverflow}
        bounces={stepsOverflow}
        showsVerticalScrollIndicator={stepsOverflow}
        onLayout={(event) => setStepsViewportHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_width, height) => setStepsContentHeight(height)}
      >
        <View style={styles.steps}>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text variant="small" color={colors.surface} style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text variant="body" style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomGradient}>
        {coachVisible ? (
          <Card style={styles.coachMark}>
            <View style={styles.coachContent}>
              <Text variant="label">{t("retention.day3CoachTitle")}</Text>
              <Text variant="small" muted>{t("retention.day3CoachBody")}</Text>
              <Button title={t("retention.day3Dismiss")} variant="text" onPress={dismissCoachMark} />
            </View>
          </Card>
        ) : null}
        <Button
          title={hasCooked ? t("recipes.detail.cookAgainCta") : t("recipes.detail.cookCta")}
          variant="accent"
          onPress={handleCookPress}
        />
        {recipeId ? (
          <Button
            title={favorite ? t("recipes.detail.savedCta") : t("recipes.detail.saveCta")}
            variant="ghost"
            onPress={handleFavoriteToggle}
          />
        ) : null}
      </View>

      <BottomSheet visible={showCooked} onDismiss={() => setShowCooked(false)}>
        <Text variant="micro" color={colors.accent} style={styles.cookedEyebrow}>
          {t("recipes.cooked.eyebrow")}
        </Text>
        <Text variant="h1" style={styles.cookedTitle}>{t("recipes.cooked.title")}</Text>
        <Text variant="body" muted style={styles.cookedBody}>{t("recipes.cooked.body")}</Text>

        <View style={styles.cookedList}>
          {cookedItems.map((item, i) => (
            <Pressable
              key={i}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.used }}
              onPress={() => toggleCookedItem(i)}
              style={[styles.cookedItem, item.used && styles.cookedItemActive]}
            >
              <View style={[styles.checkbox, item.used && styles.checkboxActive]}>
                {item.used ? (
                  <Svg width={13} height={13} viewBox="0 0 13 13">
                    <Path d="M3 7L5.5 9.5L10 4" stroke={colors.surface} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : null}
              </View>
              <View style={styles.cookedItemCopy}>
                <Text variant="body" style={[!item.used && styles.strikethrough]}>{item.name}</Text>
                <Text variant="small" muted>{item.amount}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Button
          title={t("recipes.cooked.confirm", { count: removedCount })}
          onPress={confirmCooked}
          loading={cooking}
          style={styles.cookedConfirm}
        />
      </BottomSheet>
    </View>
  );
}

function parseIngredientAmount(amount: string): { value: number; unit: string | null } {
  const match = amount.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
  const value = match ? Number(match[1]) : NaN;
  const unit = match?.[2]?.toLowerCase() ?? null;
  return {
    value: Number.isFinite(value) && value > 0 ? value : 1,
    unit,
  };
}

function parseUsedInventoryItems(input?: string): UsedInventoryItemParam[] {
  if (!input) return [];
  try {
    const parsed: unknown = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is UsedInventoryItemParam => (
      typeof item === "object" &&
      item !== null &&
      "ingredientName" in item &&
      "itemId" in item &&
      typeof item.ingredientName === "string" &&
      typeof item.itemId === "string"
    ));
  } catch {
    return [];
  }
}



const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  stepsScroll: {
    flex: 1,
  },
  stepsContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 120,
  },
  hero: {
    height: 280,
    backgroundColor: "#C8D5C2",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButton: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  urgentChip: {
    position: "absolute",
    bottom: 20,
    left: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(248,244,238,0.85)",
    borderRadius: radii.pill,
  },
  body: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  description: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ingredientChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  ingredientChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.pill,
  },
  ingredientChipMissing: {
    backgroundColor: "rgba(199, 104, 69, 0.08)",
    borderColor: "rgba(199, 104, 69, 0.35)",
    borderStyle: "dashed",
  },
  missingLabel: {
    fontWeight: "700",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ingredientName: {
    fontWeight: "600",
  },
  steps: {
    gap: spacing.lg,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepNumberText: {
    fontWeight: "700",
    fontSize: 13,
  },
  stepText: {
    flex: 1,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 28,
    gap: spacing.sm,
  },
  coachMark: {
    backgroundColor: colors.primary50,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  coachContent: {
    gap: spacing.xs,
  },
  cookedEyebrow: {
    marginBottom: spacing.sm,
  },
  cookedTitle: {
    marginBottom: spacing.sm,
  },
  cookedBody: {
    marginBottom: spacing.xl,
  },
  cookedList: {
    gap: spacing.sm,
  },
  cookedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
  },
  cookedItemActive: {
    backgroundColor: colors.primary50,
    borderColor: "transparent",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  cookedItemCopy: {
    flex: 1,
  },
  strikethrough: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  cookedConfirm: {
    marginTop: spacing.lg,
  },
});
