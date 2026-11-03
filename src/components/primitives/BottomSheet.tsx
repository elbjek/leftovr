import React, { useEffect, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../../theme";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// The dim backdrop fades in place while only the sheet slides up; the Modal
// itself doesn't animate (its "slide" moved the backdrop with the sheet).
// It stays mounted until the closing animation ends.
export function BottomSheet({ visible, onDismiss, children, style }: Props) {
  const { height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 300 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, mounted, progress]);

  return (
    <Modal animationType="none" transparent visible={mounted} onRequestClose={onDismiss}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            style,
            { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] },
          ]}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(31,31,31,0.42)",
  },
  sheet: {
    // Tall content must scroll inside the sheet, never push it past the top.
    maxHeight: "88%",
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
    ...shadows.sheet,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.hairlineStrong,
    marginBottom: spacing.xl,
  },
});
