import type { ComponentRef, RefObject } from "react";
import { StyleSheet, Text, View, type TextProps } from "react-native";

import {
  BODY_GAP,
  cardHeight,
  fitSize,
  gridPlan,
  lineCount,
  PAD,
  STORY_SAFE,
  TILE_GAP,
  type ShareFormat,
} from "../../lib/shareCardLayout";
import { colors, fonts } from "../../theme";
import { FoodGlyph, Logo } from "../illustrations";

// More than this and the chips crowd the card; the rest fold into "+N".
const MAX_CHIPS = 6;
/** Width the card is drawn at for export: 360pt = 1080px at @3x. */
export const SHARE_CARD_WIDTH = 360;

export { SHARE_IMAGE, type ShareFormat } from "../../lib/shareCardLayout";

export type ShareCardProps = {
  format?: ShareFormat;
  /** Small line over the title, e.g. "Lemon pasta · cooked". */
  eyebrow: string;
  title: string;
  /** Used foods shown as chips. */
  chips?: string[];
  /** Used foods shown as icon tiles (the rescued card). */
  foods?: { name: string; category?: string | null }[];
  /** The headline money figure, already formatted. */
  money?: { label: string; value: string } | null;
  /** A ranked list, e.g. the go-to dinners. */
  list?: { title: string; detail: string }[];
  /** Up to three figures along the bottom. */
  figures?: { value: string; label: string }[];
};

/**
 * Text at a fixed size: the shared image must look the same whatever the
 * phone's text size.
 */
function CardText(props: TextProps) {
  return <Text allowFontScaling={false} {...props} />;
}

/**
 * leftovr's branded share image. Every size is in `u` (1% of the width), so
 * the same card renders at any width, as a post (4:5) or a story (9:16).
 * Which blocks it shows is what makes it one card or another — the Insights
 * sheet passes a different set per look.
 */
