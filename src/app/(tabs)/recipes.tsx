import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import type { BottomTabNavigationProp } from "expo-router/js-tabs";
import { useTranslation } from "react-i18next";

import { CookFilters, CookPromptSheet, DaySheet, DinnerHero, FilterChip, GeneratingOverlay, IdeasResults, Logo, PremiumSheet, RecipeListCard, ScanIcon, Screen, Text, TryNextCard, WeekStrip } from "@/components";
import { isPremium as resolvePremium, openRecipeDetail, openSavedRecipe, useAuth } from "@/features";
import { useDaySheet, useHousehold, useInventory, useRecipes, useStreak } from "@/hooks";
import { formatMoney } from "@/lib";
import { CookingMode, RecipeRow } from "@/repositories/recipeRepository";
import {
  formatComplexity,
  formatTimeLabel,
  fridgeCoverage,
  latestGeneratedBatch,
  parseRecipeIngredients,
  RecipeMatch,
} from "@/services/recipeService";
import { availableBaseOptions, DAILY_GOAL, daysLeft, InventoryCategory, normalizeFoodName, toUiCategory } from "@/services";
import { colors, fonts, radii, spacing } from "@/theme";

type ListFilter = "all" | "soon" | "quick" | "saved" | "cooked";
const LIST_FILTERS: ListFilter[] = ["all", "soon", "quick", "saved", "cooked"];
// Cards on the home before "Browse all recipes".
const LIST_LIMIT = 6;

