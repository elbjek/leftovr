import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../../theme";
import { FoodCard } from "./FoodCard";
import { Text } from "../primitives";

export type ShelfItem = {
  id: string;
  name: string;
  category?: string;
  meta: string;
  metaLines?: string[];
  bestBy?: string;
  urgency?: "safe" | "useSoon" | "urgent" | "expired";
  addedBy?: string | null;
};

type Props = {
  name: string;
  count: number;
  tone?: string;
  items: ShelfItem[];
  layout?: "horizontal" | "grid";
  maxVisibleItems?: number;
  moreLabel?: string;
  seeAllLabel?: string;
  showTitle?: boolean;
  onItemPress?: (item: ShelfItem) => void;
  onMorePress?: () => void;
};

export function ShelfRow({
  name,
  count,
  tone,
  items,
  layout = "horizontal",
  maxVisibleItems,
  moreLabel,
  seeAllLabel,
  showTitle = true,
  onItemPress,
  onMorePress,
}: Props) {
  const grid = layout === "grid";
  const showMore = grid && maxVisibleItems != null && items.length > maxVisibleItems;
  const visibleItems = showMore ? items.slice(0, Math.max(0, maxVisibleItems - 1)) : items;

  return (
    <View style={styles.wrap}>
      {showTitle || seeAllLabel ? (
        <View style={styles.header}>
          {showTitle ? (
            <View style={styles.titleRow}>
              {tone ? <View style={[styles.tone, { backgroundColor: tone }]} /> : null}
              <Text variant="h3">
                {name}{" "}
                <Text variant="h3" muted style={styles.count}>
                  · {count}
                </Text>
              </Text>
            </View>
          ) : (
            <View />
          )}
          {seeAllLabel ? (
            <Pressable accessibilityRole="button" onPress={onMorePress} hitSlop={8}>
              <Text variant="small" muted style={styles.seeAll}>
                {seeAllLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {grid ? (
        <View style={styles.grid}>
          {visibleItems.map((item) => (
            <FoodCard
              key={item.id}
              name={item.name}
              category={item.category}
              meta={item.meta}
              metaLines={item.metaLines}
              bestBy={item.bestBy}
              urgency={item.urgency}
              addedBy={item.addedBy}
              onPress={() => onItemPress?.(item)}
              style={styles.gridCard}
            />
          ))}
          {showMore ? (
            <Pressable
              accessibilityRole="button"
              onPress={onMorePress}
              style={({ pressed }) => [styles.moreCard, pressed && styles.morePressed]}
            >
              <Text variant="h2" color={colors.primary}>
                +
              </Text>
              <Text variant="label" color={colors.primary}>
                {moreLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.items}
        >
          {items.map((item) => (
            <FoodCard
              key={item.id}
              name={item.name}
              category={item.category}
              meta={item.meta}
              metaLines={item.metaLines}
              bestBy={item.bestBy}
              urgency={item.urgency}
              addedBy={item.addedBy}
              onPress={() => onItemPress?.(item)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.md,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tone: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  count: {
    fontWeight: "500",
  },
  seeAll: {
    fontWeight: "600",
  },
  items: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
  },
  grid: {
    paddingHorizontal: spacing.screenX,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  gridCard: {
    width: "31.5%",
  },
  moreCard: {
    width: "31.5%",
    minHeight: 170,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.sm,
  },
  morePressed: {
    transform: [{ scale: 0.99 }],
  },
});
