import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AuthButtons, BackButton, Screen, Text, TextField } from "@/components";
import { setPendingInviteCode } from "@/features";
import { useOnboardingSignIn } from "@/features/onboardingSignIn";
import { colors, fonts, spacing } from "@/theme";

// "I have an invite code" from the tour's last slide: the code is stashed and
// prefilled into onboarding's invite step, which joins the kitchen at the end.
export default function InviteCodeRoute() {
  const { t } = useTranslation();
  const signIn = useOnboardingSignIn();
  const [code, setCode] = useState("");
  const trimmed = code.trim();
  const ready = trimmed.length >= 6;
  const stash = () => setPendingInviteCode(trimmed);

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.wrap}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.copy}>
            <Text variant="micro" muted uppercase>
              {t("onboarding.invite.eyebrow")}
            </Text>
            <Text variant="h3">{t("onboarding.invite.title")}</Text>
            <Text variant="body" muted>
              {t("onboarding.invite.body")}
            </Text>
          </View>
          <TextField
            label={t("onboarding.invite.inputLabel")}
            placeholder={t("onboarding.invite.placeholder")}
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            style={styles.code}
          />
          <View style={styles.spacer} />
          <AuthButtons
            appleLabel={t("auth.apple")}
            googleLabel={t("auth.google")}
            emailLabel={t("auth.emailContinue")}
            onApple={() => void signIn.apple(stash)}
            onGoogle={() => void signIn.google(stash)}
            onEmail={() => void signIn.email(stash)}
            disabled={!ready}
          />
          {signIn.error ? (
            <Text variant="small" color={colors.redInk} center accessibilityLiveRegion="polite">
              {signIn.error}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  wrap: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.lg,
    gap: spacing.xxl,
  },
  copy: {
    gap: spacing.sm,
  },
  code: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 20,
    letterSpacing: 2,
  },
  spacer: {
    flex: 1,
  },
});
