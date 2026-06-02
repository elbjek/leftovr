import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { colors, radii, spacing } from "../../theme";
import { Text } from "../primitives";

export type ScanMethod = "receipt" | "barcode" | "manual";

type Props = {
  method: ScanMethod;
  body: string;
  recommended?: boolean;
  /** Persistent highlight (onboarding select+confirm). Press also highlights. */
  selected?: boolean;
  onPress: () => void;
};

export function ScanMethodCard({
  method,
  body,
  recommended = false,
  selected = false,
  onPress,
}: Props) {
  const { t } = useTranslation();

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => {
        const active = selected || pressed;
        return (
          <View style={[styles.card, active && styles.cardActive]}>
            <View style={[styles.iconBox, active && styles.iconBoxActive]}>
              <ScanMethodIcon method={method} color={active ? colors.surface : colors.primary} />
            </View>
            <View style={styles.copy}>
              <View style={styles.titleRow}>
                <Text variant="h3" color={active ? colors.surface : colors.text}>
                  {t(`scanMethods.${method}.title`)}
                </Text>
                {recommended ? (
                  <View style={styles.badge}>
                    <Text variant="micro" color={colors.text}>
                      {t("scanMethods.recommended")}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text variant="small" color={active ? colors.surface : colors.muted}>
                {body}
              </Text>
            </View>
            <ChevronIcon color={active ? colors.surface : colors.muted} />
          </View>
        );
      }}
    </Pressable>
  );
}

export function ScanMethodIcon({ method, color = colors.primary }: { method: ScanMethod; color?: string }) {
  if (method === "receipt") {
    return (
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Path d="M4 3h14v16l-2-2-2 2-2-2-2 2-2-2-2 2-2-2V3z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        <Line x1={7} y1={8} x2={15} y2={8} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={7} y1={12} x2={13} y2={12} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }

  if (method === "barcode") {
    return (
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
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
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Circle cx={10} cy={10} r={6} stroke={color} strokeWidth={1.6} />
      <Path d="M14.5 14.5L18 18" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M6 4L12 9L6 14" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    backgroundColor: colors.paper,
    borderColor: colors.hairline,
    borderWidth: 1.5,
    borderRadius: radii.xl,
  },
  cardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primary50,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxActive: {
    backgroundColor: "rgba(248,244,238,0.15)",
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
});
