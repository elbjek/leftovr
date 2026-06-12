import { StyleSheet, View } from "react-native";
import { radii, shadows, spacing } from "../../theme";

type Props = {
  children: React.ReactNode;
};

// Floating pill CTA: hovers over the list bottom instead of claiming a
// full-width bordered strip, so content scrolls underneath and the screen
// keeps the ~40px it used to lose. box-none lets touches beside the pill
// reach the list.
export function BottomDock({ children }: Props) {
  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <View style={styles.pill}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    bottom: spacing.md,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    borderRadius: radii.pill,
    ...shadows.primaryButton,
  },
});
