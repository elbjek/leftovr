import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Path } from "react-native-svg";

import { BottomDock, BottomSheet, Button, CookFilters, CookPromptSheet, EmptyFridge, EmptyState, FilterChip, GeneratingOverlay, PremiumSheet, RecipeCard, RecipeGlyph, ScanIcon, Screen, ScreenHeader, Text } from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { useHousehold, useInventory, useRecipes } from "@/hooks";
import { CookingMode, RecipeRow } from "@/repositories/recipeRepository";
import {
  formatComplexity,
  formatTimeLabel,
  RecipeMatch,
} from "@/services/recipeService";
import { availableBaseOptions, normalizeFoodName } from "@/services";
import { colors, fonts, radii, spacing } from "@/theme";

type RecipeTab = "all" | "saved" | "cooked" | "household";
type RecipeIngredientParam = { name: string };

export default function RecipesRoute() {
  const { t } = useTranslation();
  const { autoGenerate } = useLocalSearchParams<{ autoGenerate?: string }>();
  const { profile, activeHousehold, refresh } = useAuth();
  const { lots: inventory, loading: inventoryLoading } = useInventory(activeHousehold?.id);
  const baseOptions = useMemo(() => availableBaseOptions(inventory), [inventory]);
  const { members, combinedAvoidances } = useHousehold(activeHousehold?.id);
  const isPremium = resolvePremium(profile, activeHousehold);
  const userAvoidances = profile?.avoidances ?? [];
  const [tab, setTab] = useState<RecipeTab>("all");
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterTime, setFilterTime] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showCookPrompt, setShowCookPrompt] = useState(false);
  const [cookPromptKey, setCookPromptKey] = useState(0);
  const [cookingMode, setCookingMode] = useState<CookingMode>("household");
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<CookFilters | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const showCookingMode = members.length >= 2;
  const activeAvoidances = cookingMode === "household" ? combinedAvoidances : userAvoidances;
  // Default comes from household/profile; the cook prompt's stepper can override
  // it for a single generation. Override resets when the cooking mode changes.
  const defaultServings = cookingMode === "household"
    ? (activeHousehold?.default_servings ?? profile?.default_servings ?? 2)
    : (profile?.default_servings ?? 2);
  const [servingsOverride, setServingsOverride] = useState<number | null>(null);
  const servings = servingsOverride ?? defaultServings;

  const {
    loading,
    generating,
    suggestions,
    savedRecipes,
    cookedRecipes,
    canGenerate,
    refresh: refreshRecipes,
    generateSession,
    toggleFavorite,
    currentSessionId,
    cookedSummaries,
    quotaExceeded,
    error: recipeError,
  } = useRecipes(activeHousehold?.id, {
    inventory,
    avoidances: activeAvoidances,
    isPremium,
    freeGenerationUsed: Boolean(profile?.free_recipe_generation_used_at),
    servings,
    userId: profile?.id,
  });

  // Server-side 402 (free generation spent) — authoritative over the local
  // canGenerate gate, which can lag behind the profile row.
  useEffect(() => {
    if (quotaExceeded) setShowPremium(true);
  }, [quotaExceeded]);

  useFocusEffect(
    useCallback(() => {
      void refreshRecipes();
    }, [refreshRecipes]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshRecipes(), refresh()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshRecipes, refresh]);

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
    setGenerateNotice(null);
    setSearch("");
    setFilterTag(null);
    setFilterTime(null);
    setTab("all");
    setShowCookPrompt(false);
    setLastFilters(filters);
    const result = await generateSession(cookingMode, filters);
    setGenerateNotice(result && result.recipes.length === 0 ? t("recipes.noMakeable") : null);
  }, [canGenerate, cookingMode, generateSession, t]);

  // "Show me others": regenerate with the last-used filters, skipping the
  // cook prompt — premium taps it when the two suggestions don't land.
  const handleShowOthers = useCallback(() => {
    if (!canGenerate) {
      setShowPremium(true);
      return;
    }
    void handleGenerate(lastFilters);
  }, [canGenerate, handleGenerate, lastFilters]);

  // Arriving from the "Tonight's idea" card: kick off a generation right away
  // (expiring items lead, per the edge prompt) instead of dropping the user on
  // an idle list. Clear the param first so it fires once. Gating lives in
  // handleGenerate (free users hit the premium sheet).
  useEffect(() => {
    if (autoGenerate !== "1") return;
    // Wait for inventory to finish loading; firing on the initial empty [] would
    // generate against an empty fridge and always surface noneFound.
    if (inventoryLoading) return;
    router.setParams({ autoGenerate: undefined });
    void handleGenerate(undefined);
  }, [autoGenerate, inventoryLoading, handleGenerate]);

  // Single navigation builder. The detail screen recomputes which ingredients
  // are in-fridge/urgent from live inventory and depletes by name, so neither
  // the matched-item ids nor the urgent-name snapshot need to travel as params.
  const goToRecipeDetail = useCallback(
    (recipe: {
      title: string;
      description: string;
      timeMinutes: number;
      complexity: string;
      servings: number;
      ingredients: unknown;
      steps: unknown;
      recipeId: string;
      isFavorite: boolean;
      cookedCount: number;
    }) => {
      router.push({
        pathname: "/recipe-detail",
        params: {
          title: recipe.title,
          description: recipe.description,
          timeMinutes: String(recipe.timeMinutes),
          complexity: recipe.complexity,
          servings: String(recipe.servings),
          ingredients: JSON.stringify(recipe.ingredients),
          steps: JSON.stringify(recipe.steps),
          recipeId: recipe.recipeId,
          isFavorite: String(recipe.isFavorite),
          cookedCount: String(recipe.cookedCount),
        },
      });
    },
    [],
  );

  const navigateToDetail = useCallback(
    (match: RecipeMatch, recipeId?: string) => {
      const saved = recipeId ? savedRecipes.find((r) => r.id === recipeId) : undefined;
      goToRecipeDetail({
        title: match.title,
        description: match.description,
        timeMinutes: match.timeMinutes,
        complexity: match.complexity,
        servings: match.servingsBaseline,
        ingredients: match.ingredients,
        steps: match.steps,
        recipeId: recipeId ?? "",
        isFavorite: saved?.is_favorite ?? false,
        cookedCount: saved?.cooked_count ?? 0,
      });
    },
    [goToRecipeDetail, savedRecipes],
  );

  const navigateToSavedDetail = useCallback(
    (recipe: RecipeRow) => {
      goToRecipeDetail({
        title: recipe.title,
        description: recipe.description ?? "",
        timeMinutes: recipe.time_minutes ?? 20,
        complexity: recipe.complexity ?? "simple",
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        recipeId: recipe.id,
        isFavorite: recipe.is_favorite,
        cookedCount: recipe.cooked_count ?? 0,
      });
    },
    [goToRecipeDetail],
  );

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
  const query = search.trim().toLowerCase();
  const hasActiveFilters = filterTag !== null || filterTime !== null;
  const matchesQuery = (title: string, ingredientNames: string[]) =>
    !query ||
    title.toLowerCase().includes(query) ||
    ingredientNames.some((name) => name.toLowerCase().includes(query));
  const filteredSuggestions = suggestions.filter(
    (match) =>
      (!filterTag || match.tags.includes(filterTag)) &&
      (!filterTime || match.timeMinutes <= filterTime) &&
      matchesQuery(match.title, match.ingredients.map((ing) => ing.name)),
  );
  const filteredTabRecipes = tabRecipes.filter(
    (recipe) =>
      (!filterTag || (recipe.tags ?? []).includes(filterTag)) &&
      (!filterTime || (recipe.time_minutes ?? 0) <= filterTime) &&
      matchesQuery(recipe.title, parseRecipeIngredients(recipe.ingredients).map((ing) => ing.name)),
  );
  const isEmpty = !hasSuggestions && !hasOwnRecipes && !loading;
  const fridgeEmpty = inventory.length === 0;

  const inventoryNames = new Set(inventory.map((lot) => lot.normalized_name));
  // "Cook again" hero: the recipe you've returned to most (favorites break ties).
  const cookAgainPick =
    tab === "all" && !query && !hasActiveFilters
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
    <Screen padded={false} bottomInset={false}>
      {isEmpty ? (
        fridgeEmpty ? (
          <EmptyFridge body={t("recipes.scanBody")} ctaLabel={t("recipes.scanCta")} />
        ) : (
          <View style={styles.emptyWrap}>
            <EmptyState
              title={t("recipes.emptyTitle")}
              body={generateNotice ?? recipeError ?? t("recipes.emptyBody")}
              actionLabel={t("recipes.emptyAction")}
              onAction={openCookPrompt}
            />
          </View>
        )
      ) : (
        <>
          <View style={styles.fixedContent}>
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("recipes.filterSheet.title")}
                  onPress={() => setShowFilters(true)}
                  style={({ pressed }) => [styles.filterButton, pressed && styles.savedRowPressed]}
                >
                  <FilterIcon />
                  {hasActiveFilters ? <View style={styles.filterDot} /> : null}
                </Pressable>
                <ScreenHeader
                  style={styles.headerCopy}
                  eyebrow={t("recipes.countLabel", { count: listedMyRecipes.length + suggestions.length })}
                  title={t("recipes.title")}
                  subtitle={t("recipes.subtitle")}
                />
              </View>

              <View style={styles.searchField}>
                <SearchIcon />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t("recipes.searchPlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel={t("recipes.searchPlaceholder")}
                />
                {search.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.cancel")}
                    onPress={() => setSearch("")}
                    hitSlop={10}
                  >
                    <CloseIcon color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            </View>

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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          >
            {hasActiveFilters ? (
              <View style={styles.activeFilterRow}>
                {filterTag ? (
                  <ActiveFilterToken
                    label={formatCategory(filterTag)}
                    onRemove={() => setFilterTag(null)}
                  />
                ) : null}
                {filterTime ? (
                  <ActiveFilterToken
                    label={t(`recipes.cookPrompt.timeOptions.${filterTime}`)}
                    onRemove={() => setFilterTime(null)}
                  />
                ) : null}
              </View>
            ) : null}

            {recipeError ? (
              <View style={styles.errorBanner}>
                <Text variant="small" color={colors.red} style={styles.limitText}>
                  {recipeError}
                </Text>
              </View>
            ) : null}

            {!isPremium ? (
              <View style={styles.limitBanner}>
                <View>
                  <Text variant="small" color={colors.primary} style={styles.limitText}>
                    {canGenerate
                      ? t("recipes.freeGenerationLeft")
                      : t("recipes.freeGenerationUsed")}
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
                    <View style={styles.inlineMeta}>
                      <ClockIcon color="rgba(243,239,232,0.85)" />
                      <Text variant="small" color="rgba(243,239,232,0.85)">
                        {cookAgainPick.time_minutes ?? 20} min · {t("recipes.cookAgain.items", {
                          have: cookAgainCoverage.have,
                          total: cookAgainCoverage.total,
                        })}
                      </Text>
                    </View>
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
                          newLabel={t("recipes.newBadge")}
                          onPress={() => navigateToDetail(match, savedRecipe?.id)}
                        />
                      );
                    })
                  )}
                </View>
                {filteredSuggestions.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={generating}
                    onPress={handleShowOthers}
                    style={({ pressed }) => [styles.showOthers, pressed && styles.savedRowPressed]}
                  >
                    <RefreshIcon />
                    <Text variant="label" color={colors.primary}>
                      {t("recipes.showOthers")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {hasOwnRecipes && filteredTabRecipes.length === 0 && (query || hasActiveFilters) ? (
              <View style={styles.savedList}>
                <Text variant="small" muted style={styles.filterEmpty}>
                  {t("recipes.filterEmpty")}
                </Text>
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
          {fridgeEmpty ? (
            <Button
              title={t("recipes.scanCta")}
              iconLeft={<ScanIcon color={colors.surface} size={20} />}
              onPress={() => router.push("/(tabs)/scan")}
            />
          ) : (
            <Button
              title={t("recipes.generateCta")}
              onPress={openCookPrompt}
              loading={generating}
            />
          )}
        </BottomDock>
      )}

      <CookPromptSheet
        key={cookPromptKey}
        visible={showCookPrompt}
        labels={{
          eyebrow: t("recipes.cookPrompt.eyebrow"),
          title: t("recipes.cookPrompt.title"),
          meal: t("recipes.cookPrompt.meal"),
          mealOptions: {
            any: t("recipes.cookPrompt.mealOptions.any"),
            breakfast: t("recipes.cookPrompt.mealOptions.breakfast"),
            lunch: t("recipes.cookPrompt.mealOptions.lunch"),
            dinner: t("recipes.cookPrompt.mealOptions.dinner"),
            snack: t("recipes.cookPrompt.mealOptions.snack"),
          },
          mealSubtitles: {
            breakfast: t("recipes.cookPrompt.mealSubtitles.breakfast"),
            lunch: t("recipes.cookPrompt.mealSubtitles.lunch"),
            dinner: t("recipes.cookPrompt.mealSubtitles.dinner"),
            snack: t("recipes.cookPrompt.mealSubtitles.snack"),
          },
          buildAround: t("recipes.cookPrompt.buildAround"),
          baseOptions: {
            protein: t("recipes.cookPrompt.baseOptions.protein"),
            vegetables: t("recipes.cookPrompt.baseOptions.vegetables"),
            pasta: t("recipes.cookPrompt.baseOptions.pasta"),
            rice: t("recipes.cookPrompt.baseOptions.rice"),
            potatoes: t("recipes.cookPrompt.baseOptions.potatoes"),
            bread: t("recipes.cookPrompt.baseOptions.bread"),
            cheese: t("recipes.cookPrompt.baseOptions.cheese"),
          },
          time: t("recipes.cookPrompt.time"),
          timeOptions: {
            "15": t("recipes.cookPrompt.timeOptions.15"),
            "30": t("recipes.cookPrompt.timeOptions.30"),
            norush: t("recipes.cookPrompt.timeOptions.norush"),
          },
          timeSubtitles: {
            "15": t("recipes.cookPrompt.timeSubtitles.15"),
            "30": t("recipes.cookPrompt.timeSubtitles.30"),
            norush: t("recipes.cookPrompt.timeSubtitles.norush"),
          },
          servingsLabel: t("recipes.cookPrompt.servingsLabel"),
          peopleCount: (count: number) => t("recipes.cookPrompt.peopleCount", { count }),
          cuisine: t("recipes.cookPrompt.cuisine"),
          eatFirstNote: t("recipes.cookPrompt.eatFirstNote"),
          cuisineOptions: {
            any: t("recipes.cookPrompt.cuisineOptions.any"),
            italian: t("recipes.cookPrompt.cuisineOptions.italian"),
            mexican: t("recipes.cookPrompt.cuisineOptions.mexican"),
            american: t("recipes.cookPrompt.cuisineOptions.american"),
            greek: t("recipes.cookPrompt.cuisineOptions.greek"),
            mediterranean: t("recipes.cookPrompt.cuisineOptions.mediterranean"),
            french: t("recipes.cookPrompt.cuisineOptions.french"),
            indian: t("recipes.cookPrompt.cuisineOptions.indian"),
            middle_eastern: t("recipes.cookPrompt.cuisineOptions.middle_eastern"),
            asian: t("recipes.cookPrompt.cuisineOptions.asian"),
            japanese: t("recipes.cookPrompt.cuisineOptions.japanese"),
            thai: t("recipes.cookPrompt.cuisineOptions.thai"),
            chinese: t("recipes.cookPrompt.cuisineOptions.chinese"),
            korean: t("recipes.cookPrompt.cuisineOptions.korean"),
            british: t("recipes.cookPrompt.cuisineOptions.british"),
            spanish: t("recipes.cookPrompt.cuisineOptions.spanish"),
            eastern_european: t("recipes.cookPrompt.cuisineOptions.eastern_european"),
          },
          generate: t("recipes.cookPrompt.generate"),
          cookingFor: t("recipes.cookingMode.title"),
          cookingForOptions: {
            household: t("recipes.cookingMode.household"),
            just_me: t("recipes.cookingMode.justMe"),
          },
        }}
        baseOptions={baseOptions}
        generating={generating}
        servings={servings}
        onServingsChange={setServingsOverride}
        cookingMode={showCookingMode ? cookingMode : undefined}
        onCookingModeChange={(mode) => {
          setCookingMode(mode);
          setServingsOverride(null);
        }}
        onDismiss={() => setShowCookPrompt(false)}
        onGenerate={handleGenerate}
      />

      <BottomSheet visible={showFilters} onDismiss={() => setShowFilters(false)}>
        <Text variant="h2" style={styles.filterSheetTitle}>{t("recipes.filterSheet.title")}</Text>

        <Text variant="small" muted style={styles.filterSectionLabel}>
          {t("recipes.filterSheet.category")}
        </Text>
        <View style={styles.filterChipWrap}>
          <FilterChip
            label={t("recipes.filterSheet.all")}
            active={filterTag === null}
            onPress={() => setFilterTag(null)}
          />
          {categories.map((tag) => (
            <FilterChip
              key={tag}
              label={formatCategory(tag)}
              active={filterTag === tag}
              onPress={() => setFilterTag((current) => (current === tag ? null : tag))}
            />
          ))}
        </View>

        <Text variant="small" muted style={styles.filterSectionLabel}>
          {t("recipes.filterSheet.time")}
        </Text>
        <View style={styles.filterChipWrap}>
          <FilterChip
            label={t("recipes.cookPrompt.timeOptions.any")}
            active={filterTime === null}
            onPress={() => setFilterTime(null)}
          />
          {[20, 45].map((minutes) => (
            <FilterChip
              key={minutes}
              label={t(`recipes.cookPrompt.timeOptions.${minutes}`)}
              active={filterTime === minutes}
              onPress={() => setFilterTime((current) => (current === minutes ? null : minutes))}
            />
          ))}
        </View>

        <View style={styles.filterSheetButtons}>
          <Button
            title={t("recipes.filterSheet.show", {
              count: filteredSuggestions.length + filteredTabRecipes.length,
            })}
            onPress={() => setShowFilters(false)}
          />
          {hasActiveFilters ? (
            <Button
              title={t("recipes.filterSheet.reset")}
              variant="text"
              onPress={() => {
                setFilterTag(null);
                setFilterTime(null);
              }}
            />
          ) : null}
        </View>
      </BottomSheet>

      <PremiumSheet
        visible={showPremium}
        onPurchased={refresh}
        onDismiss={() => setShowPremium(false)}
      />

      {generating ? (
        <GeneratingOverlay
          title={t("recipes.generatingOverlay.title")}
          steps={[
            t("recipes.generatingOverlay.phrase1"),
            t("recipes.generatingOverlay.phrase2"),
            t("recipes.generatingOverlay.phrase3"),
            t("recipes.generatingOverlay.phrase4"),
          ]}
        />
      ) : null}
    </Screen>
  );
}

