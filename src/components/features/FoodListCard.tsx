import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Urgency, colors, radii, shadows, spacing, urgencyColors } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { ListRow, StatusPill, Tappable, Text } from "../primitives";

export type FoodListItem = {
  id: string;
  name: string;
  category?: string;
  meta: string;
  urgency?: Urgency;
  addedBy?: string | null;
  /** A status pill ("Use now"); without it a freshness dot. */
  status?: string;
  /** Shows a date column ("TUE" over "5") in place of the food tile. */
  date?: { weekday: string; day: string };
};

type Props = {
  title: string;
  items: FoodListItem[];
  /** Rows shown before the "see all" link; omit to show everything. */
  maxVisible?: number;
  seeAllLabel?: string;
  onSeeAll?: () => void;
  onItemPress: (item: FoodListItem) => void;
  /** A last row inside the card (e.g. "Cook with these first"). */
  footer?: { label: string; onPress: () => void };
  /** Shown as the card's only row when there are no items (a green "all good"). */
  emptyText?: string;
};

/** A shelf on the Kitchen: the home's list pattern. A section title, then
 *  one white card per food — an outlined date tile (when dated), the food on
 *  a sage rounded tile, name over meta, and the status pill. */
export function FoodListCard({
  title,
  items,
  maxVisible,
  seeAllLabel,
  onSeeAll,
  onItemPress,
  footer,
  emptyText,
}: Props) {
  const visible = maxVisible ? items.slice(0, maxVisible) : items;
  const showSeeAll = Boolean(seeAllLabel && onSeeAll && visible.length < items.length);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        {showSeeAll ? (
          <Tappable role="link" label={seeAllLabel} onPress={onSeeAll}>
            <Text variant="label" color={colors.primary}>
              {seeAllLabel}
            </Text>
          </Tappable>
        ) : (
          <Text variant="small" muted>
            {items.length}
          </Text>
        )}
      </View>

      <View style={styles.cards}>
        {items.length === 0 && emptyText ? (
          <ListRow
            style={styles.card}
            title={emptyText}
            leading={
              <View style={styles.emptyCheck}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5.5 12.5l4.2 4.2 8.8-9.4"
                    stroke={colors.primary}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            }
          />
        ) : null}

        {visible.map((item) => (
          <React.Fragment key={item.id}>
            <ListRow
              style={styles.card}
              chevron={false}
              title={item.name}
              subtitle={item.addedBy ? `${item.meta} · ${item.addedBy}` : item.meta}
              leading={
                <View style={styles.leading}>
                  {item.date ? (
                    <View style={styles.date}>
                      <Text variant="small" muted>
                        {item.date.weekday}
                      </Text>
                      <Text variant="h3" color={colors.text}>
                        {item.date.day}
                      </Text>
                    </View>
                  ) : null}
                  {/* The home's thumbnail shape in sage: category tints and
                      peach both hid pale foods (white cheese on cream). */}
                  <View style={styles.food}>
                    <FoodGlyph name={item.name} category={item.category} size={50} />
                  </View>
                </View>
              }
              trailing={
                item.status ? (
                  <StatusPill label={item.status} tone={item.urgency ?? "safe"} />
                ) : (
                  // Redundant with the meta line, which already says the days
                  // left in words — so this is reinforcement, not the only cue.
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.dot, { backgroundColor: urgencyColors[item.urgency ?? "safe"] }]}
                  />
                )
              }
              onPress={() => onItemPress(item)}
            />
          </React.Fragment>
        ))}

        {footer && items.length > 0 ? (
          <ListRow title={footer.label} onPress={footer.onPress} style={[styles.card, styles.footer]} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  cards: {
    gap: spacing.sm,
  },
  // RecipeListCard's surface: white, 24pt corners, the soft lift.
  card: {
    padding: spacing.md,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  leading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  food: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  // Outlined on the page cream, like the home's ingredient chips.
  date: {
    width: 48,
    height: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCheck: {
    width: 26,
    height: 26,
    borderRadius: radii.md,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    minHeight: 52,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
