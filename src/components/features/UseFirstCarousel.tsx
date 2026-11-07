import { ScrollView, StyleSheet, View } from "react-native";

import { colors, spacing, Urgency } from "../../theme";
import { Tappable, Text } from "../primitives";
import { FoodCard } from "./FoodCard";

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

/**
 * The foods about to go off, as tiles. Premium only — free sees the counted
 * strip instead, as on Kitchen's Eat first shelf.
 */
export function UseFirstCarousel({ title, seeAllLabel, items, onSeeAll }: Props) {
  return (
    <View style={styles.band}>
      <View style={styles.head}>
        <Text variant="h3">{title}</Text>
        <Tappable label={seeAllLabel} onPress={onSeeAll} hitSlop={8}>
          <Text variant="small" color={colors.accentInk} weight="bold">
            {seeAllLabel}
          </Text>
        </Tappable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((item) => (
          <FoodCard
            key={item.id}
            name={item.name}
            category={item.category}
            compact
            meta=""
            bestBy={item.bestBy}
            urgency={item.urgency}
            onPress={onSeeAll}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // A full-bleed warm band, so the urgent food reads as its own zone and not
  // as one more card in the column.
  band: {
    backgroundColor: colors.accentSoft,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.sm,
  },
  row: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
});