export function ShareCard({
  width,
  format = "post",
  eyebrow,
  title,
  chips = [],
  foods = [],
  money,
  list = [],
  figures = [],
}: ShareCardProps & { width: number }) {
  const u = width / 100;
  // A fixed height, not an aspect ratio: drawn off screen for export, an
  // aspect ratio can let the card grow and the capture then cuts its bottom.
  const height = cardHeight(format) * u;
  const padTop = format === "story" ? height * STORY_SAFE.top : PAD * u;
  const padBottom = format === "story" ? height * STORY_SAFE.bottom : PAD * u;

  const shownChips = chips.slice(0, MAX_CHIPS);
  const moreChips = chips.length - shownChips.length;
  const rows = list.slice(0, 3);

  const titleSize = fitSize(title, 8, 3);
  const titleHeight = Math.min(3, lineCount(title, titleSize)) * titleSize * 1.15;

  // What's left after everything else decides how many food tiles fit.
  const { tile, slots } = gridPlan(format, foods.length, {
    titleHeight,
    chipRows: shownChips.length > 0 ? Math.ceil((shownChips.length + (moreChips > 0 ? 1 : 0)) / 3) : 0,
    money: Boolean(money),
    listRows: rows.length,
    figures: figures.length > 0,
  });
  const tiles = foods.length > slots ? foods.slice(0, Math.max(0, slots - 1)) : foods.slice(0, slots);
  const moreFoods = foods.length - tiles.length;

  return (
    <View style={[styles.card, { width, height, paddingHorizontal: PAD * u, paddingTop: padTop, paddingBottom: padBottom }]}>
      {/* Inside the padding, so on a story the shapes follow the safe area
          down instead of sitting over the profile row. */}
      <View style={styles.content}>
        <View style={[styles.shape, { right: -14 * u, top: -14 * u, width: 40 * u, height: 40 * u, borderRadius: 20 * u, backgroundColor: colors.sageTint }]} />
        <View style={[styles.shape, { right: 12 * u, top: 24 * u, width: 3 * u, height: 3 * u, borderRadius: 1.5 * u, backgroundColor: colors.accent }]} />

        <Logo size={6 * u} />

        {/* Clipped: if an estimate is ever a line out, the card loses the
            bottom of a block rather than painting it over its neighbours. */}
        <View style={[styles.body, { gap: BODY_GAP * u }]}>
          <CardText style={[styles.eyebrow, { fontSize: 3.2 * u, letterSpacing: 0.15 * u }]} numberOfLines={1}>
            {eyebrow.toUpperCase()}
          </CardText>
          <CardText style={[styles.title, { fontSize: titleSize * u, lineHeight: titleSize * u * 1.15 }]} numberOfLines={3}>
            {title}
          </CardText>
          {shownChips.length > 0 ? (
            <View style={[styles.chips, { gap: 1.6 * u }]}>
              {shownChips.map((name, index) => (
                <View key={`${index}-${name}`} style={[styles.chip, { paddingHorizontal: 3 * u, paddingVertical: 1.2 * u, borderRadius: 5 * u }]}>
                  <CardText style={[styles.chipText, { fontSize: 3.4 * u }]} numberOfLines={1}>
                    {name}
                  </CardText>
                </View>
              ))}
              {moreChips > 0 ? (
                <View style={[styles.chip, styles.chipMore, { paddingHorizontal: 3 * u, paddingVertical: 1.2 * u, borderRadius: 5 * u }]}>
                  <CardText style={[styles.chipText, styles.muted, { fontSize: 3.4 * u }]}>{`+${moreChips}`}</CardText>
                </View>
              ) : null}
            </View>
          ) : null}
          {tiles.length > 0 ? (
            <View style={[styles.grid, { gap: TILE_GAP * u }]}>
              {tiles.map((food, index) => (
                <View key={`${index}-${food.name}`} style={[styles.tile, { width: tile * u, height: tile * u, borderRadius: 2.4 * u }]}>
                  <FoodGlyph name={food.name} category={food.category} size={tile * u * 0.6} />
                </View>
              ))}
              {moreFoods > 0 ? (
                <View style={[styles.tile, styles.tileMore, { width: tile * u, height: tile * u, borderRadius: 2.4 * u }]}>
                  <CardText style={[styles.chipText, styles.muted, { fontSize: tile * u * 0.26 }]}>{`+${moreFoods}`}</CardText>
                </View>
              ) : null}
            </View>
          ) : null}
          {rows.length > 0 ? (
            <View style={{ gap: 2 * u }}>
              {rows.map((row, index) => (
                <View key={`${index}-${row.title}`} style={[styles.row, { gap: 3 * u, paddingVertical: 2 * u, borderRadius: 4 * u, paddingHorizontal: 3.5 * u }]}>
                  <CardText style={[styles.rank, { fontSize: 5 * u }]}>{String(index + 1)}</CardText>
                  <View style={styles.rowBody}>
                    <CardText style={[styles.rowTitle, { fontSize: 4.6 * u }]} numberOfLines={1}>
                      {row.title}
                    </CardText>
                    <CardText style={[styles.muted, styles.rowDetail, { fontSize: 3.2 * u }]} numberOfLines={1}>
                      {row.detail}
                    </CardText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {money ? (
          <View style={[styles.money, { padding: 5 * u, borderRadius: 5 * u, gap: 1 * u }]}>
            <CardText style={[styles.moneyLabel, { fontSize: 3.2 * u, letterSpacing: 0.15 * u }]} numberOfLines={1}>
              {money.label.toUpperCase()}
            </CardText>
            <CardText style={[styles.moneyValue, { fontSize: 10 * u, lineHeight: 11.5 * u }]} numberOfLines={1} adjustsFontSizeToFit>
              {money.value}
            </CardText>
          </View>
        ) : null}

        {figures.length > 0 ? (
          <View style={[styles.figures, { marginTop: 3.5 * u }]}>
            {figures.slice(0, 3).map((figure) => (
              <View key={figure.label} style={styles.figure}>
                <CardText style={[styles.figureValue, { fontSize: 8 * u, lineHeight: 9 * u }]} numberOfLines={1}>
                  {figure.value}
                </CardText>
                <CardText style={[styles.muted, styles.figureLabel, { fontSize: 3.2 * u }]} numberOfLines={2}>
                  {figure.label}
                </CardText>
              </View>
            ))}
          </View>
        ) : null}

        <CardText style={[styles.muted, styles.footer, { fontSize: 3.2 * u, marginTop: 4 * u }]}>leftovr.co</CardText>
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
    backgroundColor: colors.appBackground,
    overflow: "hidden",
  },
  content: {
    flex: 1,
  },
  shape: {
    position: "absolute",
  },
  // Takes the room left between the logo and the figures; shrinks first.
  body: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    overflow: "hidden",
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.text,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    backgroundColor: colors.sageTint,
  },
  chipMore: {
    backgroundColor: colors.surface2,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  tileMore: {
    backgroundColor: colors.surface2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper,
  },
  rank: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.sage,
    fontVariant: ["tabular-nums"],
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.text,
  },
  rowDetail: {
    fontFamily: fonts.bodySemiBold,
  },
  money: {
    backgroundColor: colors.primary,
  },
  moneyLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.sage,
  },
  moneyValue: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.accent,
    fontVariant: ["tabular-nums"],
  },
  figures: {
    flexDirection: "row",
  },
  figure: {
    flex: 1,
  },
  figureValue: {
    fontFamily: fonts.bodyExtraBold,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  figureLabel: {
    fontFamily: fonts.bodySemiBold,
  },
  muted: {
    color: colors.muted,
  },
  footer: {
    fontFamily: fonts.bodyBold,
  },
  offscreen: {
    position: "absolute",
    left: -10000,
    top: 0,
  },
});
