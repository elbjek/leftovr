import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { DEFAULT_UNIT, normalizeUnit } from "@/lib";
import { applySuggestion, INVENTORY_CATEGORIES, PartialState, ReceiptConfirmItem, ScanSuggestion } from "@/services";
import { CategoryTone, categoryColors, colors, fonts, radii, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { BottomSheet, Button, Card, DateField, FilterChip, Text, TextField, UnitPicker } from "../primitives";

type Props = {
  items: ReceiptConfirmItem[];
  confirming: boolean;
  onConfirm: (items: ReceiptConfirmItem[]) => void;
  onCancel: () => void;
  // Label above each item's raw text. Defaults to the receipt "Scanned as";
  // pantry passes its own ("Spotted") so shelf descriptions don't read as OCR.
  rawLabel?: string;
  // Lead-in before the raw text on a quick-look card. Defaults to "Receipt
  // says"; pantry passes "Photo shows".
  sourceLabel?: string;
  // Show an editable line price (read or AI-estimated).
  showPrice?: boolean;
  // Pantry: food may be old or opened, so every row needs an amount, how much
  // is left, and an expiry date (or an explicit "no date on it").
  requireDetails?: boolean;
};

type EditableRow = ReceiptConfirmItem & { quantityText: string; priceText: string; noExpiry: boolean };

const PARTIAL_STATES: { value: PartialState; labelKey: string }[] = [
  { value: "full", labelKey: "fridge.meta.full" },
  { value: "some_used", labelKey: "fridge.meta.someUsed" },
  { value: "low", labelKey: "fridge.meta.low" },
];

function parseAmount(text: string) {
  const value = Number(text.replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) && value > 0 ? value : null;
}

export function ReceiptConfirmList({ items, confirming, onConfirm, onCancel, rawLabel, sourceLabel, showPrice, requireDetails }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<EditableRow[]>(() =>
    items.map((item) => ({
      ...item,
      unit: normalizeUnit(item.unit),
      expiresAt: item.expiresAt ?? null,
      // An uncounted pantry item starts blank so the user fills it in.
      quantityText: requireDetails && item.quantityUnknown ? "" : String(item.quantity),
      priceText: item.price != null ? String(item.price) : "",
      partialState: item.partialState ?? "full",
      noExpiry: false,
    })),
  );
  // Row whose category is being corrected (C14).
  const [categoryRowId, setCategoryRowId] = useState<string | null>(null);
  const categoryRow = rows.find((row) => row.id === categoryRowId);

  const itemCount = rows.length;
  const missingCount = requireDetails
    ? rows.filter((row) => parseAmount(row.quantityText) == null || (!row.expiresAt && !row.noExpiry)).length
    : 0;
  const confirmDisabled = itemCount === 0 || confirming || missingCount > 0;

  function patchRow(id: string, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  // Unsure rows with real choices wait at the top until the user picks one;
  // picking settles the row into the regular list below, already filled in.
  const quickLookRows = rows.filter((row) => row.suggestions?.length);
  const settledRows = rows.filter((row) => !row.suggestions?.length);

  function pickSuggestion(id: string, suggestion: ScanSuggestion) {
    setRows((current) => current.map((row) => (row.id === id ? applySuggestion(row, suggestion) : row)));
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function handleConfirm() {
    const finalItems: ReceiptConfirmItem[] = rows.map((row) => {
      const { quantityText, priceText, noExpiry: _noExpiry, ...item } = row;
      const parsed = Number(quantityText.replace(",", "."));
      const parsedPrice = Number(priceText.replace(",", "."));
      const name = item.name.trim();
      return {
        ...item,
        // Every remaining row is kept; the rest were removed by the user.
        included: true,
        // Blank or invalid edits fall back to the scanned values.
        name: name.length > 0 ? name : items.find((i) => i.id === item.id)?.name ?? item.name,
        quantity: Number.isFinite(parsed) && parsed > 0 ? parsed : item.quantity,
        unit: item.unit || DEFAULT_UNIT,
        // A cleared price means "unknown"; an invalid one keeps the scanned price.
        price: !showPrice
          ? item.price
          : priceText.trim() === ""
            ? null
            : Number.isFinite(parsedPrice) && parsedPrice > 0
              ? parsedPrice
              : item.price,
      };
    });
    onConfirm(finalItems);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <Button title={t("common.cancel")} variant="text" onPress={onCancel} />
      </View>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {quickLookRows.length > 0 ? (
          <Text style={styles.quickLookTitle}>
            {t("scan.confirm.quickLookTitle", { count: quickLookRows.length })}
          </Text>
        ) : null}
        {quickLookRows.map((row) => (
          <QuickLookCard
            key={row.id}
            row={row}
            sourceLabel={sourceLabel ?? t("scan.confirm.receiptSays")}
            onPick={(suggestion) => pickSuggestion(row.id, suggestion)}
            onRemove={() => removeRow(row.id)}
          />
        ))}
        {settledRows.map((row) => {
          const tone = categoryColors[row.category as CategoryTone] ?? categoryColors.other;
          return (
          <Card key={row.id} style={styles.row}>
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("scan.confirm.changeCategory", {
                  category: t(`scan.categories.${row.category}` as any),
                })}
                onPress={() => setCategoryRowId(row.id)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.iconBox,
                  { backgroundColor: tone.background },
                  pressed && styles.iconBoxPressed,
                ]}
              >
                <FoodGlyph name={row.name} category={row.category} color={tone.mark} size={26} />
              </Pressable>
              <View style={styles.scannedCol}>
                <Text variant="micro" muted uppercase>
                  {rawLabel ?? t("scan.confirm.scannedAs")}
                </Text>
                <Text style={styles.scannedText} color={colors.text} numberOfLines={2}>
                  {`"${(row.rawText ?? row.name).toUpperCase()}"`}
                </Text>
                {row.lowConfidence ? (
                  <View style={styles.badge}>
                    <Text variant="micro" color={colors.text}>
                      {t("scan.confirm.checkThis")}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("scan.confirm.removeItem")}
                onPress={() => removeRow(row.id)}
                hitSlop={8}
                style={styles.remove}
              >
                <CloseIcon color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.fields}>
              <TextField
                label={t("scan.confirm.nameLabel")}
                value={row.name}
                onChangeText={(text) => patchRow(row.id, { name: text })}
              />
              <View style={styles.inlineFields}>
                <View style={styles.qtyField}>
                  <TextField
                    label={t("scan.manual.quantityLabel")}
                    value={row.quantityText}
                    keyboardType="decimal-pad"
                    onChangeText={(text) => patchRow(row.id, { quantityText: text })}
                  />
                </View>
                <View style={styles.unitField}>
                  <UnitPicker
                    label={t("scan.manual.unitLabel")}
                    value={row.unit}
                    onChange={(unit) => patchRow(row.id, { unit })}
                  />
                </View>
              </View>

              {requireDetails ? (
                <View style={styles.leftField}>
                  <Text variant="micro" muted uppercase>
                    {t("scan.confirm.leftLabel")}
                  </Text>
                  <View style={styles.leftChips}>
                    {PARTIAL_STATES.map((state) => (
                      <FilterChip
                        key={state.value}
                        label={t(state.labelKey as any)}
                        active={row.partialState === state.value}
                        onPress={() => patchRow(row.id, { partialState: state.value })}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {showPrice ? (
                <TextField
                  label={t("scan.confirm.priceLabel")}
                  value={row.priceText}
                  keyboardType="decimal-pad"
                  onChangeText={(text) => patchRow(row.id, { priceText: text })}
                />
              ) : null}

              <DateField
                label={t("scan.manual.expiryLabel")}
                value={row.expiresAt ? parseLocalDate(row.expiresAt) : null}
                placeholder={row.noExpiry ? t("scan.confirm.noExpiry") : t("scan.confirm.addExpiry")}
                minDate={new Date()}
                onChange={(date) => patchRow(row.id, { expiresAt: toLocalDateString(date), noExpiry: false })}
                onClear={() => patchRow(row.id, { expiresAt: null, noExpiry: false })}
                clearLabel={t("scan.manual.expiryNone")}
              />
              {requireDetails && !row.expiresAt && !row.noExpiry ? (
                <Button
                  title={t("scan.confirm.noExpiry")}
                  variant="text"
                  onPress={() => patchRow(row.id, { noExpiry: true })}
                  style={styles.noExpiryButton}
                />
              ) : null}
            </View>
          </Card>
          );
        })}
      </ScrollView>


      <BottomSheet visible={categoryRow != null} onDismiss={() => setCategoryRowId(null)}>
        <View style={styles.categorySheet}>
          <Text variant="h2">{t("scan.confirm.categoryTitle")}</Text>
          <Text variant="small" muted>{categoryRow?.name}</Text>
          <View style={styles.categoryChips}>
            {INVENTORY_CATEGORIES.map((category) => (
              <FilterChip
                key={category}
                label={t(`scan.categories.${category}` as any)}
                active={categoryRow?.category === category}
                onPress={() => {
                  if (categoryRowId) patchRow(categoryRowId, { category });
                  setCategoryRowId(null);
                }}
              />
            ))}
          </View>
        </View>
      </BottomSheet>

      {missingCount > 0 ? (
        <Text variant="small" muted center style={styles.missingHint}>
          {t("scan.confirm.needsDetails", { count: missingCount })}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={confirmDisabled}
        onPress={handleConfirm}
        style={({ pressed }) => [
          styles.confirmButton,
          confirmDisabled && styles.confirmButtonDisabled,
          pressed && styles.confirmButtonPressed,
        ]}
      >
        {confirming ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text variant="label" color={colors.onPrimary}>
            {t("scan.confirm.addCta", { count: itemCount })}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// An unsure scan line with 2-3 candidate foods: pick the right one, or drop it.
function QuickLookCard({
  row,
  sourceLabel,
  onPick,
  onRemove,
}: {
  row: EditableRow;
  sourceLabel: string;
  onPick: (suggestion: ScanSuggestion) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const lead = row.suggestions?.[0];
  const tone = categoryColors[(lead?.category ?? row.category) as CategoryTone] ?? categoryColors.other;
  return (
    <View style={styles.quickLook}>
      <View style={styles.header}>
        <View style={styles.quickLookIcon}>
          <FoodGlyph name={lead?.name ?? row.name} category={lead?.category ?? row.category} color={tone.mark} size={24} />
        </View>
        <View style={styles.scannedCol}>
          <View style={styles.quickLookHeadRow}>
            <View style={styles.checkBadge}>
              <Text variant="micro" color={colors.accent} uppercase style={styles.checkBadgeText}>
                {t("scan.confirm.quickLookBadge")}
              </Text>
            </View>
            <Text style={styles.quickLookQuestion} numberOfLines={1}>
              {t("scan.confirm.quickLookQuestion")}
            </Text>
          </View>
          <Text variant="small" muted numberOfLines={2}>
            {sourceLabel}{" "}
            <Text style={styles.scannedText} color={colors.text}>
              {row.rawText ?? row.name}
            </Text>
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("scan.confirm.removeItem")}
          onPress={onRemove}
          hitSlop={8}
          style={styles.quickLookRemove}
        >
          <CloseIcon color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.suggestionChips}>
        {row.suggestions?.map((suggestion) => (
          <Pressable
            key={suggestion.normalizedName}
            accessibilityRole="button"
            onPress={() => onPick(suggestion)}
            style={({ pressed }) => [styles.suggestionChip, pressed && styles.iconBoxPressed]}
          >
            <Text variant="label" style={styles.suggestionLabel}>
              {suggestion.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function toLocalDateString(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  toolbar: {
    alignItems: "flex-end",
    marginBottom: spacing.xs,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    position: "relative",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxPressed: {
    opacity: 0.7,
  },
  quickLookTitle: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 27,
    lineHeight: 33,
    marginBottom: spacing.xs,
  },
  quickLook: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  quickLookIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLookHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkBadge: {
    backgroundColor: colors.text,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  checkBadgeText: {
    fontFamily: fonts.bodyExtraBold,
    letterSpacing: 0.8,
  },
  quickLookQuestion: {
    flexShrink: 1,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 16,
    lineHeight: 20,
  },
  quickLookRemove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  suggestionChip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  suggestionLabel: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 15,
  },
  categorySheet: {
    gap: spacing.sm,
  },
  categoryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  scannedCol: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  scannedText: {
    fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.3,
  },
  remove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  fields: {
    gap: spacing.sm,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
  inlineFields: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  qtyField: {
    flex: 1,
  },
  unitField: {
    flex: 1,
  },
  leftField: {
    gap: spacing.xs,
  },
  leftChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  noExpiryButton: {
    alignSelf: "flex-start",
  },
  missingHint: {
    marginTop: spacing.xs,
  },
  confirmButton: {
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
});
