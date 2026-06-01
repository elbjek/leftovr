import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Path } from "react-native-svg";

import { BottomSheet, Button, EatFirstShelf, FoodCard, IconButton, RetentionCard, Screen, ShelfRow, Text, TextField } from "@/components";
import { useAuth, useMeasurementSystem } from "@/features";
import { updateInventoryNetAmount } from "@/repositories";
import { useInsights, useInventory, useRetention } from "@/hooks";
import {
  formatAmount,
  getCatalogFood,
  InventoryGroup,
  PartialState,
  toUiCategory,
  toUiUrgency,
} from "@/services";
import { colors, radii, spacing } from "@/theme";
import { router, useFocusEffect } from "expo-router";

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
  const urgentGroups = groups.filter((group) => group.urgency === "urgent");
  const isPremium = profile?.tier !== "free";
  const { weeklySummary } = useInsights(activeHousehold?.id);
  const eatFirstGroups = getEatFirstGroups(groups);
  const categoryShelves = buildCategoryShelves(groups, t);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <Screen scroll padded={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text variant="micro" muted uppercase>
            {profile?.display_name ? t("fridge.greetingWithName", { name: profile.display_name }) : t("fridge.greeting")}
          </Text>
          <Text variant="h1" style={styles.headerTitle}>
            {t("fridge.homeTitle")}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton label={t("fridge.search")}><SearchIcon /></IconButton>
          <IconButton label={t("fridge.refresh")} onPress={refresh}><RefreshIcon /></IconButton>
        </View>
      </View>

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
          <ActivityIndicator color={colors.primary} />
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

      {renderShelf(t("fridge.shelves.urgent"), urgentGroups, {
        tone: colors.red,
        emptyLabel: t("fridge.expiringEmpty"),
        alwaysShow: true,
        labels: getActionLabels(t),
        onUse: consumeFirstLot,
        onPartial: async (group) => setPartialGroup(group),
        onRemove: async (group) => setRemoveGroupTarget(group),
      }, groups.length === 0)}

      {categoryShelves.map((shelf) => (
        <CategoryShelf
          key={shelf.category}
          name={shelf.name}
          groups={shelf.groups}
          onItemPress={(group) => setActionGroup(group)}
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

function renderShelf(
  name: string,
  groups: InventoryGroup[],
  actions: {
    tone: string;
    labels: { use: string; partial: string; remove: string };
    onUse: (group: InventoryGroup) => Promise<void>;
    onPartial: (group: InventoryGroup) => Promise<void>;
    onRemove: (group: InventoryGroup) => Promise<void>;
    alwaysShow?: boolean;
    emptyLabel?: string;
  },
  emptyOnly = false,
) {
  if (!emptyOnly || (groups.length === 0 && !actions.alwaysShow)) return null;

  return (
    <View style={styles.shelfWrap}>
      <ShelfRow
        name={name}
        count={groups.length}
        tone={actions.tone}
        items={groups.map((group) => ({
          id: group.key,
          name: group.name,
          category: toUiCategory(group.category),
          meta: group.meta,
          urgency: toUiUrgency(group.urgency),
          addedBy: group.lots[0]?.added_by_name ?? null,
        }))}
      />
      {groups.length === 0 && actions.emptyLabel ? (
        <View style={styles.emptyShelf}>
          <Text variant="small" muted>
            {actions.emptyLabel}
          </Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        {groups.map((group) => (
          <View key={group.key} style={styles.actionCard}>
            <View style={styles.actionCopy}>
              <Text variant="label" numberOfLines={1}>
                {group.name}
              </Text>
              <Text variant="micro" muted numberOfLines={1}>
                {group.meta}
              </Text>
            </View>
            <View style={styles.actionButtons}>
              <Button title={actions.labels.use} variant="accent" onPress={() => actions.onUse(group)} style={styles.smallButton} />
              <Button title={actions.labels.partial} variant="ghost" onPress={() => actions.onPartial(group)} style={styles.smallButton} />
              <Button title={actions.labels.remove} variant="text" onPress={() => actions.onRemove(group)} style={styles.smallButton} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function CategoryShelf({
  name,
  groups,
  onItemPress,
}: {
  name: string;
  groups: InventoryGroup[];
  onItemPress: (group: InventoryGroup) => void;
}) {
  return (
    <ShelfRow
      name={name}
      count={groups.length}
      layout="grid"
      items={groups.map((group) => ({
        id: group.key,
        name: group.name,
        category: toUiCategory(group.category),
        meta: group.meta,
        urgency: toUiUrgency(group.urgency),
        addedBy: group.lots[0]?.added_by_name ?? null,
      }))}
      onItemPress={(item) => {
        const group = groups.find((candidate) => candidate.key === item.id);
        if (group) onItemPress(group);
      }}
    />
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
  const order = [
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
  ];

  return order
    .map((category) => ({
      category,
      name: t(`scan.categories.${category}` as any),
      groups: groups.filter((group) => group.category === category),
    }))
    .filter((shelf) => shelf.groups.length > 0);
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
  const catalog = getCatalogFood(group.name);
  const maxDays = catalog?.shelfLifeDays[1] ?? shelfLifeStart(group.shelfLifeRange);
  const ageDays = Math.floor((Date.now() - new Date(oldestLot.added_at).getTime()) / 86_400_000);
  const remaining = Math.max(0, maxDays - ageDays);

  if (remaining <= 0) return t("fridge.bestBy.today");
  if (remaining === 1) return t("fridge.bestBy.tomorrow");
  return t("fridge.bestBy.inDays", { count: remaining });
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={8} cy={8} r={5.5} stroke={colors.primary} strokeWidth={1.6} />
      <Path d="M12.5 12.5L16 16" stroke={colors.primary} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerTitle: {
    marginTop: spacing.xxs,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
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
  shelfWrap: {
    gap: spacing.sm,
  },
  emptyShelf: {
    marginHorizontal: spacing.screenX,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
  },
  actions: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  actionCard: {
    backgroundColor: colors.paper,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  actionCopy: {
    gap: spacing.xxs,
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  smallButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
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
  netRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  netField: {
    flex: 1,
  },
});
