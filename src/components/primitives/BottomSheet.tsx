import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Platform, Pressable, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../../theme";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Full-screen content drawn above the sheet inside the same Modal. Use it
   * to go from a sheet to a full screen: a second Modal opened while this one
   * closes is dismissed along with it on iOS.
   */
  overlay?: React.ReactNode;
  /**
   * Called once the sheet's Modal is fully gone. Open the next Modal (another
   * sheet) from here, never right after onDismiss — iOS would dismiss it too.
   */
  onClosed?: () => void;
  /**
   * Draw in place (absolutely filling the parent) instead of in a Modal, so
   * whatever sits outside the parent, like the dock, stays visible and
   * tappable. The parent decides how much of the screen the sheet covers.
   */
  inline?: boolean;
};

// The dim backdrop fades in place while only the sheet slides up; the Modal
// itself doesn't animate (its "slide" moved the backdrop with the sheet).
// It stays mounted until the closing animation ends.
export function BottomSheet({ visible, onDismiss, children, style, overlay, onClosed, inline = false }: Props) {
  const { height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  // Kept in a ref so an inline callback doesn't restart the animation effect.
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  useEffect(() => {
    if (!mounted) return;
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 300 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
        // iOS reports this from Modal.onDismiss, after the native dismissal.
        if (inline || Platform.OS !== "ios") onClosedRef.current?.();
      }
    });
  }, [visible, mounted, progress, inline]);

  const content = (
    <>
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
      {overlay}
    </>
  );

  if (inline) {
    return mounted ? (
      <View style={styles.inline} pointerEvents="box-none">
        {content}
      </View>
    ) : null;
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={mounted}
      onRequestClose={onDismiss}
      onDismiss={Platform.OS === "ios" ? onClosed : undefined}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  inline: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
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
