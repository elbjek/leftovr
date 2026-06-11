import React from "react";
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../theme";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  topInset?: boolean;
  bottomInset?: boolean;
  backgroundColor?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  topInset = true,
  bottomInset = true,
  backgroundColor = colors.surface,
  contentContainerStyle,
  style,
}: Props) {
  const contentStyle = [
    padded && styles.padded,
    !topInset && styles.noTop,
    !bottomInset && styles.noBottom,
    contentContainerStyle,
  ];

  return (
    <SafeAreaView
      // bottomInset={false} also drops the safe-area bottom edge: inside the
      // tab navigator the dock already clears the home indicator, so keeping
      // the edge would float absolute-bottom CTAs an extra inset above it.
      edges={bottomInset ? ["top", "bottom", "left", "right"] : ["top", "left", "right"]}
      style={[styles.safe, { backgroundColor }, style]}
    >
      {scroll ? (
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentStyle}
          style={styles.fill}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
  },
  noTop: {
    paddingTop: spacing.xxl,
  },
  noBottom: {
    paddingBottom: spacing.xxl,
  },
});
