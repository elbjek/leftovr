import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../../theme";
import { Text } from "./Text";

type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.item, active && styles.active]}
          >
            <Text variant="label" color={active ? colors.surface : colors.primary}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: spacing.xs,
  },
  item: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  active: {
    backgroundColor: colors.primary,
  },
});

