import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Text } from "../primitives";
import { FlameIcon } from "./WeekStrip";

/** A move against the period before: "+3" / "−€2.10", green when it's good news. */
export type Delta = { label: string; direction: "up" | "down"; good: boolean };

type Figure = { label: string; value: string; sub?: string; delta?: Delta };

type Props = {
  /** The period's headline number: things rescued, and how that moved. */
  rescued: Figure;
  /** Rescued against the period before: an up or down caret on its line. */
  trend?: "up" | "down";
  /** Foods used up in the period, newest first; the first few show as icons. */
  foods?: { name: string; category: string }[];
  saved: Figure;
  dinners: Figure;
  tossed: Figure;
  streak: Figure;
  /** The last 7 days, oldest first: true where the streak was kept (used or frozen). */
  streakDays?: boolean[];
};

const SHOWN_FOODS = 4;

// The top of Insights, built like the home: one solid tomato block for what
// was rescued (the foods themselves as white wells), then four white lifted
// stat tiles with a peach icon square and how each moved. The tomato block
// is the screen's only colour block; everything under it is a white card.
export function PeriodSummary({ rescued, trend, foods = [], saved, dinners, tossed, streak, streakDays = [] }: Props) {
  const shown = foods.slice(0, SHOWN_FOODS);
  const more = foods.length - shown.length;
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.heroMark} pointerEvents="none" />
        <View style={styles.copy}>
          <Text variant="small" weight="bold" color={colors.onPrimary} style={styles.soft}>
            {rescued.label}
          </Text>
          <Text variant="numeral" color={colors.onPrimary}>
            {rescued.value}
          </Text>
          {rescued.sub ? (
            <View style={styles.trend}>
              {trend ? <Caret direction={trend} color={colors.onPrimary} /> : null}
              <Text variant="small" weight="bold" color={colors.onPrimary} style={styles.trendText}>
                {rescued.sub}
              </Text>
            </View>
          ) : null}
        </View>
        {shown.length > 0 ? (
          <View style={styles.foods} accessible={false} importantForAccessibility="no-hide-descendants">
            <View style={styles.cluster}>
              {shown.map((food, index) => (
                <View key={food.name} style={[styles.well, index > 0 && styles.overlap, index % 2 === 1 && styles.wellPeach]}>
                  <FoodGlyph name={food.name} category={food.category} size={26} />
                </View>
              ))}
            </View>
            {more > 0 ? (
              <Text variant="small" weight="bold" color={colors.onPrimary}>
                {`+${more}`}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.row}>
        <StatTile figure={saved} icon={<WalletIcon />} />
        <StatTile figure={dinners} icon={<PotIcon />} />
      </View>
      <View style={styles.row}>
        <StatTile figure={tossed} icon={<BinIcon />} />
        <StatTile figure={streak} icon={<FlameIcon size={18} color={colors.primary} />}>
          {streakDays.length > 0 ? (
            <View style={styles.days} accessible={false} importantForAccessibility="no-hide-descendants">
              {streakDays.map((kept, index) => (
                <View key={index} style={[styles.day, kept && styles.dayKept]} />
              ))}
            </View>
          ) : null}
        </StatTile>
      </View>
    </View>
  );
}

function StatTile({ figure, icon, children }: { figure: Figure; icon: ReactNode; children?: ReactNode }) {
  const { delta } = figure;
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        <View style={styles.iconSquare}>{icon}</View>
        <Text variant="small" weight="bold" muted numberOfLines={1} style={styles.tileLabel}>
          {figure.label}
        </Text>
      </View>
      <View style={styles.tileBody}>
        {/* Value and its change side by side: about half the old tile height. */}
        <View style={styles.valueRow}>
          <Text variant="h3" color={colors.text} style={styles.num} numberOfLines={1} adjustsFontSizeToFit>
            {figure.value}
          </Text>
          {delta ? (
            <View style={[styles.delta, delta.good ? styles.deltaGood : styles.deltaBad]}>
              <Caret direction={delta.direction} color={delta.good ? colors.green : colors.redInk} size={12} />
              <Text variant="micro" color={delta.good ? colors.text : colors.redInk} numberOfLines={1}>
                {delta.label}
              </Text>
            </View>
          ) : null}
        </View>
        {figure.sub ? (
          <Text variant="small" muted>
            {figure.sub}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

function Caret({ direction, color, size = 14 }: { direction: "up" | "down"; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={direction === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const iconStroke = { stroke: colors.primary, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function WalletIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7.5h15a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 18V6A1.5 1.5 0 015 4.5h11.5V7.5M16 13.5h.5" {...iconStroke} />
    </Svg>
  );
}

function PotIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M5 10.5h14v5a4 4 0 01-4 4H9a4 4 0 01-4-4zM2.5 10.5h19M9.5 7c0-1 1-1.2 1-2.5M14 7c0-1 1-1.2 1-2.5" {...iconStroke} />
    </Svg>
  );
}

function BinIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 12.5h10L18 7M10 11v5M14 11v5" {...iconStroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  // Solid tomato like the home's goal block; a darker disc clips at the corner.
  hero: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.xxl,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  heroMark: {
    position: "absolute",
    top: -56,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: radii.pill,
    backgroundColor: colors.primary700,
  },
  soft: {
    opacity: 0.85,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  trendText: {
    flex: 1,
    minWidth: 0,
  },
  // Compact since 2026-11-12 (Lena: "make these 4 blocks smaller").
  tile: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  tileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tileLabel: {
    flex: 1,
    minWidth: 0,
  },
  iconSquare: {
    width: 26,
    height: 26,
    borderRadius: radii.xs,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  tileBody: {
    gap: spacing.xxs,
  },
  valueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: spacing.xs,
    rowGap: spacing.xxs,
  },
  num: {
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
  },
  delta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    minHeight: 22,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  deltaGood: {
    backgroundColor: colors.sageTint,
  },
  deltaBad: {
    backgroundColor: colors.redSoft,
  },
  days: {
    flexDirection: "row",
    gap: spacing.xxs,
    marginTop: spacing.xs,
  },
  day: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  dayKept: {
    backgroundColor: colors.primary,
  },
  foods: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  cluster: {
    flexDirection: "row",
  },
  well: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  wellPeach: {
    backgroundColor: colors.surface2,
  },
  overlap: {
    marginLeft: -14,
  },
});
