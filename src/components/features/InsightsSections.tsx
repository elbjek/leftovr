import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { GlyphTile, SectionHeader, Tappable, Text } from "../primitives";

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

/** The period in one sentence, with the strongest and weakest group as chips. */
export function StoryCard({
  title,
  body,
  chips,
}: {
  title: string;
  body: string;
  chips: { text: string; weak?: boolean }[];
}) {
  return (
    <View style={styles.card}>
      <View style={styles.storyText}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="body" muted>
          {body}
        </Text>
      </View>
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <View key={chip.text} style={[styles.chip, chip.weak && styles.chipWeak]}>
              <Text variant="small" weight="bold" color={chip.weak ? colors.redInk : colors.primary}>
                {chip.text}
              </Text>
            </View>
          ))}
        </View>
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
        <View style={styles.legend}>
          <LegendDot color={colors.sage} label={legend.used} />
          <LegendDot color={colors.redInk} label={legend.tossed} />
        </View>
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
      {aside ? (
        <View style={styles.callout}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 3l2.4 5.2 5.6.7-4.1 3.9 1.1 5.6L12 15.7 6.9 18.4 8 12.8 3.9 8.9l5.6-.7L12 3z"
              stroke={colors.primary}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text variant="small" weight="bold" color={colors.primary} style={styles.calloutText}>
            {aside}
          </Text>
        </View>
      ) : null}
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
              <Text variant="label" weight="bold">
                {row.label}
              </Text>
              <Text variant="small" color={row.weak ? colors.redInk : colors.muted}>
                {row.detail}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, row.weak && styles.progressWeak, { width: `${Math.round(row.share * 100)}%` }]} />
              </View>
            </View>
            <Text variant="label" weight="extrabold" color={row.weak ? colors.redInk : colors.primary}>
              {`${Math.round(row.share * 100)}%`}
            </Text>
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

/** The period's most-cooked dinners as a menu: the dish, then how often. */
export function TopDinners({ dinners }: { dinners: { title: string; detail: string; onPress?: () => void }[] }) {
  return (
    <View style={styles.menu}>
      {dinners.map((dinner, index) => (
        <Tappable
          key={dinner.title}
          role={dinner.onPress ? "button" : "text"}
          disabled={!dinner.onPress}
          onPress={dinner.onPress}
          hitSlop={0}
          style={[styles.dinner, index > 0 && styles.menuDivider]}
        >
          <Text variant="label" weight="bold" color={colors.onPrimary} numberOfLines={2} style={styles.dinnerTitle}>
            {dinner.title}
          </Text>
          <Text variant="label" weight="extrabold" color={colors.onPrimary}>
            {dinner.detail}
          </Text>
        </Tappable>
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
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.cardLine,
    padding: spacing.lg,
    gap: spacing.md,
  },
  storyText: {
    gap: spacing.xs,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.sageTint,
  },
  chipWeak: {
    backgroundColor: colors.redSoft,
  },
  callout: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.sageTint,
  },
  calloutText: {
    flex: 1,
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
    gap: 4,
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
    gap: 5,
  },
  dot: {
    width: 18,
    height: 7,
    borderRadius: radii.pill,
  },
  menu: {
    backgroundColor: colors.primary,
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.lg,
  },
  dinner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.md,
  },
  menuDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.inverseHairline,
  },
  dinnerTitle: {
    flex: 1,
    minWidth: 0,
  },
});
