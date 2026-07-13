import { useCallback, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import DateTimePicker from "@react-native-community/datetimepicker";

import { BottomSheet, Button, CheckTheseShelf, EatFirstShelf, EmptyFridge, FoodCard, GeneratingLoader, IconButton, KitchenPulse, RetentionCard, Screen, ScreenHeader, ShelfRow, Text, TextField, UnitPicker } from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { normalizeUnit } from "@/lib";
import { useHousehold, useInsights, useInventory, useRetention } from "@/hooks";
import {
  getCatalogFood,
  hasExplicitExpiredLot,
  InventoryGroup,
  isMetricAmountRunningLow,
  toUiCategory,
  toUiUrgency,
} from "@/services";
import { colors, fonts, radii, spacing } from "@/theme";
import { router, useFocusEffect } from "expo-router";

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

type CategoryFilter = "all" | (typeof CATEGORY_ORDER)[number];

export default function FridgeRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold } = useAuth();
  const {
    loading,
    groups,
    error,
    updateFirstLot,
    markGroupStillGood,
    removeGroup,
    refresh,
  } = useInventory(activeHousehold?.id);
  const prototypeDay = profile?.prototype_day ?? 1;
  const { showDay5Nudge, day7Recap } = useRetention(
    prototypeDay,
    activeHousehold?.id,
    groups,
    profile?.primary_goal ?? null,
  );
  const [actionGroup, setActionGroup] = useState<InventoryGroup | null>(null);
  const [expandedShelf, setExpandedShelf] = useState<{ name: string; groups: InventoryGroup[] } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const query = search.trim().toLowerCase();
  // Expired groups leave the category shelves, chips, and filters entirely —
  // they live in the "Check these" block below eat-first.
  const expiredGroups = groups.filter((group) => group.urgency === "expired");
  const activeGroups = groups.filter((group) => group.urgency !== "expired");
  const filteredGroups = activeGroups.filter(
    (group) =>
      (categoryFilter === "all" || group.category === categoryFilter) &&
      (!query || group.name.toLowerCase().includes(query)),
  );
  const isPremium = resolvePremium(profile, activeHousehold);
  const { refresh: refreshInsights } = useInsights(activeHousehold?.id);
  // Eat-first is global (urgency, not the active category/search filter).
  const eatFirstGroups = getEatFirstGroups(groups);
  const runningLowGroups = filteredGroups.filter(isMetricAmountRunningLow);
  // Category chips: counts per category, only those present.
  const categoryCounts = new Map<CategoryFilter, number>();
  for (const group of activeGroups) {
    categoryCounts.set(group.category as CategoryFilter, (categoryCounts.get(group.category as CategoryFilter) ?? 0) + 1);
  }
  const categoryChips: { key: CategoryFilter; label: string; count: number }[] = [
    { key: "all", label: t("fridge.filter.all"), count: activeGroups.length },
    ...CATEGORY_ORDER.map((category) => ({
      key: category as CategoryFilter,
      label: t(`scan.categories.${category}` as never),
      count: categoryCounts.get(category as CategoryFilter) ?? 0,
    })).filter((option) => option.count > 0),
  ];
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
  const weekday = new Date().toLocaleDateString(undefined, { weekday: "long" });
  const categoryShelves = buildCategoryShelves(filteredGroups, t);
  const { members } = useHousehold(activeHousehold?.id);
  const showAddedBy = members.length > 1;

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshInsights();
    }, [refresh, refreshInsights]),
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
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      <ScreenHeader
        style={styles.header}
        eyebrow={`${t("fridge.greeting")} · ${weekday}`}
        title={t("fridge.homeTitle")}
        actions={<IconButton label={t("fridge.refresh")} onPress={refresh}><RefreshIcon /></IconButton>}
      />

      {groups.length > 0 ? (
        <View style={styles.searchRow}>
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
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("fridge.addItem")}
            onPress={() => router.push("/(tabs)/scan")}
            style={({ pressed }) => [styles.addButton, pressed && styles.savedRowPressed]}
          >
            <PlusIcon />
          </Pressable>
        </View>
      ) : null}

      {groups.length > 0 ? (
        <View style={styles.pulseWrap}>
          <KitchenPulse
            fresh={pulse.fresh}
            soon={pulse.soon}
            urgent={pulse.urgent}
            labels={{
              today: t("fridge.kitchenPulse.today"),
              soon: t("fridge.kitchenPulse.soon"),
              fresh: t("fridge.kitchenPulse.fresh"),
              total: (count) => t("fridge.kitchenPulse.total", { count }),
            }}
          />
        </View>
      ) : null}

      {(isPremium ? eatFirstGroups.length > 0 : groups.length > 0) ? (
        <EatFirstShelf
          premium={isPremium}
          items={eatFirstGroups.map((group) => ({
            id: group.key,
            name: group.name,
            category: toUiCategory(group.category),
            bestBy: computeBestByLabel(group, t),
          }))}
          labels={{
            kicker: t("fridge.eatFirstTitle"),
            subtitle: t("fridge.eatFirstSubtitle"),
            heading: (count) => t("fridge.eatFirstHeading", { count }),
            cookCta: t("fridge.eatFirstCook"),
            previewTitle: t("fridge.eatFirstPreviewTitle"),
            previewBody: t("fridge.eatFirstPreviewBody"),
            unlockAction: t("fridge.eatFirstUnlock"),
          }}
          onItemPress={(item) => setActionGroup(groups.find((group) => group.key === item.id) ?? null)}
          onCook={() => router.push({ pathname: "/(tabs)/recipes", params: { autoGenerate: "1" } })}
          onUpgradePress={() => router.push("/(tabs)/settings")}
        />
      ) : null}

      {expiredGroups.length > 0 ? (
        <CheckTheseShelf
          items={expiredGroups.map((group) => ({
            id: group.key,
            name: group.name,
            category: toUiCategory(group.category),
            label: hasExplicitExpiredLot(group.lots)
              ? t("fridge.meta.expired")
              : t("fridge.checkThese.pastBest"),
          }))}
          labels={{
            kicker: t("fridge.checkThese.title"),
            subtitle: t("fridge.checkThese.subtitle"),
            stillGood: t("fridge.checkThese.stillGood"),
            toss: t("fridge.checkThese.toss"),
          }}
          onItemPress={(item) => setActionGroup(expiredGroups.find((group) => group.key === item.id) ?? null)}
          onStillGood={(item) => {
            const group = expiredGroups.find((candidate) => candidate.key === item.id);
            if (group) void markGroupStillGood(group);
          }}
          onToss={(item) => {
            const group = expiredGroups.find((candidate) => candidate.key === item.id);
            if (group) void removeGroup(group, "discarded");
          }}
        />
      ) : null}

      {showDay5Nudge && !day7Recap ? (
        <View style={styles.retentionWrap}>
          <RetentionCard
            title={t("retention.day5Title")}
            body={t("retention.day5Body")}
            actionLabel={t("retention.day5Action")}
            onAction={() => router.push({ pathname: "/(tabs)/scan", params: { mode: "receipt" } })}
          />
        </View>
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
          <Text variant="small" color={colors.red} center>
            {error}
          </Text>
        </View>
      ) : null}

      {!loading && !error && groups.length === 0 ? <EmptyFridge /> : null}

      {groups.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {categoryChips.map((chip) => {
            const active = chip.key === categoryFilter;
            return (
              <Pressable
                key={chip.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCategoryFilter(chip.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text variant="label" color={active ? colors.surface : colors.text}>{chip.label}</Text>
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text variant="micro" color={active ? colors.surface : colors.muted}>{chip.count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {runningLowGroups.length > 0 ? (
        <CategoryShelf
          name={t("fridge.shelves.runningLow")}
          groups={runningLowGroups}
          moreLabel={t("fridge.shelves.more")}
          showAddedBy={showAddedBy}
          onItemPress={(group) => setActionGroup(group)}
          onMorePress={() => setExpandedShelf({ name: t("fridge.shelves.runningLow"), groups: runningLowGroups })}
        />
      ) : null}

      {categoryShelves.map((shelf) => (
        <CategoryShelf
          key={shelf.category}
          name={shelf.name}
          groups={shelf.groups}
          moreLabel={t("fridge.shelves.more")}
          expanded={categoryFilter !== "all"}
          showAddedBy={showAddedBy}
          onItemPress={(group) => setActionGroup(group)}
          onMorePress={() => setExpandedShelf({ name: shelf.name, groups: shelf.groups })}
        />
      ))}

      <ItemActionSheet
        group={actionGroup}
        labels={getActionLabels(t)}
        onDismiss={() => setActionGroup(null)}
        onSave={async (group, input) => {
          await updateFirstLot(group, input);
          setActionGroup(null);
        }}
        onRemove={async (group, reason) => {
          await removeGroup(group, reason);
          setActionGroup(null);
        }}
      />

      <FullShelfSheet
        shelf={expandedShelf}
        showAddedBy={showAddedBy}
        onDismiss={() => setExpandedShelf(null)}
        onItemPress={(group) => {
          setExpandedShelf(null);
          setActionGroup(group);
        }}
      />

      </Screen>
  );
}

function CategoryShelf({
  name,
  groups,
  moreLabel,
  expanded,
  showAddedBy,
  onItemPress,
  onMorePress,
}: {
  name: string;
  groups: InventoryGroup[];
  moreLabel: string;
  expanded?: boolean;
  showAddedBy: boolean;
  onItemPress: (group: InventoryGroup) => void;
  onMorePress: () => void;
}) {
  return (
    <ShelfRow
      name={name}
      count={groups.length}
      layout="grid"
      maxVisibleItems={expanded ? undefined : 6}
      moreLabel={moreLabel}
      showTitle={false}
      items={groups.map((group) => ({
        id: group.key,
        name: group.name,
        category: toUiCategory(group.category),
        meta: group.meta,
        metaLines: getCardMetaLines(group.meta),
        urgency: toUiUrgency(group.urgency),
        addedBy: showAddedBy ? group.lots[0]?.added_by_name ?? null : null,
      }))}
      onItemPress={(item) => {
        const group = groups.find((candidate) => candidate.key === item.id);
        if (group) onItemPress(group);
      }}
      onMorePress={onMorePress}
    />
  );
}

function FullShelfSheet({
  shelf,
  showAddedBy,
  onDismiss,
  onItemPress,
}: {
  shelf: { name: string; groups: InventoryGroup[] } | null;
  showAddedBy: boolean;
  onDismiss: () => void;
  onItemPress: (group: InventoryGroup) => void;
}) {
  return (
    <BottomSheet visible={Boolean(shelf)} onDismiss={onDismiss}>
      <View style={styles.sheetContent}>
        <Text variant="h2">{shelf?.name}</Text>
        <ScrollView style={styles.fullShelfScroll} contentContainerStyle={styles.fullShelfGrid}>
          {shelf?.groups.map((group) => (
            <FoodCard
              key={group.key}
              name={group.name}
              category={toUiCategory(group.category)}
              meta={group.meta}
              metaLines={getCardMetaLines(group.meta)}
              urgency={toUiUrgency(group.urgency)}
              addedBy={showAddedBy ? group.lots[0]?.added_by_name ?? null : null}
              onPress={() => onItemPress(group)}
              style={styles.fullShelfCard}
            />
          ))}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

function ItemActionSheet({
  group,
  labels,
  onDismiss,
  onSave,
  onRemove,
}: {
  group: InventoryGroup | null;
  labels: {
    save: string;
    cancel: string;
    remove: string;
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
    expiryDone: string;
  };
  onDismiss: () => void;
  onSave: (
    group: InventoryGroup,
    input: { name: string; quantity: number; unit: string; expiresAt: string | null; netAmount?: number },
  ) => Promise<void>;
  onRemove: (group: InventoryGroup, reason: "used" | "discarded") => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("item");
  const [netInput, setNetInput] = useState("");
  const [expiry, setExpiry] = useState<Date | null>(null);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
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
    setExpiry(lot?.expires_at ? parseLocalDate(lot.expires_at) : null);
    setShowExpiryPicker(false);
    setConfirmingRemove(false);
  }

  const isPrecise = group?.netAmount != null && group.netUnit != null;

  if (confirmingRemove) {
    return (
      <BottomSheet visible={Boolean(group)} onDismiss={onDismiss}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetCopy}>
            <Text variant="h2">{labels.removeTitle}</Text>
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

  return (
    <BottomSheet visible={Boolean(group)} onDismiss={onDismiss}>
      <View style={styles.sheetContent}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={labels.remove}
          onPress={() => setConfirmingRemove(true)}
          style={({ pressed }) => [styles.removeRow, pressed && styles.expiryPressed]}
        >
          <TrashIcon />
          <Text variant="label" color={colors.red}>
            {labels.remove}
          </Text>
        </Pressable>

        <TextField label={labels.nameLabel} value={name} onChangeText={setName} />

        <View style={styles.netRow}>
          <TextField
            label={labels.quantityLabel}
            keyboardType="number-pad"
            value={quantity}
            onChangeText={setQuantity}
            containerStyle={styles.netField}
          />
          <UnitPicker label={labels.unitLabel} value={unit} onChange={setUnit} containerStyle={styles.netField} />
        </View>

        {isPrecise ? (
          <TextField
            label={`${labels.netLabel} (${group?.netUnit})`}
            keyboardType="number-pad"
            value={netInput}
            onChangeText={setNetInput}
          />
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!expiry) setExpiry(new Date());
            setShowExpiryPicker(true);
          }}
          style={({ pressed }) => [styles.fieldBox, pressed && styles.expiryPressed]}
        >
          <Text variant="micro" muted uppercase>
            {labels.expiryLabel}
          </Text>
          <View style={styles.expiryRow}>
            <Text variant="label" color={expiry ? colors.primary : colors.muted}>
              {expiry
                ? expiry.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                : labels.expiryNone}
            </Text>
            {expiry ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={spacing.sm}
                onPress={() => {
                  setExpiry(null);
                  setShowExpiryPicker(false);
                }}
                style={({ pressed }) => [pressed && styles.expiryPressed]}
              >
                <Text variant="small" muted>
                  {labels.expiryNone}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>

        {showExpiryPicker && expiry && Platform.OS === "android" ? (
          <DateTimePicker
            value={expiry}
            mode="date"
            display="calendar"
            onChange={(_event, date) => {
              setShowExpiryPicker(false);
              if (date) setExpiry(date);
            }}
          />
        ) : null}

        {Platform.OS === "ios" ? (
          <BottomSheet visible={showExpiryPicker && Boolean(expiry)} onDismiss={() => setShowExpiryPicker(false)}>
            <View style={styles.dateSheet}>
              <Text variant="h3" center>
                {labels.expiryLabel}
              </Text>
              <View style={styles.dateCalendarCard}>
                <DateTimePicker
                  value={expiry ?? new Date()}
                  mode="date"
                  display="inline"
                  themeVariant="light"
                  accentColor={colors.primary}
                  onChange={(_event, date) => {
                    if (date) setExpiry(date);
                  }}
                />
              </View>
              <Button title={labels.expiryDone} variant="accent" onPress={() => setShowExpiryPicker(false)} />
            </View>
          </BottomSheet>
        ) : null}

        <View style={styles.sheetButtons}>
          <Button
            title={labels.save}
            variant="accent"
            onPress={() => {
              if (!group) return;
              const qty = Number(quantity.replace(",", "."));
              const net = Number(netInput.replace(",", "."));
              void onSave(group, {
                name,
                quantity: Number.isFinite(qty) && qty > 0 ? qty : group.lots[0]?.quantity ?? 1,
                unit: normalizeUnit(unit),
                expiresAt: expiry ? toLocalDateString(expiry) : null,
                netAmount: isPrecise && net > 0 ? net : undefined,
              });
            }}
          />
          <Button title={labels.cancel} variant="text" onPress={onDismiss} />
        </View>
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
function getEatFirstGroups(groups: InventoryGroup[]) {
  return groups
    .filter((group) => group.urgency === "urgent")
    .sort((a, b) => shelfLifeStart(a.shelfLifeRange) - shelfLifeStart(b.shelfLifeRange));
}

function shelfLifeStart(range: string) {
  const firstNumber = Number(range.match(/\d+/)?.[0]);
  return Number.isFinite(firstNumber) ? firstNumber : 999;
}

function computeBestByLabel(group: InventoryGroup, t: ReturnType<typeof useTranslation>["t"]): string {
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

function RefreshIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M14.5 8A5.5 5.5 0 0 0 4.9 4.4L3 6.2" stroke={colors.primary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.5 10A5.5 5.5 0 0 0 13.1 13.6L15 11.8" stroke={colors.primary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 2.8V6.2H6.4M15 15.2V11.8H11.6" stroke={colors.primary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM12.5 12.5L16 16" stroke={colors.muted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M10 4V16M4 10H16" stroke={colors.surface} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M3.5 5H14.5M7 2.5H11M7.5 8V12.5M10.5 8V12.5M4.5 5L5.2 14.2A1.3 1.3 0 0 0 6.5 15.4H11.5A1.3 1.3 0 0 0 12.8 14.2L13.5 5" stroke={colors.red} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function getActionLabels(t: ReturnType<typeof useTranslation>["t"]) {
  return {
    save: t("fridge.actions.save"),
    cancel: t("common.cancel"),
    remove: t("fridge.actions.remove"),
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
    expiryDone: t("fridge.actions.expiryDone"),
  };
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.tabBarClearance,
    gap: spacing.xl,
  },
  retentionWrap: {
    paddingHorizontal: spacing.screenX,
  },
  pulseWrap: {
    paddingHorizontal: spacing.screenX,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.lg,
    minHeight: 48,
  },
  searchFieldFocused: {
    borderColor: colors.sage,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  savedRowPressed: {
    opacity: 0.85,
  },
  chipsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.paper,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
  },
  chipBadgeActive: {
    backgroundColor: colors.primary700,
  },
  header: {
    paddingHorizontal: spacing.screenX,
  },
  refreshButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    justifyContent: "center",
  },
  centerState: {
    paddingHorizontal: spacing.screenX,
    alignItems: "center",
    gap: spacing.md,
  },
  sheetContent: {
    gap: spacing.xl,
  },
  sheetCopy: {
    gap: spacing.sm,
  },
  removeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
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
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  filterChoiceActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterChoicePressed: {
    opacity: 0.78,
  },
  fullShelfScroll: {
    maxHeight: 520,
  },
  fullShelfGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  fullShelfCard: {
    width: "31.5%",
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
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  expiryPressed: {
    opacity: 0.78,
  },
  dateSheet: {
    gap: spacing.lg,
  },
  dateCalendarCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
