import { useCallback, useEffect, useState } from "react";

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

  const toggleAllNotifications = useCallback(async (enabled: boolean) => {
    await updateNotificationPreferences({ notifications_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, notifications_enabled: enabled } : prev);
  }, []);

  const toggleSmartSuggestions = useCallback(async (enabled: boolean) => {
    await updateNotificationPreferences({ smart_suggestions_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, smart_suggestions_enabled: enabled } : prev);
  }, []);

  const toggleMemberActivity = useCallback(async (enabled: boolean) => {
    await updateNotificationPreferences({ member_activity_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, member_activity_enabled: enabled } : prev);
  }, []);

  const toggleTips = useCallback(async (enabled: boolean) => {
    await updateNotificationPreferences({ tips_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, tips_enabled: enabled } : prev);
  }, []);

  const toggleReengagement = useCallback(async (enabled: boolean) => {
    await updateNotificationPreferences({ reengagement_enabled: enabled });
    setPreferences((prev) => prev ? { ...prev, reengagement_enabled: enabled } : prev);
  }, []);

  const toggleDailySuggestion = useCallback(async (enabled: boolean) => {
    if (!householdId) return;
    await updateHouseholdNotificationSettings(householdId, { daily_suggestion_enabled: enabled });
    setHouseholdSettings((prev) => prev ? { ...prev, daily_suggestion_enabled: enabled } : prev);
  }, [householdId]);

  const toggleRecap = useCallback(async (enabled: boolean) => {
    if (!householdId) return;
    await updateHouseholdNotificationSettings(householdId, { recap_enabled: enabled });
    setHouseholdSettings((prev) => prev ? { ...prev, recap_enabled: enabled } : prev);
  }, [householdId]);

  const updateSendWindow = useCallback(async (start: string, end: string) => {
    if (!householdId) return;
    await updateHouseholdNotificationSettings(householdId, {
      send_window_start: start,
      send_window_end: end,
    });
    setHouseholdSettings((prev) => prev ? { ...prev, send_window_start: start, send_window_end: end } : prev);
  }, [householdId]);

  return {
    loading,
    preferences,
    householdSettings,
    toggleAllNotifications,
    toggleSmartSuggestions,
    toggleMemberActivity,
    toggleTips,
    toggleReengagement,
    toggleDailySuggestion,
    toggleRecap,
    updateSendWindow,
  };
}
