import React, { useRef, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputInstance,
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
  /** Overrides the field box. */
  boxStyle?: StyleProp<ViewStyle>;
};

/**
 * A text input in an inset well.
 *
 * The outline is gone; the field is now a step down from the surface it
 * sits on, which is the shape of an input rather than a decoration around
 * it. Focus keeps a ring — that is the one place a border is not a last
 * resort, because an invisible focus state fails WCAG 2.4.11 outright.
 *
 * The error line moved from red to redInk. Red measures 2.9:1 on a light
 * surface and failed the 4.5:1 bar for body text, and an error that cannot
 * be read is not an error message. The well tints with it, so the failure
 * is carried by more than the text colour.
 */
export function TextField({
  label,
  error,
  containerStyle,
  boxStyle,
  style,
  onFocus,
  onBlur,
  editable = true,
  ...props
}: Props) {
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Pressable
        accessible={false}
        style={[
          styles.box,
          boxStyle,
          !editable && styles.boxDisabled,
          focused && styles.boxFocused,
          error ? styles.boxError : null,
        ]}
        onPress={() => inputRef.current?.focus()}
      >
        <Text variant="micro" muted uppercase>
          {label}
        </Text>
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted2}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          style={[styles.input, style]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
      </Pressable>
      {error ? (
        <Text variant="small" color={colors.redInk} style={styles.error}>
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
  box: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  boxDisabled: {
    opacity: 0.45,
  },
  // The one legitimate border: an invisible focus state fails WCAG 2.4.11.
  boxFocused: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md - 1.5,
    paddingVertical: spacing.sm - 1.5,
  },
  boxError: {
    backgroundColor: colors.redSoft,
  },
  input: {
    minHeight: 28,
    padding: 0,
    color: colors.text,
    ...typography.body,
  },
  error: {
    paddingLeft: spacing.xs,
  },
});
