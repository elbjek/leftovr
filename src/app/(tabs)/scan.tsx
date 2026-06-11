import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { BackButton, BottomSheet, Button, Card, PremiumSheet, ReceiptToFridgeIllustration, ScanMethodCard, ScanMethodIcon, Screen, ScreenHeader, Text, TextField } from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { mockBarcodeProducts, mockReceiptTemplates } from "@/mocks";
import {
  addInventoryItem,
  completeHouseholdFirstFill,
  findRecentReceiptDuplicate,
  processMockReceiptScan,
  ReceiptDuplicate,
  ReceiptScanResult,
  setNotificationPermissionPreview,
  setPreviewTier,
} from "@/repositories";
import {
  BarcodeProduct,
  getShelfLifeDays,
  INVENTORY_CATEGORIES,
  InventoryCategory,
  lookupBarcodeProduct,
  searchOpenFoodFactsProducts,
} from "@/services";
import { colors, radii, spacing } from "@/theme";

function formatNet(product: BarcodeProduct) {
  return product.netAmount && product.netUnit ? `${product.netAmount} ${product.netUnit}` : null;
}

function toLocalDateString(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type ScanMode =
  | "choice"
  | "camera"
  | "barcodeCamera"
  | "barcodeFallback"
  | "manual"
  | "processing"
  | "duplicate"
  | "success"
  | "addSuccess"
  | "notifications";
type ScanChoice = "receipt" | "barcode" | "manual";

export default function ScanRoute() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { profile, activeHousehold, refresh } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const paramChoice = getParamChoice(params.mode);
  const initialChoice = paramChoice ?? "receipt";
  const canScan = resolvePremium(profile, activeHousehold);
  // Onboarding (first-fill not yet completed) grants one free simulated scan.
  const onboardingScan = !activeHousehold?.first_fill_completed_at;
  const scanAllowed = canScan || onboardingScan;
  // Deep-linking with a mode param (from first-fill / fridge) opens the action
  // directly instead of bouncing through the choice screen. Gated scans fall back
  // to the choice screen (a Premium sheet is shown via the mount effect below).
  const initialMode: ScanMode =
    paramChoice === "manual"
      ? "manual"
      : paramChoice === "barcode"
        ? scanAllowed
          ? "barcodeCamera"
          : "choice"
        : paramChoice === "receipt"
          ? scanAllowed
            ? "camera"
            : "choice"
          : "choice";
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const [choice, setChoice] = useState<ScanChoice>(initialChoice);
  const [duplicate, setDuplicate] = useState<ReceiptDuplicate | null>(null);
  const [result, setResult] = useState<ReceiptScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [manualCategory, setManualCategory] = useState<InventoryCategory>("other");
  const [offResults, setOffResults] = useState<BarcodeProduct[]>([]);
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualUnit, setManualUnit] = useState("item");
  const [manualExpiry, setManualExpiry] = useState<Date | null>(null);
  const [manualExpiryEnabled, setManualExpiryEnabled] = useState(true);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [customSheetVisible, setCustomSheetVisible] = useState(false);
  const [offSearching, setOffSearching] = useState(false);
  const [draftProduct, setDraftProduct] = useState<BarcodeProduct | null>(null);
  const [lastAddedName, setLastAddedName] = useState("");
  // Open straight onto the Premium sheet if the initial deep-link is a gated scan.
  const [scanPremiumVisible, setScanPremiumVisible] = useState(
    (paramChoice === "receipt" || paramChoice === "barcode") && !scanAllowed,
  );
  const [barcodeLocked, setBarcodeLocked] = useState(false);
  // Seeded with the initial param so the auto-open effect below does not re-run
  // for the deep-link already handled by initialMode (avoids a double permission prompt).
  const consumedModeRef = useRef<string | null>(params.mode ?? null);

  // Returning to the Scan tab should show the choice screen, not a leftover
  // post-scan terminal screen (success / notifications) from a previous flow.
  useFocusEffect(
    useCallback(() => {
      setMode((current) =>
        current === "success" || current === "addSuccess" || current === "notifications"
          ? "choice"
          : current,
      );
    }, []),
  );

  const selectedTemplate = mockReceiptTemplates[0];
  const showCustomManualAdd = manualQuery.trim().length > 0
    && !offResults.some((product) => product.name.toLowerCase() === manualQuery.trim().toLowerCase());

  useEffect(() => {
    const query = manualQuery.trim();
    let cancelled = false;

    // All state updates run inside the timer callback (not synchronously in the
    // effect body) to avoid cascading renders. Short queries clear immediately.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (query.length < 3) {
        setOffResults([]);
        setOffSearching(false);
        return;
      }
      setOffSearching(true);
      const results = await searchOpenFoodFactsProducts(query);
      if (!cancelled) {
        setOffResults(results);
        setOffSearching(false);
      }
    }, query.length < 3 ? 0 : 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [manualQuery]);

  const sheetItemName = (draftProduct?.name ?? manualQuery).trim();
  const defaultExpiry = useMemo(() => {
    const [, upper] = getShelfLifeDays(sheetItemName, manualCategory);
    const date = new Date();
    date.setDate(date.getDate() + upper);
    return date;
  }, [sheetItemName, manualCategory]);
  const expiryValue = manualExpiry ?? defaultExpiry;

  const openSelectedChoice = useCallback(async (nextChoice = choice, options?: { skipGate?: boolean }) => {
    consumedModeRef.current = nextChoice;
    router.setParams({ mode: nextChoice });
    setChoice(nextChoice);
    setError(null);

    // Onboarding (first-fill) gives one free simulated scan: gate only once first-fill is done.
    if (
      (nextChoice === "receipt" || nextChoice === "barcode") &&
      !canScan &&
      !options?.skipGate &&
      activeHousehold?.first_fill_completed_at
    ) {
      setScanPremiumVisible(true);
      return;
    }

    if (nextChoice === "manual") {
      setMode("manual");
      return;
    }

    if ((nextChoice === "receipt" || nextChoice === "barcode") && !permission?.granted) {
      const nextPermission = await requestPermission();
      if (!nextPermission.granted) {
        consumedModeRef.current = "choice";
        router.setParams({ mode: "choice" });
        setMode("choice");
        setError(t("scan.cameraDenied"));
        return;
      }
    }

    setMode(nextChoice === "barcode" ? "barcodeCamera" : "camera");
  }, [activeHousehold?.first_fill_completed_at, canScan, choice, permission?.granted, requestPermission, t]);

  useEffect(() => {
    const paramMode = params.mode;
    const nextChoice = getParamChoice(paramMode);
    if (!paramMode || consumedModeRef.current === paramMode) return;
    if (!nextChoice) return;

    consumedModeRef.current = paramMode;
    const timeout = setTimeout(() => {
      void openSelectedChoice(nextChoice);
    }, 0);

    return () => clearTimeout(timeout);
  }, [openSelectedChoice, params.mode]);

  function returnToChoice() {
    consumedModeRef.current = "choice";
    router.setParams({ mode: "choice" });
    setMode("choice");
  }

  async function completeFirstFillIfNeeded() {
    if (!activeHousehold?.id || activeHousehold.first_fill_completed_at) return;
    await completeHouseholdFirstFill(activeHousehold.id);
  }

  async function captureReceipt(allowDuplicate = false) {
    if (!activeHousehold?.id) return;

    setMode("processing");
    setError(null);

    try {
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
        templateKey: selectedTemplate.key,
        allowDuplicate,
      });

      if (!activeHousehold.first_fill_completed_at) {
        await completeFirstFillIfNeeded();
      }

      await refresh();
      setResult(nextResult);
      setMode("success");
    } catch (scanError) {
      // RLS rejection AND the client agrees the user isn't entitled = upsell.
      // (A 42501 while canScan is true means a different problem, e.g. stale household.)
      if (isPremiumGateError(scanError) && !canScan) {
        setMode("choice");
        setScanPremiumVisible(true);
        return;
      }
      setError(errorMessage(scanError, t("auth.genericError")));
      setMode("camera");
    }
  }

  async function addInventoryFromBarcode(barcode: string) {
    if (!activeHousehold?.id || barcodeLocked) return;

    setBarcodeLocked(true);
    setError(null);

    const product = await lookupBarcodeProduct(barcode);

    if (!product) {
      setManualQuery("");
      setMode("barcodeFallback");
      setBarcodeLocked(false);
      return;
    }

    await addResolvedBarcodeProduct(product);
    setBarcodeLocked(false);
  }

  async function addMockBarcodeProduct(product: BarcodeProduct) {
    if (!activeHousehold?.id || barcodeLocked) return;

    setBarcodeLocked(true);
    setError(null);
    await addResolvedBarcodeProduct(product);
    setBarcodeLocked(false);
  }

  async function addResolvedBarcodeProduct(product: BarcodeProduct) {
    if (!activeHousehold?.id) return;

    try {
      await addInventoryItem({
        householdId: activeHousehold.id,
        name: product.name,
        brandName: product.brandName,
        category: product.category,
        quantity: product.quantity,
        unit: product.unit,
        netAmount: product.netAmount,
        netUnit: product.netUnit,
        source: "barcode",
      });
      await completeFirstFillIfNeeded();
      await refresh();
      setLastAddedName(product.name);
      setMode("addSuccess");
    } catch (addError) {
      if (isPremiumGateError(addError) && !canScan) {
        setMode("choice");
        setScanPremiumVisible(true);
        return;
      }
      setError(errorMessage(addError, t("auth.genericError")));
    }
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    void addInventoryFromBarcode(result.data);
  }

  function openProductSheet(product: BarcodeProduct | null) {
    setDraftProduct(product);
    if (product) {
      setManualCategory(product.category);
      setManualUnit(product.unit);
    }
    setManualQuantity(1);
    setManualExpiry(null);
    setManualExpiryEnabled(true);
    setCustomSheetVisible(true);
  }

  async function addManualItem(input: {
    name: string;
    category?: InventoryCategory;
    unit?: string;
    quantity?: number;
    brandName?: string | null;
    netAmount?: number | null;
    netUnit?: "ml" | "g" | null;
    expiresAt?: string | null;
  }) {
    if (!activeHousehold?.id) return;

    const name = input.name.trim();
    if (!name) {
      setError(t("scan.manual.missingName"));
      return;
    }

    setError(null);

    const quantity = input.quantity ?? 1;
    // netAmount from a product is per-package; store the total across the
    // chosen quantity to match the catalog path in addInventoryItem (#4).
    const netAmount = input.netAmount != null ? input.netAmount * quantity : input.netAmount;

    try {
      await addInventoryItem({
        householdId: activeHousehold.id,
        name,
        category: input.category ?? manualCategory,
        unit: input.unit ?? "item",
        quantity,
        brandName: input.brandName ?? undefined,
        netAmount,
        netUnit: input.netUnit,
        expiresAt: input.expiresAt,
        source: "manual",
      });
      await completeFirstFillIfNeeded();
      await refresh();
      setLastAddedName(name);
      setManualQuery("");
      setManualQuantity(1);
      setManualUnit("item");
      setManualExpiry(null);
      setManualExpiryEnabled(true);
      setCustomSheetVisible(false);
      setShowExpiryPicker(false);
      setDraftProduct(null);
      setMode("addSuccess");
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : t("auth.genericError"));
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
    if (!permission?.granted) {
      return (
        <Screen>
          <View style={styles.center}>
            <ScanMethodIcon method="receipt" />
            <Text variant="display" center>
              {t("scan.cameraTitle")}
            </Text>
            <Text variant="body" muted center>
              {t("scan.cameraDenied")}
            </Text>
            <Button title={t("common.continue")} onPress={requestPermission} />
            <Button title={t("common.cancel")} variant="text" onPress={returnToChoice} />
          </View>
        </Screen>
      );
    }

    return (
      <Screen padded={false} backgroundColor={colors.black}>
        <View style={styles.cameraWrap}>
          <CameraView style={styles.camera} facing="back" />
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraTop}>
              <Button
                title={t("common.cancel")}
                variant="text"
                onPress={returnToChoice}
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

  if (mode === "barcodeCamera") {
    if (!permission?.granted) {
      return (
        <Screen>
          <View style={styles.center}>
            <ScanMethodIcon method="barcode" />
            <Text variant="display" center>
              {t("scan.barcodeCameraTitle")}
            </Text>
            <Text variant="body" muted center>
              {t("scan.cameraDenied")}
            </Text>
            <Button title={t("common.continue")} onPress={requestPermission} />
            <Button title={t("common.cancel")} variant="text" onPress={returnToChoice} />
          </View>
        </Screen>
      );
    }

    return (
      <Screen padded={false} backgroundColor={colors.black}>
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
            }}
            onBarcodeScanned={barcodeLocked ? undefined : handleBarcodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraTop}>
              <Button
                title={t("common.cancel")}
                variant="text"
                onPress={returnToChoice}
              />
              <Text variant="label" color={colors.surface}>
                {t("scan.barcodeCameraTitle")}
              </Text>
            </View>

            <View style={styles.barcodeFrame}>
              <View style={styles.scanLine} />
            </View>

            <View style={styles.coachCard}>
              <Text variant="label">{t("scan.barcodeCoachTitle")}</Text>
              <Text variant="small" muted>
                {t("scan.barcodeCoachBody")}
              </Text>
            </View>

            <View style={styles.templateRail}>
              {mockBarcodeProducts.map((product) => (
                <Pressable
                  key={product.barcode}
                  accessibilityRole="button"
                  onPress={() => addMockBarcodeProduct(product)}
                  style={styles.templateChip}
                >
                  <Text variant="small">{product.name}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => addInventoryFromBarcode("unknown-demo-code")}
                style={styles.templateChip}
              >
                <Text variant="small">{t("scan.unknownBarcode")}</Text>
              </Pressable>
            </View>

            {error ? (
              <Text variant="small" color={colors.red} center>
                {error}
              </Text>
            ) : null}
          </View>
        </View>
      </Screen>
    );
  }

  if (mode === "barcodeFallback") {
    return (
      <Screen>
        <View style={styles.center}>
          <ScanMethodIcon method="barcode" />
          <Text variant="display" center>
            {t("scan.unknownBarcodeTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("scan.unknownBarcodeBody")}
          </Text>
          <View style={styles.buttonStack}>
            <Button title={t("scan.manual.title")} onPress={() => setMode("manual")} />
            <Button title={t("scan.tryAnotherBarcode")} variant="ghost" onPress={() => setMode("barcodeCamera")} />
          </View>
        </View>
      </Screen>
    );
  }

  if (mode === "manual") {
    return (
      <Screen scroll contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BackButton onPress={returnToChoice} style={styles.backButton} />
          <ScreenHeader title={t("scan.manual.title")} subtitle={t("scan.manual.screenBody")} />
        </View>

        <TextField
          label={t("scan.manual.searchLabel")}
          value={manualQuery}
          onChangeText={setManualQuery}
          placeholder={t("scan.manual.placeholder")}
          autoCapitalize="words"
        />

        {offSearching ? (
          <View style={styles.searchingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text variant="small" muted>
              {t("scan.manual.searching")}
            </Text>
          </View>
        ) : null}

        {offResults.length > 0 ? (
          <View style={styles.suggestions}>
            <Text variant="small" muted>
              {t("scan.manual.onlineResults")}
            </Text>
            {offResults.map((product) => (
              <Pressable
                key={product.barcode}
                accessibilityRole="button"
                onPress={() => openProductSheet(product)}
                style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
              >
                <View>
                  <Text variant="label">{product.name}</Text>
                  <Text variant="small" muted>
                    {[product.brandName, formatNet(product)].filter(Boolean).join(" · ") ||
                      t(`scan.categories.${product.category}`)}
                  </Text>
                </View>
                <Text variant="label" color={colors.primary}>
                  {t("scan.add")}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {showCustomManualAdd ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => openProductSheet(null)}
            style={({ pressed }) => [styles.customAddRow, pressed && styles.pressed]}
          >
            <View style={styles.customAddPlus}>
              <Text variant="h3" color={colors.primary}>+</Text>
            </View>
            <Text variant="label" color={colors.primary}>
              {t("scan.manual.addCustom", { item: manualQuery.trim() })}
            </Text>
          </Pressable>
        ) : null}

        {error && !customSheetVisible ? (
          <Text variant="small" color={colors.red} center>
            {error}
          </Text>
        ) : null}

        <BottomSheet
          visible={customSheetVisible}
          onDismiss={() => setCustomSheetVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.customAddCard}
          >
            <Text variant="h3">
              {t("scan.manual.addCustom", { item: sheetItemName })}
            </Text>
            {draftProduct?.brandName ? (
              <Text variant="small" muted>
                {[draftProduct.brandName, formatNet(draftProduct)].filter(Boolean).join(" · ")}
              </Text>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {INVENTORY_CATEGORIES.map((category) => (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  onPress={() => setManualCategory(category)}
                  style={[
                    styles.categoryChip,
                    manualCategory === category && styles.categoryChipSelected,
                  ]}
                >
                  <Text
                    variant="small"
                    color={manualCategory === category ? colors.surface : colors.text}
                  >
                    {t(`scan.categories.${category}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.fieldRow}>
              <View style={styles.fieldBox}>
                <Text variant="micro" muted uppercase>
                  {t("scan.manual.quantityLabel")}
                </Text>
                <View style={styles.stepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("scan.manual.quantityDown")}
                    hitSlop={spacing.sm}
                    onPress={() => setManualQuantity((current) => Math.max(1, current - 1))}
                    style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                  >
                    <Text variant="h3" color={colors.primary}>−</Text>
                  </Pressable>
                  <Text variant="h3" style={styles.stepValue}>
                    {manualQuantity}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("scan.manual.quantityUp")}
                    hitSlop={spacing.sm}
                    onPress={() => setManualQuantity((current) => current + 1)}
                    style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                  >
                    <Text variant="h3" color={colors.primary}>+</Text>
                  </Pressable>
                </View>
              </View>

              <TextField
                label={t("scan.manual.unitLabel")}
                value={manualUnit}
                onChangeText={setManualUnit}
                containerStyle={styles.fieldBoxGrow}
              />
            </View>

            <View style={styles.fieldBox}>
              <Text variant="micro" muted uppercase>
                {t("scan.manual.expiryLabel")}
              </Text>
              <View style={styles.expiryRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (!manualExpiryEnabled) {
                      setManualExpiryEnabled(true);
                      return;
                    }
                    setShowExpiryPicker(true);
                  }}
                  style={({ pressed }) => [
                    styles.expiryPill,
                    !manualExpiryEnabled && styles.expiryPillMuted,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    variant="label"
                    color={manualExpiryEnabled ? colors.primary : colors.muted}
                  >
                    {manualExpiryEnabled
                      ? expiryValue.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : t("scan.manual.expiryNone")}
                  </Text>
                </Pressable>
                {manualExpiryEnabled ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={spacing.sm}
                    onPress={() => setManualExpiryEnabled(false)}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text variant="small" muted>
                      {t("scan.manual.expiryNone")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {showExpiryPicker && manualExpiryEnabled ? (
              <DateTimePicker
                value={expiryValue}
                mode="date"
                minimumDate={new Date()}
                onChange={(_event, date) => {
                  setShowExpiryPicker(Platform.OS === "ios");
                  if (date) setManualExpiry(date);
                }}
              />
            ) : null}

            <Button
              title={t("scan.add")}
              onPress={() =>
                addManualItem({
                  name: sheetItemName,
                  category: manualCategory,
                  quantity: manualQuantity,
                  unit: manualUnit.trim() || "item",
                  brandName: draftProduct?.brandName,
                  netAmount: draftProduct?.netAmount,
                  netUnit: draftProduct?.netUnit,
                  expiresAt: manualExpiryEnabled
                    ? toLocalDateString(expiryValue)
                    : null,
                })
              }
            />

            {error ? (
              <Text variant="small" color={colors.red} center>
                {error}
              </Text>
            ) : null}
          </KeyboardAvoidingView>
        </BottomSheet>
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
            <Button title={t("common.cancel")} variant="ghost" onPress={returnToChoice} />
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

  if (mode === "addSuccess") {
    return (
      <Screen>
        <View style={styles.center}>
          <AliveIcon />
          <Text variant="display" center>
            {t("scan.addSuccessTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("scan.addSuccessBody", { item: lastAddedName })}
          </Text>
          <View style={styles.buttonStack}>
            <Button title={t("scan.addAnother")} onPress={() => setMode(choice === "barcode" ? "barcodeCamera" : "manual")} />
            <Button title={t("common.continue")} variant="ghost" onPress={() => router.replace("/(tabs)/fridge")} />
          </View>
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
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <BackButton
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/fridge"))}
          style={styles.backButton}
        />
        <ScreenHeader title={t("scan.title")} subtitle={t("scan.body")} />
      </View>

      <View style={styles.choices}>
        <ScanMethodCard
          method="receipt"
          body={t("scan.receipt.body")}
          recommended
          onPress={() => openSelectedChoice("receipt")}
        />
        <ScanMethodCard
          method="barcode"
          body={t("scan.barcode.body")}
          onPress={() => openSelectedChoice("barcode")}
        />
        <ScanMethodCard
          method="manual"
          body={t("scan.manual.body")}
          onPress={() => openSelectedChoice("manual")}
        />
      </View>

      {error ? (
        <Text variant="small" color={colors.red} center>
          {error}
        </Text>
      ) : null}

      <PremiumSheet
        visible={scanPremiumVisible}
        onPreview={async () => {
          await setPreviewTier("premium");
          await refresh();
          setScanPremiumVisible(false);
          void openSelectedChoice(choice, { skipGate: true });
        }}
        onDismiss={() => setScanPremiumVisible(false)}
      />
    </Screen>
  );
}

function Corner({ position }: { position: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" }) {
  return <View style={[styles.corner, styles[position]]} />;
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

// Postgres row-level-security rejection (insufficient_privilege).
function isPremiumGateError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42501";
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

function getParamChoice(mode?: string): ScanChoice | null {
  if (mode === "barcode" || mode === "manual" || mode === "receipt") return mode;
  return null;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingTop: spacing.screenTop,
    gap: spacing.xxl,
  },
  header: {
    gap: spacing.sm,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.xs,
  },
  choices: {
    flexGrow: 1,
    gap: spacing.md,
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
  barcodeFrame: {
    alignSelf: "center",
    width: "88%",
    height: 160,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  scanLine: {
    height: 3,
    borderRadius: 3,
    backgroundColor: colors.accent,
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
  suggestions: {
    gap: spacing.sm,
  },
  suggestionRow: {
    minHeight: 68,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  customAddCard: {
    gap: spacing.md,
  },
  searchingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  customAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairlineStrong,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  customAddPlus: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.primary50,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  categoryChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.paper,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fieldRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  fieldBox: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  fieldBoxGrow: {
    flex: 1,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.primary50,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    minWidth: 24,
    textAlign: "center",
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  expiryPill: {
    backgroundColor: colors.primary50,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: "center",
  },
  expiryPillMuted: {
    backgroundColor: colors.surface2,
  },
});
