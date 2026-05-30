import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "../../theme";
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
  onItemPress?: (item: ShelfItem) => void;
};

export function ShelfRow({ name, count, tone = colors.surface3, items, onItemPress }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={[styles.tone, { backgroundColor: tone }]} />
        <Text variant="h3">{name}</Text>
        <Text variant="small" muted>
          {count}
        </Text>
      </View>
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
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.md,
  },
  tone: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  items: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
  },
});

