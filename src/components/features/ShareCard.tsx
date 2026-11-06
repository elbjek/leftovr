import type { ComponentRef, RefObject } from "react";
import { StyleSheet, Text, View, type TextProps } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import {
  BLOCK_GAP,
  bodyPlan,
  cardHeight,
  DISH_HEIGHT,
  fitSize,
  FRAME,
  INNER,
  ITEM_COLUMNS,
  lineCount,
  PAPER_X,
  PAPER_Y,
  paperInset,
  ROW_GAP,
  ROW_HEIGHT,
  TEETH,
  type ShareFormat,
} from "../../lib/shareCardLayout";
import { colors, fonts } from "../../theme";
import { FoodGlyph, Logo } from "../illustrations";

export { SHARE_IMAGE, type ShareFormat } from "../../lib/shareCardLayout";

/** Width the card is drawn at for export: 360pt = 1080px at @3x. */
export const SHARE_CARD_WIDTH = 360;
/** The ranked dishes a menu prints. */
const MAX_DISHES = 3;
/** Days the streak punches; past this it prints the number alone. */
const MAX_MARKS = 14;
/** The barcode's bar widths, in `u`, repeated across the foot. */
const BARS = [0.8, 0.4, 1.4, 0.4, 0.6, 1.2, 0.4, 0.8, 0.4, 1.6, 0.6, 0.4, 1, 0.4, 0.8, 1.4, 0.4, 0.6];

type Item = { name: string; category?: string | null };
type Total = { label: string; value: string };

type Common = {
  format?: ShareFormat;
  /** The line over the title, e.g. "Kitchen receipt". */
  kicker: string;
  /** "November 2026", or "Lemon pasta · cooked". */
  title: string;
  /** The gold total at the foot of the receipt. */
  hero: Total;
  /** The thank-you line under the barcode. */
  footnote: string;
};

/**
 * Each card prints its own kind of receipt body: a list of rescued items, a
 * column of totals, a punched streak, or a menu of dinners.
 */
export type ShareCardProps = Common &
  (
    | { kind: "items"; items: Item[]; more: (count: number) => string; totals?: Total[] }
    | { kind: "totals"; totals: Total[] }
    | { kind: "streak"; days: number; daysLabel: string; totals: Total[] }
    | { kind: "menu"; dishes: { title: string; detail: string }[]; totals?: Total[] }
  );

/**
 * Text at a fixed size: the shared image must look the same whatever the
 * phone's text size.
 */
function CardText(props: TextProps) {
  return <Text allowFontScaling={false} {...props} />;
}

/** The torn edge at each end of the paper, drawn in the frame's colour. */
function Teeth({ width, height, flip }: { width: number; height: number; flip?: boolean }) {
  const teeth = 22;
  const step = 100 / teeth;
  let d = "M0 0 H100 V1 ";
  for (let i = teeth; i > 0; i -= 1) d += `L${(i - 0.5) * step} 0 L${(i - 1) * step} 1 `;
  return (
    <Svg width={width} height={height} viewBox="0 0 100 1" preserveAspectRatio="none" style={flip ? styles.flip : undefined}>
      <Path d={d} fill={colors.primary} />
    </Svg>
  );
}

/** A printed rule: dashed between blocks, solid above the total. */
function Rule({ width, u, solid }: { width: number; u: number; solid?: boolean }) {
  return (
    <Svg width={width} height={1.4 * u}>
      <Line
        x1={0}
        y1={0.7 * u}
        x2={width}
        y2={0.7 * u}
        stroke={solid ? colors.primary : colors.muted2}
        strokeWidth={solid ? 0.5 * u : 0.3 * u}
        strokeDasharray={solid ? undefined : `${1.2 * u},${1.2 * u}`}
      />
    </Svg>
  );
}

/** The barcode that signs the receipt off. */
function Barcode({ width, u }: { width: number; u: number }) {
  const bars: number[] = [];
  for (let total = 0; total < width; ) {
    const bar = BARS[bars.length % BARS.length] * u;
    bars.push(bar);
    total += bar + 0.45 * u;
  }
  return (
    <View style={[styles.barcode, { gap: 0.45 * u, height: 5 * u }]}>
      {bars.map((bar, index) => (
        <View key={index} style={{ width: bar, height: index % 3 === 0 ? 5 * u : 4 * u, backgroundColor: colors.text }} />
      ))}
    </View>
  );
}

