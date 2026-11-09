import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { foodIconKey } from "../../lib/foodIcons";
import { colors, radii, shadows, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Divider, GlyphTile, Tappable, Text } from "../primitives";
import { RecipeGlyph } from "./RecipeGlyph";

// The Insights tab's sections: each answers one question about your kitchen;
// with no data yet, the screen shows an EmptyNote instead.

export function SectionTitle({ title, aside, caption }: { title: string; aside?: string; caption?: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionRow}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        {aside ? (
          <Text variant="small" muted>
            {aside}
          </Text>
        ) : null}
      </View>
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

export type CalendarCell = {
  /** Day number, weekday letter or month name; "" for a blank lead-in cell. */
  label: string;
  used: number;
  tossed: number;
  /** Not reached yet: drawn empty and quiet. */
  future?: boolean;
};

// Sage steps for "more used": none (outlined), a little, some, the most.
const LEVELS = [undefined, colors.sageTint, colors.sageBorder, colors.sage] as const;

/**
 * The period as a grid instead of a bar chart: one cell per day (week,
 * month) or per month (year). Greener = more used up that day; a tomato
 * outline = something was tossed.
 */
export function UsageCalendar({
  cells,
  columns,
  head,
  legend,
  label,
}: {
  cells: CalendarCell[];
  columns: number;
  /** Weekday letters over a month grid. */
  head?: string[];
  legend: { used: string; tossed: string };
  /** Spoken summary of the grid. */
  label: string;
}) {
  const max = Math.max(1, ...cells.map((cell) => cell.used));
  const rows: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));
  return (
    <View style={styles.card} accessible accessibilityLabel={label}>
      <View style={styles.grid}>
        {head ? (
          <View style={styles.gridRow}>
            {head.map((day, index) => (
              <Text key={index} variant="small" muted center weight="bold" style={styles.cellSlot}>
                {day}
              </Text>
            ))}
          </View>
        ) : null}
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {Array.from({ length: columns }, (_, index) => {
              const cell = row[index];
              if (!cell || cell.label === "") return <View key={index} style={styles.cellSlot} />;
              const level = cell.used === 0 ? 0 : Math.ceil((cell.used / max) * 3);
              return (
                <View
                  key={index}
                  style={[
                    styles.cellSlot,
                    styles.cell,
                    level === 0 ? styles.cellEmpty : { backgroundColor: LEVELS[level] },
                    cell.tossed > 0 && styles.cellTossed,
                  ]}
                >
                  <Text variant="small" weight="bold" color={cell.future ? colors.muted2 : colors.text} numberOfLines={1}>
                    {cell.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.sage }]} />
          <Text variant="small" muted>
            {legend.used}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.cellTossed]} />
          <Text variant="small" muted>
            {legend.tossed}
          </Text>
        </View>
      </View>
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
    <View style={[styles.card, styles.listCard]}>
      {rows.map((row) => (
        <View key={row.category} style={styles.row}>
          <GlyphTile name="" category={row.category} size="sm" round style={styles.well} />
          <View style={styles.rowBody}>
            <View style={styles.titleRow}>
              <Text variant="small" weight="bold" color={row.weak ? colors.redInk : colors.text}>
                {row.label}
              </Text>
              <Text variant="small" weight="bold" color={row.weak ? colors.redInk : colors.text}>
                {`${Math.round(row.share * 100)}%`}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, row.weak && styles.progressWeak, { width: `${Math.round(row.share * 100)}%` }]} />
            </View>
            <Text variant="small" muted>
              {row.detail}
            </Text>
          </View>
        </View>
      ))}
      {tip ? (
        <Text variant="small" muted style={styles.tip}>
          {tip}
        </Text>
      ) : null}
    </View>
  );
}

/** A food's last few purchases as dots: sage used, tomato ring tossed. */
export function GoingOffList({
  rows,
}: {
  rows: { name: string; category: string; detail: string; outcomes: ("used" | "tossed")[]; label: string }[];
}) {
  return (
    <View style={[styles.card, styles.listCard]}>
      {rows.map((row, index) => (
        <View key={row.name}>
          {index > 0 ? <Divider /> : null}
          <View style={styles.row} accessible accessibilityLabel={row.label}>
            <GlyphTile name={row.name} category={row.category} size="sm" round style={styles.well} />
            <View style={styles.rowBody}>
              <Text variant="small" weight="bold">
                {row.name}
              </Text>
              <Text variant="small" muted>
                {row.detail}
              </Text>
            </View>
            <View style={styles.dots}>
              {row.outcomes.map((outcome, i) => (
                <View key={i} style={[styles.dot, outcome === "tossed" ? styles.dotTossed : styles.dotUsed]} />
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
    <View style={[styles.card, styles.listCard]}>
      {dinners.map((dinner, index) => (
        <View key={dinner.title}>
          {index > 0 ? <Divider /> : null}
          <Tappable
            role={dinner.onPress ? "button" : "text"}
            disabled={!dinner.onPress}
            onPress={dinner.onPress}
            hitSlop={0}
            style={styles.row}
          >
            <View style={[styles.well, styles.wellPeach]}>
              {/* A dish named after a food we have an icon for wears it. */}
              {foodIconKey(dinner.title) ? <FoodGlyph name={dinner.title} size={22} /> : <RecipeGlyph size={24} />}
            </View>
            <Text variant="small" weight="bold" numberOfLines={2} style={styles.rowBody}>
              {dinner.title}
            </Text>
            <Text variant="small" muted>
              {dinner.detail}
            </Text>
          </Tappable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    gap: 2,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
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
    ...shadows.soft,
    padding: spacing.xl,
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
    paddingVertical: spacing.sm,
    gap: 0,
  },
  grid: {
    gap: spacing.xs,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  cellSlot: {
    flex: 1,
    minWidth: 0,
  },
  cell: {
    height: 40,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cellEmpty: {
    borderWidth: 1.5,
    borderColor: colors.cardLine,
  },
  cellTossed: {
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  legend: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.md,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  // Food sits on a round sage well so pale foods show.
  well: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  wellPeach: {
    backgroundColor: colors.surface2,
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
    backgroundColor: colors.sage,
  },
  progressWeak: {
    backgroundColor: colors.primary,
  },
  tip: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  dots: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  dotUsed: {
    backgroundColor: colors.sage,
  },
  dotTossed: {
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
});
