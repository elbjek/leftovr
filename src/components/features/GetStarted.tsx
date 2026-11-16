import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { IconButton, Tappable, Text } from "../primitives";

type Step = { label: string; icon: React.ReactNode };

/** Three peach-circled steps in a row: what the app does, before any food is in. */
export function HowItWorks({ steps }: { steps: Step[] }) {
  return (
    <View style={styles.howRow}>
      {steps.map((step) => (
        <View key={step.label} style={styles.howCard}>
          <View style={styles.howIcon}>{step.icon}</View>
          <Text variant="small" weight="bold" center>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

type Task = { label: string; done: boolean; onPress: () => void };

type Props = {
  title: string;
  progress: string;
  hideLabel: string;
  onHide: () => void;
  tasks: Task[];
};

/** The new account's first steps; done ones tick off, open ones are tappable. */
export function GetStartedCard({ title, progress, hideLabel, onHide, tasks }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text variant="title">{title}</Text>
        <View style={styles.headRight}>
          <Text variant="small" muted>
            {progress}
          </Text>
          <IconButton label={hideLabel} transparent size={32} onPress={onHide} style={styles.hide}>
            <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
              <Path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </IconButton>
        </View>
      </View>
      {tasks.map((task) => (
        <Tappable
          key={task.label}
          onPress={task.done ? undefined : task.onPress}
          disabled={task.done}
          role="checkbox"
          state={{ checked: task.done }}
          label={task.label}
          style={styles.row}
        >
          <View style={[styles.check, task.done && styles.checkDone]}>
            {task.done ? (
              <Svg width={12} height={12} viewBox="0 0 24 24">
                <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.onPrimary} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            ) : null}
          </View>
          <Text variant="label" muted={task.done} style={styles.rowLabel}>
            {task.label}
          </Text>
          {task.done ? null : (
            <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}>
              <Path d="M9 6l6 6-6 6" fill="none" stroke={colors.muted2} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </Tappable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  howRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  howCard: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...shadows.soft,
  },
  howIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadows.soft,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  headRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  // Pulls the X into the card's corner padding, like the home's banners.
  hide: {
    marginRight: -spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.muted2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  rowLabel: {
    flex: 1,
  },
});
