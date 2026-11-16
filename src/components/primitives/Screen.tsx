import React from "react";
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { FitScrollView } from "./FitScrollView";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../theme";

type Props = {
  children: React.ReactNode;
  /** Fixed above the scroll area (a tab's logo row), so pull-to-refresh
   *  opens under it instead of dragging it down. */
  header?: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  topInset?: boolean;
  bottomInset?: boolean;
  backgroundColor?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Pull-to-refresh control; only applies when scroll is true. Enables bounce
   *  (pull down only while the content fits; see FitScrollView). */
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
  /** "handled" lets a button take the tap while the keyboard is up. */
  keyboardShouldPersistTaps?: React.ComponentProps<typeof ScrollView>["keyboardShouldPersistTaps"];
};

export function Screen({
  children,
  header,
  scroll = false,
  padded = true,
  topInset = true,
  bottomInset = true,
  backgroundColor = colors.bg,
  contentContainerStyle,
  style,
  refreshControl,
  keyboardShouldPersistTaps,
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
      {header}
      {scroll ? (
        <FitScrollView
          bounces={Boolean(refreshControl)}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentStyle}
          style={styles.fill}
        >
          {children}
        </FitScrollView>
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
