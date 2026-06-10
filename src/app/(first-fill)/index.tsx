import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, ScanMethodCard, Screen, Text } from "@/components";
import { useAuth } from "@/features";
import { HAS_PICKED_LANGUAGE_KEY, HAS_SEEN_HOOK_KEY } from "@/features/onboardingGate";
import { resetCurrentUserOnboardingForDev } from "@/repositories";
import { colors, spacing } from "@/theme";

type FillMode = "receipt" | "barcode" | "manual";

export default function FirstFillRoute() {
  const { t } = useTranslation();
  const { activeHousehold, signOut } = useAuth();
  const [selected, setSelected] = useState<FillMode>("receipt");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueToApp(mode = selected) {
    if (!activeHousehold?.id) return;

    router.replace({ pathname: "/(tabs)/scan", params: { mode } });
  }

  async function resetOnboarding() {
    setSubmitting(true);
    setError(null);

    try {
      await resetCurrentUserOnboardingForDev();
      await AsyncStorage.multiRemove([HAS_PICKED_LANGUAGE_KEY, HAS_SEEN_HOOK_KEY]);
      await signOut();
      router.replace("/");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : t("auth.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="display" style={styles.title}>
          {t("firstFill.titleStart")}{" "}
          <Text variant="display" color={colors.primary} italic style={styles.title}>
            {t("firstFill.titleAccent")}
          </Text>
        </Text>
        <Text variant="body" muted>
          {t("firstFill.body")}
        </Text>
      </View>

      <View style={styles.choices}>
        <ScanMethodCard
          method="receipt"
          body={t("firstFill.receipt.subtitle")}
          recommended
          selected={selected === "receipt"}
          onPress={() => setSelected("receipt")}
        />
        <ScanMethodCard
          method="barcode"
          body={t("firstFill.barcode.subtitle")}
          selected={selected === "barcode"}
          onPress={() => setSelected("barcode")}
        />
        <ScanMethodCard
          method="manual"
          body={t("firstFill.manual.subtitle")}
          selected={selected === "manual"}
          onPress={() => setSelected("manual")}
        />
      </View>

      {error ? (
        <Text variant="small" color={colors.red} center>
          {error}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text variant="small" muted center>
          {t("firstFill.footer")}
        </Text>
        <Button
          title={t("common.continue")}
          loading={submitting}
          onPress={() => continueToApp()}
        />
        {__DEV__ ? (
          <Button
            title={t("settings.resetOnboarding")}
            variant="text"
            disabled={submitting}
            onPress={resetOnboarding}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingTop: spacing.screenTop,
    gap: spacing.xxl,
  },
  header: {
    gap: spacing.md,
  },
  title: {
    fontSize: 40,
    lineHeight: 42,
  },
  choices: {
    flexGrow: 1,
    gap: spacing.md,
  },
  footer: {
    gap: spacing.md,
  },
});