function capitalize(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

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
  const [lastFilters, setLastFilters] = useState<CookFilters | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  // A finished generation opens the "N ideas" view (TinyMeals-style); Back returns home.
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>("all");

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

  // The week strip's day sheet.
  const { openDay, showDay, closeDay } = useDaySheet(activeHousehold?.id, profile?.id);

  const { streak, freezes, today: usedToday, days: week, refresh: refreshStreak } = useStreak(activeHousehold?.id);

  // Tapping Recipes in the dock always lands on the home, out of the ideas view.
  const navigation = useNavigation<BottomTabNavigationProp<Record<string, undefined>>>();
  useEffect(() => navigation.addListener("tabPress", () => setIdeasOpen(false)), [navigation]);

  useFocusEffect(
    useCallback(() => {
      void refreshRecipes();
      void refreshStreak();
    }, [refreshRecipes, refreshStreak]),
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
    if (result && result.recipes.length > 0) setIdeasOpen(true);
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

  const hasSuggestions = suggestions.length > 0;
  // Tonight's picks: this session's fresh generation, or — after a restart —
  // today's last batch read back from the saved recipes (no new AI call).
  const restoredTonight = hasSuggestions ? [] : latestGeneratedBatch(savedRecipes, profile?.id);
  const hasTonight = hasSuggestions || restoredTonight.length > 0;
  const tonightSessionId = hasSuggestions ? currentSessionId : restoredTonight[0]?.session_id ?? null;
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
        steps: suggestions[0].steps as unknown,
        row: savedForMatch(suggestions[0]),
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
              steps: row.steps,
              row,
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
  // Today's goal line: what the next item used up does for you.
  const goalTitle =
    usedToday >= DAILY_GOAL
      ? t("recipes.week.goalDone")
      : usedToday > 0
        ? t("recipes.week.goalMore", { count: DAILY_GOAL - usedToday })
        : streak > 0
          ? t("recipes.week.goalKeep", { count: streak })
          : t("recipes.week.goalStart");
  const lastFrozen = [...week].reverse().find((day) => day.state === "frozen");
  // Foods worth using now (today or soon), by normalized name — they lead the
  // hero's chips and the list's "Uses: …" badges.
  const soonNames = new Set(
    inventoryGroups.filter((group) => group.urgency === "urgent" || group.urgency === "use_soon").map((group) => normalizeFoodName(group.name)),
  );
  const haveOf = (ingredients: unknown) =>
    parseRecipeIngredients(ingredients).filter((ing) => inventoryNames.has(normalizeFoodName(ing.name)));
  const soonOf = (ingredients: unknown) => haveOf(ingredients).filter((ing) => soonNames.has(normalizeFoodName(ing.name)));

  // Try next: tonight's dish, the foods you have for it (soon ones first) and why it fits.
  const dishHave = dish ? haveOf(dish.ingredients) : [];
  const dishSoon = dish ? soonOf(dish.ingredients) : [];
  const dishChips = [...dishSoon, ...dishHave.filter((ing) => !dishSoon.includes(ing))].slice(0, 4).map((ing) => ({
    label: capitalize(ing.name),
    tag: dishSoon.includes(ing) ? t("recipes.tryNext.soonTag") : undefined,
  }));
  const dishSteps = dish && Array.isArray(dish.steps) ? dish.steps.length : 0;
  const dishWhy = dish
    ? dishSoon.length > 0
      ? t("recipes.tryNext.whySoon", { foods: dishSoon.slice(0, 2).map((ing) => ing.name).join(" & ") })
      : dishCoverage && dishCoverage.total > 0
        ? t("recipes.tryNext.whyHave", { have: dishCoverage.have, total: dishCoverage.total })
        : undefined
    : undefined;

  // The list under it, TinyMeals' "More for you": every recipe you have, with chips.
  // Tonight's other ideas lead it, highlighted; the one in the card above stays out.
  const isTonight = (recipe: RecipeRow) => Boolean(tonightSessionId) && recipe.session_id === tonightSessionId;
  const seen = new Set<string>();
  const listRecipes = [...savedRecipes, ...cookedRecipes].filter((recipe) => {
    if (seen.has(recipe.id) || recipe.id === dish?.row?.id) return false;
    if (isTonight(recipe) && recipe.title === dish?.title) return false;
    seen.add(recipe.id);
    return true;
  });
  const cookedCount = (recipe: RecipeRow) => cookedSummaries[recipe.id]?.count ?? recipe.cooked_count ?? 0;
  const matchesFilter = (recipe: RecipeRow, filter: ListFilter) =>
    filter === "all"
      ? true
      : filter === "soon"
        ? soonOf(recipe.ingredients).length > 0
        : filter === "quick"
          ? (recipe.time_minutes ?? 99) <= 20
          : filter === "saved"
            ? recipe.is_favorite
            : cookedCount(recipe) > 0;
  const filters = LIST_FILTERS.filter((filter) => filter === "all" || listRecipes.some((recipe) => matchesFilter(recipe, filter)));
  const activeFilter = filters.includes(listFilter) ? listFilter : "all";
  const filteredList = listRecipes
    .filter((recipe) => matchesFilter(recipe, activeFilter))
    // Recipes using what's going off lead, then the ones you have most of.
    .map((recipe) => ({ recipe, soon: soonOf(recipe.ingredients), coverage: fridgeCoverage(recipe.ingredients, inventoryNames) }))
    .sort(
      (a, b) =>
        Number(isTonight(b.recipe)) - Number(isTonight(a.recipe)) ||
        b.soon.length - a.soon.length ||
        (b.coverage.total ? b.coverage.have / b.coverage.total : 0) - (a.coverage.total ? a.coverage.have / a.coverage.total : 0),
    );
  const badgeFor = ({ recipe, soon }: (typeof filteredList)[number]) =>
    isTonight(recipe)
      ? { label: t("recipes.list.tonight"), accent: true }
      : soon.length > 0
      ? { label: t("recipes.list.uses", { food: soon[0].name }), accent: true }
      : recipe.is_favorite
        ? { label: t("recipes.list.saved"), accent: false }
        : cookedCount(recipe) > 0
          ? { label: t("recipes.list.cooked", { count: cookedCount(recipe) }), accent: false }
          : (recipe.time_minutes ?? 99) <= 20
            ? { label: t("recipes.list.quick"), accent: false }
            : { label: t("recipes.list.recipe"), accent: false };

  // The "N ideas" view: this generation's picks (or today's, read back after a restart).
  const coveragePill = (ingredients: unknown) => {
    const coverage = fridgeCoverage(ingredients, inventoryNames);
    if (coverage.total === 0) return undefined;
    return coverage.have === coverage.total
      ? t("recipes.home.haveAll")
      : t("recipes.home.haveSome", { have: coverage.have, total: coverage.total });
  };
  const ideas = hasSuggestions
    ? suggestions.map((match) => ({
        key: match.key,
        title: match.title,
        meta: [formatTimeLabel(match.timeMinutes), formatComplexity(match.complexity)].join(" · "),
        description: match.description,
        pill: coveragePill(match.ingredients),
        onPress: () => navigateToDetail(match, savedForMatch(match)?.id),
      }))
    : restoredTonight.map((recipe) => ({
        key: recipe.id,
        title: recipe.title,
        meta: [formatTimeLabel(recipe.time_minutes ?? 20), formatComplexity(recipe.complexity ?? "simple")].join(" · "),
        description: recipe.description ?? undefined,
        pill: coveragePill(recipe.ingredients),
        onPress: () => openSavedRecipe(recipe),
      }));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Screen padded={false} bottomInset={false}>
      {ideasOpen && hasTonight ? (
        <IdeasResults
          title={t("recipes.ideas.title", { count: ideas.length })}
          subtitle={t("recipes.ideas.subtitle")}
          backLabel={t("recipes.ideas.back")}
          onBack={() => setIdeasOpen(false)}
          bestLabel={t("recipes.ideas.best")}
          viewLabel={t("recipes.ideas.view")}
          othersLabel={t("recipes.ideas.others")}
          ideas={ideas}
          moreLabel={t("recipes.ideas.more")}
          onMore={handleShowOthers}
        />
      ) : (
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* TinyMeals-style top: who, today's nudge, tonight's dish (the screen's
            job, kept above the fold), then the week. */}
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

        {/* Recipes are the home: tonight's dish as TinyMeals' "Try next" when
            there is one, the question when there isn't. */}
        <View style={styles.heroWrap}>
          {dish && dishCoverage ? (
            <>
              <TryNextCard
                eyebrow={hasTonight ? t("recipes.tryNext.tonight") : t("recipes.tryNext.fromYours")}
                title={dish.title}
                meta={[formatTimeLabel(dish.minutes), formatComplexity(dish.complexity)].join(" · ")}
                description={generateNotice ?? dish.description}
                ingredientsLabel={t("recipes.tryNext.youHave")}
                stepsLabel={dishSteps > 0 ? t("recipes.tryNext.steps", { count: dishSteps }) : undefined}
                ingredients={dishChips}
                why={dishWhy}
                favorite={dish.row?.is_favorite}
                favoriteLabel={t("recipes.list.favorite")}
                onFavorite={dish.row ? () => toggleFavorite(dish.row!.id, dish.row!.is_favorite) : undefined}
                onPress={dish.open}
                ctaLabel={t("recipes.home.cookThis")}
                // The cook prompt (meal, people, base…) sits beside Cook this so
                // both stay above the fold, even once tonight's ideas exist.
                secondaryLabel={t("recipes.home.moreIdeas")}
                onSecondary={openCookPrompt}
              />
              {hasTonight ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIdeasOpen(true)}
                  style={({ pressed }) => [styles.moreIdeas, pressed && styles.savedRowPressed]}
                >
                  <Text variant="small" muted>
                    {t("recipes.home.notFeelingIt")}{" "}
                    <Text variant="small" color={colors.primary} style={styles.metaStrong}>
                      {t("recipes.tryNext.seeIdeas")}
                    </Text>
                  </Text>
                </Pressable>
              ) : null}
            </>
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

        <View style={styles.weekWrap}>
          <WeekStrip
            days={week}
            goal={{ done: usedToday, total: DAILY_GOAL, eyebrow: t("recipes.week.goalEyebrow"), title: goalTitle }}
            streak={streak >= 2 ? t("recipes.week.streak", { count: streak }) : undefined}
            freezes={{ count: freezes, label: t("recipes.week.freezes", { count: freezes }) }}
            note={
              lastFrozen
                ? t("recipes.week.frozenNote", { day: lastFrozen.date.toLocaleDateString(undefined, { weekday: "long" }) })
                : undefined
            }
            lastLabel={t("recipes.week.lastCooked")}
            lastValue={lastCooked ? `${lastCooked.title} · ${lastCookedDay}` : t("recipes.week.nothingCooked")}
            onLastPress={lastCooked ? () => openSavedRecipe(lastCooked) : undefined}
            historyLabel={t("recipes.week.history")}
            onHistory={() => router.push({ pathname: "/(tabs)/all-recipes", params: { tab: "cooked" } })}
            onDayPress={showDay}
          />
        </View>

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

        {listRecipes.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.listHead}>
              <Text variant="micro" muted uppercase style={styles.eyebrow}>
                {t("recipes.list.title")}
              </Text>
              <Text variant="small" muted>
                {t("recipes.list.count", { count: filteredList.length })}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {filters.map((filter) => (
                <FilterChip
                  key={filter}
                  label={t(`recipes.list.filters.${filter}`)}
                  active={filter === activeFilter}
                  onPress={() => setListFilter(filter)}
                />
              ))}
            </ScrollView>
            <View style={styles.listCards}>
              {filteredList.slice(0, LIST_LIMIT).map((entry) => {
                const badge = badgeFor(entry);
                return (
                  <RecipeListCard
                    key={entry.recipe.id}
                    badge={badge.label}
                    badgeAccent={badge.accent}
                    highlight={isTonight(entry.recipe)}
                    title={entry.recipe.title}
                    meta={[
                      formatTimeLabel(entry.recipe.time_minutes ?? 20),
                      entry.coverage.total > 0 ? t("recipes.list.have", { have: entry.coverage.have, total: entry.coverage.total }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    favorite={entry.recipe.is_favorite}
                    favoriteLabel={t("recipes.list.favorite")}
                    onFavorite={() => toggleFavorite(entry.recipe.id, entry.recipe.is_favorite)}
                    onPress={() => openSavedRecipe(entry.recipe)}
                  />
                );
              })}
            </View>
            {filteredList.length > LIST_LIMIT ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(tabs)/all-recipes")}
                style={({ pressed }) => [styles.browseAll, styles.listMore, pressed && styles.savedRowPressed]}
              >
                <Text variant="label" color={colors.primary} style={styles.browseAllLabel}>
                  {t("recipes.shelves.browseAll")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      )}

      <DaySheet
        visible={openDay != null}
        onDismiss={closeDay}
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
          closeDay();
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
          eyebrow={t("recipes.generatingOverlay.eyebrow")}
          title={t("recipes.generatingOverlay.title")}
          listLabel={t("recipes.generatingOverlay.listLabel")}
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

const styles = StyleSheet.create({
  browseAll: {
    marginHorizontal: spacing.screenX,
    minHeight: 48,
    borderRadius: radii.lg,
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
  moreIdeas: {
    alignSelf: "center",
    paddingVertical: spacing.md,
  },
  listHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  filterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  listCards: {
    gap: spacing.sm,
  },
  listMore: {
    marginHorizontal: 0,
    marginTop: spacing.md,
  },
  savedRowPressed: {
    transform: [{ scale: 0.98 }],
  },
  eyebrow: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    letterSpacing: 0.66,
  },
  metaStrong: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
});
