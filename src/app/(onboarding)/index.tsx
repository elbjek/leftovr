import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { getLocales } from "expo-localization";

import { BackButton, Button, ChoiceCard, FoodGlyph, Screen, Tappable, Text, TextField } from "@/components";
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
// Four tiles; each saves its `servings` (Settings still edits 1–6 exactly).
// `max` buckets a saved value back onto its tile: 3 lights "3–4", 5 lights "5+".
const PEOPLE_OPTIONS = [
  { key: "one", servings: 1, max: 1, seats: ["tomato"] },
  { key: "two", servings: 2, max: 2, seats: ["tomato", "avocado"] },
  { key: "family", servings: 4, max: 4, seats: ["tomato", "avocado", "carrot", "eggs"] },
  { key: "big", servings: 6, max: Infinity, seats: ["tomato", "avocado", "carrot", "eggs"] },
] as const;

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
              const selected = option === PEOPLE_OPTIONS.find((o) => people <= o.max);
              const title = t(`onboarding.personalization.people.tiles.${option.key}`);
              const servings = t("onboarding.personalization.people.servings", { count: option.servings });
              return (
                <Tappable
                  key={option.key}
                  onPress={() => setPeople(option.servings)}
                  feedback="scale"
                  selected={selected}
                  label={`${title}. ${servings}`}
                  hitSlop={0}
                  style={[styles.peopleTile, selected && styles.peopleTileSelected]}
                >
                  <View style={styles.seats}>
                    {option.seats.map((name, i) => (
                      <View key={name} style={[styles.seat, i > 0 && styles.seatOverlap]}>
                        <FoodGlyph name={name} size={20} />
                      </View>
                    ))}
                    {option.key === "big" ? (
                      <View style={[styles.seat, styles.seatOverlap, styles.seatMore]}>
                        <Text variant="small" weight="bold">+</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.peopleCopy}>
                    <Text variant="h3">{title}</Text>
                    <Text variant="small" muted>
                      {servings}
                    </Text>
                  </View>
                  {selected ? (
                    <View style={styles.peopleCheck}>
                      <Svg width={12} height={12} viewBox="0 0 24 24">
                        <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.onPrimary} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </Svg>
                    </View>
                  ) : null}
                </Tappable>
              );
            })}
          </View>
        ) : null}

        {step === "shopping" ? (
          <ChoiceList
            choices={SHOPPING_STYLES.map((value) => ({
              value,
              label: t(`settings.shoppingStyleChoices.${value}`),
              subtitle: t(`onboarding.personalization.shopping.hint.${value}`),
            }))}
            selected={shoppingStyle}
            onSelect={(choice) => setShoppingStyle(choice.value)}
          />
        ) : null}

        {step === "currency" ? (
          <ChoiceList
            choices={CURRENCY_CHOICES}
            selected={currency}
            onSelect={(choice) => setCurrency(choice.value)}
          />
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
  choices: {
    flexGrow: 1,
    gap: spacing.md,
  },
  peopleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  peopleTile: {
    // Two per row: half the row minus half the gap.
    width: "48%",
    flexGrow: 1,
    minHeight: 148,
    justifyContent: "space-between",
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...shadows.soft,
  },
  peopleTileSelected: {
    backgroundColor: colors.sageTint,
  },
  seats: {
    flexDirection: "row",
  },
  seat: {
    width: 36,
    height: 36,
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
  seatMore: {
    backgroundColor: colors.surface3,
  },
  peopleCopy: {
    gap: spacing.xxs,
    marginTop: spacing.lg,
  },
  peopleCheck: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
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
