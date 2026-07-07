import React from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { categoryColors, CategoryTone, colors, fonts, radii, spacing, urgencyColors } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Button, Card, Text } from "../primitives";

// Two pills fill the card row exactly: page padding (screenX) + card padding (lg)
// on both sides, minus the gap between the two pills.
const ITEM_WIDTH =
  (Dimensions.get("window").width - spacing.screenX * 2 - spacing.lg * 2 - spacing.sm) / 2;

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
    subtitle?: string;
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
          <LeafIcon />
          <Text variant="label" color={colors.primary} style={styles.kicker}>
            {labels.kicker}
          </Text>
        </View>
        <Text variant="h2" color={colors.text} style={styles.heading}>
          {labels.heading(items.length)}
        </Text>
        {labels.subtitle ? (
          <Text variant="small" muted style={styles.subtitle}>
            {labels.subtitle}
          </Text>
        ) : null}

        <ScrollView
          horizontal
          scrollEnabled={items.length > 2}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={ITEM_WIDTH + spacing.sm}
          snapToAlignment="start"
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
                  <Text variant="label" color={colors.text} numberOfLines={2} style={styles.itemName}>
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

function LeafIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20c0-8 6-14 16-14 0 10-6 15-13 15-1 0-3 0-3-1Z"
        stroke={colors.primary}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 20c2-5 6-8 11-9" stroke={colors.primary} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
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
    borderColor: colors.cardLine,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  kicker: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "700",
  },
  heading: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "700",
    marginTop: spacing.xxs,
  },
  subtitle: {
    marginTop: -spacing.xxs,
  },
  carousel: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  itemCard: {
    width: ITEM_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardLine,
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
  itemName: {
    fontFamily: fonts.bodyBold,
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
    backgroundColor: colors.sageSoft,
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
