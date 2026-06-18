import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { BackButton, BottomSheet, Button, Card, GeneratingLoader, PremiumSheet, ReceiptConfirmList, ReceiptToFridgeIllustration, ScanMethodCard, ScanMethodIcon, Screen, ScreenHeader, Text, TextField, UnitPicker } from "@/components";
import { isPremium as resolvePremium, useAuth } from "@/features";
import { DEFAULT_UNIT, normalizeUnit } from "@/lib";
import {
  addInventoryItem,
  completeHouseholdFirstFill,
  confirmNormalizedReceiptScan,
  normalizeReceiptImage,
  normalizeReceiptPdf,
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
  ReceiptConfirmItem,
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
  | "emptyScan"
  | "manual"
  | "processing"
  | "confirm"
  | "duplicate"
  | "success"
  | "addSuccess"
  | "notifications";
type ScanChoice = "receipt" | "ereceipt" | "barcode" | "manual";

// E-receipts are a few small pages; cap the upload to bound the (paid) AI call
// and block oversized/wrong documents before they reach storage or OpenAI.
const MAX_ERECEIPT_PDF_BYTES = 10 * 1024 * 1024;

export default function ScanRoute() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { profile, activeHousehold, refresh } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const paramChoice = getParamChoice(params.mode);
  const initialChoice = paramChoice ?? "receipt";
  // Receipt scanning: one free scan per user (the activation taste), premium
  // from the second (per-scan AI cost). The used_at flag is stamped by a DB
  // trigger and refreshed via refresh() after each scan. Barcode (free
  // OpenFoodFacts lookup) and manual entry are free for everyone.
  const canScanReceipt =
    resolvePremium(profile, activeHousehold) || !profile?.free_receipt_scan_used_at;
  // Deep-linking with a mode param (from fridge) opens the action
  // directly instead of bouncing through the choice screen. A gated receipt
  // scan falls back to the choice screen (Premium sheet shown on mount).
  const initialMode: ScanMode =
    paramChoice === "manual"
      ? "manual"
      : paramChoice === "barcode"
        ? "barcodeCamera"
        : paramChoice === "receipt"
          ? canScanReceipt
            ? "camera"
            : "choice"
          : "choice";
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const [choice, setChoice] = useState<ScanChoice>(initialChoice);
  const [duplicate, setDuplicate] = useState<ReceiptDuplicate | null>(null);
  const [result, setResult] = useState<ReceiptScanResult | null>(null);
  const [confirmItems, setConfirmItems] = useState<ReceiptConfirmItem[]>([]);
  const [confirmAllowsDuplicate, setConfirmAllowsDuplicate] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [manualCategory, setManualCategory] = useState<InventoryCategory>("other");
  const [offResults, setOffResults] = useState<BarcodeProduct[]>([]);
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualUnit, setManualUnit] = useState<string>(DEFAULT_UNIT);
  const [manualExpiry, setManualExpiry] = useState<Date | null>(null);
  const [manualExpiryEnabled, setManualExpiryEnabled] = useState(true);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [customSheetVisible, setCustomSheetVisible] = useState(false);
  const [offSearching, setOffSearching] = useState(false);
  const [draftProduct, setDraftProduct] = useState<BarcodeProduct | null>(null);
  const [lastAddedName, setLastAddedName] = useState("");
  // Open straight onto the Premium sheet if the initial deep-link is a gated scan.
  const [scanPremiumVisible, setScanPremiumVisible] = useState(
    paramChoice === "receipt" && !canScanReceipt,
  );
  const [barcodeLocked, setBarcodeLocked] = useState(false);
  // Seeded with the initial param so the auto-open effect below does not re-run
  // for the deep-link already handled by initialMode (avoids a double permission prompt).
  const consumedModeRef = useRef<string | null>(params.mode ?? null);
  const receiptCameraRef = useRef<CameraView>(null);
  // Scan row created by the normalize-receipt edge function; confirm completes it.
  const [pendingScanId, setPendingScanId] = useState<string | null>(null);

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

  const importEReceipt = useCallback(async () => {
    const householdId = activeHousehold?.id;
    if (!householdId) return;

    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
    } catch {
      setMode("choice");
      setError(t("auth.genericError"));
      return;
    }

    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) {
      setMode("choice");
      return;
    }

    if (asset.size != null && asset.size > MAX_ERECEIPT_PDF_BYTES) {
      setMode("choice");
      setError(t("scan.ereceipt.tooLarge"));
      return;
    }

    setMode("processing");
    setError(null);
    try {
      const pdfBase64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
      const scan = await normalizeReceiptPdf({
        householdId,
        pdfBase64,
      });

      if (scan.items.length === 0) {
        setMode("emptyScan");
        return;
      }

      setPendingScanId(scan.scanId);
      setConfirmItems(scan.items);

      if (scan.duplicate) {
        setDuplicate(scan.duplicate);
        setMode("duplicate");
        return;
      }

      setConfirmAllowsDuplicate(false);
      setMode("confirm");
    } catch (scanError) {
      if (isReceiptQuotaError(scanError) && !canScanReceipt) {
        setMode("choice");
        setScanPremiumVisible(true);
        return;
      }
      setError(errorMessage(scanError, t("auth.genericError")));
      setMode("choice");
    }
  }, [activeHousehold?.id, canScanReceipt, t]);

  const openSelectedChoice = useCallback(async (nextChoice = choice, options?: { skipGate?: boolean }) => {
    consumedModeRef.current = nextChoice;
    router.setParams({ mode: nextChoice });
    setChoice(nextChoice);
    setError(null);

    // Receipt scanning (photo or PDF): free once, then premium (per-scan AI
    // cost); barcode and manual are free.
    if ((nextChoice === "receipt" || nextChoice === "ereceipt") && !canScanReceipt && !options?.skipGate) {
      setScanPremiumVisible(true);
      return;
    }

    if (nextChoice === "manual") {
      setMode("manual");
      return;
    }

    if (nextChoice === "ereceipt") {
      await importEReceipt();
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
  }, [canScanReceipt, choice, importEReceipt, permission?.granted, requestPermission, t]);

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
    setConfirmItems([]);
    setConfirmAllowsDuplicate(false);
    setConfirming(false);
    setDuplicate(null);
    setPendingScanId(null);
    setError(null);
    setMode("choice");
  }

  async function completeFirstFillIfNeeded() {
    if (!activeHousehold?.id || activeHousehold.first_fill_completed_at) return;
    await completeHouseholdFirstFill(activeHousehold.id);
  }

  async function captureReceipt() {
    if (!activeHousehold?.id) return;

    setMode("processing");
    setError(null);

    try {
      const photo = await receiptCameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        throw new Error(t("auth.genericError"));
      }
      // Cap resolution before upload: controls storage size and vision tokens.
      const resized = await manipulateAsync(photo.uri, [{ resize: { width: 1500 } }], {
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!resized.base64) {
        throw new Error(t("auth.genericError"));
      }

      // The edge function creates the scan row and makes the AI call here;
      // the free scan is consumed now (when the cost happens), but nothing
      // lands in inventory until the user confirms.
      const scan = await normalizeReceiptImage({
        householdId: activeHousehold.id,
        imageBase64: resized.base64,
      });

      // Nothing readable on the photo (blurry, dark, or not a receipt):
      // a full-screen explanation with a retry, never an empty confirm sheet.
      if (scan.items.length === 0) {
        setMode("emptyScan");
        return;
      }

      setPendingScanId(scan.scanId);
      setConfirmItems(scan.items);

      if (scan.duplicate) {
        setDuplicate(scan.duplicate);
        setMode("duplicate");
        return;
      }

      setConfirmAllowsDuplicate(false);
      setMode("confirm");
    } catch (scanError) {
      // Edge function gate: free scan already used and not premium.
      if (isReceiptQuotaError(scanError) && !canScanReceipt) {
        setMode("choice");
        setScanPremiumVisible(true);
        return;
      }
      setError(errorMessage(scanError, t("auth.genericError")));
      setMode("camera");
    }
  }

  // The duplicate screen reuses the items already normalized for this scan;
  // re-invoking the edge function would pay for a second AI call.
  function proceedWithDuplicate() {
    setConfirmAllowsDuplicate(true);
    setMode("confirm");
  }

  async function handleConfirmScan(items: ReceiptConfirmItem[]) {
    if (!activeHousehold?.id || confirming) return;

    setConfirming(true);
    setError(null);

    try {
      if (!pendingScanId) {
        throw new Error(t("auth.genericError"));
      }
      const nextResult = await confirmNormalizedReceiptScan({
        householdId: activeHousehold.id,
        scanId: pendingScanId,
        items,
        duplicateOf: confirmAllowsDuplicate ? duplicate?.id ?? null : null,
      });

      if (!activeHousehold.first_fill_completed_at) {
        await completeFirstFillIfNeeded();
      }

      await refresh();
      setResult(nextResult);
      setMode("success");
    } catch (scanError) {
      // Concurrent scan of the same receipt slipped in while confirming
      // (cross-device race), bounce to the duplicate screen.
      if (scanError instanceof Error && scanError.message.includes("Duplicate receipt")) {
        setMode("duplicate");
        return;
      }
      setError(errorMessage(scanError, t("auth.genericError")));
    } finally {
      setConfirming(false);
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
      // Barcode adds are free — no premium gate to translate here.
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
      setManualUnit(normalizeUnit(product.unit));
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
          <CameraView ref={receiptCameraRef} style={styles.camera} facing="back" />
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

  if (mode === "emptyScan") {
    return (
      <Screen>
        <BackButton onPress={returnToChoice} style={styles.backButton} />
        <View style={styles.center}>
          <ScanMethodIcon method={choice === "ereceipt" ? "ereceipt" : "receipt"} />
          <Text variant="display" center>
            {t("scan.emptyScanTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("scan.emptyScan")}
          </Text>
          <View style={styles.buttonStack}>
            <Button
              title={t("scan.tryAgain")}
              onPress={() => (choice === "ereceipt" ? importEReceipt() : setMode("camera"))}
            />
            <Button title={t("common.cancel")} variant="ghost" onPress={returnToChoice} />
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

              <UnitPicker
                label={t("scan.manual.unitLabel")}
                value={manualUnit}
                onChange={setManualUnit}
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
                  unit: normalizeUnit(manualUnit),
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
          <GeneratingLoader size={130} />
          <Text variant="display" center>
            {t("scan.processingTitle")}
          </Text>
          <Text variant="body" muted center>
            {t("scan.processingBody")}
          </Text>
        </View>
      </Screen>
    );
  }

  if (mode === "confirm") {
    return (
      <Screen bottomInset={false}>
        <ScreenHeader
          title={t("scan.confirm.title")}
          subtitle={t("scan.confirm.body")}
        />
        {error ? (
          <Text variant="small" color={colors.red} center style={styles.confirmError}>
            {error}
          </Text>
        ) : null}
        <ReceiptConfirmList
          key={`${pendingScanId ?? "scan"}-${confirmItems.length}`}
          items={confirmItems}
          confirming={confirming}
          onConfirm={handleConfirmScan}
          onCancel={returnToChoice}
        />
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
            <Button title={t("scan.addAnyway")} onPress={proceedWithDuplicate} />
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
            {t("scan.successBody", { added: result?.addedCount ?? 0 })}
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
          method="ereceipt"
          body={t("scan.ereceipt.body")}
          onPress={() => openSelectedChoice("ereceipt")}
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
        onPurchased={async () => {
          await refresh();
          void openSelectedChoice(choice, { skipGate: true });
        }}
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

// normalize-receipt edge function 402: free scan used and not premium.
function isReceiptQuotaError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { context?: { status?: number } }).context?.status === 402
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

function getParamChoice(mode?: string): ScanChoice | null {
  if (mode === "barcode" || mode === "manual" || mode === "receipt" || mode === "ereceipt") {
    return mode;
  }
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
  confirmError: {
    marginBottom: spacing.sm,
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
