import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useNavigation } from "expo-router";
import type { BottomTabNavigationProp } from "expo-router/js-tabs";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";

import { Button, CookFilters, CookPromptSheet, DaySheet, DinnerHero, FilterChip, FoodLoader, GeneratingOverlay, HouseholdPill, useOpenAddSheet, HouseholdSheet, IconButton, IdeasResults, Logo, PremiumSheet, RecipeListCard, ScanIcon, Screen, StreakMilestone, Tappable, Text, TryNextCard, UnfinishedScanCard, WeekStrip } from "@/components";
import { isPremium as resolvePremium, openRecipeDetail, openSavedRecipe, takeGenerateOnArrival, useAuth, useScanDraft } from "@/features";
import { useDaySheet, useHousehold, useInventory, useRecipes, useStreak, useStreakMilestone } from "@/hooks";
import { foodIconKey, formatMoney } from "@/lib";
import { CookingMode, RecipeRow } from "@/repositories/recipeRepository";
import {
  formatComplexity,
  formatTimeLabel,
  fridgeCoverage,
  latestGeneratedBatch,
  parseRecipeIngredients,
  RecipeMatch,
} from "@/services/recipeService";
import { availableBaseOptions, dailyGoal, daysLeft, InventoryCategory, normalizeFoodName, toUiCategory } from "@/services";
import { colors, radii, shadows, spacing } from "@/theme";

type ListFilter = "all" | "soon" | "quick" | "saved" | "cooked";
const LIST_FILTERS: ListFilter[] = ["all", "soon", "quick", "saved", "cooked"];
// Cards on the home before "Browse all recipes".
const LIST_LIMIT = 6;

