import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { categoryColors, CategoryTone, colors, fonts, radii, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Text } from "../primitives";

// The hero lists this many items; the rest are counted and live in the shelves.
const PREVIEW_COUNT = 3;

type EatFirstItem = {
  id: string;
  name: string;
  category?: string;
  bestBy?: string;
};

type Props = {
  items: EatFirstItem[];
  premium?: boolean;
  labels: {
    kicker: string;
    subtitle?: string;
    heading: (count: number) => string;
    cookCta: string;
    previewTitle: string;
    previewBody: string;
    unlockAction: string;
    more?: (count: number) => string;
  };
  onItemPress?: (item: EatFirstItem) => void;
  onCook?: () => void;
  onUpgradePress?: () => void;
  /** Rendered under the heading on the premium card (the home puts Kitchen Pulse here). */
  children?: React.ReactNode;
};

// The home hero: one white card that says what to eat today and offers the one
// action the shelves can't — cook with it before it spoils. Free accounts get
// the same shell as an upsell.
export function EatFirstShelf({ items, premium = false, labels, onItemPress, onCook, onUpgradePress, children }: Props) {
  const lead = items[0];
  const leadTone = categoryColors[(lead?.category as CategoryTone)] ?? categoryColors.other;

  if (!premium) {
    return (
      <View style={styles.wrap}>
        <View style={styles.card}>
          <View style={styles.top}>
            <View style={styles.copy}>
              <Eyebrow label={labels.kicker} />
              <Text style={styles.title}>{labels.previewTitle}</Text>
              <Text variant="small" muted style={styles.body}>
                {labels.previewBody}
              </Text>
            </View>
            <View style={[styles.media, { backgroundColor: colors.accentSoft }]}>
              <Text style={styles.mediaCount} color={colors.accentInk}>
                {items.length || 3}
              </Text>
            </View>
          </View>
          <HeroButton label={labels.unlockAction} onPress={onUpgradePress} />
        </View>
      </View>
    );
  }

  const preview = items.slice(0, PREVIEW_COUNT);
  const hidden = items.length - preview.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.top}>
          <View style={styles.copy}>
            <Eyebrow label={labels.kicker} />
            <Text style={styles.title}>{labels.heading(items.length)}</Text>
            {labels.subtitle ? (
              <Text variant="small" muted style={styles.body}>
                {labels.subtitle}
              </Text>
            ) : null}
          </View>
          {lead ? (
            <View style={[styles.media, { backgroundColor: leadTone.background }]}>
              <FoodGlyph name={lead.name} color={leadTone.mark} size={40} />
            </View>
          ) : null}
        </View>

        {children ? <View style={styles.pulse}>{children}</View> : null}

        <View style={styles.list}>
          {preview.map((item) => {
            const tone = categoryColors[(item.category as CategoryTone)] ?? categoryColors.other;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => onItemPress?.(item)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={[styles.thumb, { backgroundColor: tone.background }]}>
                  <FoodGlyph name={item.name} color={tone.mark} size={22} />
                </View>
                <Text variant="label" numberOfLines={1} style={styles.rowName}>
                  {item.name}
                </Text>
                {item.bestBy ? (
                  <Text variant="small" color={colors.redInk} numberOfLines={1} style={styles.rowMeta}>
                    {item.bestBy}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          {hidden > 0 && labels.more ? (
            <Text variant="small" muted style={styles.more}>
              {labels.more(hidden)}
            </Text>
          ) : null}
        </View>

        <HeroButton label={labels.cookCta} onPress={onCook} />
      </View>
    </View>
  );
}

function Eyebrow({ label }: { label: string }) {
  return (
    <View style={styles.eyebrowRow}>
      <LeafIcon />
      <Text variant="micro" uppercase color={colors.accentInk} style={styles.eyebrow}>
        {label}
      </Text>
    </View>
  );
}

function HeroButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
    >
      <Text variant="label" color={colors.surface} style={styles.ctaLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function LeafIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20c0-8 6-14 16-14 0 10-6 15-13 15-1 0-3 0-3-1Z"
        stroke={colors.accentInk}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 20c2-5 6-8 11-9" stroke={colors.accentInk} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenX,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.xxl,
    padding: spacing.lg + 2,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  top: {
    flexDirection: "row",
    gap: spacing.md + 2,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  eyebrow: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    letterSpacing: 0.66,
  },
  title: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    fontSize: 22,
    lineHeight: 26,
    marginTop: 7,
  },
  body: {
    marginTop: 5,
    lineHeight: 20,
  },
  media: {
    width: 76,
    height: 76,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaCount: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    fontSize: 30,
    lineHeight: 34,
  },
  pulse: {
    marginTop: spacing.lg,
  },
  list: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  rowMeta: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
    flexShrink: 0,
  },
  more: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingVertical: spacing.sm,
  },
  cta: {
    marginTop: spacing.md,
    minHeight: 50,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
