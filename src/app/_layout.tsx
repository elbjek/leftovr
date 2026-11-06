import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { getCalendars } from "expo-localization";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import "@/i18n";
import { AuthProvider } from "@/features";
import { useNotificationRouting } from "@/hooks";
import { installErrorReporting, reportError, useLeftovrFonts } from "@/lib";
import { ErrorBoundary } from "@/components/primitives";
import { syncHouseholdTimezone, updateLastActive } from "@/repositories/notificationRepository";
import { registerDevice } from "@/services";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();
installErrorReporting();

// Without a handler, a push that arrives while the app is open is swallowed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Lives inside AuthProvider so it can wait for a signed-in user. */
function NotificationRouter() {
  useNotificationRouting();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useLeftovrFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    // Push send windows and the Sunday recap run in the household's timezone.
    const syncTimezone = () => {
      const timezone = getCalendars()[0]?.timeZone;
      if (timezone) syncHouseholdTimezone(timezone).catch(() => {});
    };
    syncTimezone();
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      void updateLastActive();
      syncTimezone();
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status === "granted") void registerDevice(); // refresh token if it rotated
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary onError={(error, componentStack) => reportError(error, { componentStack })}>
        <AuthProvider>
          <NotificationRouter />
          <StatusBar style="dark" />
          <View style={styles.appFrame}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.appBackground,
    alignItems: Platform.OS === "web" ? "center" : "stretch",
  },
  appFrame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 430 : undefined,
    backgroundColor: colors.surface,
  },
});
