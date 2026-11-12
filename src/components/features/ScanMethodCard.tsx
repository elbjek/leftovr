import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { Text } from "../primitives";

export type ScanMethod = "receipt" | "ereceipt" | "pantry" | "barcode" | "manual";

type Props = {
  method: ScanMethod;
  body: string;
  recommended?: boolean;
  /** The lead method: a tomato banner, like the home's goal strip. */
  featured?: boolean;
  onPress: () => void;
  /** Free plan: the featured card turns pale red. */
  soft?: boolean;
};

// One way to add food. The featured one is a tomato banner with food on a
// peach blob; the rest are warm tiles (half width, two per row) with the icon
// on a peach blob, like the home's cards.
export function ScanMethodCard({ method, body, recommended = false, featured = false, soft = false, onPress }: Props) {
  const { t } = useTranslation();
  const title = t(`scanMethods.${method}.title`);
  const label = recommended ? `${title}, ${t("scanMethods.recommended")}. ${body}` : `${title}. ${body}`;

  if (featured) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.hero, soft && styles.heroSoft, pressed && styles.pressed]}
      >
        <View style={styles.heroArt} pointerEvents="none" accessible={false}>
          <View style={[styles.heroBlob, soft && styles.heroBlobSoft]} />
          <View style={styles.heroFoodBig}>
            <FoodGlyph name="broccoli" size={64} />
          </View>
          <View style={styles.heroFoodSmall}>
            <FoodGlyph name="milk" size={46} />
          </View>
        </View>
        <View style={styles.heroCopy}>
          {recommended ? (
            <View style={styles.badge}>
              <Text variant="micro" uppercase color={colors.text}>
                {t("scanMethods.recommended")}
              </Text>
            </View>
          ) : null}
          <View style={styles.heroIcon}>
            <ScanMethodIcon method={method} size={26} />
          </View>
          <Text variant="h3" color={soft ? colors.redInk : colors.onPrimary}>
            {title}
          </Text>
          <Text variant="small" color={soft ? colors.redInk : colors.onPrimary} style={styles.heroBody}>
            {body}
          </Text>
        </View>
        <View style={styles.heroGo}>
          <ArrowIcon />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.tileArt}>
        <View style={styles.tileBlob} />
        <ScanMethodIcon method={method} size={24} />
      </View>
      <Text variant="title">
        {title}
      </Text>
      {recommended ? (
        <View style={styles.badge}>
          <Text variant="micro" uppercase color={colors.text}>
            {t("scanMethods.recommended")}
          </Text>
        </View>
      ) : null}
      <Text variant="small" muted>
        {body}
      </Text>
    </Pressable>
  );
}

export function ScanMethodIcon({ method, color = colors.primary, size = 22 }: { method: ScanMethod; color?: string; size?: number }) {
  if (method === "receipt") {
    return (
      <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
        <Path d="M4 3h14v16l-2-2-2 2-2-2-2 2-2-2-2 2-2-2V3z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        <Line x1={7} y1={8} x2={15} y2={8} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={7} y1={12} x2={13} y2={12} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }

  if (method === "ereceipt") {
    return (
      <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
        <Path d="M5 2.5h8l4 4v13H5V2.5z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        <Path d="M13 2.5v4h4" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        <Line x1={8} y1={11} x2={14} y2={11} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={8} y1={14.5} x2={14} y2={14.5} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }

  if (method === "pantry") {
    // Open cupboard: two shelves with jars/boxes on them.
    return (
      <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
        <Path d="M3.5 3h15v16h-15V3z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        <Line x1={3.5} y1={11} x2={18.5} y2={11} stroke={color} strokeWidth={1.6} />
        <Path d="M6.5 8V6h3v2" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        <Circle cx={13.5} cy={7.5} r={1.6} stroke={color} strokeWidth={1.6} />
        <Path d="M7 16.5v-2.5h2.5v2.5" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        <Path d="M12 16.5v-3h3.5v3" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      </Svg>
    );
  }

  if (method === "barcode") {
    return (
      <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
        {[4, 10, 16, 18].map((x) => (
          <Line key={x} x1={x} y1={5} x2={x} y2={17} stroke={color} strokeWidth={1.6} />
        ))}
        {[7, 13].map((x) => (
          <Line key={x} x1={x} y1={5} x2={x} y2={17} stroke={color} strokeWidth={2.6} />
        ))}
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Circle cx={10} cy={10} r={6} stroke={color} strokeWidth={1.6} />
      <Path d="M14.5 14.5L18 18" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function ArrowIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Solid tomato like the home's goal strip; the food blob clips at its edge.
  hero: {
    minHeight: 172,
    padding: spacing.lg,
    borderRadius: radii.xxl,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  // Free plan: pale red, solid tomato is kept for upgrade prompts.
  heroSoft: {
    backgroundColor: colors.redSoft,
  },
  heroBlobSoft: {
    backgroundColor: colors.surface,
  },
  heroArt: {
    position: "absolute",
    right: -28,
    bottom: -30,
    width: 168,
    height: 150,
  },
  heroBlob: {
    position: "absolute",
    width: 168,
    height: 150,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    transform: [{ rotate: "-14deg" }],
  },
  heroFoodBig: {
    position: "absolute",
    left: 26,
    top: 14,
  },
  heroFoodSmall: {
    position: "absolute",
    left: 88,
    top: 6,
  },
  heroCopy: {
    // Clear of the food blob on the right.
    paddingRight: 112,
    gap: spacing.xxs,
  },
  heroIcon: {
    width: 52,
    height: 52,
    marginBottom: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBody: {
    opacity: 0.9,
  },
  heroGo: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  tile: {
    flexGrow: 1,
    flexBasis: "40%",
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  tileArt: {
    width: 52,
    height: 48,
    marginBottom: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  tileBlob: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    transform: [{ rotate: "-14deg" }],
  },
  badge: {
    alignSelf: "flex-start",
    marginBottom: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pressed: {
    opacity: 0.8,
  },
});
