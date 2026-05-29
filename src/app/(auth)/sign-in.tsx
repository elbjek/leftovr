import { Link, Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Screen, Text, TextField } from "@/components";
import { useAuth } from "@/features";
import { useFirstRunOnboardingGate } from "@/features/onboardingGate";
import { colors, spacing } from "@/theme";

export default function SignInRoute() {
  const { t } = useTranslation();
  const { signIn, loading, error } = useAuth();
  const {
    loading: onboardingGateLoading,
    hasPickedLanguage,
    hasSeenHook,
  } = useFirstRunOnboardingGate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !password) {
      setFormError(t("auth.missingFields"));
      return;
    }

    setFormError(null);
    await signIn({ email, password });
    router.replace("/");
  }

  if (onboardingGateLoading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="small" muted>
            {t("common.loading")}
          </Text>
        </View>
      </Screen>
    );
  }

  if (!hasPickedLanguage) {
    return <Redirect href="/(onboarding)/language" />;
  }

  if (!hasSeenHook) {
    return <Redirect href="/(onboarding)/hook" />;
  }

  return (
    <Screen scroll>
      <View style={{ flex: 1, gap: spacing.xl, justifyContent: "center" }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="display">{t("auth.signInTitle")}</Text>
          <Text variant="body" muted>
            {t("auth.signInBody")}
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Button title={t("auth.apple")} variant="ghost" disabled />
          <Button title={t("auth.google")} variant="ghost" disabled />
          <Text variant="micro" muted center uppercase>
            {t("auth.oauthPlaceholder")}
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
          <TextField
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
          {formError || error ? (
            <Text variant="small" color={colors.red}>
              {formError ?? error}
            </Text>
          ) : null}
          <Button title={t("auth.signIn")} loading={loading} onPress={handleSubmit} />
        </View>

        <Link href="/(auth)/sign-up" asChild>
          <Button title={t("auth.goToSignUp")} variant="text" />
        </Link>
      </View>
    </Screen>
  );
}
