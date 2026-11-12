import { Redirect, Tabs, useLocalSearchParams } from "expo-router";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { useEffect, useState } from "react";
import * as QuickActions from "expo-quick-actions";
import { RouterAction, useQuickActionRouting } from "expo-quick-actions/router";

import { AddSheet, CartIcon, OpenAddSheetProvider, Tappable, Text } from "@/components";
import { useAuth } from "@/features";
import { useShoppingList } from "@/hooks";
import { colors, radii, spacing } from "@/theme";

type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  emitter: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
  };
  navigateToTab: (routeKey: string) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onTabPress: () => void;
};

// Recipes is the home: the app opens here, and a hidden or unknown tab falls
// back here too.
export const unstable_settings = { anchor: "recipes" };

export default function TabsLayout() {
  const { t } = useTranslation();
  const { loading, session } = useAuth();
  // The Add sheet sits over the screens but stops at the dock's top edge, so
  // the dock stays visible and tappable while it is open.
  const [addOpen, setAddOpen] = useState(false);
  const [dockHeight, setDockHeight] = useState(0);

  // Long-press the app icon: "Shopping list" opens the tab.
  useQuickActionRouting();
  useEffect(() => {
    void QuickActions.setItems<RouterAction>([
      { id: "shopping", title: t("shopping.title"), icon: "symbol:cart", params: { href: "/(tabs)/shopping" } },
    ]);
  }, [t]);

  if (!loading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <OpenAddSheetProvider value={() => setAddOpen(true)}>
      <View style={styles.root}>
        <Tabs
          tabBar={(props) => (
            <LeftovrTabBar
              {...props}
              onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}
              onTabPress={() => setAddOpen(false)}
            />
          )}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen
            name="recipes"
            options={{
              title: t("tabs.recipes"),
              tabBarIcon: ({ color }) => <RecipesIcon color={String(color)} />,
            }}
          />
          <Tabs.Screen
            name="fridge"
            options={{
              title: t("tabs.fridge"),
              tabBarIcon: ({ color }) => <KitchenIcon color={String(color)} />,
            }}
          />
          <Tabs.Screen
            name="shopping"
            options={{
              title: t("tabs.shopping"),
              tabBarIcon: ({ color }) => <CartIcon color={String(color)} size={24} />,
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
          {/* Detail and the full recipe list live inside the tab group so the
              dock stays visible, but they are not tabs: LeftovrTabBar skips them
              by name. No `href: null` — expo-router 58 treats that as a hidden
              tab and redirects away from it as soon as it is focused. */}
          <Tabs.Screen name="recipe-detail" />
          <Tabs.Screen name="all-recipes" />
          {/* Add opens from the "+" beside the household pill (2026-11-12). */}
          <Tabs.Screen name="scan" />
        </Tabs>
        <View style={[styles.addLayer, { bottom: dockHeight }]} pointerEvents="box-none">
          <AddSheet visible={addOpen} onClose={() => setAddOpen(false)} />
        </View>
      </View>
    </OpenAddSheetProvider>
  );
}

const NON_TAB_ROUTES = new Set(["recipe-detail", "all-recipes", "scan"]);

function LeftovrTabBar({ state, emitter, navigateToTab, onLayout, onTabPress }: TabBarProps) {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { activeHousehold } = useAuth();
  const { openCount, refresh } = useShoppingList(activeHousehold?.id);
  const activeRoute = state.routes[state.index]?.name;

  // The badge counts what's left to buy. Re-read on every tab change: kitchen
  // adds tick items off on the server without telling this copy.
  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh, activeRoute]);
  const hideForScanCamera =
    activeRoute === "scan" &&
    (params.mode === "receipt" || params.mode === "ereceipt" || params.mode === "barcode");

  if (hideForScanCamera) return null;

  return (
    <View style={styles.dock} onLayout={onLayout}>
      {state.routes.map((route, index) => {
        // Routes in the group that aren't tabs don't get a dock slot.
        if (NON_TAB_ROUTES.has(route.name)) return null;
        const focused = state.index === index;
        const color = focused ? colors.primary : colors.text;
        const label = getTabLabel(route.name, t);

        function onPress() {
          onTabPress();
          const event = emitter.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        }

        return (
          <Tappable
            key={route.key}
            selected={focused}
            label={label}
            onPress={onPress}
            style={styles.tabCell}
          >
            {/* Icons only, like the tomato layout; the label is still spoken.
                The peach circle marks the active tab, Scan included. */}
            <View style={[styles.bubble, focused && styles.bubbleActive]}>
              {getTabIcon(route.name, color)}
              {route.name === "shopping" && openCount > 0 ? (
                <View style={styles.badge}>
                  <Text variant="micro" weight="bold" color={colors.onPrimary}>
                    {openCount > 99 ? "99+" : openCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </Tappable>
        );
      })}
    </View>
  );
}

function getTabLabel(name: string, t: ReturnType<typeof useTranslation>["t"]) {
  if (name === "fridge") return t("tabs.fridge");
  if (name === "recipes") return t("tabs.recipes");
  if (name === "insights") return t("tabs.insights");
  if (name === "shopping") return t("tabs.shopping");
  return t("tabs.settings");
}

function getTabIcon(name: string, color: string) {
  if (name === "fridge") return <KitchenIcon color={color} />;
  if (name === "recipes") return <RecipesIcon color={color} />;
  if (name === "insights") return <InsightsIcon color={color} />;
  if (name === "shopping") return <CartIcon color={color} size={24} />;
  return <SettingsIcon color={color} />;
}

function KitchenIcon({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5h16v14H4z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={4} y1={11} x2={20} y2={11} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={12} y1={11} x2={12} y2={19.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={9} y1={8} x2={15} y2={8} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={8.5} y1={14.5} x2={8.5} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={15.5} y1={14.5} x2={15.5} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
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
      <Circle cx={15} cy={8} r={2.6} fill={colors.onPrimary} stroke={color} strokeWidth={1.8} />
      <Line x1={4} y1={16} x2={20} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={9} cy={16} r={2.6} fill={colors.onPrimary} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  addLayer: {
    ...StyleSheet.absoluteFill,
  },
  dock: {
    position: "relative",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    boxShadow: "0px -8px 24px rgba(170, 90, 50, 0.08)",
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingBottom: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
  },
  bubble: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleActive: {
    backgroundColor: colors.surface2,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
