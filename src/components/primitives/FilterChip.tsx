import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { colors, radii, spacing } from "../../theme";

type Props = {
  label: string;
  active?: boolean;
  count?: string;
};

export function FilterChip({ label, active = false, count }: Props) {
  return (
    <View style={[styles.chip, active && styles.chipActive]}>
      <Text variant="small" color={active ? colors.surface : colors.text} style={styles.chipText}>
        {label}
      </Text>
      {count ? (
        <View style={[styles.count, active && styles.countActive]}>
          <Text variant="micro" color={active ? colors.text : colors.primary}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontWeight: "600",
  },
  count: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    backgroundColor: colors.primary50,
  },
  countActive: {
    backgroundColor: colors.accent,
  },
});
