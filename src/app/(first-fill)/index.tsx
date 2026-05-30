import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { Button, Screen, Text } from "@/components";
import { useAuth } from "@/features";
import { HAS_PICKED_LANGUAGE_KEY, HAS_SEEN_HOOK_KEY } from "@/features/onboardingGate";
import { completeHouseholdFirstFill, resetCurrentUserOnboardingForDev } from "@/repositories";
import { colors, radii, spacing } from "@/theme";

type FillMode = "receipt" | "barcode" | "manual";

export default function FirstFillRoute() {
  const { t } = useTranslation();
  const { activeHousehold, refresh, signOut } = useAuth();
  const [selected, setSelected] = useState<FillMode>("receipt");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueToApp(mode = selected) {
    if (!activeHousehold?.id) return;

    setSubmitting(true);
    setError(null);

    try {
      await completeHouseholdFirstFill(activeHousehold.id);
      await refresh();
      router.replace(mode === "receipt" ? "/(tabs)/scan" : "/(tabs)/fridge");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("auth.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function resetOnboarding() {
    setSubmitting(true);
    setError(null);

    try {
      await resetCurrentUserOnboardingForDev();
      await AsyncStorage.multiRemove([HAS_PICKED_LANGUAGE_KEY, HAS_SEEN_HOOK_KEY]);
      await signOut();
      router.replace("/");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : t("auth.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="display" style={styles.title}>
          {t("firstFill.titleStart")}{" "}
          <Text variant="display" color={colors.primary} italic style={styles.title}>
            {t("firstFill.titleAccent")}
          </Text>
        </Text>
        <Text variant="body" muted>
          {t("firstFill.body")}
        </Text>
      </View>

      <View style={styles.choices}>
        <FirstFillChoice
          selected={selected === "receipt"}
          recommended
          title={t("firstFill.receipt.title")}
          subtitle={t("firstFill.receipt.subtitle")}
          icon={<ReceiptIcon selected={selected === "receipt"} />}
          onPress={() => setSelected("receipt")}
        />
        <FirstFillChoice
          selected={selected === "barcode"}
          title={t("firstFill.barcode.title")}
          subtitle={t("firstFill.barcode.subtitle")}
          icon={<BarcodeIcon />}
          onPress={() => setSelected("barcode")}
        />
        <FirstFillChoice
          selected={selected === "manual"}
          title={t("firstFill.manual.title")}
          subtitle={t("firstFill.manual.subtitle")}
          icon={<SearchIcon />}
          onPress={() => setSelected("manual")}
        />
      </View>

      {error ? (
        <Text variant="small" color={colors.red} center>
          {error}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text variant="small" muted center>
          {t("firstFill.footer")}
        </Text>
        <Button
          title={t("common.continue")}
          loading={submitting}
          onPress={() => continueToApp()}
        />
        {__DEV__ ? (
          <Button
            title={t("settings.resetOnboarding")}
            variant="text"
            disabled={submitting}
            onPress={resetOnboarding}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function FirstFillChoice({
  selected,
  recommended = false,
  title,
  subtitle,
  icon,
  onPress,
}: {
  selected: boolean;
  recommended?: boolean;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>{icon}</View>
      <View style={styles.choiceCopy}>
        <View style={styles.choiceTitleRow}>
          <Text variant="h3" color={selected ? colors.surface : colors.text}>
            {title}
          </Text>
          {recommended ? (
            <View style={styles.badge}>
              <Text variant="micro" color={colors.text} style={styles.badgeText}>
                Recommended
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="small" color={selected ? colors.surface : colors.muted} style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
      <PathIcon color={selected ? colors.surface : colors.muted} />
    </Pressable>
  );
}

function ReceiptIcon({ selected }: { selected: boolean }) {
  const stroke = selected ? colors.surface : colors.primary;
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path d="M4 3h14v16l-2-2-2 2-2-2-2 2-2-2-2 2-2-2V3z" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />
      <Line x1={7} y1={8} x2={15} y2={8} stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={7} y1={12} x2={13} y2={12} stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function BarcodeIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      {[4, 10, 16, 18].map((x) => (
        <Line key={x} x1={x} y1={5} x2={x} y2={17} stroke={colors.primary} strokeWidth={1.6} />
      ))}
      {[7, 13].map((x) => (
        <Line key={x} x1={x} y1={5} x2={x} y2={17} stroke={colors.primary} strokeWidth={2.6} />
      ))}
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Circle cx={10} cy={10} r={6} stroke={colors.primary} strokeWidth={1.6} />
      <Path d="M14.5 14.5L18 18" stroke={colors.primary} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function PathIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M6 4L12 9L6 14" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingTop: 68,
    gap: spacing.xxl,
  },
  header: {
    gap: spacing.md,
  },
  title: {
    fontSize: 40,
    lineHeight: 42,
  },
  choices: {
    flexGrow: 1,
    gap: spacing.md,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    backgroundColor: colors.paper,
    borderColor: colors.hairline,
    borderWidth: 1.5,
    borderRadius: radii.xl,
  },
  choiceSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primary50,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxSelected: {
    backgroundColor: "rgba(248,244,238,0.15)",
  },
  choiceCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  choiceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
  },
  subtitle: {
    opacity: 0.85,
  },
  footer: {
    gap: spacing.md,
  },
});
