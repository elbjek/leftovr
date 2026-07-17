import React, { useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Svg, { Path } from "react-native-svg";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import {
  BottomSheet,
  Button,
  Card,
  ChoiceCard,
  HouseholdSection,
  PremiumSheet,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from "@/components";
import { canShareHousehold, useAuth, useMeasurementSystem } from "@/features";
import { useHousehold, useInventory, useNotifications } from "@/hooks";
import { deleteAccount, exportAccountData, presentCodeRedemptionSheet, registerDevice } from "@/services";
import { isSupportedLanguage, supportedLanguages, SupportedLanguage } from "@/i18n";
import {
  updateHouseholdCurrency,
  updateHouseholdDefaultServings,
  updateProfileAvoidances,
  updateProfileField,
} from "@/repositories";
import { colors, fonts, radii, spacing } from "@/theme";

const PRIMARY_GOAL_OPTIONS = ["waste", "money", "quick", "all"] as const;
const SHOPPING_STYLE_OPTIONS = ["weekly", "few", "asneed"] as const;
const AVOIDANCE_OPTIONS = ["meat", "fish", "dairy", "gluten", "nuts"] as const;
const SERVINGS_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
const CURRENCY_OPTIONS = ["USD", "EUR", "RSD", "GBP"] as const;

const PRIVACY_URL = "https://leftovr.co/privacy/";
const TERMS_URL = "https://leftovr.co/terms/";
const SUPPORT_EMAIL = "support@twobricklabs.com";

export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const { joinCode } = useLocalSearchParams<{ joinCode?: string }>();
  const { profile, activeHousehold, session, signOut, refresh } = useAuth();
  const { system, setMeasurementSystem } = useMeasurementSystem();
  const currentLanguage = isSupportedLanguage(i18n.language) ? i18n.language : "en";
  const languageOptions = supportedLanguages.map((language) => ({
    label: t(`settings.languages.${language}`),
    value: language,
  }));

  const [showPremium, setShowPremium] = useState(false);
  const [premiumPlan, setPremiumPlan] = useState<"individual" | "household">("individual");
  const [saving, setSaving] = useState(false);

  // Editable state
  const [editingName, setEditingName] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState(false);
  const [editingUnits, setEditingUnits] = useState(false);
  const [nameValue, setNameValue] = useState(profile?.display_name ?? "");
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
  const [editingAvoidances, setEditingAvoidances] = useState(false);
  const [editingServings, setEditingServings] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(false);
  const [localAvoidances, setLocalAvoidances] = useState<string[]>(profile?.avoidances ?? []);

  const household = useHousehold(activeHousehold?.id);
  const { lots } = useInventory(activeHousehold?.id);
  const {
    preferences: notifPrefs,
    householdSettings: notifHouseholdSettings,
    toggleAllNotifications,
    toggleSmartSuggestions,
    toggleMemberActivity,
    toggleTips,
    toggleDailySuggestion,
    toggleRecap,
    updateSendWindow,
  } = useNotifications(activeHousehold?.id);
  const [windowPicker, setWindowPicker] = useState<"start" | "end" | null>(null);
  const notifMaster = notifPrefs?.notifications_enabled ?? true;
  // Registering the device (push token) only matters when turning something on.
  const onToggleWith = (fn: (enabled: boolean) => Promise<void> | void) => async (next: boolean) => {
    if (next) await registerDevice();
    await fn(next);
  };
  const isHouseholdPremium = canShareHousehold(profile, activeHousehold);

  function handleLanguageChange(language: SupportedLanguage) {
    i18n.changeLanguage(language);
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

  async function saveCurrency(code: string) {
    if (!activeHousehold?.id) return;
    setSaving(true);
    try {
      await updateHouseholdCurrency(activeHousehold.id, code);
      await refresh();
    } finally {
      setSaving(false);
      setEditingCurrency(false);
    }
  }

  async function handleExportData() {
    try {
      await exportAccountData();
    } catch {
      Alert.alert(t("settings.account.exportErrorTitle"), t("settings.account.exportError"));
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      t("settings.account.deleteConfirmTitle"),
      t("settings.account.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.account.deleteConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              await signOut();
            } catch {
              Alert.alert(t("settings.account.deleteErrorTitle"), t("settings.account.deleteError"));
            }
          },
        },
      ],
    );
  }

  function applyWindowTime(date: Date) {
    if (!notifHouseholdSettings || windowPicker === null) return;
    const picked = dateToHHMM(date);
    const start = windowPicker === "start" ? picked : notifHouseholdSettings.send_window_start?.slice(0, 5) ?? "13:00";
    const end = windowPicker === "end" ? picked : notifHouseholdSettings.send_window_end?.slice(0, 5) ?? "14:00";
    void updateSendWindow(`${start}:00`, `${end}:00`);
  }

  function windowPickerValue() {
    const current =
      windowPicker === "start"
        ? notifHouseholdSettings?.send_window_start
        : notifHouseholdSettings?.send_window_end;
    return hhmmToDate(current ?? (windowPicker === "start" ? "13:00" : "14:00"));
  }

  function toggleAvoidance(value: string) {
    setLocalAvoidances((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  const currentTier =
    activeHousehold?.plan_tier === "household_premium"
      ? "household_premium"
      : profile?.tier ?? "free";
  const currentTierLabel =
    currentTier === "premium"
      ? t("settings.tierPremium")
      : currentTier === "household_premium"
        ? t("settings.tierHouseholdPremium")
        : t("settings.tierFree");

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
        <ScreenHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

        {/* Profile */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("settings.displayNameLabel")}
          onPress={() => {
            setNameValue(profile?.display_name ?? "");
            setEditingName(true);
          }}
          style={styles.profileHeader}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.avatar_initials ?? (profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileNameWrap}>
            <Text variant="label">{profile?.display_name}</Text>
            {session?.user?.email ? (
              <Text variant="micro" muted numberOfLines={1}>{session.user.email}</Text>
            ) : null}
            <Text variant="micro" muted numberOfLines={1}>
              {activeHousehold?.name ?? t("common.unknownHousehold")}
            </Text>
          </View>
          <View style={styles.tierBadge}>
            <Text variant="micro" color={currentTier === "free" ? colors.primary : colors.accent}>
              {currentTier === "free"
                ? t("settings.tierFree")
                : currentTier === "premium"
                  ? `★ ${t("settings.tierPremium")}`
                  : `★ ${t("settings.tierHouseholdPremium")}`}
            </Text>
          </View>
        </Pressable>

        {/* Language + units */}
        <SettingsGroup label={t("settings.preferencesTitle")}>
          <SettingsRow
            label={t("settings.languageTitle")}
            value={languageOptions.find((option) => option.value === currentLanguage)?.label}
            onPress={() => setEditingLanguage(true)}
          />
          <SettingsRow
            label={t("settings.unitsTitle")}
            value={t(`settings.units.${system}`)}
            onPress={() => setEditingUnits(true)}
            last
          />
        </SettingsGroup>

        {/* Food profile */}
        <SettingsGroup label={t("settings.foodProfileTitle")}>
          <SettingsRow
            label={t("settings.primaryGoalLabel")}
            value={goalLabel}
            onPress={() => setEditingGoal(true)}
          />
          <SettingsRow
            label={t("settings.shoppingStyleLabel")}
            value={styleLabel}
            onPress={() => setEditingStyle(true)}
          />
          <SettingsRow
            label={t("settings.avoidancesLabel")}
            value={avoidancesLabel}
            onPress={() => {
              setLocalAvoidances(profile?.avoidances ?? []);
              setEditingAvoidances(true);
            }}
          />
          {activeHousehold ? (
            <SettingsRow
              label={t("settings.servingsTitle")}
              value={t("settings.servingsLabel", { count: activeHousehold.default_servings })}
              onPress={() => setEditingServings(true)}
            />
          ) : null}
          {activeHousehold ? (
            <SettingsRow
              label={t("settings.currencyTitle")}
              value={activeHousehold.currency_code}
              onPress={() => setEditingCurrency(true)}
              last
            />
          ) : null}
        </SettingsGroup>

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
            onPremiumGate={() => {
              setPremiumPlan("household");
              setShowPremium(true);
            }}
            initialJoinCode={typeof joinCode === "string" ? joinCode : undefined}
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

            <ToggleRow
              title={t("notifications.allTitle")}
              body={t("notifications.allBody")}
              value={notifMaster}
              onToggle={onToggleWith(toggleAllNotifications)}
            />

            <View style={styles.notifDivider} />

            <ToggleRow
              title={t("notifications.smartSuggestions")}
              body={t("notifications.smartSuggestionsBody")}
              value={notifPrefs?.smart_suggestions_enabled ?? false}
              disabled={!notifMaster}
              onToggle={onToggleWith(toggleSmartSuggestions)}
            />

            {household.members.length > 1 ? (
              <ToggleRow
                title={t("notifications.memberActivity")}
                body={t("notifications.memberActivityBody")}
                value={notifPrefs?.member_activity_enabled ?? true}
                disabled={!notifMaster}
                onToggle={onToggleWith(toggleMemberActivity)}
              />
            ) : null}

            <ToggleRow
              title={t("notifications.dailySuggestion")}
              body={t("notifications.dailySuggestionBody")}
              value={notifHouseholdSettings?.daily_suggestion_enabled ?? false}
              disabled={!notifMaster}
              onToggle={onToggleWith(toggleDailySuggestion)}
            />

            {notifHouseholdSettings?.daily_suggestion_enabled && notifMaster ? (
              <View style={styles.settingRow}>
                <Text variant="small">{t("notifications.sendWindow")}</Text>
                <View style={styles.windowPills}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("notifications.sendWindowStart")}
                    onPress={() => setWindowPicker("start")}
                    style={({ pressed }) => [styles.windowPill, pressed && styles.filterChoicePressed]}
                  >
                    <Text variant="small" color={colors.primary}>
                      {notifHouseholdSettings.send_window_start?.slice(0, 5) ?? "13:00"}
                    </Text>
                  </Pressable>
                  <Text variant="small" muted>–</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("notifications.sendWindowEnd")}
                    onPress={() => setWindowPicker("end")}
                    style={({ pressed }) => [styles.windowPill, pressed && styles.filterChoicePressed]}
                  >
                    <Text variant="small" color={colors.primary}>
                      {notifHouseholdSettings.send_window_end?.slice(0, 5) ?? "14:00"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Android: native time dialog, render only while open. */}
            {windowPicker !== null && Platform.OS === "android" ? (
              <DateTimePicker
                mode="time"
                value={windowPickerValue()}
                onChange={(event, date) => {
                  setWindowPicker(null);
                  if (event.type === "dismissed" || !date) return;
                  applyWindowTime(date);
                }}
              />
            ) : null}

            <ToggleRow
              title={t("notifications.recap")}
              body={t("notifications.recapBody")}
              value={notifHouseholdSettings?.recap_enabled ?? true}
              disabled={!notifMaster}
              onToggle={onToggleWith(toggleRecap)}
            />

            <ToggleRow
              title={t("notifications.tips")}
              body={t("notifications.tipsBody")}
              value={notifPrefs?.tips_enabled ?? true}
              disabled={!notifMaster}
              onToggle={onToggleWith(toggleTips)}
            />

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

        {/* Subscription */}
        <Card>
          <View style={styles.cardInner}>
            <View style={styles.sectionHeader}>
              <Text variant="label">{t("settings.subscriptionTitle")}</Text>
              <Text variant="small" muted>
                {t("settings.subscriptionBody")}
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text variant="small">{currentTierLabel}</Text>
              </View>
              <View
                style={[
                  styles.tierBadge,
                  currentTier !== "free" && styles.tierBadgePremium,
                ]}
              >
                <Text
                  variant="micro"
                  color={currentTier === "free" ? colors.primary : colors.accent}
                >
                  {currentTier === "free" ? t("settings.tierFree") : `★ ${currentTierLabel}`}
                </Text>
              </View>
            </View>

            <Button
              title={currentTier === "free" ? t("settings.upgrade") : t("premium.manage")}
              variant={currentTier === "free" ? "primary" : "ghost"}
              onPress={() => {
                setPremiumPlan(currentTier === "household_premium" ? "household" : "individual");
                setShowPremium(true);
              }}
            />
            <Button
              title={t("premium.redeemCode")}
              variant="ghost"
              onPress={() => void presentCodeRedemptionSheet()}
            />
          </View>
        </Card>

        {/* Support */}
        <SettingsGroup label={t("settings.support.title")}>
          <SettingsRow
            label={t("settings.support.contact")}
            value={SUPPORT_EMAIL}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            last
          />
        </SettingsGroup>

        {/* Legal */}
        <SettingsGroup label={t("settings.legal.title")}>
          <SettingsRow
            label={t("settings.legal.privacy")}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
          <SettingsRow
            label={t("settings.legal.terms")}
            onPress={() => Linking.openURL(TERMS_URL)}
            last
          />
        </SettingsGroup>

        {/* Account & data */}
        <SettingsGroup label={t("settings.account.title")}>
          <SettingsRow label={t("settings.account.export")} onPress={handleExportData} />
          <SettingsRow label={t("settings.account.delete")} onPress={handleDeleteAccount} danger />
          <SettingsRow label={t("common.signOut")} onPress={signOut} danger last />
        </SettingsGroup>
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

      {/* Language sheet */}
      <BottomSheet visible={editingLanguage} onDismiss={() => setEditingLanguage(false)}>
        <View style={styles.sheetContent}>
          <Text variant="h2">{t("settings.languageTitle")}</Text>
          <View style={styles.choiceList}>
            {languageOptions.map((option) => (
              <ChoiceCard
                compact
                key={option.value}
                title={option.label}
                selected={currentLanguage === option.value}
                onPress={() => {
                  handleLanguageChange(option.value);
                  setEditingLanguage(false);
                }}
              />
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* Units sheet */}
      <BottomSheet visible={editingUnits} onDismiss={() => setEditingUnits(false)}>
        <View style={styles.sheetContent}>
          <Text variant="h2">{t("settings.unitsTitle")}</Text>
          <View style={styles.choiceList}>
            {(["metric", "imperial"] as const).map((value) => (
              <ChoiceCard
                compact
                key={value}
                title={t(`settings.units.${value}`)}
                selected={system === value}
                onPress={() => {
                  setMeasurementSystem(value);
                  setEditingUnits(false);
                }}
              />
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* Currency sheet */}
      <BottomSheet visible={editingCurrency} onDismiss={() => setEditingCurrency(false)}>
        <View style={styles.sheetContent}>
          <Text variant="h2">{t("settings.currencyTitle")}</Text>
          <View style={styles.choiceList}>
            {CURRENCY_OPTIONS.map((code) => (
              <ChoiceCard
                compact
                key={code}
                title={code}
                selected={activeHousehold?.currency_code === code}
                onPress={() => saveCurrency(code)}
              />
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* Edit primary goal sheet */}
      <BottomSheet visible={editingGoal} onDismiss={() => setEditingGoal(false)}>
        <View style={styles.sheetContent}>
          <Text variant="h2">{t("settings.primaryGoalLabel")}</Text>
          <View style={styles.choiceList}>
            {PRIMARY_GOAL_OPTIONS.map((value) => (
              <ChoiceCard
                compact
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
                compact
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
                compact
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

      {/* iOS: time picker in a sheet so the spinner doesn't blow out the page. */}
      <BottomSheet
        visible={Platform.OS === "ios" && windowPicker !== null}
        onDismiss={() => setWindowPicker(null)}
      >
        <View style={styles.sheetContent}>
          <Text variant="h2">
            {windowPicker === "end" ? t("notifications.sendWindowEnd") : t("notifications.sendWindowStart")}
          </Text>
          {windowPicker !== null ? (
            <DateTimePicker
              mode="time"
              display="spinner"
              themeVariant="light"
              textColor={colors.text}
              value={windowPickerValue()}
              onChange={(_event, date) => {
                if (date) applyWindowTime(date);
              }}
            />
          ) : null}
          <Button title={t("common.continue")} onPress={() => setWindowPicker(null)} />
        </View>
      </BottomSheet>

      <PremiumSheet
        visible={showPremium}
        plan={premiumPlan}
        onPurchased={refresh}
        onDismiss={() => setShowPremium(false)}
      />
    </Screen>
  );
}

function ToggleRow({
  title,
  body,
  value,
  disabled,
  onToggle,
}: {
  title: string;
  body?: string;
  value: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <View style={[styles.settingRow, disabled && styles.rowDisabled]}>
      <View style={styles.settingCopy}>
        <Text variant="small">{title}</Text>
        {body ? <Text variant="micro" muted>{body}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onPress={() => onToggle(!value)}
        style={[styles.toggle, value && styles.toggleActive]}
      >
        <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
      </Pressable>
    </View>
  );
}

function SettingsGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View>
      {label ? (
        <Text variant="micro" muted uppercase style={styles.groupLabel}>
          {label}
        </Text>
      ) : null}
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  danger,
  last,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.groupRow,
        !last && styles.groupRowDivider,
        pressed && styles.groupRowPressed,
      ]}
    >
      <Text variant="label" color={danger ? colors.red : colors.text} style={styles.groupRowLabel}>
        {label}
      </Text>
      {value ? (
        <Text variant="small" muted numberOfLines={1} style={styles.groupRowValue}>
          {value}
        </Text>
      ) : null}
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Path
          d="M5 3L9 7L5 11"
          stroke={colors.muted2}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

function hhmmToDate(value: string) {
  const [h, m] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(h ?? 13, m ?? 0, 0, 0);
  return date;
}

function dateToHHMM(date: Date) {
  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.tabBarClearance,
  },
  windowPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  notifDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  windowPill: {
    backgroundColor: colors.primary50,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 32,
    justifyContent: "center",
  },
  filterChoicePressed: {
    opacity: 0.7,
  },
  sections: {
    gap: spacing.xl,
  },
  cardInner: {
    gap: spacing.md,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.accent,
  },
  profileNameWrap: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  groupLabel: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xxs,
  },
  groupCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 48,
  },
  groupRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  groupRowPressed: {
    backgroundColor: colors.primary50,
  },
  groupRowLabel: {
    flex: 1,
  },
  groupRowValue: {
    maxWidth: 160,
  },
  tierBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.primary50,
    borderRadius: radii.pill,
  },
  tierBadgePremium: {
    backgroundColor: colors.accentSoft,
  },
  sectionHeader: {
    gap: spacing.xs,
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
