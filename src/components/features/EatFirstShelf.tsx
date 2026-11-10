import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { Button, Card, Text } from "../primitives";

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

/**
 * The free account's eat-first upsell on Kitchen. Premium sees the "Use soon"
 * list (FoodListCard) instead.
 */
export function EatFirstShelf({ count, labels, onUpgradePress }: Props) {
  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <View style={styles.top}>
          <View style={styles.copy}>
            <View style={styles.eyebrowRow}>
              <LeafIcon />
              <Text variant="micro" uppercase color={colors.accentInk}>
                {labels.kicker}
              </Text>
            </View>
            <Text variant="h3" style={styles.title}>
              {labels.previewTitle}
            </Text>
            <Text variant="small" muted style={styles.body}>
              {labels.previewBody}
            </Text>
          </View>
          <View style={styles.media}>
            <Text variant="h1" color={colors.accentInk}>
              {count || 3}
            </Text>
          </View>
        </View>
        <Button title={labels.unlockAction} onPress={onUpgradePress} style={styles.cta} />
      </Card>
    </View>
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
    borderRadius: radii.xxl,
  },
  top: {
    flexDirection: "row",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  title: {
    marginTop: spacing.xs,
  },
  body: {
    marginTop: spacing.xxs,
  },
  media: {
    width: 76,
    height: 76,
    borderRadius: radii.xl,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    marginTop: spacing.md,
  },
});
