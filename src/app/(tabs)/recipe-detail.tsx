import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import { Image } from "expo-image";

import { BottomSheet, Button, CookReward, FoodGlyph, IngredientIcons, ShareCardExport, Tappable, Text, TextField, useToast } from "@/components";
import type { ShareCardProps, ShareFormat } from "@/components";
import { isPremium, useAuth } from "@/features";
import { deviceTimeZone, notifyInventoryChanged, useInventory, useShareImage } from "@/hooks";
import { asCountedPack, foodIconKey, formatMoney, newClientId } from "@/lib";
import { addAmounts, canonicalFoodName, isLiquidAmount, dailyGoal, expandRecipe, expandRecipeShared, formatComplexity, formatTimeLabel, ingredientUse, InventoryGroup, isPantryStaple, recipeCoverUrl, requestRecipeCover, resolveUrgency, sharedExpand } from "@/services";
import { getCookSavings, syncStreak } from "@/repositories/insightsRepository";
import { addInventoryItem, recordCookedEventAndDepleteInventory } from "@/repositories/inventoryRepository";
import { reportRecipe, toggleRecipeFavorite, updateRecipeDetail } from "@/repositories/recipeRepository";
import { colors, radii, spacing } from "@/theme";

// The cover band, and how far the content sheet rides up over it.
const HERO_HEIGHT = 260;
const SHEET_OVERLAP = 28;
const SHEET_TOP = HERO_HEIGHT - SHEET_OVERLAP;

type IngredientItem = {
  name: string;
  amount: string;
  required: boolean;
  countable: boolean;
  /** Household item's canonical name; `name` may be translated. */
  matchKey?: string | null;
};

// Inventory key for an ingredient. Names are localized (e.g. "paradajz"), so
// the untranslated matchKey wins; older recipes without one fall back to name.
const ingredientKey = (ing: { name: string; matchKey?: string | null }) =>
  ing.matchKey ?? canonicalFoodName(ing.name);

