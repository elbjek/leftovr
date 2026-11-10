import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { spacing } from "../../theme";
import { Text } from "./Text";

type Level = "section" | "sheet";

type Props = {
  title: string;
  subtitle?: string;
  /** A count, a "See all", an icon button — rendered at the trailing edge. */
  actions?: React.ReactNode;
  /** "sheet" gives a BottomSheet title a body-size subtitle. The title itself
   *  is h3 either way: no heading in the app is bigger than the home's
   *  "More for you". */
  level?: Level;
  style?: StyleProp<ViewStyle>;
};

/**
 * The title above a group of content. ScreenHeader's smaller sibling, with
 * the same shape of API.
 *
 * Two patterns in the app collapse into this one. The larger is the sheet
 * title: `<Text variant="h3">` at the top of a BottomSheet, 16 times, often
 * with a muted line under it. The smaller is the section head row — title
 * left, count or action right, baseline-aligned — written eight times under
 * five different names (sectionHead, titleRow, headerRow, head, resultsHead).
 *
 * In-screen sections drop from h2 to h3. A screen has one h1 in its
 * ScreenHeader; its sections sit a step below it, not level with it.
 */
export function SectionHeader({ title, subtitle, actions, level = "section", style }: Props) {
  const isSheet = level === "sheet";

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.copy}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant={isSheet ? "body" : "small"} muted style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    marginTop: spacing.xxs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
