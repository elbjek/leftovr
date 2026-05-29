import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../../theme";

type Props = {
  count: number;
  current: number;
};

export function PageDots({ count, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === current ? styles.active : styles.inactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
  },
  dot: {
    height: 6,
    borderRadius: radii.pill,
  },
  active: {
    width: 22,
    backgroundColor: colors.primary,
  },
  inactive: {
    width: 6,
    backgroundColor: colors.hairlineStrong,
  },
});