export default function RecipeDetailRoute() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    title: string;
    description: string;
    timeMinutes: string;
    complexity: string;
    servings: string;
    ingredients: string;
    steps: string;
    recipeId: string;
    isFavorite: string;
    cookedCount: string;
    coverPath?: string;
    returnTo?: string;
  }>();

  const { profile, activeHousehold } = useAuth();
  const { showToast } = useToast();
  const { groups: inventoryGroups, lots, loading: inventoryLoading } = useInventory(activeHousehold?.id);
  // Recipe id still waiting for its phase-2 expand (set by the seeding effect,
  // consumed once inventory has loaded).
  const pendingExpandRef = useRef<string | null>(null);
  // Declared with the other refs (not at its first use further down): the
  // re-seed effect below writes it, and a ref must be created before any
  // effect that touches it.
  const cookIdRef = useRef<string | null>(null);

  const title = params.title ?? "";
  const description = params.description ?? "";
  const servings = Number(params.servings ?? 2);
  const recipeId = params.recipeId ?? "";
  const cookedCount = Number(params.cookedCount ?? 0);
  const hasCooked = cookedCount > 0;

  // The cover photo: from the list when it had one, else asked for here (which
  // also gives older recipes a cover the first time they're opened). Keyed by
  // recipe, since this tab screen stays mounted between recipes.
  const [fetchedCover, setFetchedCover] = useState<{ id: string; path: string } | null>(null);
  const coverUri = recipeCoverUrl(params.coverPath || (fetchedCover?.id === recipeId ? fetchedCover.path : null));
  useEffect(() => {
    if (params.coverPath || !recipeId) return;
    let live = true;
    void requestRecipeCover(recipeId).then((path) => {
      if (live && path) setFetchedCover({ id: recipeId, path });
    });
    return () => {
      live = false;
    };
  }, [recipeId, params.coverPath]);

  // Two-phase: a card arrives with ingredients (used fridge items) but no steps.
  // We expand it on open into full ingredients + steps, then persist so the next
  // open reads straight from the DB. Detail fields live in state so the expand
  // result can replace the card placeholders in place.
  const initialIngredients: IngredientItem[] = params.ingredients
    ? JSON.parse(params.ingredients)
    : [];
  const initialSteps: string[] = params.steps ? JSON.parse(params.steps) : [];
  const [detail, setDetail] = useState<{
    ingredients: IngredientItem[];
    steps: string[];
    timeMinutes: number;
    complexity: string;
  }>({
    ingredients: initialIngredients,
    steps: initialSteps,
    timeMinutes: Number(params.timeMinutes ?? 20),
    complexity: params.complexity ?? "simple",
  });
  const [expanding, setExpanding] = useState(false);
  // Expand returned nothing (offline, server error): offer a retry (C6).
  const [expandFailed, setExpandFailed] = useState(false);
  const [expandAttempt, setExpandAttempt] = useState(0);

  const ingredients = detail.ingredients;
  const steps = detail.steps;
  // The header's icons come from the ingredients the recipe opened with (a
  // card's are the kitchen items it uses), so they don't reshuffle when the
  // full list arrives with the steps.
  const heroNames = (params.ingredients ? (JSON.parse(params.ingredients) as IngredientItem[]) : [])
    .filter((ing) => ing.required)
    .map((ing) => ing.name);
  const timeMinutes = detail.timeMinutes;
  const complexity = detail.complexity;

  useEffect(() => {
    // Expo Router reuses this screen instance across recipes (same route, new
    // params), so useState initializers are stale on re-navigation. Re-seed the
    // detail from the current params keyed to recipeId — otherwise the previous
    // recipe's ingredients/steps render under the new title.
    const baseIngredients: IngredientItem[] = params.ingredients
      ? JSON.parse(params.ingredients)
      : [];
    const baseSteps: string[] = params.steps ? JSON.parse(params.steps) : [];
    const baseTime = Number(params.timeMinutes ?? 20);
    // Syncing this screen to new route params is exactly what the rule warns
    // about, but the screen instance is reused across recipes, so there is no
    // mount to re-seed from.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail({
      ingredients: baseIngredients,
      steps: baseSteps,
      timeMinutes: baseTime,
      complexity: params.complexity ?? "simple",
    });
    // Already expanded (or opened from a persisted, expanded row): nothing to do.
    setExpandFailed(false);
    // A new recipe is a new cook: never reuse a pending id from a failed cook
    // of the previous recipe on this reused screen.
    cookIdRef.current = null;
    pendingExpandRef.current =
      baseSteps.length > 0 || baseIngredients.length === 0 ? null : recipeId;
    // Re-seed only when the recipe changes; params are read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  // Expand once inventory has loaded: on a cold open `lots` starts empty, and
  // an empty inventory makes the server null every matchKey (C17). Expired
  // lots are left out — cooking skips them anyway. A fresh idea usually has
  // its request already running (the prefetch after generating): join that
  // one straight away instead of waiting for inventory and asking again.
  useEffect(() => {
    if (pendingExpandRef.current !== recipeId) return;
    const joined = recipeId ? sharedExpand(recipeId) : null;
    if (inventoryLoading && !joined) return;
    pendingExpandRef.current = null;
    const baseIngredients: IngredientItem[] = params.ingredients
      ? JSON.parse(params.ingredients)
      : [];
    const baseTime = Number(params.timeMinutes ?? 20);
    let cancelled = false;
    let finished = false;
    (async () => {
      setExpanding(true);
      setExpandFailed(false);
      const input = {
        title,
        description,
        timeMinutes: baseTime,
        usedIngredientNames: baseIngredients.map((ing) => ing.name),
        inventory: lots.filter((lot) => resolveUrgency(lot) !== "expired"),
        avoidances: profile?.avoidances ?? [],
        servings,
      };
      const result = await (joined ?? (recipeId ? expandRecipeShared(recipeId, input) : expandRecipe(input)));
      if (cancelled) return;
      if (!result) setExpandFailed(true);
      if (result) {
        setDetail({
          ingredients: result.ingredients,
          steps: result.steps,
          timeMinutes: result.timeMinutes,
          complexity: result.complexity,
        });
        if (recipeId) {
          updateRecipeDetail(recipeId, {
            ingredients: result.ingredients,
            steps: result.steps,
            timeMinutes: result.timeMinutes,
            complexity: result.complexity,
            avoidanceTags: result.avoidanceTags,
          }).catch(() => {
            // Non-critical: detail still renders from state this session.
          });
        }
      }
      finished = true;
      setExpanding(false);
    })();
    return () => {
      cancelled = true;
      // An inventory reload (or recipe change) mid-expand cancels this run:
      // re-arm it so the next effect run expands again instead of leaving
      // the skeleton up forever. A new recipe's seed effect overwrites this.
      if (!finished) {
        pendingExpandRef.current = recipeId;
        setExpanding(false);
      }
    };
    // Expand once per opened recipe; lots/profile are read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, inventoryLoading, expandAttempt]);

  function retryExpand() {
    pendingExpandRef.current = recipeId;
    setExpandAttempt((n) => n + 1);
  }

  // Urgent ingredients are derived from LIVE inventory, not a generation-time
  // snapshot — the urgency band can change as items age (CODE_REVIEW #14/#2).
  const urgentFridgeNames = new Set(
    inventoryGroups
      .filter((group) => group.urgency === "urgent" || group.urgency === "use_soon")
      .map((group) => group.normalizedName),
  );
  const matchedUrgentItems = ingredients
    .filter((ing) => urgentFridgeNames.has(ingredientKey(ing)))
    .map((ing) => ing.name);

  const [showCooked, setShowCooked] = useState(false);
  const [cookedItems, setCookedItems] = useState<{
    name: string;
    amount: string;
    quantityToUse: number;
    unit: string;
    used: boolean;
    inFridge: boolean;
    matchKey?: string | null;
    /** Fridge item used instead of the recipe ingredient (normalized + display). */
    swapNormalized: string | null;
    swapDisplay: string | null;
    /** Extra fridge item the cook added beyond the recipe's ingredients. */
    extra?: boolean;
  }[]>([]);
  // Row currently picking a substitute, or "add" when appending an extra item.
  const [swapIndex, setSwapIndex] = useState<number | "add" | null>(null);
  // Extra-item flow, step 2: chosen fridge item awaiting an amount.
  const [extraTarget, setExtraTarget] = useState<InventoryGroup | null>(null);
  const [extraAmount, setExtraAmount] = useState("1");
  const [extraUnit, setExtraUnit] = useState("item");
  const [cooking, setCooking] = useState(false);
  // One export per shape, both drawn off screen, so the picked one is ready
  // to capture the moment Post or Story is chosen.
  const rewardPost = useShareImage();
  const rewardStory = useShareImage();
  // The after-cook reward: what this cook used up, plus the figures it
  // moved (null when they couldn't be loaded).
  const [reward, setReward] = useState<{
    items: string[];
    streak: { streak: number; today: number } | null;
    savings: { cook: number; total: number } | null;
  } | null>(null);
  const [favorite, setFavorite] = useState(params.isFavorite === "true");
  // Fold the ingredients away to bring the steps up while cooking.
  const [ingredientsOpen, setIngredientsOpen] = useState(true);


  const complexityLabel = formatComplexity(complexity);
  const liveFridgeNames = new Set(inventoryGroups.map((group) => group.normalizedName));
  // An ingredient is "owned" if the model took it from the fridge (required=true)
  // or its name still matches a live fridge item. Receipt-sourced inventory has
  // messy names (e.g. "Krastavac domaci"), so name-matching alone misses items
  // the recipe genuinely used — `required` is the reliable signal.
  const isOwned = (ing: IngredientItem) =>
    ing.required ||
    isPantryStaple(ing.name) ||
    liveFridgeNames.has(ingredientKey(ing));
  const fridgeCount = ingredients.filter(isOwned).length;
  // How much of an ingredient the kitchen holds, e.g. "500 g" or
  // "2 pcs + 300 g" (groups in different units are never summed).
  const haveLabel = (ing: IngredientItem) => {
    const matches = inventoryGroups.filter((group) => group.normalizedName === ingredientKey(ing));
    if (matches.length === 0) return null;
    // Liquids carry no amount (2026-11-06): the green dot says you have oil,
    // and that is the whole story — no "1 item, some used".
    if (isLiquidAmount(ing.amount)) return null;
    return matches
      .map((group) => (group.partialState === "full" ? group.amountLabel : `${group.amountLabel} (${group.partialLabel.toLowerCase()})`))
      .join(" + ");
  };

  function handleCookPress() {
    // Pre-tick every ingredient currently in the fridge (live by name),
    // not just the ones matched when the recipe was generated.
    const items = ingredients.map((ing) => {
      const inFridge = isOwned(ing);
      // Parsed from the amount text, not the stored `countable` flag: older
      // recipes flagged "250 grama" / "2 šolje" countable (FIXES B10).
      const use = ingredientUse(ing.amount);
      return {
        name: ing.name,
        amount: ing.amount,
        quantityToUse: use.quantity,
        unit: use.unit,
        used: inFridge,
        inFridge,
        matchKey: ing.matchKey ?? null,
        swapNormalized: null,
        swapDisplay: null,
      };
    });
    setCookedItems(items);
    setSwapIndex(null);
    setExtraTarget(null);
    setShowCooked(true);
  }

  function applySwap(index: number, group: { normalizedName: string; name: string }) {
    setCookedItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              used: true,
              swapNormalized: group.normalizedName,
              swapDisplay: group.name,
            }
          : item,
      ),
    );
    setSwapIndex(null);
  }

  function startExtraAmount(group: InventoryGroup) {
    setExtraTarget(group);
    setExtraAmount("1");
    setExtraUnit(group.unit);
  }

  function confirmExtra() {
    if (!extraTarget) return;
    const quantity = Number(extraAmount.replace(",", "."));
    if (!(quantity > 0)) return;

    setCookedItems((prev) => [
      ...prev,
      {
        name: extraTarget.name,
        amount: `${quantity} ${extraUnit}`,
        quantityToUse: quantity,
        unit: extraUnit,
        used: true,
        inFridge: true,
        swapNormalized: extraTarget.normalizedName,
        swapDisplay: null,
        extra: true,
      },
    ]);
    setExtraTarget(null);
    setSwapIndex(null);
  }

  // "I have this": the ingredient exists at home but was never logged. Log it
  // to the fridge now so this cook (and future matching) can use it.
  async function confirmHaveItem(index: number) {
    if (!activeHousehold?.id) return;
    const item = cookedItems[index];
    if (!item) return;
    try {
      await addInventoryItem({
        householdId: activeHousehold.id,
        name: item.name,
        source: "manual",
      });
      notifyInventoryChanged();
      setCookedItems((prev) =>
        prev.map((it, i) => (i === index ? { ...it, inFridge: true, used: true } : it)),
      );
    } catch (error) {
      Alert.alert(
        t("common.error"),
        error instanceof Error ? error.message : t("common.fridgeUpdateError"),
      );
    }
  }

  function confirmReport() {
    Alert.alert(t("recipes.detail.reportTitle"), t("recipes.detail.reportBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("recipes.detail.reportConfirm"),
        style: "destructive",
        onPress: () => {
          if (!activeHousehold?.id) return;
          void reportRecipe({ recipeId, householdId: activeHousehold.id })
            .then(() => showToast(t("recipes.detail.reportDone")))
            .catch(() => showToast(t("common.error")));
        },
      },
    ]);
  }

  function toggleCookedItem(index: number) {
    setCookedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, used: !item.used } : item)),
    );
  }

  async function confirmCooked() {
    if (!activeHousehold?.id) return;
    setCooking(true);
    // One id per cook, kept across retries (timeout, re-confirm, sheet
    // reopened) until a cook succeeds, so the server never depletes twice.
    cookIdRef.current ??= newClientId();
    const cookId = cookIdRef.current;
    try {
      // Deplete by item name against current inventory (spilling across lots,
      // soonest-expiry first) instead of stale snapshot lot ids. Sum duplicate
      // ingredients so each item is depleted by its total amount once.
      const byName = new Map<string, { amount: number; unit: string }>();
      const shownNames = new Map<string, string>();
      for (const item of cookedItems) {
        if (!item.used) continue;
        // A swapped row depletes the chosen fridge item instead of the
        // recipe's original ingredient.
        const key = item.swapNormalized ?? ingredientKey(item);
        const existing = byName.get(key);
        const amount = { amount: item.quantityToUse, unit: item.unit };
        byName.set(key, existing ? addAmounts(existing, amount) : amount);
        if (!shownNames.has(key)) shownNames.set(key, item.swapDisplay ?? item.name);
      }
      const usedItems = [...byName.entries()].map(([normalizedName, v]) => ({
        normalizedName,
        amount: v.amount,
        unit: v.unit,
      }));
      // Time-box the save: a hung network call (no rejection) would otherwise
      // leave the CTA spinning forever with no feedback.
      await Promise.race([
        recordCookedEventAndDepleteInventory({
          householdId: activeHousehold.id,
          recipeId: recipeId || null,
          servings,
          usedItems,
          cookId,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(t("common.fridgeUpdateError"))), 20000),
        ),
      ]);
      cookIdRef.current = null;
      notifyInventoryChanged();
      if (usedItems.length === 0) {
        setShowCooked(false);
        router.replace("/(tabs)/fridge");
        return;
      }
      // The sheet stays open (its button still spinning) and the reward is
      // drawn over it, inside the sheet's own Modal (see BottomSheet
      // `overlay`): iOS drops a second Modal opened over a closing one.
      // The cook already landed; these only feed the reward, so a failure or
      // a slow answer (4s) just hides that figure.
      const settle = <T,>(promise: Promise<T>) =>
        Promise.race([promise.catch(() => null), new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))]);
      const [streakState, savings] = await Promise.all([
        settle(syncStreak(activeHousehold.id, deviceTimeZone())),
        isPremium(profile, activeHousehold) && profile?.id
          ? settle(getCookSavings(activeHousehold.id, cookId, profile.id))
          : null,
      ]);
      setReward({
        items: [...shownNames.values()],
        streak: streakState ? { streak: streakState.streak, today: streakState.today } : null,
        savings: savings && savings.total > 0 ? savings : null,
      });
    } catch (error) {
      Alert.alert(
        t("common.error"),
        error instanceof Error ? error.message : t("common.fridgeUpdateError"),
      );
      setCooking(false);
    }
  }

  function finishReward() {
    setReward(null);
    setShowCooked(false);
    setCooking(false);
    router.replace("/(tabs)/fridge");
  }

  // The receipt the reward shares, the same in both shapes.
  const rewardCard = (done: NonNullable<typeof reward>): ShareCardProps => ({
    kind: "items",
    kicker: t("recipes.reward.receiptKicker"),
    title,
    items: done.items.map((name) => ({ name })),
    more: (count) => t("insights.share.receipt.more", { count }),
    totals: done.streak ? [{ label: t("insights.share.receipt.streak"), value: String(done.streak.streak) }] : [],
    hero: rewardMoney
      ? { label: rewardMoney.label, value: formatMoney(rewardMoney.value, rewardMoney.currency) }
      : { label: t("insights.share.receipt.rescued"), value: String(done.items.length) },
    footnote: t("insights.share.receipt.footnote"),
  });

  // Awaited by the reward's Share button (its spinner); a failure says so
  // instead of looking like a dead button.
  async function shareReward(format: ShareFormat) {
    if (!reward) return;
    try {
      const image = format === "story" ? rewardStory : rewardPost;
      await image.share(t("recipes.reward.shareMessage", { count: reward.items.length, title }), format);
    } catch (error) {
      if (__DEV__) console.warn("[share] reward share failed", error);
      // An alert, not a toast: the toast host sits under this sheet's Modal.
      Alert.alert(t("common.error"));
    }
  }

  // This dinner's saving leads; the all-time total sits under it. A cook of
  // unpriced food still shows the total.
  const currency = activeHousehold?.currency_code ?? "USD";
  const rewardMoney = reward?.savings
    ? reward.savings.cook > 0
      ? {
          value: reward.savings.cook,
          currency,
          label: t("recipes.reward.savedCook"),
          note: t("recipes.reward.savedTotal", { amount: formatMoney(reward.savings.total, currency) }),
        }
      : { value: reward.savings.total, currency, label: t("recipes.reward.savedSince"), note: null }
    : null;
  // Same fridge-driven target as the home: what is still going off after this
  // cook, so clearing the lot reads as the goal done.
  const rewardGoalTotal = dailyGoal(inventoryGroups.filter((group) => group.urgency === "urgent").length);
  const rewardGoal = reward?.streak
    ? {
        done: Math.min(reward.streak.today, rewardGoalTotal),
        total: rewardGoalTotal,
        label:
          reward.streak.today >= rewardGoalTotal
            ? t("recipes.week.goalDone")
            : t("recipes.week.goalMore", { count: rewardGoalTotal - reward.streak.today }),
      }
    : null;

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

  // Collapsing hero: the header band shrinks from HERO_MAX to HERO_MIN as the
  // recipe scrolls, with the glyph scaling down into the collapsed band. All
  // transform-driven so it runs on the native thread.
  const [scrollY] = useState(() => new Animated.Value(0));
  // The cover drifts up at a third of the scroll speed; the content sheet
  // slides over it.
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT],
    outputRange: [0, -HERO_HEIGHT / 3],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.screen}>
      {/* The cover band sits behind the content sheet, which scrolls up over
          it; back/save and the cook CTA stay fixed. */}
      <Animated.View style={[styles.hero, { transform: [{ translateY: heroTranslate }] }]}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        ) : (
          <IngredientIcons names={heroNames} />
        )}
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
      <View style={styles.body}>
        {urgentBadge || hasCooked ? (
          <View style={styles.badges}>
            {urgentBadge ? (
              <View style={[styles.badge, styles.badgeUrgent]}>
                <Text variant="micro" uppercase color={colors.accentInk}>
                  {t("recipes.saves", { item: urgentBadge })}
                </Text>
              </View>
            ) : null}
            {hasCooked ? (
              <View style={styles.badge}>
                <Text variant="micro" uppercase muted>
                  {t("recipes.cooked.count", { count: cookedCount })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text variant="h3">{title}</Text>
        {description ? (
          <Text variant="body" muted style={styles.description}>
            {description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <MetaChip icon={<ClockIcon />} label={formatTimeLabel(timeMinutes)} />
          <MetaChip icon={<ServingsIcon />} label={t("recipes.detail.servings", { count: servings })} />
          <MetaChip icon={<ComplexityIcon />} label={complexityLabel} />
        </View>

        {ingredients.length > 0 ? (
          <>
            <View style={styles.fridgeHeader}>
              <Text variant="micro" muted style={[styles.sectionLabel, styles.fridgeHeaderLabel]}>
                {fridgeCount > 0
                  ? t("recipes.detail.fromFridgeCount", { count: fridgeCount })
                  : t("recipes.detail.ingredients")}
              </Text>
              <Tappable
                state={{ expanded: ingredientsOpen }}
                onPress={() => setIngredientsOpen((open) => !open)}
                style={[styles.foldButton]}
              >
                <Text variant="small" color={colors.primary}>
                  {ingredientsOpen
                    ? t("recipes.detail.hideIngredients")
                    : t("recipes.detail.showIngredients", { count: ingredients.length })}
                </Text>
                <Chevron up={ingredientsOpen} />
              </Tappable>
            </View>
            <View style={[styles.fridgeCard, !ingredientsOpen && styles.fridgeCardFolded]}>
              {!ingredientsOpen ? (
                <View style={styles.foldedRow}>
                  {ingredients.slice(0, 8).map((ing, i) => {
                    const iconId = foodIconKey(ing.name);
                    return iconId && !iconId.startsWith("category_") ? (
                      <FoodGlyph key={i} name={iconId} size={20} />
                    ) : null;
                  })}
                </View>
              ) : null}
              {ingredientsOpen && ingredients.map((ing, i) => {
                const inFridge = isOwned(ing);
                const isUrgent = matchedUrgentItems.includes(ing.name);
                const missingRequired = !inFridge && ing.required;
                const dotColor = isUrgent || missingRequired ? colors.redInk : inFridge ? colors.green : colors.muted2;
                const meta = isUrgent
                  ? t("recipes.detail.bestToday")
                  : missingRequired
                    ? t("recipes.detail.missing")
                    : !ing.required && !inFridge
                      ? t("recipes.detail.niceToHave")
                      // A liquid shows no amount at all, here or anywhere.
                      : isLiquidAmount(ing.amount)
                        ? ""
                        : ing.amount;
                const metaColor = isUrgent || missingRequired ? colors.redInk : colors.muted;
                const have = haveLabel(ing);
                const iconId = foodIconKey(ing.name);
                const hasIcon = iconId != null && !iconId.startsWith("category_");
                return (
                  <View key={i} style={[styles.fridgeRow, i > 0 && styles.fridgeRowDivider]}>
                    <View style={styles.fridgeRowLeft}>
                      {/* The food's icon with its status dot as a badge; foods
                          without an icon keep the plain dot. */}
                      <View style={[styles.ingredientIcon, hasIcon && styles.ingredientIconTile]}>
                        {hasIcon ? <FoodGlyph name={iconId} size={22} /> : null}
                        <View style={[styles.dot, hasIcon && styles.dotBadge, { backgroundColor: dotColor }]} />
                      </View>
                      <View style={styles.ingredientText}>
                        <Text
                          variant="label"
                          color={missingRequired ? colors.redInk : colors.text}
                        >
                          {ing.name}
                        </Text>
                        {have ? (
                          <Text variant="small" muted>
                            {t("recipes.detail.have", { amount: have })}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text variant="small" color={metaColor} style={styles.fridgeMeta}>
                      {meta}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text variant="micro" muted style={styles.sectionLabel}>
          {t("recipes.detail.howToCook")}
        </Text>

        <View style={styles.steps}>
          {expanding && steps.length === 0 ? (
            <View style={styles.stepsPending}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text variant="body" muted>{t("recipes.detail.preparingSteps")}</Text>
            </View>
          ) : expandFailed && steps.length === 0 ? (
            <>
              <Text variant="body" muted>{t("recipes.detail.stepsFailed")}</Text>
              <Button title={t("scan.tryAgain")} variant="ghost" fit onPress={retryExpand} />
            </>
          ) : (
            steps.map((step, i) => (
              <View key={i} style={[styles.stepRow, i > 0 && styles.stepRowDivider]}>
                <View style={styles.stepNumber}>
                  <Text variant="micro" color={colors.primary}>{i + 1}</Text>
                </View>
                <Text variant="body" style={styles.stepText}>{step}</Text>
              </View>
            ))
          )}
        </View>

        {/* Guideline 1.4.1: the steps and the ingredient list are AI-written,
            so allergens are the cook's call, not the app's. */}
        <Text variant="micro" muted style={styles.safetyNote}>
          {t("recipes.detail.safetyNote")}
        </Text>

        {/* Guideline 1.2: a way to flag what the generator got wrong. */}
        {recipeId ? (
          <Tappable onPress={confirmReport} hitSlop={8} style={styles.reportButton}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path d="M5 21V4M5 4h11l-2 4 2 4H5" stroke={colors.muted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text variant="small" muted>
              {t("recipes.detail.report")}
            </Text>
          </Tappable>
        ) : null}
      </View>
      </Animated.ScrollView>

      <Tappable
        label={t("recipes.detail.backLabel")}
        // Return to the list the recipe was opened from — inside the tab
        // group, router.back() can land on whichever tab was visited before.
        // Tab screens stay mounted, so All recipes keeps its search and scroll.
        onPress={() =>
          router.replace(params.returnTo === "all-recipes" ? "/(tabs)/all-recipes" : "/(tabs)/recipes")
        }
        style={[styles.roundButton, { top: insets.top + spacing.sm, left: spacing.xl }]}
      >
        <Svg width={15} height={15} viewBox="0 0 14 14">
          <Path d="M9 2L3 7L9 12" stroke={colors.primary} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Tappable>
      {recipeId ? (
        <Tappable
          label={favorite ? t("recipes.detail.savedCta") : t("recipes.detail.saveCta")}
          selected={favorite}
          onPress={handleFavoriteToggle}
          style={[styles.roundButton, { top: insets.top + spacing.sm, right: spacing.xl }]}
        >
          <Svg width={19} height={19} viewBox="0 0 24 24" fill={favorite ? colors.accent : "none"}>
            <Path
              d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
              stroke={favorite ? colors.accentInk : colors.primary}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </Svg>
        </Tappable>
      ) : null}

      <View style={styles.bottomGradient}>
        <Button
          title={hasCooked ? t("recipes.detail.cookAgainCta") : t("recipes.detail.cookCta")}
          variant="accent"
          onPress={handleCookPress}
        />
      </View>

      <BottomSheet
        visible={showCooked}
        onDismiss={() => {
          // Back/escape on the reward finishes the cook like Done.
          if (reward) {
            finishReward();
            return;
          }
          setShowCooked(false);
          // Closing the sheet abandons the save; don't leave the CTA spinning
          // for the next open.
          setCooking(false);
        }}
        // The reward is drawn inside this sheet's Modal: a second Modal
        // stacked on it didn't reliably show on iOS.
        // The share image is drawn off screen in the same overlay.
        overlay={
          <>
            <CookReward
              visible={reward !== null}
              eyebrow={t("recipes.reward.eyebrow", { title })}
              title={t("recipes.reward.title", { count: reward?.items.length ?? 0 })}
              items={reward?.items ?? []}
              goal={rewardGoal}
              streak={reward?.streak ? { value: reward.streak.streak, label: t("recipes.reward.streak", { count: reward.streak.streak }) } : null}
              money={rewardMoney}
              doneLabel={t("recipes.reward.done")}
              shareLabel={t("recipes.reward.share")}
              shareAs={{
                title: t("recipes.reward.shareAs"),
                post: t("insights.share.post"),
                story: t("insights.share.story"),
                cancel: t("common.cancel"),
              }}
              onDone={finishReward}
              onShare={shareReward}
            />
            {reward ? (
              <>
                <ShareCardExport viewRef={rewardPost.ref} format="post" {...rewardCard(reward)} />
                <ShareCardExport viewRef={rewardStory.ref} format="story" {...rewardCard(reward)} />
              </>
            ) : null}
          </>
        }
      >
        {swapIndex === null ? (
          <>
            <Text variant="micro" color={colors.accent} style={styles.cookedEyebrow}>
              {t("recipes.cooked.eyebrow")}
            </Text>
            <Text variant="h3" style={styles.cookedTitle}>{t("recipes.cooked.title")}</Text>
            <Text variant="body" muted style={styles.cookedBody}>{t("recipes.cooked.body")}</Text>

            <ScrollView
              style={styles.cookedListScroll}
              contentContainerStyle={styles.cookedList}
              showsVerticalScrollIndicator={false}
            >
              {cookedItems.map((item, i) => {
                const missing = !item.inFridge && !item.swapDisplay;
                // No liquid amounts anywhere on the recipe: "Olive oil" alone.
                const amountLine = (suffix?: string) =>
                  [isLiquidAmount(item.amount) ? null : item.amount, suffix].filter(Boolean).join(" · ");

                // Unlogged pantry staples (salt, oil, spices): assume they're
                // owned — show quietly, never nag, never deplete.
                if (missing && isPantryStaple(item.name)) {
                  return (
                    <View key={i} style={styles.cookedItemStaple}>
                      <View style={styles.cookedItemCopy}>
                        <Text variant="body" muted>{item.name}</Text>
                        <Text variant="small" muted>
                          {amountLine(t("recipes.cooked.pantryStaple"))}
                        </Text>
                      </View>
                    </View>
                  );
                }

                // Missing ingredient: visually distinct (dashed, no checkbox),
                // with two outs — log it as owned, or substitute from the fridge.
                if (missing) {
                  return (
                    <View key={i} style={styles.cookedItemMissing}>
                      <View>
                        <Text variant="body" muted>{item.name}</Text>
                        <Text variant="small" muted>
                          {amountLine(t("recipes.cooked.notInFridge"))}
                        </Text>
                      </View>
                      <View style={styles.missingActions}>
                        <Tappable
                          onPress={() => confirmHaveItem(i)}
                          style={[styles.missingActionButton]}
                        >
                          <Text variant="small" color={colors.primary}>
                            {t("recipes.cooked.iHaveThis")}
                          </Text>
                        </Tappable>
                        <Tappable
                          onPress={() => setSwapIndex(i)}
                          style={[styles.missingActionButton]}
                        >
                          <Text variant="small" color={colors.primary}>
                            {t("recipes.cooked.useSomethingElse")}
                          </Text>
                        </Tappable>
                      </View>
                    </View>
                  );
                }

                return (
                  <Tappable
                    key={i}
                    role="checkbox"
                    state={{ checked: item.used }}
                    onPress={() => toggleCookedItem(i)}
                    style={[styles.cookedItem, item.used && styles.cookedItemActive]}
                  >
                    <View style={[styles.checkbox, item.used && styles.checkboxActive]}>
                      {item.used ? (
                        <Svg width={13} height={13} viewBox="0 0 13 13">
                          <Path d="M3 7L5.5 9.5L10 4" stroke={colors.onPrimary} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      ) : null}
                    </View>
                    <View style={styles.cookedItemCopy}>
                      <Text variant="body" style={[!item.used && styles.strikethrough]}>
                        {item.swapDisplay ?? item.name}
                      </Text>
                      <Text variant="small" muted>
                        {item.swapDisplay
                          ? t("recipes.cooked.insteadOf", { item: item.name })
                          : item.extra
                            ? t("recipes.fromFridge")
                            : amountLine()}
                      </Text>
                    </View>
                  </Tappable>
                );
              })}

              <Tappable
                onPress={() => setSwapIndex("add")}
                style={[styles.addExtraRow]}
              >
                <Text variant="label" color={colors.primary}>
                  + {t("recipes.cooked.addExtra")}
                </Text>
              </Tappable>
            </ScrollView>

            <Button
              title={t("recipes.cooked.confirm", { count: removedCount })}
              onPress={confirmCooked}
              loading={cooking}
              style={styles.cookedConfirm}
            />
          </>
        ) : extraTarget ? (
          <>
            <Text variant="h3" style={styles.cookedTitle}>
              {t("recipes.cooked.swapAmountTitle", { item: extraTarget.name })}
            </Text>
            <View style={styles.extraAmountRow}>
              <TextField
                label={t("scan.manual.quantityLabel")}
                value={extraAmount}
                // decimal-pad only picks the soft keyboard — hardware keyboards
                // and paste can still inject letters, so strip them here.
                onChangeText={(text) => setExtraAmount(text.replace(/[^0-9.,]/g, ""))}
                keyboardType="decimal-pad"
                containerStyle={styles.extraAmountField}
              />
              <View style={styles.unitChips}>
                {[asCountedPack(1, extraTarget.unit).unit, extraTarget.netUnit === "g" ? "g" : null]
                  .filter((unit): unit is string => Boolean(unit))
                  .filter((unit, index, all) => all.indexOf(unit) === index)
                  .map((unit) => (
                    <Tappable
                      key={unit}
                      onPress={() => setExtraUnit(unit)}
                      style={[styles.unitChip, extraUnit === unit && styles.unitChipActive]}
                    >
                      <Text
                        variant="small"
                        color={extraUnit === unit ? colors.onPrimary : colors.primary}
                      >
                        {unit}
                      </Text>
                    </Tappable>
                  ))}
              </View>
            </View>
            <Button
              title={t("scan.add")}
              onPress={confirmExtra}
              style={styles.cookedConfirm}
            />
            <Button
              title={t("common.cancel")}
              variant="text"
              onPress={() => setExtraTarget(null)}
            />
          </>
        ) : (
          <>
            <Text variant="h3" style={styles.cookedTitle}>
              {swapIndex === "add"
                ? t("recipes.cooked.swapAddTitle")
                : t("recipes.cooked.swapTitle", { item: cookedItems[swapIndex]?.name ?? "" })}
            </Text>
            <ScrollView style={styles.swapList}>
              {inventoryGroups.map((group) => (
                <Tappable
                  key={group.key}
                  onPress={() => (swapIndex === "add" ? startExtraAmount(group) : applySwap(swapIndex, group))}
                  style={[styles.swapRow]}
                >
                  <Text variant="body">{group.name}</Text>
                  <Text variant="small" muted>{group.meta}</Text>
                </Tappable>
              ))}
            </ScrollView>
            <Button
              title={t("common.cancel")}
              variant="text"
              onPress={() => setSwapIndex(null)}
            />
          </>
        )}
      </BottomSheet>
    </View>
  );
}

/** One fact about the dish (time, servings, effort) as a sage chip. */
function MetaChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.metaChip}>
      {icon}
      <Text variant="small" weight="bold" color={colors.primary}>
        {label}
      </Text>
    </View>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 14 14">
      <Path
        d={up ? "M3 9L7 5L11 9" : "M3 5L7 9L11 5"}
        stroke={colors.primary}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClockIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M12 7.5V12l3 2" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ServingsIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M4 14a8 8 0 0 1 16 0z" stroke={colors.primary} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M3 17.5h18" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ComplexityIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M4 18V11M12 18V5M20 18v-4" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: SHEET_TOP,
    paddingBottom: 140,
  },
  hero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  roundButton: {
    position: "absolute",
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  // The content rides up over the cover as a sheet of paper.
  body: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  badgeUrgent: {
    backgroundColor: colors.accentSoft,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.sageTint,
  },
  description: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fridgeCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  fridgeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  fridgeHeaderLabel: {
    marginBottom: 0,
    flexShrink: 1,
  },
  foldButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 44,
    paddingLeft: spacing.md,
  },
  fridgeCardFolded: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  foldedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  fridgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  fridgeRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  fridgeRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  ingredientIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientIconTile: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
  },
  dotBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: radii.xs,
    borderWidth: 2,
    borderColor: colors.card,
  },
  ingredientText: {
    flex: 1,
    minWidth: 0,
  },
  fridgeMeta: {
    textAlign: "right",
  },
  steps: {
    gap: 0,
  },
  safetyNote: {
    marginTop: spacing.lg,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  stepsPending: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  stepRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepText: {
    flex: 1,
  },
  // Sits over the content, so it needs its own ground.
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    // The tab dock sits below this bar now — no home-indicator clearance needed.
    paddingBottom: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
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
  cookedListScroll: {
    flexShrink: 1,
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
    backgroundColor: colors.surface,
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
    borderRadius: radii.xs,
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
  cookedItemMissing: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.hairlineStrong,
    borderRadius: radii.lg,
  },
  cookedItemStaple: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radii.lg,
    opacity: 0.8,
  },
  missingActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  missingActionButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary50,
    borderRadius: radii.lg,
  },
  addExtraRow: {
    alignItems: "center",
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.hairline,
    borderRadius: radii.lg,
  },
  swapList: {
    maxHeight: 340,
    marginTop: spacing.md,
  },
  swapRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    gap: spacing.xxs,
  },
  swapRowPressed: {
    opacity: 0.6,
  },
  extraAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  extraAmountField: {
    flex: 1,
  },
  unitChips: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary50,
  },
  unitChipActive: {
    backgroundColor: colors.primary,
  },
});
