import { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { BottomSheet, Button, CartIcon, CheckItem, DateField, CheckTheseShelf, EmptyFridge, FoodListCard, GeneratingLoader, HouseholdPill, HouseholdSheet, LockedCard, PremiumSheet, Screen, SegmentedControl, ShoppingListCard, Tappable, Text, TextField, UnitPicker, useToast } from "@/components";
import { isPremium as resolvePremium, openRecipesAndGenerate, useAuth } from "@/features";
import { normalizeUnit } from "@/lib";
import { useHousehold, useInsights, useInventory, useShoppingList } from "@/hooks";
import {
  daysLeft,
  PartialState,
  getCatalogFood,
  hasExplicitExpiredLot,
  InventoryGroup,
  isMetricAmountRunningLow,
  toUiCategory,
  toUiUrgency,
} from "@/services";
import { CategoryTone, Urgency, categoryColors, colors, radii, shadows, spacing, typography, urgencyColors } from "@/theme";
import { router, useFocusEffect } from "expo-router";
import { FoodGlyph, Logo } from "@/components/illustrations";

const CATEGORY_ORDER = [
  "dairy_eggs",
  "vegetables",
  "meat",
  "fish",
  "fruit",
  "bakery",
  "pantry",
  "frozen",
  "drinks",
  "snacks",
  "other",
] as const;

type Category = (typeof CATEGORY_ORDER)[number];
// TinyMeals-style browsing: null = the overview (today, running low, category
// tiles); otherwise a results list for everything, running low or a category.
type KitchenView = null | "all" | "low" | "soon" | Category;

export default function FridgeRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold, refresh: refreshAuth } = useAuth();
  const {
    loading,
    groups,
    error,
    updateFirstLot,
    markGroupsStillGood,
    removeGroup,
    removeGroups,
    refresh,
  } = useInventory(activeHousehold?.id);
  const shopping = useShoppingList(activeHousehold?.id);
  const refreshShopping = shopping.refresh;
  const { showToast } = useToast();
  const [actionGroup, setActionGroup] = useState<InventoryGroup | null>(null);
  const [view, setView] = useState<KitchenView>(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const query = search.trim().toLowerCase();
  // Expired groups leave the category shelves, chips, and filters entirely —
  // they live in the "Check these" block below eat-first.
  const expiredGroups = groups.filter((group) => group.urgency === "expired");
  const activeGroups = groups.filter((group) => group.urgency !== "expired");
  const [checkSheetVisible, setCheckSheetVisible] = useState(false);
  const [householdOpen, setHouseholdOpen] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const toCheckItem = (group: InventoryGroup): CheckItem => {
    const expiry = earliestExpiry(group.lots);
    // In the expired band any explicit date has necessarily passed, so a
    // present date means "Expired <date>"; no date means our estimate.
    const hasDate = Boolean(expiry) && hasExplicitExpiredLot(group.lots);
    return {
      id: group.key,
      name: group.name,
      category: toUiCategory(group.category),
      label: hasDate
        ? `${t("fridge.meta.expired")} · ${formatExpiryDate(expiry as string)}`
        : `${t("fridge.checkThese.pastBest")} · ${t("fridge.checkThese.noExpiry")}`,
      shortLabel: hasDate ? formatExpiryDate(expiry as string) : t("fridge.checkThese.noDate"),
    };
  };
  // The see-all sheet groups the pile by category so 70+ rows stay scannable.
  const checkSections = CATEGORY_ORDER
    .map((category) => ({
      key: category as string,
      name: t(`scan.categories.${category}` as never) as string,
      items: expiredGroups.filter((group) => group.category === category).map(toCheckItem),
    }))
    .filter((section) => section.items.length > 0);
  const onCheckItemPress = (item: CheckItem) => {
    setCheckSheetVisible(false);
    setActionGroup(expiredGroups.find((group) => group.key === item.id) ?? null);
  };
  // Inventory writes fail offline; say so instead of failing silently (C1).
  // Returns false on failure so sheets can stay open.
  const runFridgeAction = async (action: () => Promise<void>) => {
    try {
      await action();
      return true;
    } catch {
      Alert.alert(t("common.error"), t("common.fridgeUpdateError"));
      return false;
    }
  };
  const inView = (group: InventoryGroup) =>
    view === null || view === "all"
      ? true
      : view === "low"
        ? isMetricAmountRunningLow(group)
        : view === "soon"
          ? isUseSoon(group)
          : group.category === view;
  const matches = activeGroups.filter((group) => inView(group) && (!query || group.name.toLowerCase().includes(query)));
  const resultGroups = view === "soon" ? sortBySoonest(matches) : matches;
  // Searching or opening a list swaps the overview for results.
  const showResults = view !== null || Boolean(query);
  const isPremium = resolvePremium(profile, activeHousehold);
  const { refresh: refreshInsights } = useInsights(activeHousehold?.id);
  // Eat-first is global (urgency, not the active category/search filter).
  // Premium "Use soon" list (TinyMeals' Try next): today and soon, soonest first.
  const useSoonGroups = sortBySoonest(groups.filter(isUseSoon));
  const runningLowGroups = activeGroups.filter(isMetricAmountRunningLow);
  // Category tiles: only categories with something in them.
  const categoryTiles = CATEGORY_ORDER.map((category) => {
    const inCategory = activeGroups.filter((group) => group.category === category);
    const soon = inCategory.filter((group) => group.urgency === "urgent" || group.urgency === "use_soon").length;
    return {
      category,
      label: t(`scan.categories.${category}` as never) as string,
      count: inCategory.length,
      detail: soon > 0
        ? t("fridge.tiles.itemsSoon", { count: inCategory.length, soon })
        : t("fridge.kitchenPulse.total", { count: inCategory.length }),
    };
  }).filter((tile) => tile.count > 0);
  // Whole-kitchen freshness composition for the Kitchen Pulse bar.
  const pulse = groups.reduce(
    (acc, group) => {
      if (group.urgency === "expired") return acc; // expired isn't fresh/soon/urgent
      if (group.urgency === "urgent") acc.urgent += 1;
      else if (group.urgency === "use_soon") acc.soon += 1;
      else acc.fresh += 1;
      return acc;
    },
    { fresh: 0, soon: 0, urgent: 0 },
  );
  // Household pill initial: first name when usable (not blank, not an email).
  const rawName = profile?.display_name?.trim() ?? "";
  const firstName = rawName && !rawName.includes("@") ? rawName.split(/\s+/)[0] : "";
  const soonCount = pulse.urgent + pulse.soon;
  const summary = [
    t("fridge.summary", { count: activeGroups.length }),
    soonCount > 0 ? t("fridge.summarySoon", { count: soonCount }) : null,
  ]
    .filter(Boolean)
    .join(" ");
  const resultsTitle =
    view === "all"
      ? t("fridge.allItems")
      : view === "low"
        ? t("fridge.shelves.runningLow")
        : view === "soon"
          ? t("fridge.shelves.useSoon")
          : view
          ? (t(`scan.categories.${view}` as never) as string)
          : t("fridge.results", { query: search.trim() });
  // One card for a single list; everything (or a plain search) by category.
  const resultShelves =
    view && view !== "all"
      ? resultGroups.length > 0
        ? [{ category: view, name: resultsTitle, groups: resultGroups }]
        : []
      : buildCategoryShelves(resultGroups, t);
  const closeResults = () => {
    setView(null);
    setSearch("");
  };
  const { members } = useHousehold(activeHousehold?.id);
  const showAddedBy = members.length > 1;
  const statusLabels: Record<Urgency, string> = {
    urgent: t("fridge.status.urgent"),
    useSoon: t("fridge.status.soon"),
    safe: t("fridge.status.fresh"),
    expired: t("fridge.status.expired"),
  };

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshInsights();
      void refreshShopping().catch(() => undefined);
      // Leaving the tab drops back to the overview, so the Kitchen never
      // reopens on a category the user left behind.
      return () => {
        setView(null);
        setSearch("");
      };
    }, [refresh, refreshInsights, refreshShopping]),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), refreshInsights()]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshInsights]);

  return (
    <Screen
      scroll
      padded={false}
      bottomInset={false}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {/* Same top as the home: logo, household pill, and here the "+". */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <Logo size={26} />
          </View>
          <View style={styles.headerActions}>
            {activeHousehold ? (
              <HouseholdPill
                name={activeHousehold.name}
                initial={firstName || activeHousehold.name}
                label={t("settings.household.openSheet", { name: activeHousehold.name })}
                onPress={() => setHouseholdOpen(true)}
              />
            ) : null}
          </View>
        </View>
        {groups.length > 0 ? (
          <Text variant="small" muted style={styles.summary}>
            {summary}
          </Text>
        ) : null}
      </View>

      {groups.length > 0 ? (
        <View style={styles.searchWrap}>
          <View style={[styles.searchField, searchFocused && styles.searchFieldFocused]}>
            <SearchIcon />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("fridge.searchPlaceholder")}
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {search ? (
              <Tappable
                label={t("fridge.clearSearch")}
                onPress={() => setSearch("")}
                hitSlop={10}
                style={styles.clearButton}
              >
                <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 5l14 14M19 5 5 19" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="round" />
                </Svg>
              </Tappable>
            ) : null}
          </View>
        </View>
      ) : null}

      {showResults ? (
        <>
          <View style={styles.resultsHead}>
            <Tappable
              label={t("common.back")}
              onPress={closeResults}
              hitSlop={6}
              style={[styles.backButton]}
            >
              <Svg width={8} height={14} viewBox="0 0 9 16" fill="none">
                <Path d="M8 1 2 8l6 7" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Tappable>
            <View style={styles.resultsCopy}>
              <Text variant="h3" numberOfLines={1}>
                {resultsTitle}
              </Text>
              <Text variant="small" muted>
                {t("fridge.kitchenPulse.total", { count: resultGroups.length })}
              </Text>
            </View>
          </View>
          {resultShelves.length === 0 ? (
            <View style={styles.centerState}>
              <Text variant="title">
                {t("fridge.noMatchTitle")}
              </Text>
              <Text variant="small" muted center>
                {t("fridge.noMatchBody")}
              </Text>
            </View>
          ) : null}
          {resultShelves.map((shelf) => (
            <CategoryShelf
              key={shelf.category}
              name={shelf.name}
              groups={shelf.groups}
              showAddedBy={showAddedBy}
              statusLabels={statusLabels}
              onItemPress={(group) => setActionGroup(group)}
            />
          ))}
        </>
      ) : (
        <>
          {/* Today: "What to cook next?" (opens recipes that use what's going
              off), then (premium) what to use soon as a dated list, or (free)
              the eat-first upsell. */}
          {groups.length > 0 ? (
            <CookNextCard
              title={t("fridge.cookNext.title")}
              body={t("fridge.cookNext.body")}
              cta={t("fridge.cookNext.cta")}
              onPress={openRecipesAndGenerate}
            />
          ) : null}

          {isPremium && useSoonGroups.length > 0 ? (
            <UseSoonStrip
              title={t("fridge.shelves.useSoon")}
              seeAllLabel={t("fridge.shelves.seeAllCount", { count: useSoonGroups.length })}
              onSeeAll={() => setView("soon")}
              items={useSoonGroups.slice(0, 8).map((group) => ({
                id: group.key,
                name: group.name,
                category: toUiCategory(group.category),
                urgency: toUiUrgency(group.urgency),
                meta: computeBestByLabel(group, t),
              }))}
              onItemPress={(id) => setActionGroup(groups.find((group) => group.key === id) ?? null)}
            />
          ) : null}

          {isPremium && groups.length > 0 && useSoonGroups.length === 0 ? (
            <FoodListCard
              title={t("fridge.shelves.useSoon")}
              emptyText={t("fridge.useSoonEmpty")}
              items={[]}
              onItemPress={() => undefined}
            />
          ) : null}

          {!isPremium && groups.length > 0 ? (
            <View style={styles.cookNextWrap}>
              <LockedCard
                title={t("fridge.eatFirstPreviewTitle")}
                body={t("fridge.eatFirstPreviewBody")}
                action={t("fridge.eatFirstUnlock")}
                onPress={() => setShowPremium(true)}
              />
            </View>
          ) : null}

          {expiredGroups.length > 0 ? (
            <CheckTheseShelf
              count={expiredGroups.length}
              labels={{
                kicker: t("fridge.checkThese.title"),
                subtitle: t("fridge.checkThese.subtitle"),
              }}
              onPress={() => setCheckSheetVisible(true)}
            />
          ) : null}


          {loading ? (
            <View style={styles.centerState}>
              <GeneratingLoader size={110} />
              <Text variant="small" muted>
                {t("common.loading")}
              </Text>
            </View>
          ) : null}

          {!loading && error ? (
            <View style={styles.centerState}>
              <Text variant="small" color={colors.redInk} center accessibilityLiveRegion="polite">
                {error}
              </Text>
            </View>
          ) : null}

          {!loading && !error && groups.length === 0 ? <EmptyFridge /> : null}

          {/* The kitchen itself, the screen's main block: one white tile per
              category, four across, each opening its list. */}
          {categoryTiles.length > 0 ? (
            <View style={styles.tilesSection}>
              <View style={styles.tilesHead}>
                <Text variant="h3" accessibilityRole="header">
                  {t("fridge.tiles.title")}
                </Text>
                <Tappable role="link" onPress={() => setView("all")}>
                  <Text variant="label" color={colors.primary}>
                    {t("fridge.shelves.seeAllCount", { count: activeGroups.length })}
                  </Text>
                </Tappable>
              </View>
              <View style={styles.tiles}>
                {categoryTiles.map((tile) => {
                  const tone = categoryColors[toUiCategory(tile.category) as CategoryTone] ?? categoryColors.other;
                  return (
                    <Tappable
                      key={tile.category}
                      label={`${tile.label}, ${tile.detail}`}
                      onPress={() => setView(tile.category)}
                      style={[styles.tile]}
                    >
                      <FoodGlyph name="" category={tile.category} color={tone.mark} size={52} />
                      <Text variant="small" numberOfLines={1} weight="bold" center>
                        {tile.label}
                      </Text>
                      <Text variant="micro" muted numberOfLines={1} center>
                        {tile.detail}
                      </Text>
                    </Tappable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {runningLowGroups.length > 0 ? (
            <CategoryShelf
              name={t("fridge.shelves.runningLow")}
              groups={runningLowGroups}
              maxVisible={4}
              seeAllLabel={t("fridge.shelves.seeAllCount", { count: runningLowGroups.length })}
              showAddedBy={showAddedBy}
              statusLabels={statusLabels}
              onItemPress={(group) => setActionGroup(group)}
              onMorePress={() => setView("low")}
            />
          ) : null}

          <ShoppingListCard
            title={shopping.openCount > 0 ? `${t("shopping.title")} · ${shopping.openCount}` : t("shopping.title")}
            subtitle={
              shopping.buyAgain.length > 0
                ? t("shopping.cardBuyAgain", { count: shopping.buyAgain.length })
                : shopping.openCount > 0
                  ? t("shopping.toBuy", { count: shopping.openCount })
                  : t("shopping.cardEmpty")
            }
            onPress={() => router.navigate("/(tabs)/shopping")}
          />

          {/* Guideline 1.4.1: the dates here are estimates, not printed
              best-before dates, so never let the app be the last word on
              whether food is safe. */}
          {groups.length > 0 ? (
            <View style={styles.safetyNote}>
              <Text variant="micro" muted>
                {t("fridge.safetyNote")}
              </Text>
            </View>
          ) : null}

        </>
      )}

      <ItemActionSheet
        group={actionGroup}
        labels={getActionLabels(t)}
        onDismiss={() => setActionGroup(null)}
        onSave={async (group, input) => {
          if (await runFridgeAction(() => updateFirstLot(group, input))) setActionGroup(null);
        }}
        onRemove={async (group, reason) => {
          if (await runFridgeAction(() => removeGroup(group, reason))) setActionGroup(null);
        }}
        onAddToList={async (group) => {
          try {
            await shopping.add(group.name);
            showToast(t("shopping.addedToast", { name: group.name }));
          } catch {
            showToast(t("shopping.error"));
          }
        }}
      />

      <CheckTheseSheet
        visible={checkSheetVisible && expiredGroups.length > 0}
        sections={checkSections}
        labels={{
          title: t("fridge.checkThese.title"),
          subtitle: t("fridge.checkThese.subtitle"),
          selectAll: t("fridge.checkThese.selectAll"),
          clearSelection: t("fridge.checkThese.clearSelection"),
          stillGoodCount: (count) => t("fridge.checkThese.stillGoodCount", { count }),
          tossCount: (count) => t("fridge.checkThese.tossCount", { count }),
          tossConfirmTitle: (count) => t("fridge.checkThese.tossAllTitle", { count }),
          tossConfirmBody: t("fridge.checkThese.tossAllBody"),
          tossConfirm: t("fridge.checkThese.tossAllConfirm"),
          cancel: t("common.cancel"),
          edit: (name) => t("fridge.checkThese.edit", { name }),
        }}
        onDismiss={() => setCheckSheetVisible(false)}
        onItemPress={onCheckItemPress}
        onStillGoodMany={(ids) => {
          void runFridgeAction(() =>
            markGroupsStillGood(expiredGroups.filter((group) => ids.includes(group.key))),
          );
        }}
        onTossMany={(ids) => {
          void runFridgeAction(() =>
            removeGroups(expiredGroups.filter((group) => ids.includes(group.key)), "discarded"),
          );
        }}
      />

      <HouseholdSheet
        visible={householdOpen}
        onClose={() => setHouseholdOpen(false)}
        itemCount={groups.length}
      />
      <PremiumSheet visible={showPremium} onPurchased={refreshAuth} onDismiss={() => setShowPremium(false)} />
      </Screen>
  );
}

// "What to cook next?": the Kitchen's way into recipes that use what's going
// off. The home's goal block, taller: solid tomato, white copy and a butter
// button on the left, broccoli and avocado on a darker tomato blob right.
function CookNextCard({ title, body, cta, onPress }: { title: string; body: string; cta: string; onPress: () => void }) {
  return (
    <View style={styles.cookNextWrap}>
      <View style={styles.cookNext}>
        <View style={styles.cookNextArt} pointerEvents="none">
          <View style={styles.cookNextBlob} />
          <Svg width={34} height={30} viewBox="0 0 30 26" style={styles.cookNextSpark}>
            <Path d="M4 16l7 3M10 6l5 7M22 2l-1 8" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" />
          </Svg>
          {/* Greens: they stand out on tomato. */}
          <View style={styles.cookNextTomato}>
            <FoodGlyph name="broccoli" size={72} />
          </View>
          <View style={styles.cookNextMushroom}>
            <FoodGlyph name="avocado" size={50} />
          </View>
        </View>
        <View style={styles.cookNextCopy}>
          <Text variant="h3" color={colors.onPrimary}>
            {title}
          </Text>
          <Text variant="small" color={colors.onPrimary} style={styles.cookNextBody}>
            {body}
          </Text>
        </View>
        <Tappable label={cta} onPress={onPress} style={[styles.cookNextButton]}>
          <Text variant="label" color={colors.text}>
            {cta}
          </Text>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12h14M13 6l6 6-6 6" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Tappable>
      </View>
    </View>
  );
}

// "Use soon", kept small so the kitchen below leads: a title row and one
// sideways strip of little white cards (food, name, best-by line, an urgency dot).
function UseSoonStrip({
  title,
  seeAllLabel,
  onSeeAll,
  items,
  onItemPress,
}: {
  title: string;
  seeAllLabel: string;
  onSeeAll: () => void;
  items: { id: string; name: string; category: string; urgency: Urgency; meta: string }[];
  onItemPress: (id: string) => void;
}) {
  return (
    <View style={styles.soon}>
      <View style={styles.soonHead}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        <Tappable role="link" label={seeAllLabel} onPress={onSeeAll}>
          <Text variant="label" color={colors.primary}>
            {seeAllLabel}
          </Text>
        </Tappable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.soonRow}>
        {items.map((item) => (
          <Tappable
            key={item.id}
            label={`${item.name}, ${item.meta}`}
            onPress={() => onItemPress(item.id)}
            hitSlop={0}
            style={[styles.soonCard]}
          >
            <View style={styles.soonFood}>
              <FoodGlyph name={item.name} category={item.category} size={34} />
            </View>
            <View style={styles.soonCopy}>
              <Text variant="label" numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.soonMeta}>
                <View style={[styles.soonDot, { backgroundColor: urgencyColors[item.urgency] }]} />
                <Text variant="small" muted numberOfLines={1}>
                  {item.meta}
                </Text>
              </View>
            </View>
          </Tappable>
        ))}
      </ScrollView>
    </View>
  );
}

function CategoryShelf({
  name,
  groups,
  maxVisible,
  seeAllLabel,
  showAddedBy,
  statusLabels,
  onItemPress,
  onMorePress,
}: {
  name: string;
  groups: InventoryGroup[];
  /** Rows before "See all"; omit to show every row. */
  maxVisible?: number;
  seeAllLabel?: string;
  showAddedBy: boolean;
  statusLabels: Record<Urgency, string>;
  onItemPress: (group: InventoryGroup) => void;
  onMorePress?: () => void;
}) {
  return (
    <FoodListCard
      title={name}
      maxVisible={maxVisible}
      seeAllLabel={seeAllLabel}
      items={groups.map((group) => ({
        id: group.key,
        name: group.name,
        category: toUiCategory(group.category),
        meta: getCardMetaLines(group.meta).join(" · "),
        urgency: toUiUrgency(group.urgency),
        status: statusLabels[toUiUrgency(group.urgency)],
        addedBy: showAddedBy ? group.lots[0]?.added_by_name ?? null : null,
      }))}
      onItemPress={(item) => {
        const group = groups.find((candidate) => candidate.key === item.id);
        if (group) onItemPress(group);
      }}
      onSeeAll={onMorePress}
    />
  );
}

// Full expired list behind the card's "See all": scrollable rows with the
// same vouch/toss actions, plus the bulk "toss all" with a confirm step.
// Multi-select triage for a big expired pile: dense checkbox rows grouped by
// category, per-section select-all, one batch action bar. Tossing always
// re-confirms with the exact count.
function CheckTheseSheet({
  visible,
  sections,
  labels,
  onDismiss,
  onItemPress,
  onStillGoodMany,
  onTossMany,
}: {
  visible: boolean;
  sections: { key: string; name: string; items: CheckItem[] }[];
  labels: {
    title: string;
    subtitle: string;
    selectAll: string;
    clearSelection: string;
    stillGoodCount: (count: number) => string;
    tossCount: (count: number) => string;
    tossConfirmTitle: (count: number) => string;
    tossConfirmBody: string;
    tossConfirm: string;
    cancel: string;
    edit: (name: string) => string;
  };
  onDismiss: () => void;
  onItemPress: (item: CheckItem) => void;
  onStillGoodMany: (ids: string[]) => void;
  onTossMany: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingToss, setConfirmingToss] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);

  // Reset selection and the confirm step whenever the sheet re-opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setSelected(new Set());
    setConfirmingToss(false);
  }

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (items: CheckItem[]) => {
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = items.every((item) => next.has(item.id));
      items.forEach((item) => (allSelected ? next.delete(item.id) : next.add(item.id)));
      return next;
    });
  };

  if (confirmingToss) {
    return (
      <BottomSheet visible={visible} onDismiss={onDismiss}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetCopy}>
            <Text variant="h3">{labels.tossConfirmTitle(selected.size)}</Text>
            <Text variant="body" muted>
              {labels.tossConfirmBody}
            </Text>
          </View>
          <View style={styles.sheetButtons}>
            <Button
              title={labels.tossConfirm}
              variant="accent"
              onPress={() => {
                setConfirmingToss(false);
                onTossMany(Array.from(selected));
                setSelected(new Set());
              }}
            />
            <Button title={labels.cancel} variant="text" onPress={() => setConfirmingToss(false)} />
          </View>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.sheetContent}>
        <View style={styles.checkHeadCopy}>
          <Text variant="h3">
            {labels.title}
          </Text>
          <Text variant="small" muted>
            {labels.subtitle}
          </Text>
        </View>
        <ScrollView style={styles.fullShelfScroll} contentContainerStyle={styles.checkSheetList}>
          {sections.map((section) => {
            const allSelected = section.items.every((item) => selected.has(item.id));
            return (
              <View key={section.key} style={styles.checkSection}>
                <View style={styles.checkSectionHead}>
                  <Text variant="micro" muted uppercase>
                    {section.name} · {section.items.length}
                  </Text>
                  <Tappable
                    onPress={() => toggleSection(section.items)}
                    hitSlop={spacing.sm}
                  >
                    <Text variant="small" weight="bold" color={colors.primary}>
                      {allSelected ? labels.clearSelection : labels.selectAll}
                    </Text>
                  </Tappable>
                </View>
                {section.items.map((item) => {
                  const isSelected = selected.has(item.id);
                  return (
                    <Tappable
                      key={item.id}
                      role="checkbox"
                      state={{ checked: isSelected }}
                      label={`${item.name} · ${item.shortLabel ?? item.label}`}
                      onPress={() => toggle(item.id)}
                      style={[styles.checkPickRow, isSelected && styles.checkPickRowSelected]}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected ? <CheckMarkIcon /> : null}
                      </View>
                      <View style={styles.checkFood}>
                        <FoodGlyph name={item.name} category={item.category} size={38} />
                      </View>
                      <Text variant="title" color={colors.text} numberOfLines={1} style={styles.checkPickName}>
                        {item.name}
                      </Text>
                      <Text variant="small" muted numberOfLines={1}>
                        {item.shortLabel ?? item.label}
                      </Text>
                      <Tappable
                        label={labels.edit(item.name)}
                        onPress={() => onItemPress(item)}
                        hitSlop={spacing.sm}
                        style={[styles.checkEditBtn]}
                      >
                        <PencilIcon />
                      </Tappable>
                    </Tappable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
        {/* Always two buttons: Cancel and a disabled Toss until something is
            picked, then Still good and Toss for the picked items. */}
        <View style={styles.checkActionBar}>
          {selected.size > 0 ? (
            <Tappable
              onPress={() => {
                onStillGoodMany(Array.from(selected));
                setSelected(new Set());
              }}
              style={[styles.checkActionBtn, styles.checkKeepBtn]}
            >
              <Text variant="label">{labels.stillGoodCount(selected.size)}</Text>
            </Tappable>
          ) : (
            <Tappable onPress={onDismiss} style={[styles.checkActionBtn, styles.checkKeepBtn]}>
              <Text variant="label">{labels.cancel}</Text>
            </Tappable>
          )}
          <Tappable
            disabled={selected.size === 0}
            onPress={() => setConfirmingToss(true)}
            style={[styles.checkActionBtn, styles.checkTossBtn, selected.size === 0 && styles.checkTossIdle]}
          >
            <Text variant="label" color={colors.onPrimary}>{labels.tossCount(selected.size)}</Text>
          </Tappable>
        </View>
      </View>
    </BottomSheet>
  );
}

function CheckMarkIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M2.5 6.5 5 9l4.5-6" stroke={colors.onPrimary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PencilIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M9.8 3.2 12.8 6.2M3 13l.6-3 7.6-7.6a1.5 1.5 0 0 1 2.1 0l.3.3a1.5 1.5 0 0 1 0 2.1L6 12.4 3 13Z"
        stroke={colors.muted}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ItemActionSheet({
  group,
  labels,
  onDismiss,
  onSave,
  onRemove,
  onAddToList,
}: {
  group: InventoryGroup | null;
  labels: {
    save: string;
    cancel: string;
    remove: string;
    addToList: string;
    removeTitle: string;
    removeBody: string;
    usedConfirm: string;
    discardedConfirm: string;
    nameLabel: string;
    quantityLabel: string;
    unitLabel: string;
    netLabel: string;
    expiryLabel: string;
    expiryNone: string;
    partialLabel: string;
    partialFull: string;
    partialSomeUsed: string;
    partialLow: string;
  };
  onDismiss: () => void;
  onSave: (
    group: InventoryGroup,
    input: { name: string; quantity: number; unit: string; expiresAt: string | null; netAmount?: number; partialState?: PartialState },
  ) => Promise<void>;
  onRemove: (group: InventoryGroup, reason: "used" | "discarded") => void;
  onAddToList: (group: InventoryGroup) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("item");
  const [netInput, setNetInput] = useState("");
  const [partialState, setPartialState] = useState<PartialState>("full");
  const [expiry, setExpiry] = useState<Date | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [lastKey, setLastKey] = useState(group?.key);

  // Reset the form whenever a different item opens the sheet.
  if (group?.key !== lastKey) {
    setLastKey(group?.key);
    const lot = group?.lots[0];
    setName(group?.name ?? "");
    setQuantity(lot ? String(lot.quantity) : "");
    setUnit(group?.unit ?? "item");
    setNetInput(lot?.net_amount != null ? String(lot.net_amount) : "");
    setPartialState(lot?.partial_state ?? "full");
    setExpiry(lot?.expires_at ? parseLocalDate(lot.expires_at) : null);
    setConfirmingRemove(false);
  }

  const isPrecise = group?.netAmount != null && group.netUnit === "g";
  // "How much is left" only means something for a single item with no size:
  // that's the one case cooking can't subtract from, so it walks full → some
  // used → low instead. More than one, or a known size, is tracked exactly.
  const showPartial = !isPrecise && Number(quantity.replace(",", ".")) === 1;

  if (confirmingRemove) {
    return (
      <BottomSheet visible={Boolean(group)} onDismiss={onDismiss}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetCopy}>
            <Text variant="h3">{labels.removeTitle}</Text>
            <Text variant="body" muted>
              {group ? labels.removeBody.replace("{{item}}", group.name) : labels.removeBody}
            </Text>
          </View>
          <View style={styles.sheetButtons}>
            <Button title={labels.usedConfirm} onPress={() => group && onRemove(group, "used")} />
            <Button title={labels.discardedConfirm} variant="accent" onPress={() => group && onRemove(group, "discarded")} />
            <Button title={labels.cancel} variant="text" onPress={() => setConfirmingRemove(false)} />
          </View>
        </View>
      </BottomSheet>
    );
  }

  const tone = categoryColors[toUiCategory(group?.category ?? "other") as CategoryTone] ?? categoryColors.other;

  return (
    <BottomSheet visible={Boolean(group)} onDismiss={onDismiss}>
      <View style={styles.sheetContent}>
        <View style={styles.itemHead}>
          <View style={[styles.itemTile, { backgroundColor: tone.background }]}>
            <FoodGlyph name={group?.name ?? ""} category={group?.category} color={tone.mark} size={34} />
          </View>
          <View style={styles.itemHeadCopy}>
            <Text variant="h3" numberOfLines={2}>
              {group?.name}
            </Text>
            {group?.meta ? (
              <Text variant="small" muted numberOfLines={1}>
                {group.meta}
              </Text>
            ) : null}
          </View>
        </View>

        <TextField label={labels.nameLabel} value={name} onChangeText={setName} boxStyle={styles.whiteField} />

        <View style={styles.netRow}>
          <TextField
            label={labels.quantityLabel}
            keyboardType="decimal-pad"
            value={quantity}
            onChangeText={setQuantity}
            containerStyle={styles.netField}
            boxStyle={styles.whiteField}
          />
          <UnitPicker label={labels.unitLabel} value={unit} onChange={setUnit} containerStyle={styles.netField} boxStyle={styles.whiteField} />
        </View>

        {isPrecise ? (
          <TextField
            label={`${labels.netLabel} (${group?.netUnit})`}
            keyboardType="decimal-pad"
            value={netInput}
            onChangeText={setNetInput}
            boxStyle={styles.whiteField}
          />
        ) : null}

        {/* Set by hand how much of an opened item is left (C4). */}
        {showPartial ? (
          <View style={styles.partialField}>
            <Text variant="micro" muted uppercase>
              {labels.partialLabel}
            </Text>
            <SegmentedControl<PartialState>
              options={[
                { label: labels.partialFull, value: "full" },
                { label: labels.partialSomeUsed, value: "some_used" },
                { label: labels.partialLow, value: "low" },
              ]}
              value={partialState}
              onChange={setPartialState}
            />
          </View>
        ) : null}

        <DateField
          label={labels.expiryLabel}
          value={expiry}
          placeholder={labels.expiryNone}
          onChange={setExpiry}
          onClear={() => setExpiry(null)}
          clearLabel={labels.expiryNone}
        />

        <View style={styles.sheetButtons}>
          <Button
            title={labels.save}
            onPress={() => {
              if (!group) return;
              const lot = group.lots[0];
              const qty = Number(quantity.replace(",", "."));
              const nextQuantity = Number.isFinite(qty) && qty > 0 ? qty : lot?.quantity ?? 1;
              let net = Number(netInput.replace(",", "."));
              // Quantity changed but the size wasn't touched: scale the size
              // with it (2 packs = 500 g → 3 packs = 750 g) (C2).
              const netUntouched = lot?.net_amount != null && net === lot.net_amount;
              if (netUntouched && lot && lot.quantity > 0 && nextQuantity !== lot.quantity) {
                net = Number(((lot.net_amount as number) * (nextQuantity / lot.quantity)).toFixed(2));
              }
              void onSave(group, {
                name,
                quantity: nextQuantity,
                unit: normalizeUnit(unit),
                expiresAt: expiry ? toLocalDateString(expiry) : null,
                netAmount: isPrecise && net > 0 ? net : undefined,
                partialState: showPartial ? partialState : undefined,
              });
            }}
          />
          <Button title={labels.cancel} variant="text" onPress={onDismiss} />
        </View>

        <Tappable
          label={labels.addToList}
          onPress={() => {
            if (group) onAddToList(group);
          }}
          style={[styles.removeRow]}
        >
          <CartIcon size={20} />
          <Text variant="label" color={colors.primary}>
            {labels.addToList}
          </Text>
        </Tappable>

        <Tappable
          label={labels.remove}
          onPress={() => setConfirmingRemove(true)}
          style={[styles.removeRow]}
        >
          <TrashIcon />
          <Text variant="label" color={colors.redInk}>
            {labels.remove}
          </Text>
        </Tappable>
      </View>
    </BottomSheet>
  );
}

function toLocalDateString(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

// Earliest explicit expiry date across a group's lots, if any lot has one.
function earliestExpiry(lots: InventoryGroup["lots"]): string | null {
  const dates = lots.map((lot) => lot.expires_at).filter((date): date is string => date != null);
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

// Same format the item edit sheet uses for its expiry field.
function formatExpiryDate(value: string) {
  return parseLocalDate(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function buildCategoryShelves(groups: InventoryGroup[], t: ReturnType<typeof useTranslation>["t"]) {
  return CATEGORY_ORDER
    .map((category) => ({
      category,
      name: t(`scan.categories.${category}` as any),
      groups: groups.filter((group) => group.category === category),
    }))
    .filter((shelf) => shelf.groups.length > 0);
}

function getCardMetaLines(meta: string) {
  return meta.split(" · ").slice(0, 2);
}

// Urgent items only — these are the ones worth a dedicated, actionable block
// ("Cook with these"). Soonest-expiring first. Soon/fresh live in the pulse
// overview and the category shelves below.
function isUseSoon(group: InventoryGroup) {
  return group.urgency === "urgent" || group.urgency === "use_soon";
}

function sortBySoonest(groups: InventoryGroup[]) {
  return [...groups].sort((a, b) => groupDaysLeft(a) - groupDaysLeft(b));
}

// Soonest-running-out lot in the group (explicit date or estimate).
function groupDaysLeft(group: InventoryGroup) {
  return Math.min(...group.lots.map((lot) => daysLeft(lot)));
}

function shelfLifeStart(range: string) {
  const firstNumber = Number(range.match(/\d+/)?.[0]);
  return Number.isFinite(firstNumber) ? firstNumber : 999;
}

function computeBestByLabel(group: InventoryGroup, t: ReturnType<typeof useTranslation>["t"]): string {
  // In the grace window after a real date: don't call it "best today" (B3).
  if (hasExplicitExpiredLot(group.lots)) return t("fridge.bestBy.pastDate");
  const oldestLot = group.lots.reduce((oldest, lot) =>
    new Date(lot.added_at) < new Date(oldest.added_at) ? lot : oldest,
  );

  let remaining: number;
  if (oldestLot.expires_at) {
    const expiry = new Date(`${oldestLot.expires_at}T23:59:59`);
    remaining = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86_400_000));
  } else {
    const catalog = getCatalogFood(group.name);
    const maxDays = catalog?.shelfLifeDays[1] ?? shelfLifeStart(group.shelfLifeRange);
    const ageDays = Math.floor((Date.now() - new Date(oldestLot.added_at).getTime()) / 86_400_000);
    remaining = Math.max(0, maxDays - ageDays);
  }

  if (remaining <= 0) return t("fridge.bestBy.today");
  if (remaining === 1) return t("fridge.bestBy.tomorrow");
  return t("fridge.bestBy.inDays", { count: remaining });
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM12.5 12.5L16 16" stroke={colors.muted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M3.5 5H14.5M7 2.5H11M7.5 8V12.5M10.5 8V12.5M4.5 5L5.2 14.2A1.3 1.3 0 0 0 6.5 15.4H11.5A1.3 1.3 0 0 0 12.8 14.2L13.5 5" stroke={colors.redInk} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function getActionLabels(t: ReturnType<typeof useTranslation>["t"]) {
  return {
    save: t("fridge.actions.save"),
    cancel: t("common.cancel"),
    remove: t("fridge.actions.remove"),
    addToList: t("shopping.addToList"),
    removeTitle: t("fridge.removeSheet.title"),
    removeBody: t("fridge.removeSheet.body"),
    usedConfirm: t("fridge.removeSheet.usedConfirm"),
    discardedConfirm: t("fridge.removeSheet.discardedConfirm"),
    nameLabel: t("fridge.actions.nameLabel"),
    quantityLabel: t("fridge.actions.quantityLabel"),
    unitLabel: t("scan.manual.unitLabel"),
    netLabel: t("fridge.actions.netLabel"),
    expiryLabel: t("fridge.actions.expiryLabel"),
    expiryNone: t("fridge.actions.expiryNone"),
    partialLabel: t("fridge.actions.partialLabel"),
    partialFull: t("fridge.meta.full"),
    partialSomeUsed: t("fridge.meta.someUsed"),
    partialLow: t("fridge.meta.low"),
  };
}

const styles = StyleSheet.create({
  partialField: {
    gap: spacing.xs,
  },
  content: {
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.tabBarClearance,
    gap: spacing.xl,
  },
  cookNextWrap: {
    paddingHorizontal: spacing.screenX,
  },
  // Solid tomato, no shadow, like the home's goal block.
  cookNext: {
    overflow: "hidden",
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cookNextCopy: {
    width: "64%",
    gap: spacing.xxs,
  },
  cookNextBody: {
    opacity: 0.85,
  },
  cookNextArt: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "38%",
  },
  cookNextBlob: {
    position: "absolute",
    right: -36,
    bottom: -44,
    width: 150,
    height: 150,
    borderRadius: radii.pill,
    backgroundColor: colors.primary700,
  },
  cookNextSpark: {
    position: "absolute",
    top: spacing.sm,
    left: 0,
  },
  cookNextTomato: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
  },
  cookNextMushroom: {
    position: "absolute",
    bottom: spacing.md,
    right: 64,
  },
  cookNextButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
  },
  safetyNote: {
    paddingHorizontal: spacing.screenX,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: radii.lg,
    minHeight: 52,
    ...shadows.soft,
  },
  searchFieldFocused: {
    borderColor: colors.primary,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.md,
    ...typography.body,
  },
  savedRowPressed: {
    opacity: 0.85,
  },
  header: {
    paddingHorizontal: spacing.screenX,
  },
  headerRow: {
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
  headerActions: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summary: {
    marginTop: spacing.md,
  },
  searchWrap: {
    paddingHorizontal: spacing.screenX,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: radii.md,
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.screenX,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsCopy: {
    flex: 1,
    minWidth: 0,
  },
  soon: {
    gap: spacing.xs,
  },
  soonHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
  },
  // Vertical padding leaves room for the cards' shadow inside the scroller.
  soonRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  soonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    paddingRight: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  soonFood: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  soonCopy: {
    maxWidth: 148,
    gap: 2,
  },
  soonMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  soonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tilesSection: {
    marginHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  tilesHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tile: {
    // Four per row: a quarter of the row minus the gaps.
    width: "23.4%",
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxs,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  refreshButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    justifyContent: "center",
  },
  centerState: {
    paddingHorizontal: spacing.screenX,
    alignItems: "center",
    gap: spacing.md,
  },
  sheetContent: {
    gap: spacing.lg,
  },
  sheetCopy: {
    gap: spacing.sm,
  },
  removeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minHeight: 50,
    borderRadius: radii.lg,
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  itemTile: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  itemHeadCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  whiteField: {
    backgroundColor: colors.surface2,
    borderRadius: radii.lg,
  },
  sheetButtons: {
    gap: spacing.sm,
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterChoice: {
    width: "48%",
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  filterChoiceActive: {
    backgroundColor: colors.primary,
  },
  filterChoicePressed: {
    opacity: 0.78,
  },
  fullShelfScroll: {
    maxHeight: 520,
  },
  checkSection: {
    gap: spacing.xxs,
    marginBottom: spacing.md,
  },
  checkHeadCopy: {
    gap: spacing.xs,
  },
  checkFood: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  checkSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Plain rows straight on the sheet, no cards or outlines; a picked row
  // gets a soft peach fill.
  checkPickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginHorizontal: -spacing.xs,
    borderRadius: radii.lg,
  },
  checkPickRowSelected: {
    backgroundColor: colors.surface2,
  },
  checkPickName: {
    flex: 1,
  },
  checkEditBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  // Like the reference: a light rounded square, thin warm-grey outline.
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkActionBar: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  checkActionBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  checkKeepBtn: {
    backgroundColor: colors.surface2,
  },
  checkTossBtn: {
    flex: 1.35,
    backgroundColor: colors.primary,
  },
  checkTossIdle: {
    opacity: 0.5,
  },
  checkSheetList: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  netRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  netField: {
    flex: 1,
  },
  fieldBox: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  expiryPressed: {
    opacity: 0.78,
  },
});
