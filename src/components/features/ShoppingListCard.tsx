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
          leading={<CartIcon />}
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

export function CartIcon({ color = colors.primary, size = 26 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.1"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={9.5} cy={19.5} r={1.4} fill={color} />
      <Circle cx={17} cy={19.5} r={1.4} fill={color} />
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
