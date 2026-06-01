import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { BottomDock, Button, EmptyState, FilterChip, PremiumSheet, RecipeCard, RecipeGlyph, SegmentedControl, Text } from "@/components";
import { useAuth } from "@/features";
import { setPreviewTier } from "@/repositories";
import { useHousehold, useInventory, useRecipes } from "@/hooks";
import { CookingMode, RecipeRow } from "@/repositories/recipeRepository";
import {
  formatComplexity,
  formatTimeLabel,
  RecipeMatch,
} from "@/services/recipeService";
import { normalizeFoodName } from "@/services";
import { colors, radii, spacing } from "@/theme";

type RecipeTab = "all" | "saved" | "cooked";
type RecipeIngredientParam = { name: string };
type UsedInventoryItemParam = { ingredientName: string; itemId: string };

export default function RecipesRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh } = useAuth();
  const { lots: inventory } = useInventory(activeHousehold?.id);
  const { members, combinedAvoidances } = useHousehold(activeHousehold?.id);
  const isPremium = profile?.tier !== "free";
  const userAvoidances = profile?.avoidances ?? [];
  const [tab, setTab] = useState<RecipeTab>("all");
  const [showPremium, setShowPremium] = useState(false);
  const [cookingMode, setCookingMode] = useState<CookingMode>("household");

  const showCookingMode = members.length >= 2;
  const activeAvoidances = cookingMode === "household" ? combinedAvoidances : userAvoidances;
  const servings = cookingMode === "household"
    ? (activeHousehold?.default_servings ?? profile?.default_servings ?? 2)
    : (profile?.default_servings ?? 2);

  const {
    loading,
    generating,
    suggestions,
    savedRecipes,
    canGenerate,
    remainingSessions,
    freeLimit,
    generateSession,
    toggleFavorite,
  } = useRecipes(activeHousehold?.id, { inventory, avoidances: activeAvoidances, isPremium, servings });

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      setShowPremium(true);
      return;
    }
    await generateSession(cookingMode);
  }, [canGenerate, cookingMode, generateSession]);

  const navigateToDetail = useCallback(
    (match: RecipeMatch, recipeId?: string) => {
      const usedInventoryItems = buildUsedInventoryItemsFromMatch(match);
      const usedIds = usedInventoryItems.map((item) => item.itemId);
      const urgentNames = match.matchedItems
        .filter((m) => m.isUrgent)
        .map((m) => m.ingredientName);

      router.push({
        pathname: "/recipe-detail",
        params: {
          title: match.title,
          description: match.description,
          timeMinutes: String(match.timeMinutes),
          complexity: match.complexity,
          servings: String(match.servingsBaseline),
          ingredients: JSON.stringify(match.ingredients),
          steps: JSON.stringify(match.steps),
          usedInventoryItemIds: JSON.stringify(usedIds),
          usedInventoryItems: JSON.stringify(usedInventoryItems),
          recipeId: recipeId ?? "",
          isFavorite: "false",
          matchedUrgentItems: JSON.stringify(urgentNames),
        },
      });
    },
    [],
  );

  const navigateToSavedDetail = useCallback((recipe: RecipeRow) => {
    const usedInventoryItems = buildUsedInventoryItemsForSavedRecipe(
      recipe.ingredients,
      recipe.used_inventory_item_ids,
      inventory,
    );

    router.push({
      pathname: "/recipe-detail",
      params: {
        title: recipe.title,
        description: recipe.description ?? "",
        timeMinutes: String(recipe.time_minutes ?? 20),
        complexity: recipe.complexity ?? "simple",
        servings: String(recipe.servings),
        ingredients: JSON.stringify(recipe.ingredients),
        steps: JSON.stringify(recipe.steps),
        usedInventoryItemIds: JSON.stringify(recipe.used_inventory_item_ids),
        usedInventoryItems: JSON.stringify(usedInventoryItems),
        recipeId: recipe.id,
        isFavorite: String(recipe.is_favorite),
        matchedUrgentItems: "[]",
      },
    });
  }, [inventory]);

  const favoriteRecipes = savedRecipes.filter((r) => r.is_favorite);
  const cookedRecipes = savedRecipes;

  const hasSuggestions = suggestions.length > 0;
  const isEmpty = !hasSuggestions && savedRecipes.length === 0 && !loading;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              title={t("recipes.emptyTitle")}
              body={t("recipes.emptyBody")}
              actionLabel={t("recipes.emptyAction")}
              onAction={handleGenerate}
            />
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text variant="micro" muted uppercase>
                {t("recipes.countLabel", { count: savedRecipes.length + suggestions.length })}
              </Text>
              <Text variant="h1" style={styles.headerTitle}>
                {t("recipes.title")}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRail}
            >
              <FilterChip label={t("recipes.filters.fromFridge")} active count={String(suggestions.length || inventory.length)} />
              <FilterChip label={t("recipes.filters.quick")} />
              <FilterChip label={t("recipes.filters.simple")} />
              <FilterChip label={t("recipes.filters.comfort")} />
            </ScrollView>

            {showCookingMode ? (
              <View style={styles.cookingModeWrap}>
                <Text variant="small" muted style={styles.cookingModeLabel}>
                  {t("recipes.cookingMode.title")}
                </Text>
                <SegmentedControl
                  options={[
                    { label: t("recipes.cookingMode.household"), value: "household" as CookingMode },
                    { label: t("recipes.cookingMode.justMe"), value: "just_me" as CookingMode },
                  ]}
                  value={cookingMode}
                  onChange={setCookingMode}
                />
              </View>
            ) : null}

            {!isPremium ? (
              <View style={styles.limitBanner}>
                <View>
                  <Text variant="small" color={colors.primary} style={styles.limitText}>
                    {canGenerate
                      ? t("recipes.weeklyLimit", { remaining: remainingSessions, limit: freeLimit })
                      : t("recipes.weeklyLimitReached")}
                  </Text>
                  <Text variant="small" muted style={styles.limitSub}>{t("recipes.freePlan")}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowPremium(true)}
                  style={styles.upgradeChip}
                >
                  <Text variant="micro" color={colors.text}>{t("recipes.upgrade")}</Text>
                </Pressable>
              </View>
            ) : null}

            {hasSuggestions ? (
              <View style={styles.sectionBlock}>
                <Text variant="h3" style={styles.sectionTitle}>
                  {t("recipes.fromFridgeTitle")}
                </Text>
                <View style={styles.cardList}>
                  {suggestions.map((match) => {
                    const savedRecipe = savedRecipes.find((r) => r.title === match.title && r.session_id);
                    return (
                      <RecipeCard
                        key={match.key}
                        title={match.title}
                        timeLabel={formatTimeLabel(match.timeMinutes)}
                        complexityLabel={formatComplexity(match.complexity)}
                        usedItems={match.matchedItems.filter((m) => m.inFridge).map((m) => m.ingredientName)}
                        usesLabel={t("recipes.uses")}
                        favorite={savedRecipe?.is_favorite}
                        favoriteLabel="★"
                        onPress={() => navigateToDetail(match, savedRecipe?.id)}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}

            {savedRecipes.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.tabBar}>
                  {(["all", "saved", "cooked"] as RecipeTab[]).map((t_) => {
                    const label =
                      t_ === "all"
                        ? t("recipes.tabs.all")
                        : t_ === "saved"
                          ? `${t("recipes.tabs.saved")} · ${favoriteRecipes.length}`
                          : `${t("recipes.tabs.cooked")} · ${cookedRecipes.length}`;
                    return (
                      <Pressable
                        key={t_}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: tab === t_ }}
                        onPress={() => setTab(t_)}
                        style={[styles.tabItem, tab === t_ && styles.tabItemActive]}
                      >
                        <Text
                          variant="label"
                          color={tab === t_ ? colors.primary : colors.muted}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.savedList}>
                  {(tab === "all"
                    ? savedRecipes
                    : tab === "saved"
                      ? favoriteRecipes
                      : cookedRecipes
                  ).map((recipe) => (
                    <SavedRecipeRow
                      key={recipe.id}
                      recipe={recipe}
                      onPress={() => navigateToSavedDetail(recipe)}
                      onFavorite={() => toggleFavorite(recipe.id, recipe.is_favorite)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <BottomDock>
        <Button
          title={t("recipes.generateCta")}
          onPress={handleGenerate}
          loading={generating}
        />
      </BottomDock>

      <PremiumSheet
        visible={showPremium}
        onPreview={async () => {
          await setPreviewTier("premium");
          await refresh();
        }}
        onDismiss={() => setShowPremium(false)}
      />
    </View>
  );
}

function buildUsedInventoryItemsFromMatch(match: RecipeMatch): UsedInventoryItemParam[] {
  return match.matchedItems
    .filter((item) => item.inFridge && item.inventoryLot)
    .map((item) => ({
      ingredientName: item.ingredientName,
      itemId: item.inventoryLot!.id,
    }));
}

function buildUsedInventoryItemsForSavedRecipe(
  ingredients: unknown,
  usedInventoryItemIds: string[],
  inventory: { id: string; normalized_name: string }[],
): UsedInventoryItemParam[] {
  const activeSavedIds = new Set(usedInventoryItemIds);
  const inventoryByName = new Map(inventory.map((lot) => [lot.normalized_name, lot]));

  return parseRecipeIngredients(ingredients).flatMap((ingredient) => {
    const lot = inventoryByName.get(normalizeFoodName(ingredient.name));
    if (!lot || !activeSavedIds.has(lot.id)) return [];
    return [{ ingredientName: ingredient.name, itemId: lot.id }];
  });
}

function parseRecipeIngredients(ingredients: unknown): RecipeIngredientParam[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.filter((ingredient): ingredient is RecipeIngredientParam => (
    typeof ingredient === "object" &&
    ingredient !== null &&
    "name" in ingredient &&
    typeof ingredient.name === "string"
  ));
}


function SavedRecipeRow({
  recipe,
  onPress,
  onFavorite,
}: {
  recipe: RecipeRow;
  onPress: () => void;
  onFavorite: () => void;
}) {
  const time = recipe.time_minutes ? `${recipe.time_minutes} min` : "";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.savedRow, pressed && styles.savedRowPressed]}
    >
      <View style={styles.savedRowThumb}>
        <RecipeGlyph size={34} variant="simple" />
      </View>
      <View style={styles.savedRowCopy}>
        <Text variant="h3" numberOfLines={1}>{recipe.title}</Text>
        <View style={styles.savedRowMeta}>
          {time ? <Text variant="small" muted>⏱ {time}</Text> : null}
          {recipe.is_favorite ? (
            <Pressable accessibilityRole="button" onPress={onFavorite}>
              <Text variant="small" color={colors.accent}>★</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.tabBarClearance + 70,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.screenX,
    paddingTop: 80,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.md,
  },
  headerTitle: {
    marginTop: spacing.xxs,
  },
  cookingModeWrap: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.lg,
  },
  filterRail: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  cookingModeLabel: {
    marginBottom: spacing.sm,
  },
  limitBanner: {
    marginHorizontal: spacing.screenX,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary50,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  limitText: {
    fontWeight: "700",
  },
  limitSub: {
    marginTop: 2,
  },
  upgradeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  cardList: {
    gap: spacing.md,
  },
  sectionBlock: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.sm,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.screenX,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  tabItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  savedList: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  savedRow: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  savedRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  savedRowThumb: {
    width: 60,
    height: 60,
    borderRadius: radii.sm,
    backgroundColor: "#C8D5C2",
    alignItems: "center",
    justifyContent: "center",
  },
  savedRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  savedRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
});
