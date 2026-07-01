import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getLocales } from "expo-localization";

import { BackButton, Button, ChoiceCard, ChoiceIcon, CHOICE_ICON_NAMES, Screen, Text, TextField } from "@/components";
import { consumePendingInviteCode, useAuth } from "@/features";
import {
  acceptHouseholdInvite,
  completeCurrentProfileOnboarding,
  OnboardingPersonalization,
  updateProfileField,
} from "@/repositories";
import { colors, spacing } from "@/theme";

type StepKey = "name" | "cookingFor" | "shoppingStyle" | "primaryGoal" | "currency" | "avoidances" | "invite";
type Choice = {
  label: string;
  subtitle?: string;
  value: string;
  servings?: number;
  emoji?: string;
};

const steps: StepKey[] = ["name", "cookingFor", "shoppingStyle", "primaryGoal", "currency", "avoidances", "invite"];
const requiredStepCount = 6;

const CURRENCY_CHOICES: Choice[] = [
  { label: "USD", subtitle: "$ · US dollar", value: "USD" },
  { label: "EUR", subtitle: "€ · Euro", value: "EUR" },
  { label: "RSD", subtitle: "дин · Serbian dinar", value: "RSD" },
  { label: "GBP", subtitle: "£ · British pound", value: "GBP" },
];

function guessCurrency(): string {
  const region = getLocales()[0]?.regionCode;
  const map: Record<string, string> = { RS: "RSD", US: "USD", GB: "GBP" };
  if (region && map[region]) return map[region];
  return region ? "EUR" : "USD";
}

function hasUsableProfileName(displayName: string | undefined, email: string | undefined) {
  const trimmedName = displayName?.trim();
  if (!trimmedName) return false;

  const emailLocalPart = email?.split("@")[0]?.trim();
  return trimmedName.toLowerCase() !== emailLocalPart?.toLowerCase();
}

function getInitialStepIndex({
  hasSavedDisplayName,
  cookingForSeed,
  shoppingStyle,
  primaryGoal,
}: {
  hasSavedDisplayName: boolean;
  cookingForSeed: string | null | undefined;
  shoppingStyle: string | null | undefined;
  primaryGoal: string | null | undefined;
}) {
  if (!hasSavedDisplayName) return 0;
  if (!cookingForSeed) return 1;
  if (!shoppingStyle) return 2;
  if (!primaryGoal) return 3;
  return 4;
}

