import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getLocales } from "expo-localization";

import { BackButton, Button, FoodGlyph, Screen, Tappable, Text, TextField } from "@/components";
import { consumePendingInviteCode, useAuth } from "@/features";
import {
  acceptHouseholdInvite,
  completeCurrentProfileOnboarding,
  InviteLookup,
  lookupHouseholdInvite,
  OnboardingPersonalization,
  updateProfileField,
} from "@/repositories";
import { colors, radii, shadows, spacing } from "@/theme";

type StepKey = "name" | "people" | "shopping" | "currency" | "invite";
type Choice = {
  label: string;
  subtitle?: string;
  value: string;
};

const steps: StepKey[] = ["name", "people", "shopping", "currency", "invite"];
const requiredStepCount = 4;
// Also picks the recommended way to add food (`recommendedAddMethod`).
const SHOPPING_STYLES = ["weekly", "few", "asneed"] as const;
// The size of the haul, drawn as overlapping food "seats" like the people step.
const SHOPPING_FOODS: Record<(typeof SHOPPING_STYLES)[number], string[]> = {
  weekly: ["bread", "milk", "eggs"],
  few: ["tomato", "bread"],
  asneed: ["milk"],
};
// Household-size buckets; each saves its `servings` (Settings still edits
// 1–6 exactly). `max` maps a saved value onto its card: 3 lights the family
// card, 5 the big household, without changing the value until a tap.
const PEOPLE_OPTIONS = [
  { key: "one", servings: 1, max: 1, seats: 1 },
  { key: "two", servings: 2, max: 2, seats: 2 },
  { key: "family", servings: 4, max: 4, seats: 4 },
  { key: "big", servings: 6, max: Infinity, seats: 4 },
] as const;
// One food "seat" per person; the big household adds a "+".
const SEAT_FOODS = ["tomato", "avocado", "carrot", "eggs"];

