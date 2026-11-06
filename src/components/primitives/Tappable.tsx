import React from "react";
import { AccessibilityRole, AccessibilityState, Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";

type Feedback = "opacity" | "scale" | "none";

type Props = {
  /** Optional: a full-bleed tap target (a focus layer, a scrim) has none. */
  children?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Spoken name. Required unless the children are already readable text. */
  label?: string;
  hint?: string;
  role?: AccessibilityRole;
  /** Rows and icon buttons dim; tiles and card-sized targets press in. */
  feedback?: Feedback;
  selected?: boolean;
  disabled?: boolean;
  /** The rest of the state: expanded, checked, busy. */
  state?: AccessibilityState;
  /** 8 by default: the value 19 of the app's 32 hand-written targets already used. */
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The single pressable surface. Everything in the app that reacts to a tap
 * and is not a Button goes through this.
 *
 * It exists because the app hand-rolled 117 Pressables with twelve different
 * pressed treatments (opacity .6 through .85, scale .94 through .99) and 44
 * of them had no pressed feedback at all.
 */
export function Tappable({
  children,
  onPress,
  onLongPress,
  label,
  hint,
  role = "button",
  feedback = "opacity",
  selected,
  disabled = false,
  state,
  hitSlop = 8,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled, selected, ...state }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles[feedback],
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  opacity: {
    opacity: 0.7,
  },
  scale: {
    transform: [{ scale: 0.985 }],
  },
  none: {},
  disabled: {
    opacity: 0.45,
  },
});
