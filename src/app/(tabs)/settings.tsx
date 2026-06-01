import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  BottomSheet,
  Button,
  Card,
  ChoiceCard,
  HouseholdSection,
  PremiumSheet,
  Screen,
  SegmentedControl,
  Text,
  TextField,
} from "@/components";
import { useAuth, useMeasurementSystem } from "@/features";
import { HAS_PICKED_LANGUAGE_KEY, HAS_SEEN_HOOK_KEY } from "@/features/onboardingGate";
import { useHousehold, useInventory, useNotifications } from "@/hooks";
import { isSupportedLanguage, supportedLanguages, SupportedLanguage } from "@/i18n";
import {
  resetCurrentUserOnboardingForDev,
  setPreviewTier,
  setPrototypeDay,
  updateHouseholdDefaultServings,
  updateProfileAvoidances,
  updateProfileField,
  PlanTier,
} from "@/repositories";
import { colors, radii, spacing } from "@/theme";

const TIER_OPTIONS: { label: string; value: PlanTier; key: string }[] = [
  { label: "tierFree", value: "free", key: "free" },
  { label: "tierPremium", value: "premium", key: "premium" },
  { label: "tierHouseholdPremium", value: "household_premium", key: "household_premium" },
];

const PROTOTYPE_DAYS = [1, 2, 3, 4, 5, 6, 7];

