import React from "react";
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { colors, fonts, radii, spacing } from "../../theme";
import { Text } from "./Text";

type Props = TextInputProps & {
  label: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function TextField({ label, error, containerStyle, style, ...props }: Props) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text variant="micro" muted uppercase style={styles.label}>
        {label.toLocaleUpperCase()}
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
    minHeight: 60,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.paper,
    paddingHorizontal: 18,
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    lineHeight: 22,
  },
  inputError: {
    borderColor: colors.red,
  },
  error: {
    paddingLeft: spacing.xs,
  },
});
