import { router } from "expo-router";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, radii, spacing } from "../../theme";
import { ReceiptToFridgeIllustration } from "../illustrations";
import { Button, Text } from "../primitives";

type Props = {
  /** Copy overrides; default to the fridge empty-state strings. */
  title?: string;
  body?: string;
  ctaLabel?: string;
  style?: ViewStyle;
};

/**
 * Shared "fridge is empty → scan to fill" state. Used on every non-scan tab
 * that has nothing to show yet, replacing the old persistent scan banner.
 */
export function EmptyFridge({ title, body, ctaLabel, style }: Props) {
  const { t } = useTranslation();

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.art}>
        <ReceiptToFridgeIllustration width={240} height={172} />
      </View>
      <View style={styles.copy}>
        <Text variant="h2" center>
          {title ?? t("fridge.emptyTitle")}
        </Text>
        <Text variant="body" muted center style={styles.body}>
          {body ?? t("fridge.emptyBody")}
        </Text>
      </View>
      <Button
        title={ctaLabel ?? t("fridge.emptyCta")}
        onPress={() => router.push("/(tabs)/scan")}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    alignItems: "center",
    gap: spacing.xl,
  },
  art: {
    alignSelf: "stretch",
    borderRadius: radii.xl,
    backgroundColor: colors.surface2,
    paddingVertical: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    alignItems: "center",
    gap: spacing.sm,
  },
  body: {
    maxWidth: 300,
  },
  cta: {
    alignSelf: "stretch",
  },
});
