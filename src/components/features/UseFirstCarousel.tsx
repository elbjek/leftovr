import { ScrollView, StyleSheet, View } from "react-native";

import { colors, radii, spacing, Urgency, urgencyColors } from "../../theme";
import { Card, GlyphTile, Tappable, Text } from "../primitives";

export type UseFirstItem = {
  id: string;
  name: string;
  category: string;
  urgency: Urgency;
  /** "Best today", "In 2 days"… */
  bestBy: string;
};

type Props = {
  title: string;
  seeAllLabel: string;
  items: UseFirstItem[];
  onSeeAll: () => void;
};

const BEST_BY_COLOR: Partial<Record<Urgency, string>> = {
  urgent: colors.redInk,
  useSoon: colors.accentInk,
};

/**
 * The foods about to go off, as flat tiles in one white card — the same
 * surface as the rest of the home, so it doesn't read as a banner. Premium
 * only.
 */
export function UseFirstCarousel({ title, seeAllLabel, items, onSeeAll }: Props) {
  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.head}>
        <Text variant="h3">{title}</Text>
        <Tappable label={seeAllLabel} onPress={onSeeAll} hitSlop={8}>
          <Text variant="small" color={colors.primary} weight="bold">
            {seeAllLabel}
          </Text>
        </Tappable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => (
          <Tappable
            key={item.id}
            feedback="scale"
            label={`${item.name}. ${item.bestBy}`}
            onPress={onSeeAll}
            hitSlop={0}
            style={styles.tile}
          >
            <View>
              <GlyphTile name={item.name} category={item.category} size="lg" style={styles.well} />
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.dot, { backgroundColor: urgencyColors[item.urgency] }]}
              />
            </View>
            <Text variant="small" weight="bold" numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="small" color={BEST_BY_COLOR[item.urgency] ?? colors.muted} numberOfLines={1}>
              {item.bestBy}
            </Text>
          </Tappable>
        ))}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.lg,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  tile: {
    width: 72,
    gap: 2,
  },
  // Neutral well, not the category tint: the tints match the food's own
  // colour (yogurt on cream, banana on peach), so the icon disappears.
  well: {
    backgroundColor: colors.surface2,
  },
  dot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
