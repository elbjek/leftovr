import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { categoryColors, CategoryTone, colors, fonts, radii, spacing, Urgency, urgencyColors } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Text } from "../primitives";

export type FoodListItem = {
  id: string;
  name: string;
  category?: string;
  meta: string;
  urgency?: Urgency;
  addedBy?: string | null;
  /** TinyMeals-style status pill ("Use now"); without it a freshness dot. */
  status?: string;
};

type Props = {
  title: string;
  items: FoodListItem[];
  /** Rows shown before the "see all" link; omit to show everything. */
  maxVisible?: number;
  seeAllLabel?: string;
  onSeeAll?: () => void;
  onItemPress: (item: FoodListItem) => void;
};

// A shelf on the Kitchen home: small uppercase label, then a cream card of
// hairline-divided food rows (round glyph tile, name, meta, status pill or
// freshness dot).
export function FoodListCard({ title, items, maxVisible, seeAllLabel, onSeeAll, onItemPress }: Props) {
  const visible = maxVisible ? items.slice(0, maxVisible) : items;
  const showSeeAll = Boolean(seeAllLabel && onSeeAll && visible.length < items.length);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="micro" uppercase muted style={styles.title}>
          {title}
        </Text>
        {showSeeAll ? (
          <Pressable accessibilityRole="link" onPress={onSeeAll} hitSlop={8}>
            <Text variant="small" color={colors.primary} style={styles.seeAll}>
              {seeAllLabel}
            </Text>
          </Pressable>
        ) : (
          <Text variant="small" muted>
            {items.length}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        {visible.map((item, index) => {
          const tone = categoryColors[(item.category as CategoryTone)] ?? categoryColors.other;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}. ${item.meta}`}
              onPress={() => onItemPress(item)}
              style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressed]}
            >
              <View style={[styles.thumb, { backgroundColor: tone.background }]}>
                <FoodGlyph name={item.name} color={tone.mark} size={24} />
              </View>
              <View style={styles.copy}>
                <Text variant="label" numberOfLines={1} style={styles.name}>
                  {item.name}
                </Text>
                <Text variant="small" muted numberOfLines={1}>
                  {item.addedBy ? `${item.meta} · ${item.addedBy}` : item.meta}
                </Text>
              </View>
              {item.status ? (
                <View style={[styles.pill, { backgroundColor: PILL[item.urgency ?? "safe"].background }]}>
                  <Text variant="micro" color={PILL[item.urgency ?? "safe"].ink} style={styles.pillLabel}>
                    {item.status}
                  </Text>
                </View>
              ) : (
                <View style={[styles.dot, { backgroundColor: urgencyColors[item.urgency ?? "safe"] }]} />
              )}
              <ChevronIcon />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const PILL: Record<Urgency, { background: string; ink: string }> = {
  urgent: { background: colors.redSoft, ink: colors.redInk },
  useSoon: { background: colors.accentSoft, ink: colors.accentInk },
  safe: { background: colors.sageTint, ink: colors.primary },
  expired: { background: colors.surface3, ink: colors.muted },
};

function ChevronIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
      <Path d="M5 2.5 9.5 7 5 11.5" stroke={colors.muted2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
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
  title: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    letterSpacing: 0.66,
  },
  seeAll: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 62,
    paddingVertical: spacing.sm + 2,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
    fontSize: 15,
  },
  pill: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: "center",
  },
  pillLabel: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pressed: {
    opacity: 0.6,
  },
});