const PRIMARY_GOAL_OPTIONS = ["waste", "money", "quick", "all"] as const;
const SHOPPING_STYLE_OPTIONS = ["weekly", "few", "asneed"] as const;
const AVOIDANCE_OPTIONS = ["meat", "fish", "dairy", "gluten", "nuts"] as const;
const SERVINGS_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const { profile, activeHousehold, session, signOut, loading, refresh } = useAuth();
  const { system, setMeasurementSystem } = useMeasurementSystem();
  const currentLanguage = isSupportedLanguage(i18n.language) ? i18n.language : "en";
  const languageOptions = supportedLanguages.map((language) => ({
    label: t(`settings.languages.${language}`),
    value: language,
  }));

  const [tierLoading, setTierLoading] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(profile?.display_name ?? "");
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
  const [editingAvoidances, setEditingAvoidances] = useState(false);
  const [editingServings, setEditingServings] = useState(false);
  const [localAvoidances, setLocalAvoidances] = useState<string[]>(profile?.avoidances ?? []);

  const household = useHousehold(activeHousehold?.id);
  const { lots } = useInventory(activeHousehold?.id);
  const {
    preferences: notifPrefs,
    householdSettings: notifHouseholdSettings,
    toggleSmartSuggestions,
    toggleDailySuggestion,
  } = useNotifications(activeHousehold?.id);
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

  async function saveName() {
    if (!nameValue.trim() || nameValue === profile?.display_name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await updateProfileField("display_name", nameValue.trim());
      await refresh();
    } finally {
      setSaving(false);
      setEditingName(false);
    }
  }

  async function saveGoal(value: string) {
    setSaving(true);
    try {
      await updateProfileField("primary_goal", value);
      await refresh();
    } finally {
      setSaving(false);
      setEditingGoal(false);
    }
  }

  async function saveStyle(value: string) {
    setSaving(true);
    try {
      await updateProfileField("shopping_style", value);
      await refresh();
    } finally {
      setSaving(false);
      setEditingStyle(false);
    }
  }

  async function saveAvoidances() {
    setSaving(true);
    try {
      await updateProfileAvoidances(localAvoidances);
      await refresh();
    } finally {
      setSaving(false);
      setEditingAvoidances(false);
    }
  }

  async function saveServings(count: number) {
    if (!activeHousehold?.id) return;
    setSaving(true);
    try {
      await updateHouseholdDefaultServings(activeHousehold.id, count);
      await refresh();
    } finally {
      setSaving(false);
      setEditingServings(false);
    }
  }

  function toggleAvoidance(value: string) {
    setLocalAvoidances((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  const currentTier = profile?.tier ?? "free";
  const currentDay = profile?.prototype_day ?? 1;

  const goalLabel = profile?.primary_goal
    ? t(`settings.primaryGoalChoices.${profile.primary_goal}` as any)
    : "—";
  const styleLabel = profile?.shopping_style
    ? t(`settings.shoppingStyleChoices.${profile.shopping_style}` as any)
    : "—";
  const avoidancesLabel = (profile?.avoidances ?? []).length > 0
    ? (profile?.avoidances ?? []).map((a) => t(`settings.avoidanceChoices.${a}` as any)).join(", ")
    : "—";

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.sections}>
        <View style={styles.titleBlock}>
          <Text variant="display">{t("settings.title")}</Text>
          <Text variant="body" muted>
            {t("settings.body")}
          </Text>
        </View>

        {/* Profile card */}
        <Card>
          <View style={styles.cardInner}>
            <View style={styles.profileInfo}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setNameValue(profile?.display_name ?? "");
                  setEditingName(true);
                }}
              >
                <Text variant="label">{profile?.display_name}</Text>
                <Text variant="micro" muted>{t("settings.displayNameLabel")}</Text>
              </Pressable>
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

        {/* Language */}
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

        {/* Units */}
        <Card>
          <View style={styles.cardInner}>
            <View style={styles.sectionHeader}>
              <Text variant="label">{t("settings.unitsTitle")}</Text>
              <Text variant="small" muted>
                {t("settings.unitsBody")}
              </Text>
            </View>
            <SegmentedControl
              options={[
                { label: t("settings.units.metric"), value: "metric" },
                { label: t("settings.units.imperial"), value: "imperial" },
              ]}
              value={system}
              onChange={(value) => setMeasurementSystem(value as "metric" | "imperial")}
            />
          </View>
        </Card>

        {/* Preferences */}
        <Card>
          <View style={styles.cardInner}>
            <View style={styles.sectionHeader}>
              <Text variant="label">{t("settings.preferencesTitle")}</Text>
              <Text variant="small" muted>
                {t("settings.preferencesBody")}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setEditingGoal(true)}
              style={styles.prefRow}
            >
              <Text variant="small">{t("settings.primaryGoalLabel")}</Text>
              <Text variant="small" color={colors.primary}>{goalLabel}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setEditingStyle(true)}
              style={styles.prefRow}
            >
              <Text variant="small">{t("settings.shoppingStyleLabel")}</Text>
              <Text variant="small" color={colors.primary}>{styleLabel}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLocalAvoidances(profile?.avoidances ?? []);
                setEditingAvoidances(true);
              }}
              style={styles.prefRow}
            >
              <View style={styles.prefCopy}>
                <Text variant="small">{t("settings.avoidancesLabel")}</Text>
                <Text variant="micro" muted>{avoidancesLabel}</Text>
              </View>
            </Pressable>

            {activeHousehold ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditingServings(true)}
                style={styles.prefRow}
              >
                <Text variant="small">{t("settings.servingsTitle")}</Text>
                <Text variant="small" color={colors.primary}>
                  {t("settings.servingsLabel", { count: activeHousehold.default_servings })}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {/* Household */}
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

        {/* Notifications */}
        <Card>
          <View style={styles.cardInner}>
            <View style={styles.sectionHeader}>
              <Text variant="label">{t("notifications.title")}</Text>
              <Text variant="small" muted>
                {t("notifications.body")}
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text variant="small">{t("notifications.smartSuggestions")}</Text>
                <Text variant="micro" muted>{t("notifications.smartSuggestionsBody")}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: notifPrefs?.smart_suggestions_enabled ?? false }}
                onPress={() => toggleSmartSuggestions(!notifPrefs?.smart_suggestions_enabled)}
                style={[
                  styles.toggle,
                  notifPrefs?.smart_suggestions_enabled && styles.toggleActive,
                ]}
              >
                <View style={[
                  styles.toggleThumb,
                  notifPrefs?.smart_suggestions_enabled && styles.toggleThumbActive,
                ]} />
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text variant="small">{t("notifications.dailySuggestion")}</Text>
                <Text variant="micro" muted>{t("notifications.dailySuggestionBody")}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: notifHouseholdSettings?.daily_suggestion_enabled ?? false }}
                onPress={() => toggleDailySuggestion(!notifHouseholdSettings?.daily_suggestion_enabled)}
                style={[
                  styles.toggle,
                  notifHouseholdSettings?.daily_suggestion_enabled && styles.toggleActive,
                ]}
              >
                <View style={[
                  styles.toggleThumb,
                  notifHouseholdSettings?.daily_suggestion_enabled && styles.toggleThumbActive,
                ]} />
              </Pressable>
            </View>

            {notifHouseholdSettings?.daily_suggestion_enabled ? (
              <View style={styles.settingRow}>
                <Text variant="small">{t("notifications.sendWindow")}</Text>
                <Text variant="small" muted>
                  {t("notifications.sendWindowValue", {
                    start: notifHouseholdSettings.send_window_start?.slice(0, 5) ?? "13:00",
                    end: notifHouseholdSettings.send_window_end?.slice(0, 5) ?? "14:00",
                  })}
                </Text>
              </View>
            ) : null}

            <View style={styles.settingRow}>
              <Text variant="small">{t("notifications.permissionStatus")}</Text>
              <Text variant="small" muted>
                {notifPrefs?.permission_status === "granted"
                  ? t("notifications.permissionGranted")
                  : notifPrefs?.permission_status === "denied"
                    ? t("notifications.permissionDenied")
                    : t("notifications.permissionNotDetermined")}
              </Text>
            </View>
          </View>
        </Card>

        {/* Prototype controls */}
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

      {/* Edit name sheet */}
      <BottomSheet visible={editingName} onDismiss={() => setEditingName(false)}>
        <View style={styles.sheetContent}>
          <Text variant="h2">{t("settings.displayNameLabel")}</Text>
          <TextField
            label={t("settings.displayNameLabel")}
            placeholder={t("settings.displayNamePlaceholder")}
            value={nameValue}
            onChangeText={setNameValue}
            autoFocus
          />
          <Button title={t("settings.save")} loading={saving} onPress={saveName} />
        </View>
      </BottomSheet>

      {/* Edit primary goal sheet */}
      <BottomSheet visible={editingGoal} onDismiss={() => setEditingGoal(false)}>
        <View style={styles.sheetContent}>
          <Text variant="h2">{t("settings.primaryGoalLabel")}</Text>
          <View style={styles.choiceList}>
            {PRIMARY_GOAL_OPTIONS.map((value) => (
              <ChoiceCard
                key={value}
                title={t(`settings.primaryGoalChoices.${value}`)}
                selected={profile?.primary_goal === value}
                onPress={() => saveGoal(value)}
              />
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* Edit shopping style sheet */}
      <BottomSheet visible={editingStyle} onDismiss={() => setEditingStyle(false)}>
        <View style={styles.sheetContent}>
          <Text variant="h2">{t("settings.shoppingStyleLabel")}</Text>
          <View style={styles.choiceList}>
            {SHOPPING_STYLE_OPTIONS.map((value) => (
              <ChoiceCard
                key={value}
                title={t(`settings.shoppingStyleChoices.${value}`)}
                selected={profile?.shopping_style === value}
                onPress={() => saveStyle(value)}
              />
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* Edit avoidances sheet */}
      <BottomSheet visible={editingAvoidances} onDismiss={() => setEditingAvoidances(false)}>
        <View style={styles.sheetContent}>
          <Text variant="h2">{t("settings.avoidancesLabel")}</Text>
          <Text variant="small" muted>{t("settings.avoidancesBody")}</Text>
          <View style={styles.choiceList}>
            {AVOIDANCE_OPTIONS.map((value) => (
              <ChoiceCard
                key={value}
                title={t(`settings.avoidanceChoices.${value}`)}
                selected={localAvoidances.includes(value)}
                onPress={() => toggleAvoidance(value)}
              />
            ))}
          </View>
          <Button title={t("settings.save")} loading={saving} onPress={saveAvoidances} />
        </View>
      </BottomSheet>

      {/* Edit servings sheet */}
      <BottomSheet visible={editingServings} onDismiss={() => setEditingServings(false)}>
        <View style={styles.sheetContent}>
          <Text variant="h2">{t("settings.servingsTitle")}</Text>
          <Text variant="small" muted>{t("settings.servingsBody")}</Text>
          <View style={styles.servingsGrid}>
            {SERVINGS_OPTIONS.map((count) => (
              <Pressable
                key={count}
                accessibilityRole="button"
                accessibilityState={{ selected: activeHousehold?.default_servings === count }}
                onPress={() => saveServings(count)}
                style={[
                  styles.servingsOption,
                  activeHousehold?.default_servings === count && styles.servingsOptionActive,
                ]}
              >
                <Text
                  variant="small"
                  color={activeHousehold?.default_servings === count ? colors.surface : colors.primary}
                  center
                >
                  {count}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </BottomSheet>

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
  prefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: spacing.md,
  },
  prefCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  settingCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.hairlineStrong,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  sheetContent: {
    gap: spacing.lg,
  },
  choiceList: {
    gap: spacing.sm,
  },
  servingsGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  servingsOption: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
