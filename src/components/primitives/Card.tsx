import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../../theme";

type Props = {
  children: React.ReactNode;
  padded?: boolean;
  dashed?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, padded = true, dashed = false, style }: Props) {
  return (
    <View style={[styles.card, padded && styles.padded, dashed && styles.dashed, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.card,
  },
  padded: {
    padding: spacing.lg,
  },
  dashed: {
    borderStyle: "dashed",
    borderColor: colors.hairlineStrong,
  },
});

