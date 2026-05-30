import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, FoodCard, Screen, ShelfRow, Text } from "@/components";
import { useAuth } from "@/features";
import { useInventory } from "@/hooks";
import {
  demoFoodCatalog,
  InventoryGroup,
  toUiCategory,
  toUiUrgency,
} from "@/services";
import { colors, radii, spacing } from "@/theme";

export default function FridgeRoute() {
  const { t } = useTranslation();
  const { profile, activeHousehold } = useAuth();
  const {
    loading,
    groups,
    error,
    addDemoItem,
    useFirstLot,
    markFirstLotPartial,
    removeGroup,
    refresh,
  } = useInventory(activeHousehold?.id);
  const urgentGroups = groups.filter((group) => group.urgency === "urgent");
  const useSoonGroups = groups.filter((group) => group.urgency === "use_soon");
  const safeGroups = groups.filter((group) => group.urgency === "safe");

  return (
    <Screen scroll padded={false} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text variant="display">
              {profile?.display_name ? t("fridge.titleWithName", { name: profile.display_name }) : t("fridge.title")}
            </Text>
            <Text variant="body" muted>
              {t("fridge.body")}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.refreshButton}>
            <Text variant="small" color={colors.primary}>
              {t("fridge.refresh")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.quickAdd}>
          {demoFoodCatalog.slice(0, 5).map((item) => (
            <Button
              key={item.name}
              title={`+ ${item.name}`}
              variant="ghost"
              onPress={() => addDemoItem(item.name)}
              style={styles.quickButton}
            />
          ))}
        </View>
      </View>

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
            name="Greek yogurt"
            category="dairy-eggs"
            meta={t("fridge.emptyMeta")}
            urgency="useSoon"
            size="large"
            onPress={() => addDemoItem("Greek yogurt")}
          />
        </View>
      ) : null}

      {renderShelf(t("fridge.shelves.urgent"), urgentGroups, {
        tone: colors.red,
        labels: getActionLabels(t),
        onUse: useFirstLot,
        onPartial: markFirstLotPartial,
        onRemove: removeGroup,
      })}
      {renderShelf(t("fridge.shelves.useSoon"), useSoonGroups, {
        tone: colors.yellow,
        labels: getActionLabels(t),
        onUse: useFirstLot,
        onPartial: markFirstLotPartial,
        onRemove: removeGroup,
      })}
      {renderShelf(t("fridge.shelves.safe"), safeGroups, {
        tone: colors.green,
        labels: getActionLabels(t),
        onUse: useFirstLot,
        onPartial: markFirstLotPartial,
        onRemove: removeGroup,
      })}
    </Screen>
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
  },
) {
  if (groups.length === 0) return null;

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
        }))}
      />
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

function getActionLabels(t: ReturnType<typeof useTranslation>["t"]) {
  return {
    use: t("fridge.actions.use"),
    partial: t("fridge.actions.partial"),
    remove: t("fridge.actions.remove"),
  };
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
    gap: spacing.xl,
  },
  hero: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.xl,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  titleCopy: {
    flex: 1,
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
  quickAdd: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
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
});