function formatCategory(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
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

// Every required ingredient counts — no staple assumption, so the number
// matches what the detail screen (and a future AI generation) actually needs.
function fridgeCoverage(ingredients: unknown, inventoryNames: Set<string>) {
  const counted = parseRecipeIngredients(ingredients).filter(
    (ing) => (ing as { required?: boolean }).required !== false,
  );
  const have = counted.filter((ing) => inventoryNames.has(normalizeFoodName(ing.name))).length;
  return { have, total: counted.length };
}

function ActiveFilterToken({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("recipes.filterSheet.remove", { label })}
      onPress={onRemove}
      hitSlop={{ top: 6, bottom: 6 }}
      style={styles.activeFilterToken}
    >
      <Text variant="micro" color={colors.surface} style={styles.activeFilterText}>
        {label}
      </Text>
      <CloseIcon color="rgba(243,239,232,0.75)" />
    </Pressable>
  );
}

function ClockIcon({ color = colors.muted }: { color?: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={5.4} stroke={color} strokeWidth={1.4} fill="none" />
      <Path d="M7 4.2V7l1.8 1.4" stroke={color} strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Path d="M3 3l6 6M9 3l-6 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7L10 2.5z"
        fill={filled ? colors.accent : "none"}
        stroke={filled ? colors.accent : colors.muted}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Circle cx={7} cy={7} r={5} stroke={colors.muted} strokeWidth={1.6} fill="none" />
      <Path d="M11 11l3 3" stroke={colors.muted} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function RefreshIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M13 5A5.5 5.5 0 1 0 14 8"
        stroke={colors.primary}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M13 2v3h-3" stroke={colors.primary} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FilterIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M2 4h12M4 8h8M6 12h4"
        stroke={colors.primary}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
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
  const { t } = useTranslation();
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
          {time ? (
            <View style={styles.inlineMeta}>
              <ClockIcon />
              <Text variant="small" muted>{time}</Text>
            </View>
          ) : null}
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
        accessibilityLabel={recipe.is_favorite ? t("recipes.detail.savedCta") : t("recipes.detail.saveCta")}
        accessibilityState={{ checked: recipe.is_favorite }}
        onPress={onFavorite}
        hitSlop={10}
        style={styles.favoriteTap}
      >
        <StarIcon filled={recipe.is_favorite} />
      </Pressable>
      <Chevron />
    </Pressable>
  );
}


const styles = StyleSheet.create({
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
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 10,
  },
  filterSheetTitle: {
    marginBottom: spacing.md,
  },
  filterSectionLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  filterChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterSheetButtons: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  activeFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.lg,
  },
  activeFilterToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  activeFilterText: {
    fontWeight: "600",
  },
  inlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  errorBanner: {
    marginHorizontal: spacing.screenX,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FBEDEA",
    borderRadius: radii.md,
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
  showOthers: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 44,
    marginTop: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
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
    minHeight: 44,
    justifyContent: "center",
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
