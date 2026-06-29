import { useCallback, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import DateTimePicker from "@react-native-community/datetimepicker";

import { BottomSheet, Button, EatFirstShelf, EmptyFridge, FoodCard, GeneratingLoader, IconButton, RetentionCard, Screen, ScreenHeader, ShelfRow, Text, TextField, UnitPicker } from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { normalizeUnit } from "@/lib";
import { useHousehold, useInsights, useInventory, useRetention } from "@/hooks";
import {
  getCatalogFood,
  InventoryGroup,
  isMetricAmountRunningLow,
  toUiCategory,
  toUiUrgency,
} from "@/services";
import { colors, radii, spacing } from "@/theme";
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
    removeGroup,
    refresh,
  } = useInventory(activeHousehold?.id);
  const prototypeDay = profile?.prototype_day ?? 1;
  const { day1Suggestion, showDay5Nudge, day7Recap } = useRetention(
    prototypeDay,
    activeHousehold?.id,
    groups,
    profile?.primary_goal ?? null,
  );
  const [actionGroup, setActionGroup] = useState<InventoryGroup | null>(null);
  const [expandedShelf, setExpandedShelf] = useState<{ name: string; groups: InventoryGroup[] } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const filteredGroups = categoryFilter === "all" ? groups : groups.filter((group) => group.category === categoryFilter);
  const isPremium = resolvePremium(profile, activeHousehold);
  const { weeklySummary, refresh: refreshInsights } = useInsights(activeHousehold?.id);
  const eatFirstGroups = getEatFirstGroups(filteredGroups);
  const runningLowGroups = filteredGroups.filter(isMetricAmountRunningLow);
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
        eyebrow={profile?.display_name ? t("fridge.greetingWithName", { name: profile.display_name }) : t("fridge.greeting")}
        title={t("fridge.homeTitle")}
        actions={
          <>
            <IconButton label={t("fridge.filter.title")} onPress={() => setFilterOpen(true)}><FilterIcon active={categoryFilter !== "all"} /></IconButton>
            <IconButton label={t("fridge.refresh")} onPress={refresh}><RefreshIcon /></IconButton>
          </>
        }
      />

      {weeklySummary && weeklySummary.itemsSaved > 0 ? (
        <Pressable
          accessibilityRole="button"
          style={styles.statsStrip}
          onPress={isPremium ? () => router.push("/(tabs)/insights") : undefined}
        >
          <View style={styles.statsIcon}>
            <Svg width={22} height={22} viewBox="0 0 16 16" fill="none">
              <Path d="M2 12 L6 7 L10 9 L14 3" stroke={colors.surface} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text variant="label" color={colors.primary}>
            {t("fridge.statsStrip.title", { count: weeklySummary.itemsSaved })}
          </Text>
        </Pressable>
      ) : null}

      {groups.length > 0 ? (
        <EatFirstShelf
          premium={isPremium}
          items={eatFirstGroups.map((group) => ({
            id: group.key,
            name: group.name,
            category: toUiCategory(group.category),
            note: group.meta,
            bestBy: computeBestByLabel(group, t),
            urgency: toUiUrgency(group.urgency),
          }))}
          labels={{
            premium: t("fridge.eatFirstPremium"),
            title: t("fridge.eatFirstTitle"),
            itemCount: (count) => t("fridge.eatFirstCount", { count }),
            previewTitle: t("fridge.eatFirstPreviewTitle"),
            previewBody: t("fridge.eatFirstPreviewBody"),
            unlockAction: t("fridge.eatFirstUnlock"),
          }}
          onItemPress={(item) => setActionGroup(groups.find((group) => group.key === item.id) ?? null)}
          onUpgradePress={() => router.push("/(tabs)/settings")}
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

      {day1Suggestion && !showDay5Nudge && !day7Recap ? (
        <View style={styles.retentionWrap}>
          <RetentionCard
            title={t("retention.day1Title")}
            body={t("retention.day1Body", { body: day1Suggestion.body })}
            actionLabel={t("retention.day1Action")}
            onAction={() => router.push({ pathname: "/(tabs)/recipes", params: { autoGenerate: "1" } })}
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
        onRemove={async (group) => {
          await removeGroup(group);
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

      <CategoryFilterSheet
        visible={filterOpen}
        selected={categoryFilter}
        groups={groups}
        labels={{
          title: t("fridge.filter.title"),
          all: t("fridge.filter.all"),
        }}
        t={t}
        onSelect={(category) => {
          setCategoryFilter(category);
          setFilterOpen(false);
        }}
        onDismiss={() => setFilterOpen(false)}
      />
    </Screen>
  );
}

function CategoryShelf({
  name,
  groups,
  moreLabel,
  showAddedBy,
  onItemPress,
  onMorePress,
}: {
  name: string;
  groups: InventoryGroup[];
  moreLabel: string;
  showAddedBy: boolean;
  onItemPress: (group: InventoryGroup) => void;
  onMorePress: () => void;
}) {
  return (
    <ShelfRow
      name={name}
      count={groups.length}
      layout="grid"
      maxVisibleItems={6}
      moreLabel={moreLabel}
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
    removeConfirm: string;
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
  onRemove: (group: InventoryGroup) => void;
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
            <Button title={labels.removeConfirm} variant="accent" onPress={() => group && onRemove(group)} />
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

function CategoryFilterSheet({
  visible,
  selected,
  groups,
  labels,
  t,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  selected: CategoryFilter;
  groups: InventoryGroup[];
  labels: {
    title: string;
    all: string;
  };
  t: ReturnType<typeof useTranslation>["t"];
  onSelect: (category: CategoryFilter) => void;
  onDismiss: () => void;
}) {
  const counts = new Map<CategoryFilter, number>([["all", groups.length]]);
  for (const group of groups) {
    counts.set(group.category as CategoryFilter, (counts.get(group.category as CategoryFilter) ?? 0) + 1);
  }

  const options: { key: CategoryFilter; label: string; count: number }[] = [
    { key: "all", label: labels.all, count: groups.length },
    ...CATEGORY_ORDER.map((category) => ({
      key: category,
      label: t(`scan.categories.${category}` as any),
      count: counts.get(category) ?? 0,
    })).filter((option) => option.count > 0),
  ];

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.sheetContent}>
        <Text variant="h2">{labels.title}</Text>
        <View style={styles.filterGrid}>
          {options.map((option) => {
            const active = option.key === selected;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                onPress={() => onSelect(option.key)}
                style={({ pressed }) => [
                  styles.filterChoice,
                  active && styles.filterChoiceActive,
                  pressed && styles.filterChoicePressed,
                ]}
              >
                <Text variant="label" color={active ? colors.surface : colors.primary}>
                  {option.label}
                </Text>
                <Text variant="micro" color={active ? colors.surface : colors.muted}>
                  {option.count}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

function getCardMetaLines(meta: string) {
  return meta.split(" · ").slice(0, 2);
}

function getEatFirstGroups(groups: InventoryGroup[]) {
  const urgentOrSoon = groups.filter((group) => group.urgency === "urgent" || group.urgency === "use_soon");
  if (urgentOrSoon.length > 0) return urgentOrSoon.slice(0, 3);

  const lowRiskCategories = new Set(["pantry", "frozen", "drinks"]);
  return groups
    .filter((group) => !lowRiskCategories.has(group.category))
    .sort((a, b) => shelfLifeStart(a.shelfLifeRange) - shelfLifeStart(b.shelfLifeRange))
    .slice(0, 3);
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
  // An explicit expiry date wins over shelf-life estimation (CODE_REVIEW #3) —
  // otherwise the badge can disagree with the card's urgency.
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

function FilterIcon({ active }: { active: boolean }) {
  const color = active ? colors.accent : colors.primary;
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M3 4.5H15M5.5 9H12.5M7.5 13.5H10.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
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
    removeConfirm: t("fridge.removeSheet.confirm"),
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
  statsStrip: {
    marginHorizontal: spacing.screenX,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface2,
    borderRadius: radii.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  statsIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
