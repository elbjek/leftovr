import type { ComponentRef, RefObject } from "react";
import { StyleSheet, Text, View, type TextProps } from "react-native";

import { colors, fonts } from "../../theme";
import { Logo } from "../illustrations";

// More than this and the chips crowd the card; the rest fold into "+N".
const MAX_CHIPS = 6;
/** Width the card is drawn at for export: 360pt = 1080px at @3x (4:5 post). */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_IMAGE = { width: 1080, height: 1350 } as const;

export type ShareCardProps = {
  /** Small line over the title, e.g. "Lemon pasta · cooked". */
  eyebrow: string;
  title: string;
  /** Used foods shown as chips. */
  chips?: string[];
  /** The headline money figure, already formatted. */
  money?: { label: string; value: string } | null;
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
 * leftovr's branded share image (4:5). Every size is in `u` (1% of the width),
 * so the same card renders at any width.
 */
export function ShareCard({ width, eyebrow, title, chips = [], money, figures = [] }: ShareCardProps & { width: number }) {
  const u = width / 100;
  const shown = chips.slice(0, MAX_CHIPS);
  const more = chips.length - shown.length;
  return (
    <View style={[styles.card, { width, height: width * 1.25, padding: 7 * u }]}>
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
        <ShareCard width={SHARE_CARD_WIDTH} {...card} />
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
