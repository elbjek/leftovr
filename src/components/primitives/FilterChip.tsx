import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../../theme";
import { Tappable } from "./Tappable";
import { Text } from "./Text";

type Props = {
  label: string;
  active?: boolean;
  count?: string;
  disabled?: boolean;
  /** "dark": resting chips are dark with white text, the active one stays tomato. */
  tone?: "light" | "dark";
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
export function FilterChip({ label, active = false, count, disabled = false, tone = "light", onPress }: Props) {
  const dark = tone === "dark" && !active;
  return (
    <Tappable
      selected={active}
      disabled={disabled}
      onPress={onPress}
      label={count ? `${label}, ${count}` : label}
      // 36 high, so 4 each side brings the target to Apple's 44pt minimum
      // without eating into the 8pt gap between chips.
      hitSlop={4}
      style={[styles.chip, dark && styles.chipDark, active && styles.chipActive]}
    >
      <Text variant="small" color={active || dark ? colors.onPrimary : colors.text}>
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
    backgroundColor: colors.surface2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  chipDark: {
    backgroundColor: colors.text,
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
