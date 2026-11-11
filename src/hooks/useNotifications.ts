import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "@/components/primitives";
import { reportError } from "@/lib";

import {
  getNotificationPreferences,
  getHouseholdNotificationSettings,
  updateNotificationPreferences,
  updateHouseholdNotificationSettings,
  NotificationPreferences,
  HouseholdNotificationSettings,
} from "@/repositories/notificationRepository";

export function useNotifications(householdId: string | undefined) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [householdSettings, setHouseholdSettings] = useState<HouseholdNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const { t } = useTranslation();

  // A failed write used to be silent: the switch just snapped back. Keep the
  // UI honest and say so.
  const guard = useCallback(
    async (run: () => Promise<void>) => {
      try {
        await run();
      } catch (error) {
        reportError(error, { scope: "notificationPreferences" });
        showToast(t("notifications.saveFailed"));
      }
    },
    [showToast, t],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const prefs = await getNotificationPreferences();
        if (!cancelled) setPreferences(prefs);

        if (householdId) {
          const settings = await getHouseholdNotificationSettings(householdId);
          if (!cancelled) setHouseholdSettings(settings);
        }
      } catch {
        // Preferences may not exist yet in edge cases
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [householdId]);

  const toggleAllNotifications = useCallback((enabled: boolean) => guard(async () => {
    await updateNotificationPreferences({ notifications_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, notifications_enabled: enabled } : prev);
  }), [guard]);

  const toggleSmartSuggestions = useCallback((enabled: boolean) => guard(async () => {
    await updateNotificationPreferences({ smart_suggestions_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, smart_suggestions_enabled: enabled } : prev);
  }), [guard]);

  const toggleMemberActivity = useCallback((enabled: boolean) => guard(async () => {
    await updateNotificationPreferences({ member_activity_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, member_activity_enabled: enabled } : prev);
  }), [guard]);

  const toggleTips = useCallback((enabled: boolean) => guard(async () => {
    await updateNotificationPreferences({ tips_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, tips_enabled: enabled } : prev);
  }), [guard]);

  const toggleReengagement = useCallback((enabled: boolean) => guard(async () => {
    await updateNotificationPreferences({ reengagement_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, reengagement_enabled: enabled } : prev);
  }), [guard]);

  const toggleStreakReminders = useCallback((enabled: boolean) => guard(async () => {
    await updateNotificationPreferences({ streak_reminders_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, streak_reminders_enabled: enabled } : prev);
  }), [guard]);

  const toggleShoppingReminders = useCallback((enabled: boolean) => guard(async () => {
    await updateNotificationPreferences({ shopping_reminders_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, shopping_reminders_enabled: enabled } : prev);
  }), [guard]);

  const toggleDailySuggestion = useCallback((enabled: boolean) => guard(async () => {
    if (!householdId) return;
    await updateHouseholdNotificationSettings(householdId, { daily_suggestion_enabled: enabled });
    setHouseholdSettings((prev) => prev ? { ...prev, daily_suggestion_enabled: enabled } : prev);
  }), [householdId, guard]);

  const toggleRecap = useCallback((enabled: boolean) => guard(async () => {
    if (!householdId) return;
    await updateHouseholdNotificationSettings(householdId, { recap_enabled: enabled });
    setHouseholdSettings((prev) => prev ? { ...prev, recap_enabled: enabled } : prev);
  }), [householdId, guard]);

  const updateSendWindow = useCallback((start: string, end: string) => guard(async () => {
    if (!householdId) return;
    await updateHouseholdNotificationSettings(householdId, {
      send_window_start: start,
      send_window_end: end,
    });
    setHouseholdSettings((prev) => prev ? { ...prev, send_window_start: start, send_window_end: end } : prev);
  }), [householdId, guard]);

  return {
    loading,
    preferences,
    householdSettings,
    toggleAllNotifications,
    toggleSmartSuggestions,
    toggleMemberActivity,
    toggleTips,
    toggleReengagement,
    toggleStreakReminders,
    toggleShoppingReminders,
    toggleDailySuggestion,
    toggleRecap,
    updateSendWindow,
  };
}
