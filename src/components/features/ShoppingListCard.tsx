import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { ListRow } from "../primitives";

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

/** Kitchen's way into the shopping list: a white lifted card, like Check these. */
export function ShoppingListCard({ title, subtitle, onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <ListRow
          title={title}
          subtitle={subtitle}
          leading={<ShoppingListIcon />}
          trailing={
            <View style={styles.go}>
              <ArrowIcon />
            </View>
          }
          chevron={false}
          onPress={onPress}
        />
      </View>
    </View>
  );
}

// A checklist, not a cart: it is a list of what to buy, not a shop.
export function ShoppingListIcon({ color = colors.primary, size = 26 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 6.5l1.6 1.6L8 5.2M3.5 12.5l1.6 1.6L8 11.2" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={5.6} cy={18.4} r={1.7} stroke={color} strokeWidth={1.7} />
      <Path d="M11 6.5h9.5M11 12.5h9.5M11 18.5h9.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
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
  wrap: {
    paddingHorizontal: spacing.screenX,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    ...shadows.soft,
  },
  go: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
});
