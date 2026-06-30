import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { categoryColors, CategoryTone, colors, radii, shadows, spacing, urgencyColors } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Button, Card, Text } from "../primitives";

type EatFirstItem = {
  id: string;
  name: string;
  category?: string;
  bestBy?: string;
};

type Props = {
  items: EatFirstItem[];
  premium?: boolean;
  labels: {
    kicker: string;
    heading: (count: number) => string;
    cookCta: string;
    previewTitle: string;
    previewBody: string;
    unlockAction: string;
  };
  onItemPress?: (item: EatFirstItem) => void;
  onCook?: () => void;
  onUpgradePress?: () => void;
};


// The hero block: items that need using today + the one action the plain shelves
// can't offer — cook with them before they spoil.
export function EatFirstShelf({ items, premium = false, labels, onItemPress, onCook, onUpgradePress }: Props) {
  if (!premium) {
    return (
      <View style={styles.previewWrap}>
        <Card dashed style={styles.preview}>
          <View style={styles.previewIcon}>
            <Text variant="h2" color={colors.primary} italic>
              {items.length || 3}
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
      <View style={styles.card}>
        <View style={styles.kickerRow}>
          <View style={styles.dot} />
          <Text variant="micro" color={colors.red} uppercase style={styles.kicker}>
            {labels.kicker}
          </Text>
        </View>
        <Text variant="h3" color={colors.text} style={styles.heading}>
          {labels.heading(items.length)}
        </Text>

        <ScrollView
          horizontal
          scrollEnabled={items.length > 2}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {items.map((item) => {
            const tone = categoryColors[(item.category as CategoryTone)] ?? categoryColors.other;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => onItemPress?.(item)}
                style={({ pressed }) => [styles.itemCard, pressed && styles.itemPressed]}
              >
                <View style={[styles.thumb, { backgroundColor: tone.background }]}>
                  <FoodGlyph name={item.name} color={tone.mark} size={26} />
                </View>
                <View style={styles.itemText}>
                  <Text variant="label" color={colors.text} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.bestBy ? (
                    <Text variant="small" color={urgencyColors.urgent} numberOfLines={1}>
                      {item.bestBy}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          onPress={onCook}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text variant="label" color={colors.surface}>{labels.cookCta}</Text>
          <Text variant="label" color={colors.surface}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: urgencyColors.urgent,
  },
  kicker: {
    letterSpacing: 0.6,
  },
  heading: {
    marginTop: -spacing.xs,
  },
  carousel: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  itemCard: {
    width: 184,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm,
  },
  itemPressed: {
    opacity: 0.9,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    flex: 1,
    gap: 1,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  ctaPressed: {
    opacity: 0.9,
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
