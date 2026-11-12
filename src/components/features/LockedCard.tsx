import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { Button, Text } from "../primitives";

type Props = {
  title: string;
  body: string;
  /** Optional ticked lines under the body. */
  points?: string[];
  action: string;
  onPress: () => void;
};

// Anything Premium-locked (Insights, Kitchen's Eat first): solid tomato with a
// darker disc clipping the corner, a white lock seal, white copy, optional
// ticked points and a pale butter button (buttons on red use accentSoft).
export function LockedCard({ title, body, points, action, onPress }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.mark} pointerEvents="none" />
      <View style={styles.seal}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4.5 10h15v10.5h-15zM8.2 10V7.6a3.8 3.8 0 017.6 0V10"
            stroke={colors.primary}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text variant="h3" color={colors.onPrimary}>
        {title}
      </Text>
      <Text variant="small" color={colors.onPrimary} style={styles.body}>
        {body}
      </Text>
      {points?.length ? (
        <View style={styles.points}>
          {points.map((point) => (
            <View key={point} style={styles.point}>
              <View style={styles.tick}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.primary} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text variant="small" weight="bold" color={colors.onPrimary} style={styles.pointText}>
                {point}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Button title={action} variant="accent" onPress={onPress} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.xxl,
    backgroundColor: colors.primary,
    overflow: "hidden",
  },
  mark: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 140,
    height: 140,
    borderRadius: radii.pill,
    backgroundColor: colors.primary700,
  },
  body: {
    opacity: 0.8,
  },
  seal: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  points: {
    gap: spacing.sm,
  },
  point: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tick: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  pointText: {
    flex: 1,
    minWidth: 0,
  },
  button: {
    backgroundColor: colors.accentSoft,
  },
});
