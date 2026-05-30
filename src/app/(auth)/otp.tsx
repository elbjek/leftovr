import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Screen, Text, TextField } from "@/components";
import { useAuth } from "@/features";
import { useFirstRunOnboardingGate } from "@/features/onboardingGate";
import { colors, spacing } from "@/theme";

type OtpMode = "sign-in" | "sign-up";

export default function OtpRoute() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: OtpMode = params.mode === "sign-in" ? "sign-in" : "sign-up";
  const { sendOtp, verifyOtp, loading, error } = useAuth();
  const {
    loading: onboardingGateLoading,
    hasPickedLanguage,
    hasSeenHook,
  } = useFirstRunOnboardingGate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isSignUp = mode === "sign-up";
  const title = isSignUp ? t("auth.otp.signUpTitle") : t("auth.otp.signInTitle");
  const body = sent ? t("auth.otp.sentBody", { email }) : t("auth.otp.body");
  const normalizedToken = useMemo(() => token.replace(/\D/g, "").slice(0, 6), [token]);

  async function handleSend() {
    if (!email || (isSignUp && !displayName)) {
      setFormError(t("auth.missingFields"));
      return;
    }

    setFormError(null);
    await sendOtp({
      email: email.trim(),
      displayName: displayName.trim() || undefined,
      shouldCreateUser: true,
    });
    setSent(true);
  }

  async function handleVerify() {
    if (!email || normalizedToken.length < 6) {
      setFormError(t("auth.otp.missingCode"));
      return;
    }

    setFormError(null);
    await verifyOtp({ email: email.trim(), token: normalizedToken });
    router.replace("/");
  }

  if (onboardingGateLoading) {
    return (
      <Screen>
        <View style={styles.center}>
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
      <View style={styles.wrap}>
        <View style={styles.copy}>
          <Text variant="display">{title}</Text>
          <Text variant="body" muted>
            {body}
          </Text>
        </View>

        <View style={styles.form}>
          {isSignUp && !sent ? (
            <TextField
              label={t("auth.displayName")}
              value={displayName}
              onChangeText={setDisplayName}
              textContentType="name"
              autoCapitalize="words"
            />
          ) : null}
          <TextField
            label={t("auth.email")}
            value={email}
            editable={!sent}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          {sent ? (
            <TextField
              label={t("auth.otp.code")}
              value={normalizedToken}
              onChangeText={setToken}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
            />
          ) : null}
          {formError || error ? (
            <Text variant="small" color={colors.red}>
              {formError ?? error}
            </Text>
          ) : null}
          <Button
            title={sent ? t("auth.otp.verify") : t("auth.otp.send")}
            loading={loading}
            onPress={sent ? handleVerify : handleSend}
          />
          {sent ? (
            <Button title={t("auth.otp.resend")} variant="text" loading={loading} onPress={handleSend} />
          ) : null}
        </View>

        <Button
          title={t("auth.backToChoices")}
          variant="text"
          onPress={() => router.replace(isSignUp ? "/(auth)/sign-up" : "/(auth)/sign-in")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  wrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xl,
  },
  copy: {
    gap: spacing.sm,
  },
  form: {
    gap: spacing.lg,
  },
});
