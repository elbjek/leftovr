import React from "react";
import { Modal, Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../../theme";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function BottomSheet({ visible, onDismiss, children, style }: Props) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onDismiss} />
        <View style={[styles.sheet, style]}>
          <View style={styles.handle} />
          {children}
        </View>
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
    backgroundColor: "rgba(28,28,26,0.42)",
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
