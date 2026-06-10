import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { Text } from "./Text";
import { spacing } from "../../theme";

type Props = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  /** Icon buttons or similar, rendered to the right of the copy. */
  actions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({ title, eyebrow, subtitle, actions, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.copy}>
        {eyebrow ? (
          <Text variant="micro" muted uppercase>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h1" style={eyebrow ? styles.titleWithEyebrow : undefined}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" muted style={styles.subtitle}>
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
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  titleWithEyebrow: {
    marginTop: spacing.xxs,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
