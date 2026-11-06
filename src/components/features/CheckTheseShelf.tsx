import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radii, spacing } from "../../theme";
import { Text } from "../primitives";

export type CheckItem = {
  id: string;
  name: string;
  category?: string;
  /** "Expired" when the user-entered date passed, else "Past its best". */
  label: string;
  /** Compact date-only variant for dense lists ("5 Jul 2026" / "No date"). */
  shortLabel?: string;
};

type Props = {
  count: number;
  labels: {
    kicker: string;
    subtitle: string;
  };
  onPress: () => void;
};

// Items past their (known or estimated) date. They left the category shelves
// and everything that cooks — this warm note exists to be emptied: it opens
// the triage sheet where food gets vouched for ("still good") or tossed.
export function CheckTheseShelf({ count, labels, onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <AlertIcon />
        </View>
        <View style={styles.copy}>
          <Text variant="label" color={colors.text} style={styles.kicker}>
            {labels.kicker} · {count}
          </Text>
          <Text variant="small" muted numberOfLines={2} style={styles.subtitle}>
            {labels.subtitle}
          </Text>
        </View>
        <ChevronIcon />
      </Pressable>
    </View>
  );
}

function AlertIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5 21 20H3L12 3.5Z"
        stroke={colors.text}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 10v4.5M12 17.2v.3" stroke={colors.text} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M5 2.5 9.5 7 5 11.5" stroke={colors.muted2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenX,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.xl,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
  },
  subtitle: {
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.75,
  },
});
