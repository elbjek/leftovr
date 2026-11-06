import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, fonts, radii, shadows, spacing } from "../../theme";
import { Text } from "../primitives";

const COLLAPSED_ROWS = 7;

type Props = {
  eyebrow: string;
  /** One row per day, newest first. */
  days: { key: string; date: string; title: string; detail?: string; money?: string; onPress: () => void }[];
  /** "Show all {count}" label for the collapsed list. */
  showAllLabel: string;
};

// Every day you used something up, so a cook's "4 things saved" doesn't
// vanish once its reward screen closes. Cream bordered card like the home.
export function WinsList({ eyebrow, days, showAllLabel }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (days.length === 0) return null;
  const visible = expanded ? days : days.slice(0, COLLAPSED_ROWS);
  return (
    <View style={styles.section}>
      <Text variant="micro" muted uppercase>
        {eyebrow}
      </Text>
      <View style={styles.card}>
        {visible.map((day, index) => (
          <Pressable
            key={day.key}
            accessibilityRole="button"
            onPress={day.onPress}
            style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressed]}
          >
            <Text variant="small" muted style={styles.date}>
              {day.date}
            </Text>
            <View style={styles.body}>
              <Text variant="label" style={styles.bold}>
                {day.title}
              </Text>
              {day.detail ? (
                <Text variant="small" muted numberOfLines={1}>
                  {day.detail}
                </Text>
              ) : null}
            </View>
            {day.money ? (
              <Text variant="label" color={colors.green} style={styles.bold}>
                {day.money}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      {!expanded && days.length > COLLAPSED_ROWS ? (
        <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} hitSlop={8} style={styles.more}>
          <Text variant="label" color={colors.primary} style={styles.bold}>
            {showAllLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    ...shadows.soft,
    borderRadius: radii.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  date: {
    width: 64,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  more: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bold: {
    fontFamily: fonts.bodyBold,
  },
  pressed: {
    opacity: 0.6,
  },
});
