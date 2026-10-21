import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, ScrollViewInstance, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { BottomSheet, Button, Card, RecipeGlyph, Text, TextField } from "@/components";
import { useAuth } from "@/features";
import { notifyInventoryChanged, useInventory } from "@/hooks";
import { newClientId } from "@/lib";
import { canonicalFoodName, expandRecipe, formatComplexity, formatTimeLabel, ingredientUse, InventoryGroup, isPantryStaple, resolveUrgency } from "@/services";
import { addInventoryItem, recordCookedEventAndDepleteInventory } from "@/repositories/inventoryRepository";
import { markCookedCoachmarkSeen } from "@/repositories/notificationRepository";
import { toggleRecipeFavorite, updateRecipeDetail } from "@/repositories/recipeRepository";
import { colors, radii, spacing } from "@/theme";

const HERO_MAX_HEIGHT = 168;
const HERO_MIN_HEIGHT = 84;
const HERO_SCROLL_DISTANCE = HERO_MAX_HEIGHT - HERO_MIN_HEIGHT;

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
  }>();

  const { profile, activeHousehold, refresh: refreshAuth } = useAuth();
  const { groups: inventoryGroups, lots, loading: inventoryLoading } = useInventory(activeHousehold?.id);
  // Recipe id still waiting for its phase-2 expand (set by the seeding effect,
  // consumed once inventory has loaded).
  const pendingExpandRef = useRef<string | null>(null);

  const title = params.title ?? "";
  const description = params.description ?? "";
  const servings = Number(params.servings ?? 2);
  const recipeId = params.recipeId ?? "";
  const cookedCount = Number(params.cookedCount ?? 0);
  const hasCooked = cookedCount > 0;

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

  const ingredients = detail.ingredients;
  const steps = detail.steps;
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
    setDetail({
      ingredients: baseIngredients,
      steps: baseSteps,
      timeMinutes: baseTime,
      complexity: params.complexity ?? "simple",
    });
    // Already expanded (or opened from a persisted, expanded row): nothing to do.
    pendingExpandRef.current =
      baseSteps.length > 0 || baseIngredients.length === 0 ? null : recipeId;
    // Re-seed only when the recipe changes; params are read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  // Expand once inventory has loaded: on a cold open `lots` starts empty, and
  // an empty inventory makes the server null every matchKey (C17). Expired
  // lots are left out — cooking skips them anyway.
  useEffect(() => {
    if (inventoryLoading || pendingExpandRef.current !== recipeId) return;
    pendingExpandRef.current = null;
    const baseIngredients: IngredientItem[] = params.ingredients
      ? JSON.parse(params.ingredients)
      : [];
    const baseTime = Number(params.timeMinutes ?? 20);
    let cancelled = false;
    setExpanding(true);
    (async () => {
      const result = await expandRecipe({
        title,
        description,
        timeMinutes: baseTime,
        usedIngredientNames: baseIngredients.map((ing) => ing.name),
        inventory: lots.filter((lot) => resolveUrgency(lot) !== "expired"),
        avoidances: profile?.avoidances ?? [],
        servings,
      });
      if (cancelled) return;
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
      setExpanding(false);
    })();
    return () => {
      cancelled = true;
    };
    // Expand once per opened recipe; lots/profile are read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, inventoryLoading]);

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
  const cookIdRef = useRef<string | null>(null);
  const [favorite, setFavorite] = useState(params.isFavorite === "true");

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
  // An ingredient is "owned" if the model took it from the fridge (required=true)
  // or its name still matches a live fridge item. Receipt-sourced inventory has
  // messy names (e.g. "Krastavac domaci"), so name-matching alone misses items
  // the recipe genuinely used — `required` is the reliable signal.
  const isOwned = (ing: IngredientItem) =>
    ing.required ||
    isPantryStaple(ing.name) ||
    liveFridgeNames.has(ingredientKey(ing));
  const fridgeCount = ingredients.filter(isOwned).length;

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
    try {
      // Deplete by item name against current inventory (spilling across lots,
      // soonest-expiry first) instead of stale snapshot lot ids. Sum duplicate
      // ingredients so each item is depleted by its total amount once.
      const byName = new Map<string, { amount: number; unit: string }>();
      for (const item of cookedItems) {
        if (!item.used) continue;
        // A swapped row depletes the chosen fridge item instead of the
        // recipe's original ingredient.
        const key = item.swapNormalized ?? ingredientKey(item);
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
      // Time-box the save: a hung network call (no rejection) would otherwise
      // leave the CTA spinning forever with no feedback.
      await Promise.race([
        recordCookedEventAndDepleteInventory({
          householdId: activeHousehold.id,
          recipeId: recipeId || null,
          servings,
          usedItems,
          cookId: cookIdRef.current,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(t("common.fridgeUpdateError"))), 20000),
        ),
      ]);
      cookIdRef.current = null;
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

  // Collapsing hero: the header band shrinks from HERO_MAX to HERO_MIN as the
  // recipe scrolls, with the glyph scaling down into the collapsed band. All
  // transform-driven so it runs on the native thread.
  const [scrollY] = useState(() => new Animated.Value(0));
  // "Jump to recipe": long ingredient lists push the steps below the fold, so
  // a shortcut scrolls straight to them. stepsY is the section label's offset
  // within the body; the content itself starts at HERO_MAX_HEIGHT (padding).
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [stepsY, setStepsY] = useState(0);
  const jumpToSteps = () =>
    scrollRef.current?.scrollTo({
      y: HERO_MAX_HEIGHT + stepsY - HERO_MIN_HEIGHT - spacing.md,
      animated: true,
    });
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, HERO_SCROLL_DISTANCE],
    outputRange: [0, -HERO_SCROLL_DISTANCE],
    extrapolate: "clamp",
  });
  const glyphScale = scrollY.interpolate({
    inputRange: [0, HERO_SCROLL_DISTANCE],
    outputRange: [1, 0.6],
    extrapolate: "clamp",
  });
  // Counter-translate so the shrinking glyph stays centered in what remains
  // visible of the hero after it slides up.
  const glyphTranslate = scrollY.interpolate({
    inputRange: [0, HERO_SCROLL_DISTANCE],
    outputRange: [0, HERO_SCROLL_DISTANCE / 2],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.screen}>
      {/* Single scroll surface: title through steps move together; the hero
          collapses with scroll while back/save and the cook CTA stay fixed. */}
      <Animated.ScrollView
        ref={scrollRef}
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

        {ingredients.length > 0 ? (
          <>
            <View style={styles.fridgeHeader}>
              <Text variant="micro" muted style={[styles.sectionLabel, styles.fridgeHeaderLabel]}>
                {fridgeCount > 0
                  ? t("recipes.detail.fromFridgeCount", { count: fridgeCount })
                  : t("recipes.detail.ingredients")}
              </Text>
              {ingredients.length > 6 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={jumpToSteps}
                  style={({ pressed }) => [styles.jumpButton, pressed && { opacity: 0.6 }]}
                >
                  <Text variant="small" color={colors.primary}>
                    {t("recipes.detail.jumpToRecipe")} ↓
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.fridgeCard}>
              {ingredients.map((ing, i) => {
                const inFridge = isOwned(ing);
                const isUrgent = matchedUrgentItems.includes(ing.name);
                const missingRequired = !inFridge && ing.required;
                const dotColor = isUrgent || missingRequired ? colors.red : inFridge ? colors.green : colors.muted2;
                const meta = isUrgent
                  ? t("recipes.detail.bestToday")
                  : missingRequired
                    ? t("recipes.detail.missing")
                    : !ing.required && !inFridge
                      ? t("recipes.detail.niceToHave")
                      : ing.amount;
                const metaColor = isUrgent || missingRequired ? colors.red : colors.muted;
                return (
                  <View key={i} style={[styles.fridgeRow, i > 0 && styles.fridgeRowDivider]}>
                    <View style={styles.fridgeRowLeft}>
                      <View style={[styles.dot, { backgroundColor: dotColor }]} />
                      <Text
                        variant="body"
                        color={missingRequired ? colors.red : colors.text}
                        style={styles.ingredientName}
                      >
                        {ing.name}
                      </Text>
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

        <Text
          variant="micro"
          muted
          style={styles.sectionLabel}
          onLayout={(event) => setStepsY(event.nativeEvent.layout.y)}
        >
          {t("recipes.detail.howToCook")}
        </Text>

        <View style={styles.steps}>
          {expanding && steps.length === 0 ? (
            <>
              <Text variant="body" muted>{t("recipes.detail.preparingSteps")}</Text>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.stepSkeleton} />
              ))}
            </>
          ) : (
            steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text variant="small" color={colors.surface} style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text variant="body" style={styles.stepText}>{step}</Text>
              </View>
            ))
          )}
        </View>
      </View>
      </Animated.ScrollView>

      <Animated.View style={[styles.hero, { transform: [{ translateY: heroTranslate }] }]}>
        <Animated.View
          style={{ transform: [{ translateY: glyphTranslate }, { scale: glyphScale }] }}
        >
          <RecipeGlyph size={48} />
        </Animated.View>
        {urgentBadge ? (
          <View style={styles.urgentChip}>
            <Text variant="small" color={colors.primary}>
              {t("recipes.saves", { item: urgentBadge })}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("recipes.detail.backLabel")}
        // Always return to the recipes list — inside the tab group,
        // router.back() can land on whichever tab was visited before.
        onPress={() => router.replace("/(tabs)/recipes")}
        style={styles.backButton}
      >
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path d="M9 2L3 7L9 12" stroke={colors.primary} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      {recipeId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? t("recipes.detail.savedCta") : t("recipes.detail.saveCta")}
          onPress={handleFavoriteToggle}
          style={styles.favoriteButton}
        >
          <Text variant="body">{favorite ? "★" : "☆"}</Text>
        </Pressable>
      ) : null}

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
      </View>

      <BottomSheet
        visible={showCooked}
        onDismiss={() => {
          setShowCooked(false);
          // Closing the sheet abandons the save; don't leave the CTA spinning
          // for the next open.
          setCooking(false);
        }}
      >
        {swapIndex === null ? (
          <>
            <Text variant="micro" color={colors.accent} style={styles.cookedEyebrow}>
              {t("recipes.cooked.eyebrow")}
            </Text>
            <Text variant="h1" style={styles.cookedTitle}>{t("recipes.cooked.title")}</Text>
            <Text variant="body" muted style={styles.cookedBody}>{t("recipes.cooked.body")}</Text>

            <ScrollView
              style={styles.cookedListScroll}
              contentContainerStyle={styles.cookedList}
              showsVerticalScrollIndicator={false}
            >
              {cookedItems.map((item, i) => {
                const missing = !item.inFridge && !item.swapDisplay;

                // Unlogged pantry staples (salt, oil, spices): assume they're
                // owned — show quietly, never nag, never deplete.
                if (missing && isPantryStaple(item.name)) {
                  return (
                    <View key={i} style={styles.cookedItemStaple}>
                      <View style={styles.cookedItemCopy}>
                        <Text variant="body" muted>{item.name}</Text>
                        <Text variant="small" muted>
                          {item.amount} · {t("recipes.cooked.pantryStaple")}
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
                          {item.amount} · {t("recipes.cooked.notInFridge")}
                        </Text>
                      </View>
                      <View style={styles.missingActions}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => confirmHaveItem(i)}
                          style={({ pressed }) => [
                            styles.missingActionButton,
                            pressed && styles.swapRowPressed,
                          ]}
                        >
                          <Text variant="small" color={colors.primary}>
                            {t("recipes.cooked.iHaveThis")}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setSwapIndex(i)}
                          style={({ pressed }) => [
                            styles.missingActionButton,
                            pressed && styles.swapRowPressed,
                          ]}
                        >
                          <Text variant="small" color={colors.primary}>
                            {t("recipes.cooked.useSomethingElse")}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }

                return (
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
                      <Text variant="body" style={[!item.used && styles.strikethrough]}>
                        {item.swapDisplay ?? item.name}
                      </Text>
                      <Text variant="small" muted>
                        {item.swapDisplay
                          ? t("recipes.cooked.insteadOf", { item: item.name })
                          : item.extra
                            ? t("recipes.fromFridge")
                            : item.amount}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              <Pressable
                accessibilityRole="button"
                onPress={() => setSwapIndex("add")}
                style={({ pressed }) => [styles.addExtraRow, pressed && styles.swapRowPressed]}
              >
                <Text variant="label" color={colors.primary}>
                  + {t("recipes.cooked.addExtra")}
                </Text>
              </Pressable>
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
            <Text variant="h2" style={styles.cookedTitle}>
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
                {[extraTarget.unit, extraTarget.netUnit]
                  .filter((unit): unit is string => Boolean(unit))
                  .filter((unit, index, all) => all.indexOf(unit) === index)
                  .map((unit) => (
                    <Pressable
                      key={unit}
                      accessibilityRole="button"
                      onPress={() => setExtraUnit(unit)}
                      style={[styles.unitChip, extraUnit === unit && styles.unitChipActive]}
                    >
                      <Text
                        variant="small"
                        color={extraUnit === unit ? colors.surface : colors.primary}
                      >
                        {unit}
                      </Text>
                    </Pressable>
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
            <Text variant="h2" style={styles.cookedTitle}>
              {swapIndex === "add"
                ? t("recipes.cooked.swapAddTitle")
                : t("recipes.cooked.swapTitle", { item: cookedItems[swapIndex]?.name ?? "" })}
            </Text>
            <ScrollView style={styles.swapList}>
              {inventoryGroups.map((group) => (
                <Pressable
                  key={group.key}
                  accessibilityRole="button"
                  onPress={() => (swapIndex === "add" ? startExtraAmount(group) : applySwap(swapIndex, group))}
                  style={({ pressed }) => [styles.swapRow, pressed && styles.swapRowPressed]}
                >
                  <Text variant="body">{group.name}</Text>
                  <Text variant="small" muted>{group.meta}</Text>
                </Pressable>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: HERO_MAX_HEIGHT,
    paddingBottom: 140,
  },
  hero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HERO_MAX_HEIGHT,
    backgroundColor: "#C8D5C2",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  backButton: {
    position: "absolute",
    zIndex: 20,
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
    zIndex: 20,
    top: 56,
    right: 20,
    width: 44,
    height: 44,
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
    backgroundColor: "rgba(243,239,232,0.85)",
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
  fridgeCard: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
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
  jumpButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingLeft: spacing.md,
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
  ingredientName: {
    fontWeight: "600",
  },
  fridgeMeta: {
    fontWeight: "600",
    textAlign: "right",
  },
  steps: {
    gap: spacing.lg,
  },
  stepSkeleton: {
    height: 14,
    borderRadius: radii.sm,
    backgroundColor: colors.surface2,
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
    // The tab dock sits below this bar now — no home-indicator clearance needed.
    paddingBottom: spacing.md,
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
    borderWidth: 1.5,
    borderColor: colors.primary100,
    backgroundColor: colors.paper,
    borderRadius: radii.pill,
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
    borderBottomWidth: 1,
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
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  unitChipActive: {
    backgroundColor: colors.primary,
  },
});
