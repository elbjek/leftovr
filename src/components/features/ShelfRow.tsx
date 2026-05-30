import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { spacing } from "../../theme";
import { FoodCard } from "./FoodCard";
import { Text } from "../primitives";

export type ShelfItem = {
  id: string;
  name: string;
  category?: string;
  meta: string;
  urgency?: "safe" | "useSoon" | "urgent";
  addedBy?: string | null;
};

type Props = {
  name: string;
  count: number;
  tone?: string;
  items: ShelfItem[];
  layout?: "horizontal" | "grid";
  seeAllLabel?: string;
  onItemPress?: (item: ShelfItem) => void;
};

export function ShelfRow({
  name,
  count,
  tone,
  items,
  layout = "horizontal",
  seeAllLabel,
  onItemPress,
}: Props) {
  const grid = layout === "grid";

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {tone ? <View style={[styles.tone, { backgroundColor: tone }]} /> : null}
          <Text variant="h3">
            {name}{" "}
            <Text variant="h3" muted style={styles.count}>
              · {count}
            </Text>
          </Text>
        </View>
        {seeAllLabel ? (
          <Text variant="small" muted style={styles.seeAll}>
            {seeAllLabel}
          </Text>
        ) : null}
      </View>
      {grid ? (
        <View style={styles.grid}>
          {items.map((item) => (
            <FoodCard
              key={item.id}
              name={item.name}
              category={item.category}
              meta={item.meta}
              urgency={item.urgency}
              addedBy={item.addedBy}
              onPress={() => onItemPress?.(item)}
              style={styles.gridCard}
            />
          ))}
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
    width: "23.4%",
  },
});
