import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../../theme";
import { Tappable } from "./Tappable";
import { Text } from "./Text";

type Props = {
  label: string;
  active?: boolean;
  count?: string;
  disabled?: boolean;
  onPress?: () => void;
};

/**
 * A filter toggle.
 *
 * The hairline outline is gone: resting is a white chip on the grey page,
 * active is the solid primary fill the interaction spec gives a selected
 * control. A short label on a solid fill is unambiguous in a way a 1px
 * border changing colour never was.
 */
export function FilterChip({ label, active = false, count, disabled = false, onPress }: Props) {
  return (
    <Tappable
      selected={active}
      disabled={disabled}
      onPress={onPress}
      label={count ? `${label}, ${count}` : label}
      hitSlop={0}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text variant="small" color={active ? colors.onPrimary : colors.text}>
        {label}
      </Text>
      {count ? (
        <View style={[styles.count, active && styles.countActive]}>
          <Text variant="micro" color={active ? colors.text : colors.primary}>
            {count}
          </Text>
        </View>
      ) : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primary,
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
