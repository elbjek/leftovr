import { StyleSheet, View } from "react-native";

import { colors, radii, spacing, urgencyColors } from "../../theme";
import { Text } from "../primitives";

type Props = {
  fresh: number;
  soon: number;
  urgent: number;
  labels: {
    today: string;
    soon: string;
    fresh: string;
    total: (count: number) => string;
  };
};

// Whole-kitchen freshness at a glance: a segmented bar (fresh / soon / today)
// with a counted legend and the total item count.
export function KitchenPulse({ fresh, soon, urgent, labels }: Props) {
  const total = fresh + soon + urgent;
  if (total === 0) return null;

  const segments = [
    { value: fresh, color: urgencyColors.safe },
    { value: soon, color: urgencyColors.useSoon },
    { value: urgent, color: urgencyColors.urgent },
  ].filter((s) => s.value > 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {segments.map((seg, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              { flex: seg.value, backgroundColor: seg.color },
              index < segments.length - 1 && styles.segmentGap,
            ]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItems}>
          <Legend color={urgencyColors.safe} label={labels.fresh} count={fresh} />
          <Legend color={urgencyColors.useSoon} label={labels.soon} count={soon} />
          <Legend color={urgencyColors.urgent} label={labels.today} count={urgent} />
        </View>
        <Text variant="small" muted>
          {labels.total(total)}
        </Text>
      </View>
    </View>
  );
}

function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="small" color={colors.text}>
        <Text variant="small" color={colors.text} style={styles.count}>{count}</Text> {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  track: {
    flexDirection: "row",
    height: 8,
    borderRadius: radii.pill,
    overflow: "hidden",
    backgroundColor: colors.surface2,
  },
  segment: {
    height: "100%",
  },
  segmentGap: {
    marginRight: 2,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  legendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
    flexShrink: 1,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  count: {
    fontWeight: "700",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
