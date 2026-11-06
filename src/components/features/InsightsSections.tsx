import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { GlyphTile, SectionHeader, Text } from "../primitives";
import { RecipeGlyph } from "./RecipeGlyph";

// The Insights tab's sections, TinyMeals-style: each answers one question
// about your kitchen; with no data yet, the screen shows an EmptyNote instead.


export function SectionTitle({ title, aside, caption }: { title: string; aside?: string; caption?: string }) {
  return (
    <View style={styles.sectionHead}>
      <SectionHeader
        title={title}
        actions={
          aside ? (
            <Text variant="small" muted>
              {aside}
            </Text>
          ) : null
        }
      />
      {caption ? (
        <Text variant="small" muted>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** A section's line before there's data, or a green "all good" one. */
export function EmptyNote({ text, good }: { text: string; good?: boolean }) {
  return (
    <View style={[styles.card, styles.note, good && styles.noteGood]}>
      {good ? (
        <View style={styles.noteCheck}>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path d="M5.5 12.5l4.2 4.2 8.8-9.4" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      ) : null}
      <Text variant="small" color={good ? colors.primary : colors.muted} weight={good ? "bold" : undefined} style={styles.noteText}>
        {text}
      </Text>
    </View>
  );
}

/** Used (green) stacked on tossed (red) per day or per week; the current bucket is darker. */
export function UsedTossedChart({
  title,
  aside,
  bars,
  legend,
  label,
}: {
  title: string;
  aside?: string;
  bars: { label: string; used: number; tossed: number; current: boolean }[];
  legend: { used: string; tossed: string };
  /** Spoken summary of the chart. */
  label: string;
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.used + bar.tossed));
  const HEIGHT = 96;
  return (
    <View style={styles.card} accessible accessibilityLabel={label}>
      <View style={styles.titleRow}>
        <Text variant="label" weight="bold">
          {title}
        </Text>
        {aside ? (
          <Text variant="small" muted>
            {aside}
          </Text>
        ) : null}
      </View>
      <View style={[styles.bars, { height: HEIGHT + 20 }]}>
        {bars.map((bar, index) => {
          const total = bar.used + bar.tossed;
          return (
            <View key={index} style={styles.barColumn}>
              <Text variant="small" weight="bold" style={total === 0 ? styles.hidden : undefined}>
                {total}
              </Text>
              <View style={[styles.barTrack, { height: HEIGHT }]}>
                {bar.tossed > 0 ? <View style={[styles.barTossed, { height: (bar.tossed / max) * HEIGHT }]} /> : null}
                {bar.used > 0 ? (
                  <View style={[styles.barUsed, bar.current && styles.barCurrent, { height: (bar.used / max) * HEIGHT }]} />
                ) : null}
                {total === 0 ? <View style={styles.barEmpty} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.barLabels}>
        {bars.map((bar, index) => (
          <Text key={index} variant="small" muted center weight={bar.current ? "bold" : undefined} style={styles.barLabel}>
            {bar.label}
          </Text>
        ))}
      </View>
      <View style={styles.legend}>
        <LegendDot color={colors.sage} label={legend.used} />
        <LegendDot color={colors.redInk} label={legend.tossed} />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text variant="small" muted>
        {label}
      </Text>
    </View>
  );
}

/** How much of each food group gets used, plus one tip for the weakest. */
export function FoodGroups({
  rows,
  tip,
}: {
  rows: { category: string; label: string; detail: string; share: number; weak: boolean }[];
  tip?: string;
}) {
  return (
    <>
      <View style={[styles.card, styles.listCard]}>
        {rows.map((row, index) => (
          <View key={row.category} style={[styles.groupRow, index > 0 && styles.divider]}>
            <GlyphTile name="" category={row.category} size="sm" />
            <View style={styles.groupBody}>
              <View style={styles.titleRow}>
                <Text variant="label" weight="bold">
                  {row.label}
                </Text>
                <Text variant="small" color={row.weak ? colors.redInk : colors.muted}>
                  {row.detail}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, row.weak && styles.progressWeak, { width: `${Math.round(row.share * 100)}%` }]} />
              </View>
            </View>
          </View>
        ))}
      </View>
      {tip ? (
        <View style={styles.tip}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"
              stroke={colors.accentInk}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text variant="small" color={colors.accentInk} style={styles.tipText}>
            {tip}
          </Text>
        </View>
      ) : null}
    </>
  );
}

/** A food's last few purchases as dots: green used, red tossed. */
export function GoingOffList({
  rows,
}: {
  rows: { name: string; category: string; detail: string; outcomes: ("used" | "tossed")[]; label: string }[];
}) {
  return (
    <View style={[styles.card, styles.listCard]}>
      {rows.map((row, index) => (
        <View key={row.name} style={[styles.groupRow, index > 0 && styles.divider]} accessible accessibilityLabel={row.label}>
          <GlyphTile name={row.name} category={row.category} size="sm" />
          <View style={styles.groupBody}>
            <View style={styles.titleRow}>
              <Text variant="label" weight="bold">
                {row.name}
              </Text>
              <Text variant="small" color={colors.redInk}>
                {row.detail}
              </Text>
            </View>
            <View style={styles.dots}>
              {row.outcomes.map((outcome, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: outcome === "tossed" ? colors.redInk : colors.sage }]} />
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** The period's most-cooked dinners, ranked. */
export function TopDinners({ dinners }: { dinners: { title: string; detail: string; onPress?: () => void }[] }) {
  return (
    <View style={styles.dinners}>
      {dinners.map((dinner, index) => (
        <Pressable
          key={dinner.title}
          accessibilityRole={dinner.onPress ? "button" : undefined}
          disabled={!dinner.onPress}
          onPress={dinner.onPress}
          style={({ pressed }) => [styles.dinner, pressed && styles.pressed]}
        >
          <View style={styles.dinnerTile}>
            <RecipeGlyph size={30} />
            <View style={styles.rank}>
              <Text variant="small" weight="bold" color={colors.onPrimary}>
                {index + 1}
              </Text>
            </View>
          </View>
          <Text variant="label" weight="bold" numberOfLines={2}>
            {dinner.title}
          </Text>
          <Text variant="small" muted>
            {dinner.detail}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadows.soft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  noteGood: {
    backgroundColor: colors.sageTint,
    borderColor: colors.sageTint,
  },
  noteCheck: {
    width: 26,
    height: 26,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  noteText: {
    flex: 1,
  },
  listCard: {
    paddingVertical: spacing.xs,
    gap: 0,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  hidden: {
    opacity: 0,
  },
  barTrack: {
    width: "100%",
    maxWidth: 40,
    justifyContent: "flex-end",
    gap: 2,
  },
  barUsed: {
    borderRadius: radii.xs,
    backgroundColor: colors.sage,
  },
  barCurrent: {
    backgroundColor: colors.primary,
  },
  barTossed: {
    borderRadius: 4,
    backgroundColor: colors.redInk,
  },
  barEmpty: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.surface3,
  },
  barLabels: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: -spacing.xs,
  },
  barLabel: {
    flex: 1,
  },
  legend: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  groupBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressWeak: {
    backgroundColor: colors.redInk,
  },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
  },
  tipText: {
    flex: 1,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: radii.xs,
  },
  dinners: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dinner: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...shadows.soft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  dinnerTile: {
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  rank: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