/** "ITEMS USED ............ 62" — the receipt's plain line. */
function TotalRow({ total, u, strong }: { total: Total; u: number; strong?: boolean }) {
  return (
    <View style={[styles.line, { height: ROW_HEIGHT * u }]}>
      <CardText style={[styles.lineLabel, { fontSize: 3.4 * u, letterSpacing: 0.12 * u }]} numberOfLines={1}>
        {total.label.toUpperCase()}
      </CardText>
      <CardText style={[strong ? styles.lineValueStrong : styles.lineValue, { fontSize: strong ? 5 * u : 4.2 * u }]} numberOfLines={1}>
        {total.value}
      </CardText>
    </View>
  );
}

/**
 * leftovr's share image: a kitchen receipt, printed on paper in a green
 * frame, torn at both ends. Every size is in `u` (1% of the width), so it
 * renders the same at any width, as a post (4:5) or a story (9:16).
 */
export function ShareCard(props: ShareCardProps & { width: number }) {
  const { width, format = "post", kicker, title, hero, footnote } = props;
  const u = width / 100;
  // A fixed height, not an aspect ratio: drawn off screen for export, an
  // aspect ratio can let the card grow and the capture then cuts its bottom.
  const height = cardHeight(format) * u;
  const inset = paperInset(format);
  const print = INNER * u;

  const titleSize = fitSize(title, 7, 2);
  const titleLines = Math.min(2, lineCount(title, titleSize));

  // Everything in the body is budgeted, longest-lived first, so the print
  // never overflows the paper and loses its barcode.
  const plan = bodyPlan(format, titleLines * titleSize * 1.15, {
    marks: props.kind === "streak",
    dishes: props.kind === "menu" ? Math.min(props.dishes.length, MAX_DISHES) : 0,
    totals: (props.kind === "items" || props.kind === "menu" ? props.totals?.length ?? 0 : props.totals.length),
    items: props.kind === "items",
  });
  const totals = (props.kind === "items" || props.kind === "menu" ? props.totals ?? [] : props.totals).slice(0, plan.totals);
  const dishes = props.kind === "menu" ? props.dishes.slice(0, plan.dishes) : [];
  const items = props.kind === "items" ? props.items : [];
  const shown = items.length > plan.items ? items.slice(0, Math.max(0, plan.items - 1)) : items.slice(0, plan.items);
  const hidden = items.length - shown.length;
  const itemWidth = (print - 2 * u) / ITEM_COLUMNS;

  return (
    <View style={[styles.card, { width, height, paddingHorizontal: FRAME * u, paddingTop: inset.top * u, paddingBottom: inset.bottom * u }]}>
      <View style={styles.paper}>
        <Teeth width={width - FRAME * 2 * u} height={TEETH * u} />
        <View style={[styles.print, { paddingHorizontal: PAPER_X * u, paddingVertical: PAPER_Y * u, gap: BLOCK_GAP * u }]}>
          <View>
            <Logo size={6 * u} />
            <CardText style={[styles.kicker, { fontSize: 3.2 * u, letterSpacing: 0.22 * u, marginTop: 1.5 * u }]} numberOfLines={1}>
              {kicker.toUpperCase()}
            </CardText>
            <CardText
              style={[styles.title, { fontSize: titleSize * u, lineHeight: titleSize * u * 1.15, marginTop: 1.5 * u }]}
              numberOfLines={2}
            >
              {title}
            </CardText>
          </View>

          <Rule width={print} u={u} />

          <View style={[styles.body, { gap: ROW_GAP * u }]}>
            {props.kind === "items" ? (
              <View style={[styles.items, { gap: ROW_GAP * u, columnGap: 2 * u }]}>
                {shown.map((item, index) => (
                  <View key={`${index}-${item.name}`} style={[styles.item, { width: itemWidth, height: ROW_HEIGHT * u, gap: 1.4 * u }]}>
                    <FoodGlyph name={item.name} category={item.category} size={4.6 * u} />
                    <CardText style={[styles.itemName, { fontSize: 3.4 * u }]} numberOfLines={1}>
                      {item.name.toUpperCase()}
                    </CardText>
                  </View>
                ))}
                {hidden > 0 ? (
                  <View style={[styles.item, { width: itemWidth, height: ROW_HEIGHT * u }]}>
                    <CardText style={[styles.itemMore, { fontSize: 3.4 * u }]} numberOfLines={1}>
                      {props.more(hidden).toUpperCase()}
                    </CardText>
                  </View>
                ) : null}
              </View>
            ) : null}

            {props.kind === "streak" && plan.marks ? (
              <View style={{ gap: 2 * u }}>
                <View style={[styles.marks, { gap: 1.2 * u }]}>
                  {Array.from({ length: Math.min(props.days, MAX_MARKS) }, (_, index) => (
                    <View key={index} style={[styles.mark, { width: 5.4 * u, height: 5.4 * u, borderRadius: 1.4 * u, borderWidth: 0.4 * u }]}>
                      <Svg width={3 * u} height={3 * u} viewBox="0 0 24 24" fill="none">
                        <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.primary} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                  ))}
                </View>
                <CardText style={[styles.kicker, { fontSize: 3.2 * u, letterSpacing: 0.22 * u }]} numberOfLines={1}>
                  {props.daysLabel.toUpperCase()}
                </CardText>
              </View>
            ) : null}

            {dishes.map((dish, index) => (
              <View key={`${index}-${dish.title}`} style={[styles.dish, { height: DISH_HEIGHT * u, gap: 2.4 * u }]}>
                <CardText style={[styles.rank, { fontSize: 4.6 * u }]}>{String(index + 1)}</CardText>
                <View style={styles.dishBody}>
                  <CardText style={[styles.dishTitle, { fontSize: 4.6 * u }]} numberOfLines={1}>
                    {dish.title}
                  </CardText>
                  <CardText style={[styles.dishDetail, { fontSize: 3.2 * u }]} numberOfLines={1}>
                    {dish.detail}
                  </CardText>
                </View>
              </View>
            ))}

            {totals.map((total) => (
              <TotalRow key={total.label} total={total} u={u} />
            ))}
          </View>

          <Rule width={print} u={u} solid />

          <View style={[styles.hero, { paddingHorizontal: 4 * u, paddingVertical: 2.6 * u, borderRadius: 3 * u }]}>
            <CardText style={[styles.heroLabel, { fontSize: 3.2 * u, letterSpacing: 0.22 * u }]} numberOfLines={1}>
              {hero.label.toUpperCase()}
            </CardText>
            <CardText style={[styles.heroValue, { fontSize: 9 * u, lineHeight: 10.4 * u }]} numberOfLines={1} adjustsFontSizeToFit>
              {hero.value}
            </CardText>
          </View>

          <View style={{ gap: 2 * u }}>
            <Barcode width={print} u={u} />
            <View style={styles.foot}>
              <CardText style={[styles.footText, { fontSize: 3.2 * u, letterSpacing: 0.12 * u }]} numberOfLines={1}>
                {footnote.toUpperCase()}
              </CardText>
              <CardText style={[styles.footText, { fontSize: 3.2 * u }]}>leftovr.co</CardText>
            </View>
          </View>
        </View>
        <Teeth width={width - FRAME * 2 * u} height={TEETH * u} flip />
      </View>
    </View>
  );
}

