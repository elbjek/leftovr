import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { colors } from "@/theme";

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.hairline,
        },
      }}
    >
      <Tabs.Screen name="fridge" options={{ title: t("fridge.title") }} />
      <Tabs.Screen name="recipes" options={{ title: t("recipes.title") }} />
      <Tabs.Screen name="scan" options={{ title: t("scan.title") }} />
      <Tabs.Screen name="insights" options={{ title: t("insights.title") }} />
      <Tabs.Screen name="settings" options={{ title: t("settings.title") }} />
    </Tabs>
  );
}
