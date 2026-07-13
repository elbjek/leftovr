import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { categoryColors, CategoryTone, colors, fonts, radii, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Text } from "../primitives";

export type CheckItem = {
  id: string;
  name: string;
  category?: string;
  /** "Expired" when the user-entered date passed, else "Past its best". */
  label: string;
};

// The card previews this many rows; the rest live in the "see all" sheet.
const PREVIEW_COUNT = 3;

type RowLabels = {
  stillGood: string;
  toss: string;
};

type Props = {
  items: CheckItem[];
  labels: RowLabels & {
    kicker: string;
    subtitle: string;
    seeAll: string;
  };
  onItemPress?: (item: CheckItem) => void;
  onStillGood: (item: CheckItem) => void;
  onToss: (item: CheckItem) => void;
  onSeeAll: () => void;
};

// Items past their (known or estimated) date. They left the category shelves
// and everything that cooks — this block exists to be emptied: vouch for the
// food ("still good") or toss it. Long tails collapse behind "see all" so a
// neglected fridge doesn't bury the rest of the screen.
export function CheckTheseShelf({ items, labels, onItemPress, onStillGood, onToss, onSeeAll }: Props) {
  const preview = items.slice(0, PREVIEW_COUNT);
  const hiddenCount = items.length - preview.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.kickerRow}>
          <AlertIcon />
          <Text variant="label" color={colors.text} style={styles.kicker}>
            {labels.kicker}
          </Text>
          <View style={styles.countBadge}>
            <Text variant="micro" color={colors.text}>{items.length}</Text>
          </View>
        </View>
        <Text variant="small" muted>
          {labels.subtitle}
        </Text>

        {preview.map((item) => (
          <CheckTheseRow
            key={item.id}
            item={item}
            labels={labels}
            onPress={onItemPress}
            onStillGood={onStillGood}
            onToss={onToss}
          />
        ))}

        {hiddenCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSeeAll}
            style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
          >
            <Text variant="label" color={colors.primary}>{labels.seeAll}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// One expired item with its vouch/toss actions. Shared between the card
// preview and the full-list sheet.
export function CheckTheseRow({
  item,
  labels,
  onPress,
  onStillGood,
  onToss,
}: {
  item: CheckItem;
  labels: RowLabels;
  onPress?: (item: CheckItem) => void;
  onStillGood: (item: CheckItem) => void;
  onToss: (item: CheckItem) => void;
}) {
  const tone = categoryColors[(item.category as CategoryTone)] ?? categoryColors.other;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onPress?.(item)}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <View style={[styles.thumb, { backgroundColor: tone.background }]}>
          <FoodGlyph name={item.name} color={tone.mark} size={22} />
        </View>
        <View style={styles.rowText}>
          <Text variant="label" color={colors.text} numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="small" muted numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${labels.stillGood}: ${item.name}`}
        onPress={() => onStillGood(item)}
        style={({ pressed }) => [styles.actionPill, styles.stillGoodPill, pressed && styles.pressed]}
      >
        <Text variant="label" color={colors.primary}>{labels.stillGood}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${labels.toss}: ${item.name}`}
        onPress={() => onToss(item)}
        style={({ pressed }) => [styles.actionPill, styles.tossPill, pressed && styles.pressed]}
      >
        <Text variant="label" color={colors.red}>{labels.toss}</Text>
      </Pressable>
    </View>
  );
}

function AlertIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5 21 20H3L12 3.5Z"
        stroke={colors.text}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 10v4.5M12 17.2v.3" stroke={colors.text} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenX,
  },
  card: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.yellow,
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
  countBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardLine,
    padding: spacing.sm,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPill: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stillGoodPill: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.sageBorder,
  },
  tossPill: {
    backgroundColor: colors.paper,
    borderColor: colors.red,
  },
  seeAll: {
    minHeight: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
});
