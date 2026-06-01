import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../../theme";

type Props = {
  children: React.ReactNode;
};

export function BottomDock({ children }: Props) {
  return <View style={styles.dock}>{children}</View>;
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
