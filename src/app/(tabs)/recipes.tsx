import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { CookFilters, CookPromptSheet, DaySheet, DinnerHero, GeneratingOverlay, Logo, PremiumSheet, RecipeCard, RecipeGlyph, SavedRecipeRow, ScanIcon, Screen, Text, WeekStrip } from "@/components";
import { isPremium as resolvePremium, openRecipeDetail, openSavedRecipe, useAuth } from "@/features";
import { useHousehold, useInsights, useInventory, useRecipes } from "@/hooks";
import { formatMoney } from "@/lib";
import { DayActivity, getDayActivity } from "@/repositories/insightsRepository";
import { CookingMode, RecipeRow } from "@/repositories/recipeRepository";
import {
  formatComplexity,
  formatTimeLabel,
  fridgeCoverage,
  latestGeneratedBatch,
  parseRecipeIngredients,
  RecipeMatch,
} from "@/services/recipeService";
import { availableBaseOptions, daysLeft, InventoryCategory, normalizeFoodName, toUiCategory } from "@/services";
import { colors, fonts, radii, spacing } from "@/theme";

export default function RecipesRoute() {
  const { t } = useTranslation();
  const { autoGenerate } = useLocalSearchParams<{ autoGenerate?: string }>();
  const { profile, activeHousehold, refresh } = useAuth();
  const { lots: inventory, groups: inventoryGroups, loading: inventoryLoading } = useInventory(activeHousehold?.id);
  const baseOptions = useMemo(() => availableBaseOptions(inventory), [inventory]);
  const { members, combinedAvoidances } = useHousehold(activeHousehold?.id);
  const isPremium = resolvePremium(profile, activeHousehold);
  const userAvoidances = profile?.avoidances ?? [];
  const [showPremium, setShowPremium] = useState(false);
  const [showCookPrompt, setShowCookPrompt] = useState(false);
  const [cookPromptKey, setCookPromptKey] = useState(0);
  const [cookingMode, setCookingMode] = useState<CookingMode>("household");
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  // The week strip's day sheet: the tapped day, and its activity once loaded.
  const [openDay, setOpenDay] = useState<{ date: Date; activity: DayActivity | null } | null>(null);
  const [lastFilters, setLastFilters] = useState<CookFilters | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const showCookingMode = members.length >= 2;
  const activeAvoidances = cookingMode === "household" ? combinedAvoidances : userAvoidances;
  // Just me cooks for one; the household cooks for its servings setting
  // (seeded at onboarding, editable in Settings). The cook prompt's stepper can
  // override it for a single generation; the override resets when the mode changes.
  const defaultServings = cookingMode === "household"
    ? (activeHousehold?.default_servings ?? profile?.default_servings ?? 2)
    : 1;
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
    lastCookedAt,
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

  const showDay = async (date: Date) => {
    if (!activeHousehold?.id) return;
    setOpenDay({ date, activity: null });
    const until = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    let activity: DayActivity = { cooked: [], used: [], moneySaved: 0 };
    try {
      activity = await getDayActivity(activeHousehold.id, date.toISOString(), until.toISOString(), profile?.id);
    } catch {
      // A failed load reads as an empty day; tapping the day again retries.
    }
    // Ignore a late answer for a day the user already moved on from.
    setOpenDay((current) => (current?.date === date ? { date, activity } : current));
  };

  const { streak, week, refresh: refreshInsights } = useInsights(activeHousehold?.id, { userId: profile?.id });

  useFocusEffect(
    useCallback(() => {
      void refreshRecipes();
      void refreshInsights();
    }, [refreshRecipes, refreshInsights]),
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

  const navigateToDetail = useCallback(
    (match: RecipeMatch, recipeId?: string) => {
      const saved = recipeId ? savedRecipes.find((r) => r.id === recipeId) : undefined;
      openRecipeDetail({
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
    [savedRecipes],
  );

  const memberName = useCallback(
    (id: string | null) =>
      id === profile?.id
        ? t("settings.household.you")
        : members.find((m) => m.user_id === id)?.display_name ?? "?",
    [members, profile?.id, t],
  );

  const myRecipes = savedRecipes.filter((r) => r.generated_by === profile?.id);
  // is_favorite is overlaid per current user in useRecipes, so this is "my favorites".
  const favoriteRecipes = savedRecipes.filter((r) => r.is_favorite);
  const hasOwnRecipes = myRecipes.length > 0 || cookedRecipes.length > 0;
  const hasSuggestions = suggestions.length > 0;
  // Tonight's picks: this session's fresh generation, or — after a restart —
  // today's last batch read back from the saved recipes (no new AI call).
  const restoredTonight = hasSuggestions ? [] : latestGeneratedBatch(savedRecipes, profile?.id);
  const hasTonight = hasSuggestions || restoredTonight.length > 0;
  const tonightSessionId = hasSuggestions ? currentSessionId : restoredTonight[0]?.session_id ?? null;
  // Rows backing tonight's picks are skipped in the shelves so they don't
  // appear twice on screen.
  const listedMyRecipes = hasTonight && tonightSessionId
    ? myRecipes.filter((r) => r.session_id !== tonightSessionId)
    : myRecipes;
  const fridgeEmpty = inventory.length === 0;
  // Soonest to go off first — the same foods Kitchen's Eat first shelf lists.
  const urgentGroups = inventoryGroups
    .filter((group) => group.urgency === "urgent")
    .map((group) => ({ group, left: Math.min(...group.lots.map((lot) => daysLeft(lot))) }))
    .sort((a, b) => a.left - b.left)
    .map(({ group }) => group);
  // Use first: premium names the foods (as Eat first does); free gets the count.
  const useFirstText =
    urgentGroups.length === 0
      ? null
      : isPremium
        ? urgentGroups.slice(0, 3).map((group) => group.name).join(", ") +
          (urgentGroups.length > 3 ? ` +${urgentGroups.length - 3}` : "")
        : t("recipes.home.useToday", { count: urgentGroups.length });
  const rawName = profile?.display_name?.trim() ?? "";
  const firstName = rawName && !rawName.includes("@") ? rawName.split(/\s+/)[0] : "";

  const inventoryNames = new Set(inventory.map((lot) => lot.normalized_name));
  // Tonight's idea: before any generation today, open on the saved recipe the
  // kitchen covers best right now (at least 60% of its ingredients; ties go to
  // the one cooked most). Free — no AI call; AI ideas stay one tap away.
  const idea = hasTonight
    ? undefined
    : savedRecipes
        .map((recipe) => ({ recipe, coverage: fridgeCoverage(recipe.ingredients, inventoryNames) }))
        .filter(({ coverage }) => coverage.total > 0 && coverage.have / coverage.total >= 0.6)
        .sort(
          (a, b) =>
            b.coverage.have / b.coverage.total - a.coverage.have / a.coverage.total ||
            (cookedSummaries[b.recipe.id]?.count ?? 0) - (cookedSummaries[a.recipe.id]?.count ?? 0),
        )[0];
  // Tonight's dish: the first of tonight's picks, else the idea. The other
  // picks follow under the card.
  const savedForMatch = (match: RecipeMatch) => savedRecipes.find((r) => r.title === match.title && r.session_id);
  const dish = hasSuggestions
    ? {
        title: suggestions[0].title,
        description: suggestions[0].description,
        minutes: suggestions[0].timeMinutes,
        complexity: suggestions[0].complexity,
        ingredients: suggestions[0].ingredients as unknown,
        open: () => navigateToDetail(suggestions[0], savedForMatch(suggestions[0])?.id),
      }
    : (() => {
        const row = restoredTonight[0] ?? idea?.recipe;
        return row
          ? {
              title: row.title,
              description: row.description,
              minutes: row.time_minutes ?? 20,
              complexity: row.complexity ?? "simple",
              ingredients: row.ingredients,
              open: () => openSavedRecipe(row),
            }
          : null;
      })();
  const dishCoverage = dish ? fridgeCoverage(dish.ingredients, inventoryNames) : null;
  const lastCooked = cookedRecipes[0];
  const lastCookedDay = lastCookedAt
    ? new Date(lastCookedAt).toLocaleDateString(
        undefined,
        // Inside the strip's week a weekday is enough; older cooks get a date.
        new Date(lastCookedAt) >= week[0].date ? { weekday: "short" } : { day: "numeric", month: "short" },
      )
    : "";
  // "Cook again" hero: the recipe you've returned to most (favorites break ties).
  const cookAgainPick = [...listedMyRecipes]
    .filter((r) => (cookedSummaries[r.id]?.count ?? 0) > 0)
    .sort(
      (a, b) =>
        (cookedSummaries[b.id]?.count ?? 0) - (cookedSummaries[a.id]?.count ?? 0) ||
        Number(b.is_favorite) - Number(a.is_favorite),
    )[0];
  const cookAgainCoverage = cookAgainPick
    ? fridgeCoverage(cookAgainPick.ingredients, inventoryNames)
    : null;

  const memberCount = members.length;
  const renderSavedRow = (recipe: RecipeRow) => (
    <SavedRecipeRow
      key={recipe.id}
      recipe={recipe}
      onPress={() => openSavedRecipe(recipe)}
      onFavorite={() => toggleFavorite(recipe.id, recipe.is_favorite)}
      cookedSummary={cookedSummaries[recipe.id]}
      memberCount={memberCount}
      memberName={memberName}
      inventoryNames={inventoryNames}
    />
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Screen padded={false} bottomInset={false}>
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* TinyMeals-style top: who, today's nudge, the week, tonight's dish. */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <Logo size={26} />
            {isPremium ? <View style={styles.premiumDot} /> : null}
          </View>
          {activeHousehold ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(tabs)/settings")}
              style={({ pressed }) => [styles.householdPill, pressed && styles.savedRowPressed]}
            >
              <View style={styles.householdAvatar}>
                <Text variant="micro" color={colors.primary} style={styles.metaStrong}>
                  {(firstName || activeHousehold.name).charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text variant="small" numberOfLines={1} style={styles.metaStrong}>
                {activeHousehold.name}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {useFirstText ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/fridge")}
            style={({ pressed }) => [styles.useFirst, pressed && styles.savedRowPressed]}
          >
            <Text variant="small" color={colors.accentInk}>
              <Text variant="small" color={colors.accentInk} style={styles.metaStrong}>
                {t("recipes.home.useFirst")} ·{" "}
              </Text>
              {useFirstText}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.weekWrap}>
          <WeekStrip
            days={week}
            streak={streak >= 2 ? t("recipes.week.streak", { count: streak }) : undefined}
            lastLabel={t("recipes.week.lastCooked")}
            lastValue={lastCooked ? `${lastCooked.title} · ${lastCookedDay}` : t("recipes.week.nothingCooked")}
            onLastPress={lastCooked ? () => openSavedRecipe(lastCooked) : undefined}
            historyLabel={t("recipes.week.history")}
            onHistory={() => router.push({ pathname: "/(tabs)/all-recipes", params: { tab: "cooked" } })}
            onDayPress={showDay}
          />
        </View>

        {/* Recipes are the home: tonight's dish when there is one, the question when there isn't. */}
        <View style={styles.heroWrap}>
          {dish && dishCoverage ? (
            <DinnerHero
              eyebrow={t("recipes.home.tonightEyebrow")}
              title={dish.title}
              body={generateNotice ?? dish.description ?? undefined}
              meta={[
                formatTimeLabel(dish.minutes),
                formatComplexity(dish.complexity),
                dishCoverage.have === dishCoverage.total
                  ? t("recipes.home.haveAll")
                  : t("recipes.home.haveSome", { have: dishCoverage.have, total: dishCoverage.total }),
              ].join(" • ")}
              media={<RecipeGlyph size={48} />}
              ctaLabel={t("recipes.home.cookThis")}
              loading={generating}
              onPress={dish.open}
              secondary={{
                prefix: t("recipes.home.notFeelingIt"),
                label: hasTonight ? t("recipes.showOthers") : t("recipes.home.moreIdeas"),
                onPress: hasTonight ? handleShowOthers : openCookPrompt,
              }}
            />
          ) : (
            <DinnerHero
              eyebrow={t("recipes.home.eyebrow")}
              title={fridgeEmpty ? t("recipes.home.titleEmpty") : t("recipes.home.title")}
              body={
                generateNotice ??
                (fridgeEmpty
                  ? t("recipes.scanBody")
                  : urgentGroups.length > 0
                    ? t("recipes.home.useToday", { count: urgentGroups.length })
                    : t("recipes.home.inKitchen", { count: inventoryGroups.length }))
              }
              ctaLabel={fridgeEmpty ? t("recipes.home.scanCta") : t("recipes.generateCta")}
              ctaIcon={fridgeEmpty ? <ScanIcon color={colors.surface} size={20} /> : undefined}
              loading={generating}
              onPress={fridgeEmpty ? () => router.push("/(tabs)/scan") : openCookPrompt}
            />
          )}
        </View>

        {hasTonight && (hasSuggestions ? suggestions.length : restoredTonight.length) > 1 ? (
          <View style={styles.sectionBlock}>
            <Text variant="micro" muted uppercase style={[styles.eyebrow, styles.cookAgainLabel]}>
              {t("recipes.home.alsoTonight")}
            </Text>
            <View style={styles.alsoTonight}>
              {hasSuggestions
                ? suggestions.slice(1).map((match) => {
                    const savedRecipe = savedForMatch(match);
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
                : restoredTonight.slice(1).map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      title={recipe.title}
                      timeLabel={formatTimeLabel(recipe.time_minutes ?? 20)}
                      complexityLabel={formatComplexity(recipe.complexity ?? "simple")}
                      usedItems={parseRecipeIngredients(recipe.ingredients)
                        .map((ing) => ing.name)
                        .filter((name) => inventoryNames.has(normalizeFoodName(name)))}
                      usesLabel={t("recipes.uses")}
                      favorite={recipe.is_favorite}
                      favoriteLabel="★"
                      cookedLabel={recipe.cooked_count ? t("recipes.cooked.count", { count: recipe.cooked_count }) : undefined}
                      onPress={() => openSavedRecipe(recipe)}
                    />
                  ))}
            </View>
          </View>
        ) : null}




        {recipeError ? (
          <View style={styles.errorBanner}>
            <Text variant="small" color={colors.redInk} style={styles.limitText}>
              {recipeError}
            </Text>
          </View>
        ) : null}

        {!isPremium ? (
          <View style={styles.limitBanner}>
            <View>
              <Text variant="small" color={colors.accentInk} style={styles.limitText}>
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
              <Text variant="micro" color={colors.surface} style={styles.limitText}>{t("recipes.upgrade")}</Text>
            </Pressable>
          </View>
        ) : null}

        {cookAgainPick && cookAgainCoverage ? (
          <View style={styles.sectionBlock}>
            <Text variant="micro" muted uppercase style={[styles.eyebrow, styles.cookAgainLabel]}>
              {t("recipes.cookAgain.title")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openSavedRecipe(cookAgainPick)}
              style={({ pressed }) => [styles.cookAgainCard, pressed && styles.savedRowPressed]}
            >
              <View style={styles.cookAgainThumb}>
                <RecipeGlyph size={48} />
                <View style={styles.cookAgainCountBadge}>
                  <Text variant="micro" color={colors.accentInk} style={styles.cookAgainCountText}>
                    {cookedSummaries[cookAgainPick.id]?.count ?? 0}×
                  </Text>
                </View>
              </View>
              <View style={styles.cookAgainCopy}>
                <View>
                  <Text variant="micro" color={colors.accentInk} uppercase style={styles.eyebrow}>
                    {t("recipes.cookAgain.eyebrow")}
                  </Text>
                  <Text style={styles.cookAgainTitle} numberOfLines={2}>
                    {cookAgainPick.title}
                  </Text>
                </View>
                <View style={styles.inlineMeta}>
                  <View style={styles.metaDot} />
                  <Text variant="small" color={colors.primary} style={styles.metaStrong}>
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

        {/* Short shelves keep the home a home; the long tail lives on All recipes. */}
        <RecipeShelf
          title={t("recipes.shelves.saved")}
          recipes={favoriteRecipes}
          limit={3}
          seeAllTab="saved"
          renderRow={renderSavedRow}
        />
        <RecipeShelf
          title={t("recipes.shelves.recentlyMade")}
          recipes={cookedRecipes}
          limit={3}
          seeAllTab="cooked"
          renderRow={renderSavedRow}
        />
        <RecipeShelf
          title={t("recipes.shelves.yours")}
          recipes={listedMyRecipes}
          limit={4}
          seeAllTab="all"
          renderRow={renderSavedRow}
        />

        {hasOwnRecipes ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/all-recipes")}
            style={({ pressed }) => [styles.browseAll, pressed && styles.savedRowPressed]}
          >
            <Text variant="label" color={colors.primary} style={styles.browseAllLabel}>
              {t("recipes.shelves.browseAll")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <DaySheet
        visible={openDay != null}
        onDismiss={() => setOpenDay(null)}
        title={openDay?.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) ?? ""}
        activity={
          openDay?.activity
            ? {
                cooked: openDay.activity.cooked,
                used: openDay.activity.used.map((food) => ({ ...food, category: toUiCategory(food.category as InventoryCategory) })),
              }
            : null
        }
        saved={
          isPremium && openDay?.activity && openDay.activity.moneySaved > 0
            ? t("recipes.week.saved", { amount: formatMoney(openDay.activity.moneySaved, activeHousehold?.currency_code ?? "USD") })
            : undefined
        }
        labels={{ cooked: t("recipes.week.dayCooked"), used: t("recipes.week.dayUsed"), empty: t("recipes.week.dayEmpty") }}
        onOpenRecipe={(recipeId) => {
          const recipe = savedRecipes.find((r) => r.id === recipeId);
          if (!recipe) return;
          setOpenDay(null);
          openSavedRecipe(recipe);
        }}
      />

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

function RecipeShelf({
  title,
  recipes,
  limit,
  seeAllTab,
  renderRow,
}: {
  title: string;
  recipes: RecipeRow[];
  limit: number;
  seeAllTab: "all" | "saved" | "cooked";
  renderRow: (recipe: RecipeRow) => ReactNode;
}) {
  const { t } = useTranslation();
  if (recipes.length === 0) return null;
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHead}>
        <Text variant="micro" uppercase muted style={styles.eyebrow}>
          {title} · {recipes.length}
        </Text>
        {recipes.length > limit ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => router.push({ pathname: "/(tabs)/all-recipes", params: { tab: seeAllTab } })}
          >
            <Text variant="small" color={colors.primary} style={styles.metaStrong}>
              {t("recipes.shelves.seeAll", { count: recipes.length })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.shelfRows}>{recipes.slice(0, limit).map(renderRow)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  shelfRows: {
    gap: 10,
  },
  shelfHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxs,
  },
  browseAll: {
    marginHorizontal: spacing.screenX,
    minHeight: 48,
    borderRadius: radii.xl,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  browseAllLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  weekWrap: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.md,
  },
  heroWrap: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.xl,
  },
  alsoTonight: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.tabBarClearance,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  premiumDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
  },
  householdPill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  householdAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  useFirst: {
    marginHorizontal: spacing.screenX,
    marginBottom: spacing.md,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
  },
  inlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  limitBanner: {
    marginHorizontal: spacing.screenX,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  errorBanner: {
    marginHorizontal: spacing.screenX,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.redSoft,
    borderRadius: radii.xl,
  },
  limitText: {
    fontWeight: "700",
  },
  limitSub: {
    marginTop: 2,
  },
  upgradeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  sectionBlock: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.xxl,
  },
  savedRowPressed: {
    transform: [{ scale: 0.98 }],
  },
  eyebrow: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    letterSpacing: 0.66,
  },
  metaDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  metaStrong: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  cookAgainLabel: {
    marginBottom: spacing.sm,
  },
  cookAgainCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.xxl,
    padding: spacing.lg + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  cookAgainThumb: {
    width: 76,
    height: 76,
    borderRadius: radii.xl,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cookAgainCountBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 4,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: colors.cardLine,
    alignItems: "center",
    justifyContent: "center",
  },
  cookAgainCountText: {
    fontWeight: "700",
  },
  cookAgainCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  cookAgainTitle: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 22,
    marginTop: 3,
  },
});
