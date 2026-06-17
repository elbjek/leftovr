import { router } from "expo-router";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features";
import { colors, radii, spacing } from "../../theme";
import { Text } from "../primitives";

type Props = {
  style?: ViewStyle;
};

/**
 * Persistent nudge shown on non-scan tabs until the household has added its
 * first items. Hides itself once `first_fill_completed_at` is set.
 */
export function ScanNudgeBanner({ style }: Props) {
  const { t } = useTranslation();
  const { activeHousehold } = useAuth();

  if (!activeHousehold || activeHousehold.first_fill_completed_at) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("scanBanner.message")}
      onPress={() => router.push("/(tabs)/scan")}
      style={[styles.banner, style]}
    >
      <Text variant="label" color={colors.surface} style={styles.text}>
        {t("scanBanner.message")}
      </Text>
      <Text variant="label" color={colors.surface}>
        {"›"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.screenX,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  text: {
    flex: 1,
  },
});
