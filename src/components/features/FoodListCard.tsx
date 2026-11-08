import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Urgency, colors, radii, spacing, urgencyColors } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Divider, ListRow, StatusPill, Tappable, Text } from "../primitives";

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

/** A shelf on the Kitchen home: a big title, then food rows straight on the
 *  page — a peach date tile (when dated), the food on its round tint, name
 *  over meta, the status pill and a chevron. */
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
        <Text variant="h2" weight="extrabold" accessibilityRole="header">
          {title}
        </Text>
        {showSeeAll ? (
          <Tappable role="link" label={seeAllLabel} onPress={onSeeAll}>
            <Text variant="label" weight="extrabold" color={colors.primary}>
              {seeAllLabel}
            </Text>
          </Tappable>
        ) : (
          <Text variant="label" weight="extrabold" color={colors.primary}>
            {items.length}
          </Text>
        )}
      </View>

      <View>
        {items.length === 0 && emptyText ? (
          <ListRow
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
              title={item.name}
              subtitle={item.addedBy ? `${item.meta} · ${item.addedBy}` : item.meta}
              leading={
                <View style={styles.leading}>
                  {item.date ? (
                    <View style={styles.date}>
                      <Text variant="small" weight="semibold" muted>
                        {item.date.weekday}
                      </Text>
                      <Text variant="h3" weight="extrabold" color={colors.text}>
                        {item.date.day}
                      </Text>
                    </View>
                  ) : null}
                  {/* One sage well and a big icon: category tints and peach
                      both hid pale foods (white cheese on cream). */}
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
          <>
            {visible.length > 0 ? <Divider /> : null}
            <ListRow title={footer.label} onPress={footer.onPress} style={styles.footer} />
          </>
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
    paddingHorizontal: spacing.xxs,
  },
  leading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  food: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.foodWell,
    alignItems: "center",
    justifyContent: "center",
  },
  // Neutral, so the row's only red is the status pill.
  date: {
    width: 48,
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.surface,
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
