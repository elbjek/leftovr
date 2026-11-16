import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { IconButton, Tappable, Text } from "../primitives";
import { useHop } from "./FoodShelf";

type Step = { label: string; food: string };

/**
 * Three numbered steps, each a food hopping on a peach tile: the dinner card's
 * shelf carried down the page, before any food is in.
 */
export function HowItWorks({ steps }: { steps: Step[] }) {
  const hops = useHop(steps.length);
  return (
    <View style={styles.howRow}>
      {steps.map((step, i) => (
        <View key={step.label} style={styles.howCard} accessible accessibilityLabel={`${i + 1}. ${step.label}`}>
          <View style={styles.howTile}>
            <View style={styles.howNumber}>
              <Text variant="micro" color={colors.onPrimary}>
                {i + 1}
              </Text>
            </View>
            <Animated.View style={{ transform: [{ translateY: hops[i] }] }}>
              <FoodGlyph name={step.food} size={30} />
            </Animated.View>
          </View>
          <Text variant="small" weight="bold" center>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

type Task = { label: string; food: string; done: boolean; onPress: () => void };

type Props = {
  title: string;
  progress: string;
  hideLabel: string;
  onHide: () => void;
  tasks: Task[];
};

/**
 * The new account's first steps: a tomato progress bar, a food on a peach
 * well per step, the next one tinted. Done steps tick off.
 */
export function GetStartedCard({ title, progress, hideLabel, onHide, tasks }: Props) {
  const done = tasks.filter((task) => task.done).length;
  const next = tasks.findIndex((task) => !task.done);

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

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(done / tasks.length) * 100}%` }]} />
      </View>

      {tasks.map((task, i) => {
        const isNext = i === next;
        return (
          <Tappable
            key={task.label}
            onPress={task.done ? undefined : task.onPress}
            disabled={task.done}
            role="checkbox"
            state={{ checked: task.done }}
            label={task.label}
            style={[styles.row, isNext && styles.rowNext]}
          >
            <View style={styles.well}>
              <FoodGlyph name={task.food} size={22} />
              {task.done ? (
                <View style={styles.tick}>
                  <Svg width={9} height={9} viewBox="0 0 24 24">
                    <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.onPrimary} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </Svg>
                </View>
              ) : null}
            </View>
            <Text variant="label" muted={task.done} style={styles.rowLabel}>
              {task.label}
            </Text>
            {task.done ? null : (
              <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}>
                <Path
                  d="M9 6l6 6-6 6"
                  fill="none"
                  stroke={isNext ? colors.primary : colors.muted2}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </Tappable>
        );
      })}
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
    gap: spacing.sm,
    padding: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...shadows.soft,
  },
  howTile: {
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  howNumber: {
    position: "absolute",
    top: spacing.xs,
    left: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
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
  track: {
    height: 6,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  // The tint runs to the card's edges; the row's own padding keeps the text in line.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radii.md,
  },
  rowNext: {
    backgroundColor: colors.primary50,
  },
  well: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
  },
});
