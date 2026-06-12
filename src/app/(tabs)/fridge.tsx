import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { BottomSheet, Button, EatFirstShelf, FoodCard, GeneratingLoader, IconButton, RetentionCard, Screen, ScreenHeader, ShelfRow, Text, TextField } from "@/components";
import { isPremium as resolvePremium, useAuth, useMeasurementSystem } from "@/features";
import { updateInventoryNetAmount } from "@/repositories";
import { useHousehold, useInsights, useInventory, useRetention } from "@/hooks";
import {
  formatAmount,
  getCatalogFood,
  InventoryGroup,
  isMetricAmountRunningLow,
  PartialState,
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
  const { system } = useMeasurementSystem();
  const {
    loading,
    groups,
    error,
    addDemoItem,
    useFirstLot: consumeFirstLot,
    setFirstLotPartialState,
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
  const [partialGroup, setPartialGroup] = useState<InventoryGroup | null>(null);
  const [actionGroup, setActionGroup] = useState<InventoryGroup | null>(null);
  const [removeGroupTarget, setRemoveGroupTarget] = useState<InventoryGroup | null>(null);
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

  return (
    <Screen scroll padded={false} contentContainerStyle={styles.content}>
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
            onAction={() => router.push("/(tabs)/recipes")}
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

      {!loading && !error && groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="h2" center>
            {t("fridge.emptyTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("fridge.emptyBody")}
          </Text>
          <FoodCard
            name={t("fridge.demoItemName")}
            category="dairy-eggs"
            meta={t("fridge.emptyMeta")}
            urgency="useSoon"
            size="large"
            onPress={() => addDemoItem(t("fridge.demoItemName"))}
          />
        </View>
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
          showAddedBy={showAddedBy}
          onItemPress={(group) => setActionGroup(group)}
          onMorePress={() => setExpandedShelf({ name: shelf.name, groups: shelf.groups })}
        />
      ))}

      <ItemActionSheet
        group={actionGroup}
        labels={getActionLabels(t)}
        system={system}
        onDismiss={() => setActionGroup(null)}
        onUse={async (group) => {
          await consumeFirstLot(group);
          setActionGroup(null);
        }}
        onPartial={(group) => {
          setActionGroup(null);
          setPartialGroup(group);
        }}
        onRemove={(group) => {
          setActionGroup(null);
          setRemoveGroupTarget(group);
        }}
        onOverrideNet={async (itemId, netAmount) => {
          await updateInventoryNetAmount(itemId, netAmount);
          await refresh();
          setActionGroup(null);
        }}
      />

      <PartialSheet
        group={partialGroup}
        labels={{
          title: t("fridge.partialSheet.title"),
          body: t("fridge.partialSheet.body"),
          full: t("fridge.partialSheet.full"),
          someUsed: t("fridge.partialSheet.someUsed"),
          low: t("fridge.partialSheet.low"),
          cancel: t("common.cancel"),
        }}
        onDismiss={() => setPartialGroup(null)}
        onSelect={async (partialState) => {
          if (!partialGroup) return;
          await setFirstLotPartialState(partialGroup, partialState);
          setPartialGroup(null);
        }}
      />

      <RemoveSheet
        group={removeGroupTarget}
        labels={{
          title: t("fridge.removeSheet.title"),
          body: t("fridge.removeSheet.body"),
          confirm: t("fridge.removeSheet.confirm"),
          cancel: t("common.cancel"),
        }}
        onDismiss={() => setRemoveGroupTarget(null)}
        onConfirm={async () => {
          if (!removeGroupTarget) return;
          await removeGroup(removeGroupTarget);
          setRemoveGroupTarget(null);
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

function PartialSheet({
  group,
  labels,
  onDismiss,
  onSelect,
}: {
  group: InventoryGroup | null;
  labels: {
    title: string;
    body: string;
    full: string;
    someUsed: string;
    low: string;
    cancel: string;
  };
  onDismiss: () => void;
  onSelect: (partialState: PartialState) => Promise<void>;
}) {
  return (
    <BottomSheet visible={Boolean(group)} onDismiss={onDismiss}>
      <View style={styles.sheetContent}>
        <View style={styles.sheetCopy}>
          <Text variant="h2">{labels.title}</Text>
          <Text variant="body" muted>
            {group ? labels.body.replace("{{item}}", group.name) : labels.body}
          </Text>
        </View>
        <View style={styles.sheetButtons}>
          <Button title={labels.full} variant="ghost" onPress={() => onSelect("full")} />
          <Button title={labels.someUsed} variant="ghost" onPress={() => onSelect("some_used")} />
          <Button title={labels.low} variant="accent" onPress={() => onSelect("low")} />
          <Button title={labels.cancel} variant="text" onPress={onDismiss} />
        </View>
      </View>
    </BottomSheet>
  );
}

function RemoveSheet({
  group,
  labels,
  onDismiss,
  onConfirm,
}: {
  group: InventoryGroup | null;
  labels: {
    title: string;
    body: string;
    confirm: string;
    cancel: string;
  };
  onDismiss: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <BottomSheet visible={Boolean(group)} onDismiss={onDismiss}>
      <View style={styles.sheetContent}>
        <View style={styles.sheetCopy}>
          <Text variant="h2">{labels.title}</Text>
          <Text variant="body" muted>
            {group ? labels.body.replace("{{item}}", group.name) : labels.body}
          </Text>
        </View>
        <View style={styles.sheetButtons}>
          <Button title={labels.confirm} onPress={onConfirm} />
          <Button title={labels.cancel} variant="text" onPress={onDismiss} />
        </View>
      </View>
    </BottomSheet>
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
  system,
  onDismiss,
  onUse,
  onPartial,
  onRemove,
  onOverrideNet,
}: {
  group: InventoryGroup | null;
  labels: { use: string; partial: string; remove: string; netLabel: string; saveNet: string };
  system: "metric" | "imperial";
  onDismiss: () => void;
  onUse: (group: InventoryGroup) => Promise<void>;
  onPartial: (group: InventoryGroup) => void;
  onRemove: (group: InventoryGroup) => void;
  onOverrideNet: (itemId: string, netAmount: number) => Promise<void>;
}) {
  const [netInput, setNetInput] = useState("");
  const [lastKey, setLastKey] = useState(group?.key);
  if (group?.key !== lastKey) {
    setLastKey(group?.key);
    const firstLotNet = group?.lots[0]?.net_amount;
    setNetInput(firstLotNet != null ? String(firstLotNet) : "");
  }

  const isPrecise = group?.netAmount != null && group.netUnit != null;

  return (
    <BottomSheet visible={Boolean(group)} onDismiss={onDismiss}>
      <View style={styles.sheetContent}>
        <View style={styles.sheetCopy}>
          <Text variant="h2">{group?.name}</Text>
          <Text variant="body" muted>
            {group?.meta}
          </Text>
          {isPrecise && group ? (
            <Text variant="small" muted>
              {formatAmount(group.netAmount as number, group.netUnit as "ml" | "g", system)}
            </Text>
          ) : null}
        </View>
        {isPrecise && group ? (
          <View style={styles.netRow}>
            <TextField
              label={labels.netLabel}
              keyboardType="number-pad"
              value={netInput}
              onChangeText={setNetInput}
              containerStyle={styles.netField}
            />
            <Button
              title={labels.saveNet}
              variant="ghost"
              onPress={async () => {
                const value = Number(netInput);
                if (!group.lots[0] || !(value > 0)) return;
                await onOverrideNet(group.lots[0].id, value);
              }}
            />
          </View>
        ) : null}
        <View style={styles.sheetButtons}>
          <Button title={labels.use} variant="accent" onPress={() => group && onUse(group)} />
          <Button title={labels.partial} variant="ghost" onPress={() => group && onPartial(group)} />
          <Button title={labels.remove} variant="text" onPress={() => group && onRemove(group)} />
        </View>
      </View>
    </BottomSheet>
  );
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

function getActionLabels(t: ReturnType<typeof useTranslation>["t"]) {
  return {
    use: t("fridge.actions.use"),
    partial: t("fridge.actions.partial"),
    remove: t("fridge.actions.remove"),
    netLabel: t("fridge.actions.netLabel"),
    saveNet: t("fridge.actions.saveNet"),
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
  emptyState: {
    paddingHorizontal: spacing.screenX,
    alignItems: "center",
    gap: spacing.lg,
  },
  sheetContent: {
    gap: spacing.xl,
  },
  sheetCopy: {
    gap: spacing.sm,
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
});
