import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "../../theme";
import { FoodCard } from "./FoodCard";
import { Button, Card, Text } from "../primitives";

type EatFirstItem = {
  id: string;
  name: string;
  category?: string;
  note: string;
  urgency?: "safe" | "useSoon" | "urgent";
};

type Props = {
  items: EatFirstItem[];
  premium?: boolean;
  labels: {
    premium?: string;
    title: string;
    itemCount: (count: number) => string;
    previewTitle: string;
    previewBody: string;
    unlockAction: string;
  };
  onItemPress?: (item: EatFirstItem) => void;
  onUpgradePress?: () => void;
};

export function EatFirstShelf({ items, premium = false, labels, onItemPress, onUpgradePress }: Props) {
  if (!premium) {
    return (
      <View style={styles.previewWrap}>
        <Card dashed style={styles.preview}>
          <View style={styles.previewIcon}>
            <Text variant="h2" color={colors.primary} italic>
              3
            </Text>
          </View>
          <View style={styles.previewCopy}>
            <Text variant="label">{labels.previewTitle}</Text>
            <Text variant="small" muted style={styles.previewText}>
              {labels.previewBody}
            </Text>
          </View>
          <Button title={labels.unlockAction} variant="text" onPress={onUpgradePress} />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <View>
          <Text variant="micro" color={colors.accent} uppercase>
            {labels.premium}
          </Text>
          <Text variant="h2" italic style={styles.title}>
            {labels.title}
          </Text>
        </View>
        <Text variant="small" muted>
          {labels.itemCount(items.length)}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => (
          <FoodCard
            key={item.id}
            name={item.name}
            category={item.category}
            meta={item.note}
            urgency={item.urgency}
            size="large"
            onPress={() => onItemPress?.(item)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing.xxxl,
  },
  heading: {
    paddingHorizontal: spacing.screenX,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: "Fraunces",
    fontWeight: "500",
  },
  row: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
  },
  previewWrap: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.xxxl,
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCopy: {
    flex: 1,
  },
  previewText: {
    marginTop: 2,
  },
});
