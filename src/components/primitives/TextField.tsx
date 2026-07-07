import React, { useRef, useState } from "react";
import {
  Pressable,
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

export function TextField({
  label,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Pressable
        accessible={false}
        style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null]}
        onPress={() => inputRef.current?.focus()}
      >
        <Text variant="micro" muted uppercase>
          {label}
        </Text>
        <TextInput
          ref={inputRef}
          placeholderTextColor={colors.muted2}
          autoCapitalize="none"
          autoCorrect={false}
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
  box: {
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  boxFocused: {
    borderColor: colors.sage,
  },
  boxError: {
    borderColor: colors.red,
  },
  input: {
    height: 36,
    padding: 0,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
  },
  error: {
    paddingLeft: spacing.xs,
  },
});