function capitalize(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function RecipesRoute() {
  const { t } = useTranslation();
  const openAddSheet = useOpenAddSheet();
  const [autoGenerate, setAutoGenerate] = useState(false);
  const { profile, activeHousehold, refresh } = useAuth();
  const { lots: inventory, groups: inventoryGroups, loading: inventoryLoading } = useInventory(activeHousehold?.id);
  const { draft: scanDraft, discard: discardScanDraft } = useScanDraft(activeHousehold?.id);
  const baseOptions = useMemo(() => availableBaseOptions(inventory), [inventory]);
  const { members, combinedAvoidances } = useHousehold(activeHousehold?.id);
  const isPremium = resolvePremium(profile, activeHousehold);
  const userAvoidances = profile?.avoidances ?? [];
  const [showPremium, setShowPremium] = useState(false);
  const [householdOpen, setHouseholdOpen] = useState(false);
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
    error: recipeError,
  } = useRecipes(activeHousehold?.id, {
    inventory,
    avoidances: activeAvoidances,
    isPremium,
    freeGenerationUsed: Boolean(profile?.free_recipe_generation_used_at),
    servings,
    userId: profile?.id,
    // Server-side 402 (free generation spent) — authoritative over the local
    // canGenerate gate, which can lag behind the profile row.
    onQuotaExceeded: () => setShowPremium(true),
  });

  // The week strip's day sheet.
  const { openDay, showDay, closeDay } = useDaySheet(activeHousehold?.id, profile?.id);

  const { streak, today: usedToday, refresh: refreshStreak } = useStreak(activeHousehold?.id);
  // Streaks are premium (2026-11-13): free accounts see no streak anywhere,
  // though it is still tracked, so upgrading shows the real count.
  const { milestone, dismiss: dismissMilestone } = useStreakMilestone(activeHousehold?.id, isPremium ? streak : 0);

  // Free users can hide "Free generation used" for good (per account, this
  // device); upgrade is still offered when they try to generate. Null = not
  // read yet, kept hidden so it doesn't flash.
  const usedHiddenKey = `free-gen-used-hidden:${profile?.id}`;
  const [usedHidden, setUsedHidden] = useState<boolean | null>(null);
  useEffect(() => {
    if (!profile?.id) return;
    AsyncStorage.getItem(usedHiddenKey)
      .then((value) => setUsedHidden(value === "1"))
      .catch(() => setUsedHidden(false));
  }, [profile?.id, usedHiddenKey]);
  const hideUsedBanner = () => {
    setUsedHidden(true);
    AsyncStorage.setItem(usedHiddenKey, "1").catch(() => {});
  };

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
  // an idle list. The request is in memory (takeGenerateOnArrival), never a
  // route param, so a deep link can't start a paid generation. Gating lives in
  // handleGenerate (free users hit the premium sheet).
  useFocusEffect(
    useCallback(() => {
      if (takeGenerateOnArrival()) setAutoGenerate(true);
    }, []),
  );
  useEffect(() => {
    if (!autoGenerate) return;
    // Wait for inventory to finish loading; firing on the initial empty [] would
    // generate against an empty fridge and always surface noneFound.
    if (inventoryLoading) return;
    // Deferred by a tick: this is an action fired by navigation, not state
    // synchronisation, and running it inside the effect body would cascade
    // renders through handleGenerate's setState calls. Cleared in the same
    // tick, so it fires once.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setAutoGenerate(false);
      void handleGenerate(undefined);
    });
    return () => {
      cancelled = true;
    };
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
        coverPath: saved?.cover_path ?? null,
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
  const urgentRanked = inventoryGroups
    .filter((group) => group.urgency === "urgent")
    // Whole days: 0 = today, 1 = tomorrow (daysLeft is fractional).
    .map((group) => ({ group, left: Math.floor(Math.min(...group.lots.map((lot) => daysLeft(lot)))) }))
    .sort((a, b) => a.left - b.left);
  const urgentGroups = urgentRanked.map(({ group }) => group);
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
  // Today's goal is set by the fridge: rescue what is actually going off.
  // With nothing at risk it falls back to the one item that keeps the streak.
  const goalTotal = dailyGoal(urgentGroups.length);
  const goalTitle =
    usedToday >= goalTotal
      ? t("recipes.week.goalDoneShort")
      : urgentGroups.length > 0
        ? t(usedToday > 0 ? "recipes.week.goalRescueMore" : "recipes.week.goalRescue", { count: goalTotal - usedToday })
        : usedToday > 0
          ? t("recipes.week.goalMore", { count: goalTotal - usedToday })
          : !isPremium
            ? t("recipes.week.goalOne")
            : streak > 0
              ? t("recipes.week.goalKeep", { count: streak })
              : t("recipes.week.goalStart");
  // Premium names the food that goes off first (the eat-first list is
  // premium on Kitchen too); free keeps the nudge above.
  const firstFood = isPremium && usedToday < goalTotal ? urgentRanked[0] : undefined;
  // Only what's true: past its date (in the grace window) says check, not
  // "goes off today" for three days running. Capitalised: foods are stored lowercase.
  const goalHeadline = firstFood
    ? capitalize(
        t(
          firstFood.left < 0
            ? "recipes.week.goalFoodPast"
            : firstFood.left === 0
              ? "recipes.week.goalFoodToday"
              : firstFood.left === 1
                ? "recipes.week.goalFoodTomorrow"
                : "recipes.week.goalFoodFirst",
          { name: firstFood.group.name },
        ),
      )
    : goalTitle;
  // The detail ties the goal to the streak: one item keeps it, whatever T is.
  // With nothing at risk the headline already says so.
  const streakNote = !isPremium
    ? null
    : usedToday > 0
      ? t("recipes.week.goalStreakKept")
      : urgentGroups.length > 0
        ? t(streak > 0 ? "recipes.week.goalStreakKeeps" : "recipes.week.goalStreakStarts")
        : null;
  const goalDetail = [
    t("recipes.week.goalProgress", { done: Math.min(usedToday, goalTotal), total: goalTotal }),
    streakNote,
  ]
    .filter(Boolean)
    .join(" · ");
  // Foods worth using now (today or soon), by normalized name — they lead the
  // hero's chips and the list's "Uses: …" badges.
  const soonNames = new Set(
    inventoryGroups.filter((group) => group.urgency === "urgent" || group.urgency === "use_soon").map((group) => normalizeFoodName(group.name)),
  );
  const haveOf = (ingredients: unknown) =>
    parseRecipeIngredients(ingredients).filter((ing) => inventoryNames.has(normalizeFoodName(ing.name)));
  const soonOf = (ingredients: unknown) => haveOf(ingredients).filter((ing) => soonNames.has(normalizeFoodName(ing.name)));

  // Try next: a dish's foods you have (soon ones first) and why it fits. The
  // home's hero and the ideas view's best match both use it.
  const heroBits = (ingredients: unknown) => {
    const have = haveOf(ingredients);
    const soon = soonOf(ingredients);
    const coverage = fridgeCoverage(ingredients, inventoryNames);
    return {
      chips: [...soon, ...have.filter((ing) => !soon.includes(ing))].slice(0, 4).map((ing) => ({
        label: capitalize(ing.name),
        tag: soon.includes(ing) ? t("recipes.tryNext.soonTag") : undefined,
      })),
      why:
        soon.length > 0
          ? t("recipes.tryNext.whySoon", { foods: soon.slice(0, 2).map((ing) => ing.name).join(" & ") })
          : coverage.total > 0
            ? t("recipes.tryNext.whyHave", { have: coverage.have, total: coverage.total })
            : undefined,
    };
  };
  const dishBits = dish ? heroBits(dish.ingredients) : null;
  const dishChips = dishBits?.chips ?? [];
  const dishSteps = dish && Array.isArray(dish.steps) ? dish.steps.length : 0;
  const dishWhy = dishBits?.why;

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
  // Same meta line as the home's list: time, then how much you have.
  const listMetaFor = (minutes: number, ingredients: unknown) => {
    const coverage = fridgeCoverage(ingredients, inventoryNames);
    return [
      formatTimeLabel(minutes),
      coverage.total > 0 ? t("recipes.list.have", { have: coverage.have, total: coverage.total }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const ideas = hasSuggestions
    ? suggestions.map((match) => ({
        key: match.key,
        title: match.title,
        time: formatTimeLabel(match.timeMinutes),
        complexity: formatComplexity(match.complexity),
        description: match.description,
        ...heroBits(match.ingredients),
        listMeta: listMetaFor(match.timeMinutes, match.ingredients),
        coverPath: savedForMatch(match)?.cover_path,
        onPress: () => navigateToDetail(match, savedForMatch(match)?.id),
      }))
    : restoredTonight.map((recipe) => ({
        key: recipe.id,
        title: recipe.title,
        time: formatTimeLabel(recipe.time_minutes ?? 20),
        complexity: formatComplexity(recipe.complexity ?? "simple"),
        description: recipe.description ?? undefined,
        ...heroBits(recipe.ingredients),
        listMeta: listMetaFor(recipe.time_minutes ?? 20, recipe.ingredients),
        coverPath: recipe.cover_path,
        onPress: () => openSavedRecipe(recipe),
      }));

  // The loader's plate: kitchen foods with an illustrated icon, soonest to go off first.
  const loaderFoods = [...new Set([...urgentGroups, ...inventoryGroups].map((group) => group.name))]
    .filter((name) => foodIconKey(name))
    .slice(0, 8);

  // Logo left, household pill right; the generating overlay shows it too.
  const topBar = (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Logo size={26} />
      </View>
      {activeHousehold ? (
        <HouseholdPill
          name={activeHousehold.name}
          initial={firstName || activeHousehold.name}
          label={t("settings.household.openSheet", { name: activeHousehold.name })}
          onPress={() => setHouseholdOpen(true)}
        />
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <FoodLoader />
      </View>
    );
  }

  return (
    <Screen padded={false} bottomInset={false} contentContainerStyle={styles.screen}>
      {ideasOpen && hasTonight ? (
        <IdeasResults
          header={topBar}
          title={t("recipes.ideas.title", { count: ideas.length })}
          subtitle={t("recipes.ideas.subtitle")}
          backLabel={t("recipes.ideas.back")}
          onBack={() => setIdeasOpen(false)}
          bestLabel={t("recipes.ideas.best")}
          viewLabel={t("recipes.ideas.view")}
          ingredientsLabel={t("recipes.tryNext.youHave")}
          othersLabel={t("recipes.ideas.others")}
          otherBadge={t("recipes.list.tonight")}
          favoriteLabel={t("recipes.list.favorite")}
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
        {/* TinyMeals-style top: who, today's nudge, the week, tonight's dish. */}
        {topBar}

        {scanDraft ? (
          <UnfinishedScanCard
            count={scanDraft.items.length}
            onReview={() => router.navigate({ pathname: "/(tabs)/scan", params: { mode: "resume" } })}
            onDiscard={discardScanDraft}
            style={styles.unfinishedScan}
          />
        ) : null}

        {!isPremium && (canGenerate || usedHidden === false) ? (
          <View style={[styles.limitBanner, !canGenerate && styles.limitWarning]}>
            <View style={styles.limitMessage}>
              {!canGenerate ? (
                <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
                  <Path d="M12 3 22 21H2L12 3Z" fill="none" stroke={colors.onPrimary} strokeWidth={1.8} strokeLinejoin="round" />
                  <Path d="M12 9v5m0 3v.1" stroke={colors.onPrimary} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              ) : null}
              <View style={styles.limitCopy}>
                <Text variant="title" color={canGenerate ? colors.text : colors.onPrimary}>
                  {t(canGenerate ? "recipes.freeGenerationLeft" : "recipes.freeGenerationUsed")}
                </Text>
                <Text variant="small" color={canGenerate ? colors.muted : colors.onPrimary} style={styles.limitSub}>
                  {t(canGenerate ? "recipes.freePlan" : "recipes.freeGenerationUsedBody")}
                </Text>
              </View>
              {!canGenerate ? (
                <IconButton label={t("recipes.freeGenerationHide")} transparent size={32} onPress={hideUsedBanner} style={styles.limitClose}>
                  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                    <Path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke={colors.onPrimary} strokeWidth={1.8} strokeLinecap="round" />
                  </Svg>
                </IconButton>
              ) : null}
            </View>
            {/* Out of free generations is the home's one real warning: solid
                tomato with a pale butter button (buttons on red use accentSoft). */}
            <Button
              title={t("recipes.upgrade")}
              variant={canGenerate ? "primary" : "accent"}
              onPress={() => setShowPremium(true)}
              style={!canGenerate && styles.onRedButton}
            />
          </View>
        ) : null}

        <View style={styles.weekWrap}>
          <WeekStrip
            goal={{ done: usedToday, total: goalTotal }}
            headline={goalHeadline}
            detail={goalDetail}
            streak={isPremium ? { count: streak, label: t("recipes.week.streak", { count: streak }) } : undefined}
            onPress={() => showDay(new Date())}
            soft={!isPremium}
          />
        </View>

        {/* Recipes are the home: tonight's dish as TinyMeals' "Try next" when
            there is one, the question when there isn't. */}
        <View style={styles.heroWrap}>
          {dish && dishCoverage ? (
            <>
              <TryNextCard
                coverPath={dish.row?.cover_path}
                eyebrow={hasTonight ? t("recipes.tryNext.tonight") : t("recipes.tryNext.fromYours")}
                title={dish.title}
                time={formatTimeLabel(dish.minutes)}
                complexity={formatComplexity(dish.complexity)}
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
                <Tappable
                  onPress={() => setIdeasOpen(true)}
                  style={[styles.moreIdeas]}
                >
                  <Text variant="small" muted>
                    {t("recipes.home.notFeelingIt")}{" "}
                    <Text variant="small" color={colors.primary} weight="bold">
                      {t("recipes.tryNext.seeIdeas")}
                    </Text>
                  </Text>
                </Tappable>
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
              ctaIcon={fridgeEmpty ? <ScanIcon color={colors.onPrimary} size={20} /> : undefined}
              loading={generating}
              onPress={fridgeEmpty ? openAddSheet : openCookPrompt}
            />
          )}
        </View>

        {recipeError ? (
          <View style={styles.errorBanner}>
            <Text variant="small" color={colors.redInk} weight="bold" accessibilityLiveRegion="polite">
              {recipeError}
            </Text>
          </View>
        ) : null}

        {listRecipes.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.listHead}>
              <Text variant="h3">
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
                    coverPath={entry.recipe.cover_path}
                    favorite={entry.recipe.is_favorite}
                    favoriteLabel={t("recipes.list.favorite")}
                    onFavorite={() => toggleFavorite(entry.recipe.id, entry.recipe.is_favorite)}
                    onPress={() => openSavedRecipe(entry.recipe)}
                  />
                );
              })}
            </View>
            {/* Always there once you have recipes (2026-11-12: it hid until 7+). */}
            <Tappable
              onPress={() => router.push("/(tabs)/all-recipes")}
              style={[styles.browseAll, styles.listMore]}
            >
              <Text variant="label" color={colors.primary}>
                {t("recipes.shelves.browseAll")}
              </Text>
            </Tappable>
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
        soon={
          isPremium
            ? urgentRanked.map(({ group, left }) => ({
                id: group.key,
                name: group.name,
                category: toUiCategory(group.category),
                today: left <= 0,
                when: left <= 0 ? t("fridge.bestBy.today") : left === 1 ? t("fridge.bestBy.tomorrow") : t("fridge.bestBy.inDays", { count: left }),
              }))
            : undefined
        }
        labels={{ cooked: t("recipes.week.dayCooked"), used: t("recipes.week.dayUsed"), empty: t("recipes.week.dayEmpty"), soon: t("recipes.week.daySoon") }}
        onOpenSoon={(key) => {
          closeDay();
          router.push({ pathname: "/(tabs)/fridge", params: { item: key } });
        }}
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
            side: t("recipes.cookPrompt.mealOptions.side"),
          },
          mealSubtitles: {
            breakfast: t("recipes.cookPrompt.mealSubtitles.breakfast"),
            lunch: t("recipes.cookPrompt.mealSubtitles.lunch"),
            dinner: t("recipes.cookPrompt.mealSubtitles.dinner"),
            snack: t("recipes.cookPrompt.mealSubtitles.snack"),
            side: t("recipes.cookPrompt.mealSubtitles.side"),
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
          feedsAbout: (count, servings) => t("recipes.cookPrompt.feedsAbout", { count, servings }),
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
        inventory={inventory}
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
          header={topBar}
          foods={loaderFoods}
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
      <HouseholdSheet
        visible={householdOpen}
        onClose={() => setHouseholdOpen(false)}
        itemCount={inventory.length}
      />
      {/* Waits for the screen to be clear: iOS won't stack two Modals. */}
      <StreakMilestone
        visible={milestone != null && openDay == null && !showPremium && !householdOpen && !showCookPrompt}
        onDismiss={dismissMilestone}
        days={milestone ?? 0}
        title={t("recipes.milestone.title", { count: milestone ?? 0 })}
        body={t(`recipes.milestone.body${milestone ?? 3}` as "recipes.milestone.body3")}
        freezeNote={milestone != null && milestone % 7 === 0 ? t("recipes.milestone.freeze") : undefined}
        doneLabel={t("recipes.milestone.done")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The dock sits right under the screen: no bottom padding, or the list
  // stops short of it.
  screen: {
    paddingBottom: 0,
  },
  browseAll: {
    marginHorizontal: spacing.screenX,
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
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
  unfinishedScan: {
    marginHorizontal: spacing.screenX,
    marginBottom: spacing.md,
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
  limitBanner: {
    marginHorizontal: spacing.screenX,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface2,
    borderRadius: radii.xl,
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
  limitWarning: {
    backgroundColor: colors.primary,
  },
  onRedButton: {
    backgroundColor: colors.accentSoft,
  },
  limitMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  limitCopy: {
    flex: 1,
  },
  limitSub: {
    marginTop: spacing.xxs,
  },
  // Pulls the X into the banner's corner padding, level with the title.
  limitClose: {
    marginTop: -spacing.xs,
    marginRight: -spacing.sm,
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
});
