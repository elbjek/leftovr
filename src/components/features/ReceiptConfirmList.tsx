import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import Svg, { Path } from "react-native-svg";

import { DEFAULT_UNIT, normalizeUnit } from "@/lib";
import { INVENTORY_CATEGORIES, ReceiptConfirmItem } from "@/services";
import { CategoryTone, categoryColors, colors, radii, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { BottomSheet, Button, Card, FilterChip, Text, TextField, UnitPicker } from "../primitives";

type Props = {
  items: ReceiptConfirmItem[];
  confirming: boolean;
  onConfirm: (items: ReceiptConfirmItem[]) => void;
  onCancel: () => void;
  // Label above each item's raw text. Defaults to the receipt "Scanned as";
  // pantry passes its own ("Spotted") so shelf descriptions don't read as OCR.
  rawLabel?: string;
};

type EditableRow = ReceiptConfirmItem & { quantityText: string };

export function ReceiptConfirmList({ items, confirming, onConfirm, onCancel, rawLabel }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<EditableRow[]>(() =>
    items.map((item) => ({
      ...item,
      unit: normalizeUnit(item.unit),
      expiresAt: item.expiresAt ?? null,
      quantityText: String(item.quantity),
    })),
  );
  const [expiryPickerRowId, setExpiryPickerRowId] = useState<string | null>(null);
  // Row whose category is being corrected (C14).
  const [categoryRowId, setCategoryRowId] = useState<string | null>(null);
  const categoryRow = rows.find((row) => row.id === categoryRowId);

  const itemCount = rows.length;
  const activeExpiryRow = rows.find((row) => row.id === expiryPickerRowId);
  const activeExpiryDate = activeExpiryRow?.expiresAt
    ? parseLocalDate(activeExpiryRow.expiresAt)
    : new Date();

  function patchRow(id: string, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function handleConfirm() {
    const finalItems: ReceiptConfirmItem[] = rows.map((row) => {
      const { quantityText, ...item } = row;
      const parsed = Number(quantityText.replace(",", "."));
      const name = item.name.trim();
      return {
        ...item,
        // Every remaining row is kept; the rest were removed by the user.
        included: true,
        // Blank or invalid edits fall back to the scanned values.
        name: name.length > 0 ? name : items.find((i) => i.id === item.id)?.name ?? item.name,
        quantity: Number.isFinite(parsed) && parsed > 0 ? parsed : item.quantity,
        unit: item.unit || DEFAULT_UNIT,
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
        {rows.map((row) => {
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
                <FoodGlyph name={row.name} color={tone.mark} size={26} />
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

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("scan.manual.expiryLabel")}
                style={[styles.expiryBox, expiryPickerRowId === row.id && styles.expiryBoxActive]}
                onPress={() => setExpiryPickerRowId(row.id)}
              >
                <Text variant="micro" muted uppercase>
                  {t("scan.manual.expiryLabel")}
                </Text>
                <View style={styles.expiryValueRow}>
                  <Text
                    style={styles.expiryValue}
                    color={row.expiresAt ? colors.text : colors.muted}
                  >
                    {row.expiresAt ? formatExpiry(row.expiresAt) : t("scan.confirm.addExpiry")}
                  </Text>
                  {row.expiresAt ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("scan.manual.expiryNone")}
                      hitSlop={8}
                      onPress={() => patchRow(row.id, { expiresAt: null })}
                    >
                      <CloseIcon color={colors.muted} />
                    </Pressable>
                  ) : (
                    <CalendarIcon color={colors.muted} />
                  )}
                </View>
              </Pressable>
            </View>
          </Card>
          );
        })}
      </ScrollView>

      {expiryPickerRowId !== null ? (
        <DateTimePicker
          value={activeExpiryDate}
          mode="date"
          minimumDate={new Date()}
          onChange={(_event, date) => {
            setExpiryPickerRowId(Platform.OS === "ios" ? expiryPickerRowId : null);
            if (date && expiryPickerRowId) {
              patchRow(expiryPickerRowId, { expiresAt: toLocalDateString(date) });
            }
          }}
        />
      ) : null}
      {expiryPickerRowId !== null && Platform.OS === "ios" ? (
        <Button title={t("common.continue")} variant="text" onPress={() => setExpiryPickerRowId(null)} />
      ) : null}

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

      <Pressable
        accessibilityRole="button"
        disabled={itemCount === 0 || confirming}
        onPress={handleConfirm}
        style={({ pressed }) => [
          styles.confirmButton,
          (itemCount === 0 || confirming) && styles.confirmButtonDisabled,
          pressed && styles.confirmButtonPressed,
        ]}
      >
        {confirming ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text variant="label" color={colors.surface}>
            {t("scan.confirm.addCta", { count: itemCount })}
          </Text>
        )}
      </Pressable>
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

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path
        d="M2.5 3.5h9v8h-9zM2.5 5.8h9M4.5 2v2M9.5 2v2"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
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

function formatExpiry(value: string) {
  return parseLocalDate(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  expiryBox: {
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  expiryBoxActive: {
    borderColor: colors.sage,
  },
  expiryValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 36,
  },
  expiryValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  confirmButton: {
    minHeight: 48,
    borderRadius: radii.pill,
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
