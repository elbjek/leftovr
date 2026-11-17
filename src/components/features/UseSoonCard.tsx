import { StyleSheet, View } from "react-native";

import { colors, radii, shadows, spacing, Urgency, urgencyColors } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Tappable, Text } from "../primitives";

type Props = {
  name: string;
  category: string;
  urgency: Urgency;
  /** The best-by line ("Best today", "In 3 days"), after an urgency dot. */
  meta: string;
  /** Omitted in the feature tour, where the card is only a picture. */
  onPress?: () => void;
};

/** One food in the Kitchen's Use soon row (also the tour's Kitchen slide). */
export function UseSoonCard({ name, category, urgency, meta, onPress }: Props) {
  return (
    <Tappable label={`${name}, ${meta}`} onPress={onPress} hitSlop={0} style={styles.card}>
      <View style={styles.food}>
        <FoodGlyph name={name} category={category} size={34} />
      </View>
      <View style={styles.copy}>
        <Text variant="label" numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.dot, { backgroundColor: urgencyColors[urgency] }]} />
          <Text variant="small" muted numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    paddingRight: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  food: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    maxWidth: 148,
    gap: 2,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
