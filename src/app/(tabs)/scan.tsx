import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { Button, Card, ReceiptToFridgeIllustration, Screen, Text } from "@/components";
import { useAuth } from "@/features";
import { mockReceiptTemplates } from "@/mocks";
import {
  completeHouseholdFirstFill,
  findRecentReceiptDuplicate,
  getReceiptScanLimitStatus,
  processMockReceiptScan,
  ReceiptDuplicate,
  ReceiptScanResult,
  setNotificationPermissionPreview,
} from "@/repositories";
import { getMockReceiptTemplate } from "@/services";
import { colors, radii, spacing } from "@/theme";

type ScanMode = "choice" | "camera" | "processing" | "duplicate" | "limit" | "success" | "notifications";
type ScanChoice = "receipt" | "barcode" | "manual";

export default function ScanRoute() {
  const { t } = useTranslation();
  const { activeHousehold, refresh } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>("choice");
  const [choice, setChoice] = useState<ScanChoice>("receipt");
  const [templateKey, setTemplateKey] = useState(mockReceiptTemplates[0]?.key ?? "weekly-family");
  const [duplicate, setDuplicate] = useState<ReceiptDuplicate | null>(null);
  const [result, setResult] = useState<ReceiptScanResult | null>(null);
  const [limitCopy, setLimitCopy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => getMockReceiptTemplate(templateKey), [templateKey]);

  useEffect(() => {
    if (mode !== "choice" || !activeHousehold?.id) return;

    getReceiptScanLimitStatus(activeHousehold.id)
      .then((limit) => {
        setLimitCopy(
          t("scan.limitStatus", {
            remaining: limit.remaining,
            limit: limit.limit,
          }),
        );
      })
      .catch(() => undefined);
  }, [activeHousehold?.id, mode, t]);

  async function openSelectedChoice(nextChoice = choice) {
    setChoice(nextChoice);
    setError(null);

    if (nextChoice !== "receipt") {
      setMode("choice");
      setError(t("scan.phaseEight"));
      return;
    }

    if (!permission?.granted) {
      const nextPermission = await requestPermission();
      if (!nextPermission.granted) {
        setError(t("scan.cameraDenied"));
        return;
      }
    }

    setMode("camera");
  }

  async function captureReceipt(allowDuplicate = false) {
    if (!activeHousehold?.id) return;

    setMode("processing");
    setError(null);

    try {
      const limit = await getReceiptScanLimitStatus(activeHousehold.id);

      if (limit.remaining <= 0) {
        setMode("limit");
        return;
      }

      if (!allowDuplicate) {
        const existing = await findRecentReceiptDuplicate(
          activeHousehold.id,
          selectedTemplate.receiptSignature,
        );

        if (existing) {
          setDuplicate(existing);
          setMode("duplicate");
          return;
        }
      }

      await delay(900);
      const nextResult = await processMockReceiptScan({
        householdId: activeHousehold.id,
        templateKey,
        allowDuplicate,
      });

      if (!activeHousehold.first_fill_completed_at) {
        await completeHouseholdFirstFill(activeHousehold.id);
      }

      await refresh();
      setResult(nextResult);
      setMode("success");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : t("auth.genericError"));
      setMode("camera");
    }
  }

  async function finishNotifications(enabled: boolean) {
    setError(null);

    try {
      await setNotificationPermissionPreview({
        enabled,
        permissionStatus: enabled ? "granted" : "denied",
      });
    } catch {
      // Prototype prompt should not block reaching fridge.
    }

    router.replace("/(tabs)/fridge");
  }

  if (mode === "camera") {
    return (
      <Screen padded={false} backgroundColor={colors.black}>
        <View style={styles.cameraWrap}>
          <CameraView style={styles.camera} facing="back" />
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraTop}>
              <Button
                title={t("common.cancel")}
                variant="text"
                onPress={() => setMode("choice")}
              />
              <Text variant="label" color={colors.surface}>
                {t("scan.cameraTitle")}
              </Text>
            </View>

            <View style={styles.frame}>
              <Corner position="topLeft" />
              <Corner position="topRight" />
              <Corner position="bottomLeft" />
              <Corner position="bottomRight" />
            </View>

            <View style={styles.coachCard}>
              <Text variant="label">{t("scan.coachTitle")}</Text>
              <Text variant="small" muted>
                {t("scan.coachBody")}
              </Text>
            </View>

            <View style={styles.templateRail}>
              {mockReceiptTemplates.map((template) => (
                <Pressable
                  key={template.key}
                  accessibilityRole="button"
                  onPress={() => setTemplateKey(template.key)}
                  style={[
                    styles.templateChip,
                    template.key === templateKey && styles.templateChipSelected,
                  ]}
                >
                  <Text
                    variant="small"
                    color={template.key === templateKey ? colors.surface : colors.text}
                  >
                    {template.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <Text variant="small" color={colors.red} center>
                {error}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("scan.capture")}
              onPress={() => captureReceipt()}
              style={styles.captureButton}
            >
              <View style={styles.captureInner} />
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  if (mode === "processing") {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text variant="display" center>
            {t("scan.processingTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("scan.processingBody", { template: selectedTemplate.label })}
          </Text>
        </View>
      </Screen>
    );
  }

  if (mode === "duplicate") {
    return (
      <Screen>
        <View style={styles.center}>
          <ReceiptToFridgeIllustration />
          <Text variant="display" center>
            {t("scan.duplicateTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("scan.duplicateBody")}
          </Text>
          <View style={styles.buttonStack}>
            <Button title={t("scan.addAnyway")} onPress={() => captureReceipt(true)} />
            <Button title={t("common.cancel")} variant="ghost" onPress={() => setMode("choice")} />
          </View>
          {duplicate ? (
            <Text variant="small" muted center>
              {t("scan.duplicateMeta", { date: new Date(duplicate.created_at).toLocaleDateString() })}
            </Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  if (mode === "limit") {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="display" center>
            {t("scan.limitTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("scan.limitBody")}
          </Text>
          <Button title={t("common.continue")} onPress={() => router.replace("/(tabs)/fridge")} />
        </View>
      </Screen>
    );
  }

  if (mode === "success") {
    return (
      <Screen>
        <View style={styles.center}>
          <AliveIcon />
          <Text variant="display" center>
            {t("scan.successTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("scan.successBody", {
              added: result?.addedCount ?? 0,
              review: result?.reviewCount ?? 0,
            })}
          </Text>
          <Button title={t("common.continue")} onPress={() => setMode("notifications")} />
        </View>
      </Screen>
    );
  }

  if (mode === "notifications") {
    return (
      <Screen>
        <View style={styles.center}>
          <Card style={styles.notificationIcon}>
            <BellIcon />
          </Card>
          <Text variant="display" center>
            {t("scan.notificationsTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("scan.notificationsBody")}
          </Text>
          <View style={styles.buttonStack}>
            <Button title={t("scan.enableNotifications")} onPress={() => finishNotifications(true)} />
            <Button
              title={t("scan.notNow")}
              variant="text"
              onPress={() => finishNotifications(false)}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="display">{t("scan.title")}</Text>
        <Text variant="body" muted>
          {t("scan.body")}
        </Text>
        {limitCopy ? (
          <Text variant="small" muted>
            {limitCopy}
          </Text>
        ) : null}
      </View>

      <View style={styles.choices}>
        <ScanChoiceCard
          selected={choice === "receipt"}
          title={t("scan.receipt.title")}
          body={t("scan.receipt.body")}
          recommended
          icon={<ReceiptIcon />}
          onPress={() => openSelectedChoice("receipt")}
        />
        <ScanChoiceCard
          selected={choice === "barcode"}
          title={t("scan.barcode.title")}
          body={t("scan.barcode.body")}
          icon={<BarcodeIcon />}
          onPress={() => openSelectedChoice("barcode")}
        />
        <ScanChoiceCard
          selected={choice === "manual"}
          title={t("scan.manual.title")}
          body={t("scan.manual.body")}
          icon={<ManualIcon />}
          onPress={() => openSelectedChoice("manual")}
        />
      </View>

      {error ? (
        <Text variant="small" color={colors.red} center>
          {error}
        </Text>
      ) : null}

      <Button title={t("scan.startReceipt")} onPress={() => openSelectedChoice("receipt")} />
    </Screen>
  );
}

function ScanChoiceCard({
  selected,
  recommended = false,
  title,
  body,
  icon,
  onPress,
}: {
  selected: boolean;
  recommended?: boolean;
  title: string;
  body: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        selected && styles.choiceCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.choiceIcon, selected && styles.choiceIconSelected]}>{icon}</View>
      <View style={styles.choiceCopy}>
        <View style={styles.choiceTitleRow}>
          <Text variant="h3" color={selected ? colors.surface : colors.text}>
            {title}
          </Text>
          {recommended ? (
            <View style={styles.badge}>
              <Text variant="micro" color={colors.text}>
                Recommended
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="small" color={selected ? colors.surface : colors.muted}>
          {body}
        </Text>
      </View>
      <PathIcon color={selected ? colors.surface : colors.muted} />
    </Pressable>
  );
}

function Corner({ position }: { position: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" }) {
  return <View style={[styles.corner, styles[position]]} />;
}

function ReceiptIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path d="M4 3h14v16l-2-2-2 2-2-2-2 2-2-2-2 2-2-2V3z" stroke={colors.primary} strokeWidth={1.6} strokeLinejoin="round" />
      <Line x1={7} y1={8} x2={15} y2={8} stroke={colors.primary} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={7} y1={12} x2={13} y2={12} stroke={colors.primary} strokeWidth={1.6} strokeLinecap="round" />
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

function ManualIcon() {
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

function AliveIcon() {
  return (
    <Svg width={180} height={180} viewBox="0 0 180 180" fill="none">
      <Circle cx={90} cy={90} r={76} fill={colors.primary50} />
      <Circle cx={90} cy={90} r={52} fill={colors.accentSoft} />
      <Rect x={58} y={42} width={64} height={96} rx={10} fill={colors.surface} stroke={colors.primary} strokeOpacity={0.18} />
      <Line x1={58} y1={80} x2={122} y2={80} stroke={colors.primary} strokeOpacity={0.18} />
      <Rect x={68} y={52} width={14} height={24} rx={3} fill={colors.green} />
      <Rect x={88} y={52} width={14} height={24} rx={3} fill={colors.accent} />
      <Rect x={104} y={90} width={12} height={26} rx={3} fill={colors.red} opacity={0.75} />
      <Path d="M76 104L88 116L110 92" stroke={colors.primary} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BellIcon() {
  return (
    <Svg width={42} height={42} viewBox="0 0 42 42" fill="none">
      <Path d="M12 29h18l-2-3v-7c0-4.4-2.8-8-7-8s-7 3.6-7 8v7l-2 3z" stroke={colors.primary} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M18 32c.6 1.7 1.6 2.5 3 2.5s2.4-.8 3-2.5" stroke={colors.primary} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingTop: 68,
    gap: spacing.xxl,
  },
  header: {
    gap: spacing.sm,
  },
  choices: {
    flexGrow: 1,
    gap: spacing.md,
  },
  choiceCard: {
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
  choiceCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primary50,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceIconSelected: {
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
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  cameraWrap: {
    flex: 1,
    backgroundColor: colors.black,
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  cameraOverlay: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 56,
    paddingBottom: spacing.screenBottom,
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  cameraTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  frame: {
    alignSelf: "center",
    width: "88%",
    aspectRatio: 0.72,
    borderRadius: 22,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 38,
    height: 38,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  coachCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  templateRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  templateChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.paper,
  },
  templateChipSelected: {
    backgroundColor: colors.primary,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignSelf: "center",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xl,
  },
  buttonStack: {
    alignSelf: "stretch",
    gap: spacing.sm,
  },
  notificationIcon: {
    width: 86,
    height: 86,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