export default function OnboardingRoute() {
  const { t } = useTranslation();
  const { profile, refresh, user, activeHousehold } = useAuth();
  const hasSavedDisplayName = hasUsableProfileName(profile?.display_name, user?.email);
  const initialStepIndex = getInitialStepIndex({
    hasSavedDisplayName,
    cookingForSeed: profile?.cooking_for_seed,
    shoppingStyle: profile?.shopping_style,
    primaryGoal: profile?.primary_goal,
  });
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [displayName, setDisplayName] = useState(hasSavedDisplayName ? profile?.display_name ?? "" : "");
  const [cookingFor, setCookingFor] = useState(profile?.cooking_for_seed ?? "partner");
  const [servings, setServings] = useState(profile?.default_servings ?? 2);
  const [shoppingStyle, setShoppingStyle] = useState(profile?.shopping_style ?? "weekly");
  const [primaryGoal, setPrimaryGoal] = useState(profile?.primary_goal ?? "waste");
  const [avoidances, setAvoidances] = useState<string[]>(profile?.avoidances ?? []);
  const [currency, setCurrency] = useState<string>(activeHousehold?.currency_code ?? guessCurrency());
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void consumePendingInviteCode().then((code) => {
      if (code) setInviteCode(code);
    });
  }, []);

  const step = steps[stepIndex];
  const stepCopy = t(`onboarding.personalization.${step}`, { returnObjects: true }) as {
    eyebrow?: string;
    title: string;
    body?: string;
    choices?: Choice[];
    skipLabel?: string;
    inputLabel?: string;
  };
  const canContinue = useMemo(() => {
    if (step === "name") return displayName.trim().length > 0;
    if (step === "cookingFor") return Boolean(cookingFor);
    if (step === "shoppingStyle") return Boolean(shoppingStyle);
    if (step === "primaryGoal") return Boolean(primaryGoal);
    return true;
  }, [cookingFor, displayName, primaryGoal, shoppingStyle, step]);

  function handleBack() {
    setError(null);

    if (stepIndex > 0) {
      setStepIndex((current) => current - 1);
      return;
    }

    router.back();
  }

  function goNext() {
    setError(null);

    if (stepIndex < steps.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }

    void handleSubmit(false);
  }

  async function handleSubmit(skipInvite: boolean) {
    setSubmitting(true);
    setError(null);

    try {
      const personalization: OnboardingPersonalization = {
        cookingForSeed: cookingFor,
        defaultServings: servings,
        shoppingStyle,
        primaryGoal,
        avoidances,
        currencyCode: currency,
      };

      await updateProfileField("display_name", displayName.trim());

      await completeCurrentProfileOnboarding(personalization);

      if (!skipInvite && inviteCode.trim()) {
        try {
          await acceptHouseholdInvite(inviteCode.trim(), false);
        } catch {
          setError(t("onboarding.personalization.invite.invalidCode"));
          return;
        }
      }

      await refresh();
      router.replace("/(tabs)/scan");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("auth.genericError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function toggleAvoidance(value: string) {
    setAvoidances((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  return (
    <Screen
      scroll
      padded={false}
      contentContainerStyle={styles.screenPad}
    >
      <View style={styles.wrap}>
        <BackButton onPress={handleBack} style={styles.backButton} />

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(Math.min(stepIndex + 1, requiredStepCount) / requiredStepCount) * 100}%` },
              ]}
            />
          </View>
          <Text variant="small" muted>
            {Math.min(stepIndex + 1, requiredStepCount)}/{requiredStepCount}
          </Text>
        </View>

        <View style={styles.header}>
          {stepCopy.eyebrow ? (
            <Text variant="micro" muted uppercase>
              {stepCopy.eyebrow}
            </Text>
          ) : null}
          <Text variant="h1">
            {stepCopy.title}
          </Text>
          {stepCopy.body ? (
            <Text variant="body" muted>
              {stepCopy.body}
            </Text>
          ) : null}
        </View>

        {step === "name" ? (
          <TextField
            label={t("onboarding.personalization.name.inputLabel")}
            placeholder={t("onboarding.personalization.name.placeholder")}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            textContentType="name"
            autoFocus
          />
        ) : null}

        {step === "cookingFor" ? (
          <ChoiceList
            choices={stepCopy.choices ?? []}
            selected={cookingFor}
            onSelect={(choice) => {
              setCookingFor(choice.value);
              setServings(choice.servings ?? 1);
            }}
          />
        ) : null}

        {step === "shoppingStyle" ? (
          <ChoiceList
            choices={stepCopy.choices ?? []}
            selected={shoppingStyle}
            onSelect={(choice) => setShoppingStyle(choice.value)}
          />
        ) : null}

        {step === "primaryGoal" ? (
          <ChoiceList
            choices={stepCopy.choices ?? []}
            selected={primaryGoal}
            onSelect={(choice) => setPrimaryGoal(choice.value)}
          />
        ) : null}

        {step === "currency" ? (
          <ChoiceList
            choices={CURRENCY_CHOICES}
            selected={currency}
            onSelect={(choice) => setCurrency(choice.value)}
          />
        ) : null}

        {step === "avoidances" ? (
          <View style={styles.choices}>
            {(stepCopy.choices ?? []).map((choice) => (
              <ChoiceCard
                key={choice.value}
                title={choice.label}
                selected={avoidances.includes(choice.value)}
                icon={CHOICE_ICON_NAMES.includes(choice.value) ? <ChoiceIcon name={choice.value} /> : undefined}
                onPress={() => toggleAvoidance(choice.value)}
              />
            ))}
          </View>
        ) : null}

        {step === "invite" ? (
          <TextField
            label={t("onboarding.personalization.invite.inputLabel")}
            placeholder={t("onboarding.personalization.invite.placeholder")}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
          />
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text variant="small" color={colors.red} center>
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Button
            title={
              stepIndex === steps.length - 1
                ? t("common.continue")
                : stepCopy.skipLabel ?? t("common.continue")
            }
            disabled={!canContinue}
            loading={submitting}
            onPress={goNext}
          />
          {step === "avoidances" || step === "invite" ? (
            <Button
              title={t("common.skipForNow")}
              variant="text"
              disabled={submitting}
              onPress={() => (step === "invite" ? void handleSubmit(true) : goNext())}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function ChoiceList({
  choices,
  selected,
  onSelect,
}: {
  choices: Choice[];
  selected: string;
  onSelect: (choice: Choice) => void;
}) {
  return (
    <View style={styles.choices}>
      {choices.map((choice) => (
        <ChoiceCard
          key={choice.value}
          title={choice.label}
          subtitle={choice.subtitle}
          selected={selected === choice.value}
          icon={
            CHOICE_ICON_NAMES.includes(choice.value) ? (
              <ChoiceIcon name={choice.value} />
            ) : choice.emoji ? (
              <Text style={styles.choiceEmoji}>{choice.emoji}</Text>
            ) : undefined
          }
          onPress={() => onSelect(choice)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screenPad: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: spacing.screenTop,
    paddingBottom: 32,
  },
  wrap: {
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  header: {
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.hairline,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  choices: {
    flexGrow: 1,
    gap: 10,
  },
  choiceEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  footer: {
    gap: 8,
    marginTop: 16,
  },
  errorBox: {
    marginTop: 12,
  },
});
