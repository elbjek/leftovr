import React from "react";
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { colors, radii, spacing, typography } from "../../theme";
import { Text } from "./Text";

type Props = TextInputProps & {
  label: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function TextField({ label, error, containerStyle, style, ...props }: Props) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.muted2}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, error && styles.inputError, style]}
        {...props}
      />
      {error ? (
        <Text variant="small" color={colors.red} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    paddingLeft: spacing.xs,
  },
  input: {
    minHeight: 54,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  inputError: {
    borderColor: colors.red,
  },
  error: {
    paddingLeft: spacing.xs,
  },
});

