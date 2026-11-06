import type { ComponentRef, RefObject } from "react";
import { StyleSheet, Text, View, type TextProps } from "react-native";

import { colors, fonts } from "../../theme";
import { FoodGlyph, Logo } from "../illustrations";

// More than this and the chips crowd the card; the rest fold into "+N".
const MAX_CHIPS = 6;
/** Width the card is drawn at for export: 360pt = 1080px at @3x. */
export const SHARE_CARD_WIDTH = 360;

/** Instagram post (4:5) or story (9:16). */
export type ShareFormat = "post" | "story";

/** Exported image size per format, in pixels. */
export const SHARE_IMAGE: Record<ShareFormat, { width: number; height: number }> = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

/**
 * Instagram's story safe area on 1080×1920: the top 250px (profile, progress
 * bar) and the bottom 340px (reply bar) stay clear of text.
 */
const STORY_SAFE = { top: 250 / 1920, bottom: 340 / 1920 };
/** Food tiles on the rescued card: columns by count, and the most tiles shown. */
const GRID_MAX = 24;

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

/** Columns for the food grid: bigger tiles while there are few foods. */
function gridColumns(count: number) {
  return count <= 4 ? 4 : count <= 9 ? 3 : count <= 16 ? 4 : 6;
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
  const height = format === "story" ? (width * 16) / 9 : width * 1.25;
  const pad = 7 * u;
  const shown = chips.slice(0, MAX_CHIPS);
  const more = chips.length - shown.length;
  const tiles = foods.slice(0, GRID_MAX);
  const moreFoods = foods.length - tiles.length;
  const cols = gridColumns(tiles.length + (moreFoods > 0 ? 1 : 0));
  const gap = 2 * u;
  const tile = (86 * u - gap * (cols - 1)) / cols;

  return (
    <View
      style={[
        styles.card,
        {
          width,
          height,
          paddingHorizontal: pad,
          paddingTop: format === "story" ? height * STORY_SAFE.top : pad,
          paddingBottom: format === "story" ? height * STORY_SAFE.bottom : pad,
        },
      ]}
    >
      {/* Brand shapes, kept clear of the text. */}
      <View style={[styles.shape, { right: -14 * u, top: -14 * u, width: 40 * u, height: 40 * u, borderRadius: 20 * u, backgroundColor: colors.sageTint }]} />
      <View style={[styles.shape, { right: 12 * u, top: 30 * u, width: 3 * u, height: 3 * u, borderRadius: 1.5 * u, backgroundColor: colors.accent }]} />

      <Logo size={6 * u} />

      <View style={[styles.body, { gap: 3 * u }]}>
        <CardText style={[styles.eyebrow, { fontSize: 3.2 * u, letterSpacing: 0.15 * u }]} numberOfLines={1}>
          {eyebrow.toUpperCase()}
        </CardText>
        <CardText style={[styles.title, { fontSize: 8 * u, lineHeight: 9 * u }]} numberOfLines={3}>
          {title}
        </CardText>
        {shown.length > 0 ? (
          <View style={[styles.chips, { gap: 1.6 * u }]}>
            {shown.map((name, index) => (
              <View key={`${index}-${name}`} style={[styles.chip, { paddingHorizontal: 3 * u, paddingVertical: 1.2 * u, borderRadius: 5 * u }]}>
                <CardText style={[styles.chipText, { fontSize: 3.4 * u }]} numberOfLines={1}>
                  {name}
                </CardText>
              </View>
            ))}
            {more > 0 ? (
              <View style={[styles.chip, styles.chipMore, { paddingHorizontal: 3 * u, paddingVertical: 1.2 * u, borderRadius: 5 * u }]}>
                <CardText style={[styles.chipText, styles.muted, { fontSize: 3.4 * u }]}>{`+${more}`}</CardText>
              </View>
            ) : null}
          </View>
        ) : null}
        {tiles.length > 0 ? (
          <View style={[styles.grid, { gap }]}>
            {tiles.map((food, index) => (
              <View
                key={`${index}-${food.name}`}
                style={[styles.tile, { width: tile, height: tile, borderRadius: 2.4 * u }]}
              >
                <FoodGlyph name={food.name} category={food.category} size={tile * 0.6} />
              </View>
            ))}
            {moreFoods > 0 ? (
              <View style={[styles.tile, styles.tileMore, { width: tile, height: tile, borderRadius: 2.4 * u }]}>
                <CardText style={[styles.chipText, styles.muted, { fontSize: tile * 0.26 }]}>{`+${moreFoods}`}</CardText>
              </View>
            ) : null}
          </View>
        ) : null}
        {list.length > 0 ? (
          <View style={{ gap: 2 * u }}>
            {list.slice(0, 3).map((row, index) => (
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
  shape: {
    position: "absolute",
  },
  // Takes the room left between the logo and the figures; shrinks first.
  body: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
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
