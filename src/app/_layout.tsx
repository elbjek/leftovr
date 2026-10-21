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
import { useLeftovrFonts } from "@/lib";
import { syncHouseholdTimezone, updateLastActive } from "@/repositories/notificationRepository";
import { registerDevice } from "@/services";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

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
      <AuthProvider>
        <StatusBar style="dark" />
        <View style={styles.appFrame}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </AuthProvider>
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
