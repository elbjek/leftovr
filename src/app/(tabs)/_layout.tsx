import { Redirect, Tabs } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { useAuth } from "@/features";
import { colors, fonts } from "@/theme";

type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const { loading, session } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      tabBar={(props) => <ChompTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="fridge"
        options={{
          title: t("tabs.fridge"),
          tabBarIcon: ({ color }) => <FridgeIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: t("tabs.recipes"),
          tabBarIcon: ({ color }) => <RecipesIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t("tabs.scan"),
          tabBarIcon: () => (
            <View style={styles.scanButton}>
              <ScanIcon color={colors.surface} />
            </View>
          ),
          tabBarLabelStyle: [styles.label, styles.scanLabel],
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t("tabs.insights"),
          tabBarIcon: ({ color }) => <InsightsIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color }) => <SettingsIcon color={String(color)} />,
        }}
      />
    </Tabs>
  );
}

function ChompTabBar({ state, navigation }: TabBarProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.dock}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? colors.primary : colors.muted2;
        const label = getTabLabel(route.name, t);

        function onPress() {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        if (route.name === "scan") {
          return (
            <View key={route.key} style={styles.tabCell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={onPress}
                style={({ pressed }) => [
                  styles.scanButton,
                  pressed && styles.pressed,
                ]}
              >
                <ScanIcon color={colors.surface} />
              </Pressable>
              <Text style={styles.scanLabel}>{label}</Text>
            </View>
          );
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={onPress}
            style={({ pressed }) => [
              styles.tabCell,
              pressed && styles.pressed,
            ]}
          >
            {getTabIcon(route.name, color)}
            <Text style={[styles.label, { color }, focused && styles.labelActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getTabLabel(name: string, t: ReturnType<typeof useTranslation>["t"]) {
  if (name === "fridge") return t("tabs.fridge");
  if (name === "recipes") return t("tabs.recipes");
  if (name === "scan") return t("tabs.scan");
  if (name === "insights") return t("tabs.insights");
  return t("tabs.settings");
}

function getTabIcon(name: string, color: string) {
  if (name === "fridge") return <FridgeIcon color={color} />;
  if (name === "recipes") return <RecipesIcon color={color} />;
  if (name === "insights") return <InsightsIcon color={color} />;
  return <SettingsIcon color={color} />;
}

function FridgeIcon({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={2.5} width={12} height={19} rx={3.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={6} y1={10} x2={18} y2={10} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={9} y1={6} x2={9} y2={7.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={9} y1={13} x2={9} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function RecipesIcon({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Path d="M7 3v18" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 3v5a2 2 0 0 0 4 0V3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 3c-1.6 1-2.6 3-2.6 6 0 2 1.1 3 2.6 3.2V21" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function InsightsIcon({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={20} x2={5} y2={13} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={12} y1={20} x2={12} y2={8} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={19} y1={20} x2={19} y2={11} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={8} x2={20} y2={8} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={15} cy={8} r={2.6} fill={colors.surface} stroke={color} strokeWidth={1.8} />
      <Line x1={4} y1={16} x2={20} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={9} cy={16} r={2.6} fill={colors.surface} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function ScanIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M5 3h14v18l-2.3-1.8-2.35 1.8L12 19.2 9.65 21 7.3 19.2 5 21V3z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={9} y1={8} x2={15} y2={8} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={9} y1={12} x2={13} y2={12} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "relative",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: 10,
    paddingHorizontal: 26,
    paddingBottom: 26,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  tabCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    minHeight: 41,
  },
  label: {
    fontSize: 10.5,
    lineHeight: 13,
    fontFamily: fonts.bodySemiBold,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  labelActive: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  scanButton: {
    position: "absolute",
    top: -26,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  scanLabel: {
    fontSize: 10.5,
    lineHeight: 13,
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 39,
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
