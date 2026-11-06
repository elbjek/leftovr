import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../../theme";

type Props = {
  children: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A white surface on the grey page.
 *
 * The border is gone. It was doing the work of separating the card from the
 * page because the two surfaces were 1.02:1 apart — paper #FDF8F6 on a
 * #F9F6F1 background — which is to say indistinguishable. White on #EDEDEB
 * is 1.17:1, so the card now reads as a card on its own, and the outline
 * has nothing left to do.
 */
export function Card({ children, padded = true, style }: Props) {
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadows.soft,
  },
  padded: {
    padding: spacing.lg,
  },
});
