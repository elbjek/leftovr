import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, spacing, Urgency, urgencyColors } from "../../theme";
import { Card, Divider, GlyphTile, ListRow, SectionHeader, StatusPill, Tappable, Text } from "../primitives";

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

/** A shelf on the Kitchen home: a section header, then a card of food rows. */
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
      <SectionHeader
        title={title}
        style={styles.head}
        actions={
          showSeeAll ? (
            <Tappable role="link" label={seeAllLabel} onPress={onSeeAll}>
              <Text variant="label" color={colors.primary}>
                {seeAllLabel}
              </Text>
            </Tappable>
          ) : (
            <Text variant="small" muted>
              {items.length}
            </Text>
          )
        }
      />

      <Card padded={false} style={styles.card}>
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

        {visible.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 ? <Divider inset /> : null}
            <ListRow
              title={item.name}
              subtitle={item.addedBy ? `${item.meta} · ${item.addedBy}` : item.meta}
              leading={
                item.date ? (
                  <View style={styles.date}>
                    <Text variant="micro" color={colors.muted2}>
                      {item.date.weekday}
                    </Text>
                    <Text variant="h3">{item.date.day}</Text>
                  </View>
                ) : (
                  <GlyphTile name={item.name} category={item.category} size="sm" round />
                )
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
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  head: {
    paddingHorizontal: spacing.xxs,
  },
  card: {
    paddingHorizontal: spacing.lg,
  },
  date: {
    width: 40,
    alignItems: "center",
  },
  emptyCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