const CURRENCY_CHOICES: Choice[] = [
  { label: "USD", subtitle: "$ · US dollar", value: "USD" },
  { label: "EUR", subtitle: "€ · Euro", value: "EUR" },
  { label: "RSD", subtitle: "din · Serbian dinar", value: "RSD" },
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

export default function OnboardingRoute() {
  const { t } = useTranslation();
  const { profile, refresh, user, activeHousehold } = useAuth();
  const hasSavedDisplayName = hasUsableProfileName(profile?.display_name, user?.email);
  const [stepIndex, setStepIndex] = useState(hasSavedDisplayName ? 1 : 0);
  const [displayName, setDisplayName] = useState(hasSavedDisplayName ? profile?.display_name ?? "" : "");
  const [people, setPeople] = useState(profile?.default_servings ?? 2);
  const [shoppingStyle, setShoppingStyle] = useState(profile?.shopping_style ?? "weekly");
  const [currency, setCurrency] = useState<string>(activeHousehold?.currency_code ?? guessCurrency());
  const [inviteCode, setInviteCode] = useState("");
  const [invitePreview, setInvitePreview] = useState<InviteLookup | null>(null);
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
    inputLabel?: string;
  };
  const canContinue = step !== "name" || displayName.trim().length > 0;

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

    // A code (often prefilled from a link) is only joined after showing whose
    // kitchen it is: the first tap looks it up, "Join household" accepts.
    if (inviteCode.trim() && !invitePreview) {
      void previewInvite();
      return;
    }

    void handleSubmit(false);
  }

  async function previewInvite() {
    setSubmitting(true);
    try {
      const found = await lookupHouseholdInvite(inviteCode);
      if (!found) setError(t("onboarding.personalization.invite.invalidCode"));
      else if (found.member_count >= 3) setError(t("settings.household.householdFull"));
      else setInvitePreview(found);
    } catch {
      setError(t("onboarding.personalization.invite.invalidCode"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(skipInvite: boolean) {
    setSubmitting(true);
    setError(null);

    try {
      // How many people sets the household's servings (the cook prompt's
      // Household default). Shopping style, goal and avoidances aren't asked
      // up front; keep anything already saved, else seed defaults (editable in Settings).
      const personalization: OnboardingPersonalization = {
        cookingForSeed: people === 1 ? "solo" : people === 2 ? "partner" : "family",
        defaultServings: people,
        shoppingStyle,
        primaryGoal: profile?.primary_goal ?? "waste",
        avoidances: profile?.avoidances ?? [],
        currencyCode: currency,
      };

      await updateProfileField("display_name", displayName.trim());

      await completeCurrentProfileOnboarding(personalization);

      if (!skipInvite && invitePreview) {
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

  return (
    <Screen
      scroll
      padded={false}
      contentContainerStyle={styles.screenPad}
    >
      <View style={styles.wrap}>
        {/* Nothing to go back to on the first step: this screen replaces the
            tour / sign-in, so hide it but keep its space so the layout holds. */}
        <BackButton
          onPress={handleBack}
          style={[styles.backButton, stepIndex === 0 && !router.canGoBack() && styles.hidden]}
        />

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
          <Text variant="h3">
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

        {step === "people" ? (
          <View style={styles.peopleGrid}>
            {PEOPLE_OPTIONS.map((option) => {
              const label = t(`onboarding.personalization.people.options.${option.key}`);
              const range = t(`onboarding.personalization.people.ranges.${option.key}`);
              const selected = option === PEOPLE_OPTIONS.find((o) => people <= o.max);
              return (
                <Tappable
                  key={option.key}
                  onPress={() => setPeople(option.servings)}
                  feedback="scale"
                  role="radio"
                  selected={selected}
                  label={`${label}. ${range}`}
                  hitSlop={0}
                  style={[styles.optionCard, styles.gridCard, selected && styles.optionCardSelected]}
                >
                  <View style={[styles.radio, selected && styles.radioOn]} />
                  <View style={styles.seats}>
                    {SEAT_FOODS.slice(0, option.seats).map((name, i) => (
                      <View key={name} style={[styles.seat, i > 0 && styles.seatOverlap]}>
                        <FoodGlyph name={name} size={16} />
                      </View>
                    ))}
                    {option.key === "big" ? (
                      <View style={[styles.seat, styles.seatOverlap]}>
                        <Text variant="small" weight="bold">+</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.peopleCopy}>
                    <Text variant="title">{label}</Text>
                    <Text variant="small" muted>
                      {range}
                    </Text>
                  </View>
                </Tappable>
              );
            })}
          </View>
        ) : null}

        {step === "shopping" ? (
          <View style={styles.optionList}>
            {SHOPPING_STYLES.map((value) => {
              const label = t(`settings.shoppingStyleChoices.${value}`);
              const hint = t(`onboarding.personalization.shopping.hint.${value}`);
              const selected = shoppingStyle === value;
              return (
                <Tappable
                  key={value}
                  onPress={() => setShoppingStyle(value)}
                  feedback="scale"
                  role="radio"
                  selected={selected}
                  label={`${label}. ${hint}`}
                  hitSlop={0}
                  style={[styles.optionCard, styles.optionRow, selected && styles.optionCardSelected]}
                >
                  <View style={[styles.seats, styles.shoppingSeats]}>
                    {SHOPPING_FOODS[value].map((name, i) => (
                      <View key={name} style={[styles.seat, i > 0 && styles.seatOverlap]}>
                        <FoodGlyph name={name} size={16} />
                      </View>
                    ))}
                  </View>
                  <View style={styles.optionRowCopy}>
                    <Text variant="title">{label}</Text>
                    <Text variant="small" muted>
                      {hint}
                    </Text>
                  </View>
                  <View style={[styles.radio, styles.radioInline, selected && styles.radioOn]} />
                </Tappable>
              );
            })}
          </View>
        ) : null}

        {step === "currency" ? (
          <View style={styles.peopleGrid}>
            {CURRENCY_CHOICES.map((choice) => {
              // "$ · US dollar": the symbol goes in the well, the name under the code.
              const [symbol, name] = (choice.subtitle ?? "").split(" · ");
              const selected = currency === choice.value;
              return (
                <Tappable
                  key={choice.value}
                  onPress={() => setCurrency(choice.value)}
                  feedback="scale"
                  role="radio"
                  selected={selected}
                  label={`${choice.label}. ${name}`}
                  hitSlop={0}
                  style={[styles.optionCard, styles.gridCard, selected && styles.optionCardSelected]}
                >
                  <View style={[styles.radio, selected && styles.radioOn]} />
                  <View style={styles.symbolWell}>
                    <Text variant="label">{symbol}</Text>
                  </View>
                  <View style={styles.peopleCopy}>
                    <Text variant="title">{choice.label}</Text>
                    <Text variant="small" muted>
                      {name}
                    </Text>
                  </View>
                </Tappable>
              );
            })}
          </View>
        ) : null}

        {step === "invite" ? (
          <TextField
            label={t("onboarding.personalization.invite.inputLabel")}
            placeholder={t("onboarding.personalization.invite.placeholder")}
            value={inviteCode}
            onChangeText={(code) => {
              setInviteCode(code);
              setInvitePreview(null);
            }}
            autoCapitalize="characters"
          />
        ) : null}

        {step === "invite" && invitePreview ? (
          <View style={styles.invitePreview}>
            <Text variant="h3">
              {t("settings.household.lookupTitle", { name: invitePreview.household_name })}
            </Text>
            <Text variant="small" muted>
              {t("settings.household.lookupMembers", { count: invitePreview.member_count })}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text variant="small" color={colors.redInk} center accessibilityLiveRegion="polite">
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Button
            title={
              step === "invite" && invitePreview
                ? t("settings.household.joinButton")
                : t("common.continue")
            }
            disabled={!canContinue}
            loading={submitting}
            onPress={goNext}
          />
          {step === "invite" ? (
            <Button
              title={t("common.skipForNow")}
              variant="text"
              disabled={submitting}
              onPress={() => void handleSubmit(true)}
            />
          ) : null}
        </View>
      </View>
    </Screen>
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
  hidden: {
    opacity: 0,
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
  // flexGrow keeps Continue at the bottom of the screen, as on the other steps.
  peopleGrid: {
    flexGrow: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    gap: spacing.md,
  },
  optionList: {
    flexGrow: 1,
    gap: spacing.md,
  },
  // The app's card: lifted by the soft shadow, no outline. Selected tints it.
  optionCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...shadows.soft,
  },
  optionCardSelected: {
    backgroundColor: colors.primary100,
  },
  gridCard: {
    // Two per row: just under half, flexGrow takes up the gap.
    width: "46%",
    flexGrow: 1,
    minHeight: 132,
    justifyContent: "space-between",
    gap: spacing.md,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  optionRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  // Fits the widest stack (three seats), so the labels line up.
  shoppingSeats: {
    width: 64,
  },
  symbolWell: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.muted2,
  },
  radioInline: {
    position: "relative",
    top: 0,
    right: 0,
  },
  radioOn: {
    borderWidth: 5,
    borderColor: colors.primary,
  },
  seats: {
    flexDirection: "row",
  },
  seat: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  seatOverlap: {
    marginLeft: -10,
  },
  peopleCopy: {
    gap: spacing.xxs,
  },
  footer: {
    gap: spacing.sm,
    marginTop: 16,
  },
  errorBox: {
    marginTop: 12,
  },
  invitePreview: {
    marginTop: spacing.md,
    backgroundColor: colors.primary50,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
});
