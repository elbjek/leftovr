import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Button, Card, HouseholdSection, PremiumSheet, Screen, SegmentedControl, Text } from "@/components";
import { useAuth } from "@/features";
import { HAS_PICKED_LANGUAGE_KEY, HAS_SEEN_HOOK_KEY } from "@/features/onboardingGate";
import { useHousehold, useInventory } from "@/hooks";
import { isSupportedLanguage, supportedLanguages, SupportedLanguage } from "@/i18n";
import { resetCurrentUserOnboardingForDev, setPreviewTier, setPrototypeDay, PlanTier } from "@/repositories";
import { colors, radii, spacing } from "@/theme";

const TIER_OPTIONS: { label: string; value: PlanTier; key: string }[] = [
  { label: "tierFree", value: "free", key: "free" },
  { label: "tierPremium", value: "premium", key: "premium" },
  { label: "tierHouseholdPremium", value: "household_premium", key: "household_premium" },
];

const PROTOTYPE_DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const { profile, activeHousehold, session, signOut, loading, refresh } = useAuth();
  const currentLanguage = isSupportedLanguage(i18n.language) ? i18n.language : "en";
  const languageOptions = supportedLanguages.map((language) => ({
    label: t(`settings.languages.${language}`),
    value: language,
  }));

  const [tierLoading, setTierLoading] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  const household = useHousehold(activeHousehold?.id);
  const { lots } = useInventory(activeHousehold?.id);
  const isHouseholdPremium = profile?.tier === "household_premium";

  function handleLanguageChange(language: SupportedLanguage) {
    i18n.changeLanguage(language);
  }

  async function handleResetOnboarding() {
    if (session) {
      await resetCurrentUserOnboardingForDev();
    }
    await AsyncStorage.multiRemove([HAS_PICKED_LANGUAGE_KEY, HAS_SEEN_HOOK_KEY]);
    await signOut();
    router.replace("/");
  }

  async function handleTierChange(tier: PlanTier) {
    setTierLoading(true);
    try {
      await setPreviewTier(tier);
      await refresh();
    } finally {
      setTierLoading(false);
    }
  }

  async function handleDayChange(day: number) {
    setDayLoading(true);
    try {
      await setPrototypeDay(day);
      await refresh();
    } finally {
      setDayLoading(false);
    }
  }

  const currentTier = profile?.tier ?? "free";
  const currentDay = profile?.prototype_day ?? 1;

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.sections}>
        <View style={styles.titleBlock}>
          <Text variant="display">{t("settings.title")}</Text>
          <Text variant="body" muted>
            {t("settings.body")}
          </Text>
        </View>

        <Card>
          <View style={styles.cardInner}>
            <View style={styles.profileInfo}>
              <Text variant="label">{profile?.display_name}</Text>
              <Text variant="small" muted>
                {activeHousehold?.name ?? t("common.unknownHousehold")}
              </Text>
              <View style={styles.tierBadge}>
                <Text variant="micro" color={currentTier === "free" ? colors.primary : colors.accent}>
                  {currentTier === "free"
                    ? t("settings.tierFree")
                    : currentTier === "premium"
                      ? `★ ${t("settings.tierPremium")}`
                      : `★ ${t("settings.tierHouseholdPremium")}`}
                </Text>
              </View>
            </View>
            <Button title={t("common.signOut")} loading={loading} onPress={signOut} />
            {__DEV__ ? (
              <Button
                title={t("settings.resetOnboarding")}
                variant="ghost"
                loading={loading}
                onPress={handleResetOnboarding}
              />
            ) : null}
          </View>
        </Card>

        <Card>
          <View style={styles.cardInner}>
            <View style={styles.sectionHeader}>
              <Text variant="label">{t("settings.languageTitle")}</Text>
              <Text variant="small" muted>
                {t("settings.languageBody")}
              </Text>
            </View>
            <SegmentedControl
              options={languageOptions}
              value={currentLanguage}
              onChange={handleLanguageChange}
            />
          </View>
        </Card>

        {profile && activeHousehold ? (
          <HouseholdSection
            householdName={activeHousehold.name}
            members={household.members}
            currentUserId={profile.id}
            activeInvite={household.activeInvite}
            isPremium={isHouseholdPremium}
            currentItemCount={lots.length}
            onCreateInvite={household.createInvite}
            onLookupCode={household.lookupCode}
            onJoin={async (code, moveItems) => {
              await household.joinHousehold(code, moveItems);
              await refresh();
            }}
            onPremiumGate={() => setShowPremium(true)}
          />
        ) : null}

        <Card>
          <View style={styles.cardInner}>
            <View style={styles.sectionHeader}>
              <Text variant="label">{t("settings.prototypeControls")}</Text>
              <Text variant="small" muted>
                {t("settings.prototypeControlsBody")}
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text variant="small" color={colors.primary} style={styles.controlLabel}>
                {t("settings.tierLabel")}
              </Text>
            </View>
            <View style={styles.tierButtons}>
              {TIER_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: currentTier === option.value }}
                  disabled={tierLoading}
                  onPress={() => handleTierChange(option.value)}
                  style={[
                    styles.tierOption,
                    currentTier === option.value && styles.tierOptionActive,
                  ]}
                >
                  <Text
                    variant="small"
                    color={currentTier === option.value ? colors.surface : colors.primary}
                    style={styles.tierOptionText}
                  >
                    {t(`settings.${option.label}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.sectionHeader}>
              <Text variant="small" color={colors.primary} style={styles.controlLabel}>
                {t("settings.prototypeDayLabel")}
              </Text>
              <Text variant="small" muted>
                {t("settings.prototypeDayBody")}
              </Text>
            </View>
            <View style={styles.dayButtons}>
              {PROTOTYPE_DAYS.map((day) => (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityState={{ selected: currentDay === day }}
                  disabled={dayLoading}
                  onPress={() => handleDayChange(day)}
                  style={[
                    styles.dayOption,
                    currentDay === day && styles.dayOptionActive,
                  ]}
                >
                  <Text
                    variant="small"
                    color={currentDay === day ? colors.surface : colors.primary}
                    center
                  >
                    {day}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Card>
      </View>

      <PremiumSheet
        visible={showPremium}
        plan="household"
        onPreview={async () => {
          await setPreviewTier("household_premium");
          await refresh();
        }}
        onDismiss={() => setShowPremium(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.tabBarClearance,
  },
  sections: {
    gap: spacing.xl,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  cardInner: {
    gap: spacing.md,
  },
  profileInfo: {
    gap: spacing.xs,
  },
  tierBadge: {
    marginTop: spacing.xxs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.primary50,
    borderRadius: radii.pill,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  controlLabel: {
    fontWeight: "600",
  },
  tierButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tierOption: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
  },
  tierOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tierOptionText: {
    fontWeight: "600",
    textAlign: "center",
  },
  dayButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dayOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  dayOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
