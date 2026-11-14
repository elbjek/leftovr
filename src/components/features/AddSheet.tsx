import { createContext, useContext } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { isPremium, useAuth } from "@/features";
import { spacing } from "../../theme";
import { BottomSheet, Text } from "../primitives";
import { ScanMethod, ScanMethodCard } from "./ScanMethodCard";

const ADD_METHODS: ScanMethod[] = ["receipt", "pantry", "ereceipt", "barcode", "manual"];

// The way of adding food that fits how someone shops (onboarding / Settings
// "Shopping style"); it gets the Recommended badge and goes first.
const RECOMMENDED_BY_SHOPPING_STYLE: Record<string, ScanMethod> = {
  weekly: "receipt",
  few: "pantry",
  asneed: "barcode",
};

function recommendedAddMethod(shoppingStyle?: string | null): ScanMethod | undefined {
  return shoppingStyle ? RECOMMENDED_BY_SHOPPING_STYLE[shoppingStyle] : undefined;
}

// The tab layout hosts the sheet; the household pill's "+" opens it.
const OpenAddSheetContext = createContext<() => void>(() => undefined);
export const OpenAddSheetProvider = OpenAddSheetContext.Provider;
export function useOpenAddSheet() {
  return useContext(OpenAddSheetContext);
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

// The "+" beside the household pill: Add's ways in as a sheet over the
// current screen (2026-11-12). Drawn inline by (tabs)/_layout above the dock,
// not in a Modal, so the dock stays visible and tappable. Picking a method
// opens Add straight into it (Add handles gates like the AI notice there).
export function AddSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { profile, activeHousehold } = useAuth();
  const recommended = recommendedAddMethod(profile?.shopping_style);
  const featured = recommended ?? ADD_METHODS[0];

  function pick(method: ScanMethod) {
    onClose();
    // `at` makes every pick a new param, so the same method reopens too.
    router.navigate({ pathname: "/(tabs)/scan", params: { mode: method, at: String(Date.now()) } });
  }

  return (
    <BottomSheet inline visible={visible} onDismiss={onClose} style={styles.sheet}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.copy}>
          <Text variant="h3">{t("scan.title")}</Text>
          <Text variant="small" muted>
            {t("scan.body")}
          </Text>
        </View>
        <ScanMethodCard
          featured
          method={featured}
          body={t(`scan.${featured}.body`)}
          recommended={featured === recommended}
          soft={!isPremium(profile, activeHousehold)}
          onPress={() => pick(featured)}
        />
        <View style={styles.grid}>
          {ADD_METHODS.filter((method) => method !== featured).map((method) => (
            <ScanMethodCard key={method} method={method} body={t(`scan.${method}.body`)} onPress={() => pick(method)} />
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // The dock below already clears the home indicator.
  sheet: {
    paddingBottom: spacing.lg,
  },
  // Scrolls only on small phones, where five cards outgrow the sheet.
  scroll: {
    flexShrink: 1,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  copy: {
    gap: spacing.xxs,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
});