/**
 * The card drawn off screen at export size, for useShareImage to capture.
 * Render it in the same tree as the share button (inside a BottomSheet's
 * `overlay` there), never in a Modal of its own.
 */
export function ShareCardExport({ viewRef, ...card }: ShareCardProps & { viewRef: RefObject<ComponentRef<typeof View> | null> }) {
  return (
    <View pointerEvents="none" style={styles.offscreen} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View ref={viewRef} collapsable={false}>
        {/* Keyed by format: a fresh layout each switch, so iOS never reuses
            the other size's text measurements. */}
        <ShareCard key={card.format ?? "post"} width={SHARE_CARD_WIDTH} {...card} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  paper: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  print: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  flip: {
    transform: [{ scaleY: -1 }],
  },
  kicker: {
    fontFamily: fonts.bodyBold,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.text,
  },
  // Takes the room left between the header and the total; shrinks first.
  body: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    overflow: "hidden",
  },
  items: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemName: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
  itemMore: {
    fontFamily: fonts.bodyBold,
    color: colors.muted,
  },
  marks: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  mark: {
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.sage,
    backgroundColor: colors.sageTint,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
  },
  lineLabel: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    color: colors.muted,
  },
  lineValue: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  lineValueStrong: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  dish: {
    flexDirection: "row",
    alignItems: "center",
  },
  rank: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.sage,
    fontVariant: ["tabular-nums"],
  },
  dishBody: {
    flex: 1,
    minWidth: 0,
  },
  dishTitle: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.text,
  },
  dishDetail: {
    fontFamily: fonts.bodySemiBold,
    color: colors.muted,
  },
  hero: {
    backgroundColor: colors.primary,
  },
  heroLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.sage,
  },
  heroValue: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.accent,
    fontVariant: ["tabular-nums"],
  },
  barcode: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footText: {
    fontFamily: fonts.bodyBold,
    color: colors.muted,
  },
  offscreen: {
    position: "absolute",
    left: -10000,
    top: 0,
  },
});
