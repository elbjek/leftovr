import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radii, spacing } from "../../theme";
import { Text } from "../primitives";

type Props = {
  /** How many items need eating first (shown on the tile). */
  count: number;
  labels: {
    kicker: string;
    previewTitle: string;
    previewBody: string;
    unlockAction: string;
  };
  onUpgradePress?: () => void;
};

// The free account's eat-first upsell on Kitchen. Premium sees the "Use soon"
// list (FoodListCard) instead.
export function EatFirstShelf({ count, labels, onUpgradePress }: Props) {
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
              {count || 3}
            </Text>
          </View>
        </View>
        <HeroButton label={labels.unlockAction} onPress={onUpgradePress} />
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
      <Text variant="label" color={colors.onPrimary} style={styles.ctaLabel}>
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
  cta: {
    marginTop: spacing.md,
    minHeight: 50,
    borderRadius: radii.lg,
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
