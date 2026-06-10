import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { BottomDock, Button, CookFilters, CookPromptSheet, EmptyState, FilterChip, PremiumSheet, RecipeCard, RecipeGlyph, Text } from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { setPreviewTier } from "@/repositories";
import { useHousehold, useInventory, useRecipes } from "@/hooks";
import { CookingMode, RecipeRow } from "@/repositories/recipeRepository";
import {
  formatComplexity,
  formatTimeLabel,
  RecipeMatch,
  STAPLE_INGREDIENTS,
} from "@/services/recipeService";
import { normalizeFoodName } from "@/services";
import { colors, radii, spacing } from "@/theme";

type RecipeTab = "all" | "saved" | "cooked" | "household";
// "fridge" = show all fridge suggestions; any other value is a recipe tag/category.
type RecipeFilter = "fridge" | (string & {});
type RecipeIngredientParam = { name: string };
type UsedInventoryItemParam = { ingredientName: string; itemId: string };

export default function RecipesRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh } = useAuth();
  const { lots: inventory } = useInventory(activeHousehold?.id);
  const { members, combinedAvoidances } = useHousehold(activeHousehold?.id);
  const isPremium = resolvePremium(profile, activeHousehold);
  const userAvoidances = profile?.avoidances ?? [];
  const [tab, setTab] = useState<RecipeTab>("all");
  const [filter, setFilter] = useState<RecipeFilter>("fridge");
  const [showPremium, setShowPremium] = useState(false);
  const [showCookPrompt, setShowCookPrompt] = useState(false);
  const [cookPromptKey, setCookPromptKey] = useState(0);
  const [cookingMode, setCookingMode] = useState<CookingMode>("household");
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);

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
    cookedRecipes,
    canGenerate,
    remainingSessions,
    freeLimit,
    refresh: refreshRecipes,
    generateSession,
    toggleFavorite,
    currentSessionId,
    cookedSummaries,
  } = useRecipes(activeHousehold?.id, {
    inventory,
    avoidances: activeAvoidances,
    isPremium,
    servings,
    userId: profile?.id,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshRecipes();
    }, [refreshRecipes]),
  );

  const openCookPrompt = useCallback(() => {
    if (!canGenerate) {
      setShowPremium(true);
      return;
    }
    setCookPromptKey((key) => key + 1);
    setShowCookPrompt(true);
  }, [canGenerate]);

  const handleGenerate = useCallback(async (filters?: CookFilters) => {
    if (!canGenerate) {
      setShowCookPrompt(false);
      setShowPremium(true);
      return;
    }
    setShowCookPrompt(false);
    const result = await generateSession(cookingMode, filters);
    setGenerateNotice(result && result.recipes.length === 0 ? t("recipes.noMakeable") : null);
  }, [canGenerate, cookingMode, generateSession, t]);

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
          isFavorite: String(recipeId ? (savedRecipes.find((r) => r.id === recipeId)?.is_favorite ?? false) : false),
          cookedCount: String(recipeId ? (savedRecipes.find((r) => r.id === recipeId)?.cooked_count ?? 0) : 0),
          matchedUrgentItems: JSON.stringify(urgentNames),
        },
      });
    },
    [savedRecipes],
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
        cookedCount: String(recipe.cooked_count ?? 0),
        matchedUrgentItems: "[]",
      },
    });
  }, [inventory]);

  const memberName = useCallback(
    (id: string) =>
      id === profile?.id
        ? t("settings.household.you")
        : members.find((m) => m.user_id === id)?.display_name ?? "?",
    [members, profile?.id, t],
  );

  // Own recipes drive the default tabs; household recipes only appear in the
  // dedicated Household tab once the user has generated something themselves.
  const myRecipes = savedRecipes.filter((r) => r.generated_by === profile?.id);
  // is_favorite is overlaid per current user in useRecipes, so this is "my favorites".
  const favoriteRecipes = savedRecipes.filter((r) => r.is_favorite);
  const hasOwnRecipes = myRecipes.length > 0 || cookedRecipes.length > 0;
  const showHouseholdTab = myRecipes.length > 0 && members.length >= 2;
  const visibleTabs: RecipeTab[] = showHouseholdTab
    ? ["all", "saved", "cooked", "household"]
    : ["all", "saved", "cooked"];
  // Rows backing the live "From your fridge tonight" cards are skipped in the
  // lists so a fresh generation doesn't appear twice on screen.
  const hideCurrentSession = suggestions.length > 0 && currentSessionId;
  const listedMyRecipes = hideCurrentSession
    ? myRecipes.filter((r) => r.session_id !== currentSessionId)
    : myRecipes;
  const listedHouseholdRecipes = hideCurrentSession
    ? savedRecipes.filter((r) => r.session_id !== currentSessionId)
    : savedRecipes;
  const tabRecipes =
    tab === "all"
      ? listedMyRecipes
      : tab === "saved"
        ? favoriteRecipes
        : tab === "cooked"
          ? cookedRecipes
          : listedHouseholdRecipes;
  const cookedEventCount = cookedRecipes.reduce((sum, recipe) => sum + (recipe.cooked_count ?? 0), 0);

  const hasSuggestions = suggestions.length > 0;
  // Full filter vocabulary: every tag across suggestions, household recipes,
  // and cooked history — not just the user's own.
  const categories = [
    ...new Set([
      ...suggestions.flatMap((match) => match.tags),
      ...savedRecipes.flatMap((recipe) => recipe.tags ?? []),
      ...cookedRecipes.flatMap((recipe) => recipe.tags ?? []),
    ]),
  ].sort();
  const filteredSuggestions =
    filter === "fridge" ? suggestions : suggestions.filter((match) => match.tags.includes(filter));
  const filteredTabRecipes =
    filter === "fridge" ? tabRecipes : tabRecipes.filter((recipe) => (recipe.tags ?? []).includes(filter));
  const fromFridgeRecipeCount = suggestions.length + tabRecipes.length;
  const tagRecipeCounts = new Map(
    categories.map((tag) => [
      tag,
      suggestions.filter((match) => match.tags.includes(tag)).length +
        tabRecipes.filter((recipe) => (recipe.tags ?? []).includes(tag)).length,
    ]),
  );
  const isEmpty = !hasSuggestions && !hasOwnRecipes && !loading;

  const inventoryNames = new Set(inventory.map((lot) => lot.normalized_name));
  // "Cook again" hero: the recipe you've returned to most (favorites break ties).
  const cookAgainPick =
    tab === "all" && filter === "fridge"
      ? [...listedMyRecipes]
          .filter((r) => (cookedSummaries[r.id]?.count ?? 0) > 0)
          .sort(
            (a, b) =>
              (cookedSummaries[b.id]?.count ?? 0) - (cookedSummaries[a.id]?.count ?? 0) ||
              Number(b.is_favorite) - Number(a.is_favorite),
          )[0]
      : undefined;
  const cookAgainCoverage = cookAgainPick
    ? fridgeCoverage(cookAgainPick.ingredients, inventoryNames)
    : null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title={t("recipes.emptyTitle")}
            body={generateNotice ?? t("recipes.emptyBody")}
            actionLabel={t("recipes.emptyAction")}
            onAction={openCookPrompt}
          />
        </View>
      ) : (
        <>
          <View style={styles.fixedContent}>
            <View style={styles.header}>
              <Text variant="micro" muted uppercase>
                {t("recipes.countLabel", { count: listedMyRecipes.length + suggestions.length })}
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
              <FilterChip
                label={t("recipes.filters.fromFridge")}
                active={filter === "fridge"}
                count={String(fromFridgeRecipeCount)}
                onPress={() => setFilter("fridge")}
              />
              {categories.map((tag) => (
                <FilterChip
                  key={tag}
                  label={formatCategory(tag)}
                  active={filter === tag}
                  count={String(tagRecipeCounts.get(tag) ?? 0)}
                  onPress={() => setFilter((f) => (f === tag ? "fridge" : tag))}
                />
              ))}
            </ScrollView>

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

            {hasOwnRecipes ? (
              <View style={styles.tabBar}>
                {visibleTabs.map((t_) => {
                  const label =
                    t_ === "all"
                        ? t("recipes.tabs.all")
                        : t_ === "saved"
                          ? `${t("recipes.tabs.saved")} · ${favoriteRecipes.length}`
                        : t_ === "cooked"
                          ? `${t("recipes.tabs.cooked")} · ${cookedEventCount}`
                        : t("recipes.tabs.household");
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
            ) : null}
          </View>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {cookAgainPick && cookAgainCoverage ? (
              <View style={styles.sectionBlock}>
                <Text variant="micro" muted uppercase style={styles.cookAgainLabel}>
                  {t("recipes.cookAgain.title")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigateToSavedDetail(cookAgainPick)}
                  style={({ pressed }) => [styles.cookAgainCard, pressed && styles.savedRowPressed]}
                >
                  <View style={styles.cookAgainThumb}>
                    <RecipeGlyph size={48} />
                    <View style={styles.cookAgainCountBadge}>
                      <Text variant="micro" color={colors.text} style={styles.cookAgainCountText}>
                        {cookedSummaries[cookAgainPick.id]?.count ?? 0}×
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cookAgainCopy}>
                    <View>
                      <Text variant="micro" color={colors.accent} uppercase>
                        {t("recipes.cookAgain.eyebrow")}
                      </Text>
                      <Text variant="h3" color={colors.surface} style={styles.cookAgainTitle} numberOfLines={2}>
                        {cookAgainPick.title}
                      </Text>
                    </View>
                    <Text variant="small" color="rgba(248,244,238,0.85)">
                      ⏱ {cookAgainPick.time_minutes ?? 20} min · {t("recipes.cookAgain.items", {
                        have: cookAgainCoverage.have,
                        total: cookAgainCoverage.total,
                      })}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : null}

            {hasSuggestions ? (
              <View style={styles.sectionBlock}>
                <Text variant="h3" style={styles.sectionTitle}>
                  {t("recipes.fromFridgeTitle")}
                </Text>
                <View style={styles.cardList}>
                  {filteredSuggestions.length === 0 ? (
                    <Text variant="small" muted style={styles.filterEmpty}>
                      {t("recipes.filterEmpty")}
                    </Text>
                  ) : (
                    filteredSuggestions.map((match) => {
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
                          cookedLabel={savedRecipe?.cooked_count ? t("recipes.cooked.count", { count: savedRecipe.cooked_count }) : undefined}
                          onPress={() => navigateToDetail(match, savedRecipe?.id)}
                        />
                      );
                    })
                  )}
                </View>
              </View>
            ) : null}

            {hasOwnRecipes ? (
              <View style={styles.savedList}>
                {filteredTabRecipes.map((recipe) => {
                  const summary = cookedSummaries[recipe.id];
                  const cookedLabel = summary
                    ? members.length >= 2 && summary.cookedBy.length === 1
                      ? t("recipes.cooked.countBy", {
                          count: summary.count,
                          name: memberName(summary.cookedBy[0]),
                        })
                      : t("recipes.cooked.count", { count: summary.count })
                    : undefined;
                  const coverage = fridgeCoverage(recipe.ingredients, inventoryNames);
                  return (
                    <SavedRecipeRow
                      key={recipe.id}
                      recipe={recipe}
                      onPress={() => navigateToSavedDetail(recipe)}
                      onFavorite={() => toggleFavorite(recipe.id, recipe.is_favorite)}
                      cookedLabel={cookedLabel}
                      attribution={
                        members.length >= 2
                          ? t("recipes.byName", { name: memberName(recipe.generated_by) })
                          : undefined
                      }
                      coverageLabel={
                        coverage.total === 0
                          ? undefined
                          : coverage.have === coverage.total
                            ? t("recipes.haveAll")
                            : t("recipes.needItems", { count: coverage.total - coverage.have })
                      }
                      haveAll={coverage.total > 0 && coverage.have === coverage.total}
                      tagLabel={recipe.tags?.[0] ? formatCategory(recipe.tags[0]) : undefined}
                    />
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        </>
      )}

      {isEmpty ? null : (
        <BottomDock>
          <Button
            title={t("recipes.generateCta")}
            onPress={openCookPrompt}
            loading={generating}
          />
        </BottomDock>
      )}

      <CookPromptSheet
        key={cookPromptKey}
        visible={showCookPrompt}
        labels={{
          title: t("recipes.cookPrompt.title"),
          meal: t("recipes.cookPrompt.meal"),
          mealOptions: {
            any: t("recipes.cookPrompt.mealOptions.any"),
            breakfast: t("recipes.cookPrompt.mealOptions.breakfast"),
            lunch: t("recipes.cookPrompt.mealOptions.lunch"),
            dinner: t("recipes.cookPrompt.mealOptions.dinner"),
            snack: t("recipes.cookPrompt.mealOptions.snack"),
          },
          time: t("recipes.cookPrompt.time"),
          timeOptions: {
            any: t("recipes.cookPrompt.timeOptions.any"),
            "20": t("recipes.cookPrompt.timeOptions.20"),
            "45": t("recipes.cookPrompt.timeOptions.45"),
          },
          vibe: t("recipes.cookPrompt.vibe"),
          vibeOptions: {
            comfort: t("recipes.cookPrompt.vibeOptions.comfort"),
            healthy: t("recipes.cookPrompt.vibeOptions.healthy"),
            veggie: t("recipes.cookPrompt.vibeOptions.veggie"),
            quick: t("recipes.cookPrompt.vibeOptions.quick"),
          },
          surprise: t("recipes.cookPrompt.surprise"),
          generate: t("recipes.cookPrompt.generate"),
          cookingFor: t("recipes.cookingMode.title"),
          cookingForOptions: {
            household: t("recipes.cookingMode.household"),
            just_me: t("recipes.cookingMode.justMe"),
          },
        }}
        cookingMode={showCookingMode ? cookingMode : undefined}
        onCookingModeChange={setCookingMode}
        onDismiss={() => setShowCookPrompt(false)}
        onGenerate={handleGenerate}
      />

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

function formatCategory(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
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


const THUMB_COLORS = ["#C8D5C2", "#E8C3B0", "#F0DDA8", "#E8B59E", "#E5D9C4"] as const;

function thumbColorFor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash + title.charCodeAt(i)) % 997;
  return THUMB_COLORS[hash % THUMB_COLORS.length];
}

// Required, non-staple ingredients found in the live fridge.
function fridgeCoverage(ingredients: unknown, inventoryNames: Set<string>) {
  const counted = parseRecipeIngredients(ingredients).filter(
    (ing) =>
      (ing as { required?: boolean }).required !== false &&
      !STAPLE_INGREDIENTS.has(normalizeFoodName(ing.name)),
  );
  const have = counted.filter((ing) => inventoryNames.has(normalizeFoodName(ing.name))).length;
  return { have, total: counted.length };
}

function Chevron() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path
        d="M5 3L9 7L5 11"
        stroke={colors.muted2}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SavedRecipeRow({
  recipe,
  onPress,
  onFavorite,
  cookedLabel,
  attribution,
  coverageLabel,
  haveAll,
  tagLabel,
}: {
  recipe: RecipeRow;
  onPress: () => void;
  onFavorite: () => void;
  cookedLabel?: string;
  attribution?: string;
  coverageLabel?: string;
  haveAll?: boolean;
  tagLabel?: string;
}) {
  const time = recipe.time_minutes ? `${recipe.time_minutes} min` : "";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.savedRow, pressed && styles.savedRowPressed]}
    >
      <View style={[styles.savedRowThumb, { backgroundColor: thumbColorFor(recipe.title) }]}>
        <RecipeGlyph size={34} variant="simple" />
      </View>
      <View style={styles.savedRowCopy}>
        <Text variant="label" numberOfLines={1}>{recipe.title}</Text>
        <View style={styles.savedRowMeta}>
          {time ? <Text variant="small" muted>⏱ {time}</Text> : null}
          {coverageLabel ? (
            <View style={styles.coverageWrap}>
              {haveAll ? <View style={styles.coverageDot} /> : null}
              <Text variant="micro" color={haveAll ? colors.green : colors.muted} style={styles.coverageText}>
                {coverageLabel}
              </Text>
            </View>
          ) : null}
          {tagLabel ? (
            <View style={styles.tagPill}>
              <Text variant="micro" color={colors.primary} style={styles.tagPillText}>{tagLabel}</Text>
            </View>
          ) : null}
          {cookedLabel ? (
            <View style={styles.cookedBadge}>
              <Text variant="micro" color={colors.primary}>{cookedLabel}</Text>
            </View>
          ) : null}
          {attribution ? (
            <Text variant="micro" muted>{attribution}</Text>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recipe.is_favorite ? "★" : "☆"}
        onPress={onFavorite}
        hitSlop={10}
        style={styles.favoriteTap}
      >
        <Text variant="body" color={recipe.is_favorite ? colors.accent : colors.muted2}>
          {recipe.is_favorite ? "★" : "☆"}
        </Text>
      </Pressable>
      <Chevron />
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
  fixedContent: {
    paddingTop: spacing.screenTop,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.tabBarClearance,
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
  filterRail: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  filterEmpty: {
    paddingVertical: spacing.lg,
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
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.screenX,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: spacing.xl,
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
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  cookedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.primary50,
    borderRadius: radii.pill,
  },
  coverageWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coverageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  coverageText: {
    fontWeight: "600",
  },
  tagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.primary50,
    borderRadius: radii.pill,
  },
  tagPillText: {
    fontWeight: "700",
  },
  favoriteTap: {
    minWidth: 32,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cookAgainLabel: {
    marginBottom: spacing.sm,
  },
  cookAgainCard: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
  },
  cookAgainThumb: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    backgroundColor: "#C8D5C2",
    alignItems: "center",
    justifyContent: "center",
  },
  cookAgainCountBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  cookAgainCountText: {
    fontWeight: "700",
  },
  cookAgainCopy: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  cookAgainTitle: {
    marginTop: 4,
  },
});
