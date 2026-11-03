import { StyleSheet, View } from "react-native";

import { colors, fonts, radii, spacing } from "../../theme";
import { Text } from "../primitives";

type Props = {
  eyebrow: string;
  /** Label on the left, value on the right; `tone` colours the value. */
  rows: { label: string; value: string; tone?: "danger" }[];
};

// A titled cream card of label/value rows (Insights highlights).
export function FactList({ eyebrow, rows }: Props) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text variant="micro" muted uppercase>
        {eyebrow}
      </Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && styles.rowDivider]}>
            <Text variant="small" muted style={styles.label}>
              {row.label}
            </Text>
            <Text
              variant="label"
              numberOfLines={1}
              color={row.tone === "danger" ? colors.redInk : colors.text}
              style={styles.value}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.cardLine,
  },
  label: {
    flexShrink: 0,
  },
  value: {
    flex: 1,
    textAlign: "right",
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
});
