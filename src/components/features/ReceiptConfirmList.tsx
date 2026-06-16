import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { DEFAULT_UNIT, normalizeUnit } from "@/lib";
import { ReceiptConfirmItem } from "@/services";
import { colors, radii, spacing } from "../../theme";
import { Button, Card, Text, TextField, UnitPicker } from "../primitives";

type Props = {
  items: ReceiptConfirmItem[];
  confirming: boolean;
  onConfirm: (items: ReceiptConfirmItem[]) => void;
  onCancel: () => void;
};

type EditableRow = ReceiptConfirmItem & { quantityText: string };

export function ReceiptConfirmList({ items, confirming, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<EditableRow[]>(() =>
    items.map((item) => ({
      ...item,
      unit: normalizeUnit(item.unit),
      quantityText: String(item.quantity),
    })),
  );

  const itemCount = rows.length;

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
        {rows.map((row) => (
          <Card key={row.id} style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("scan.confirm.removeItem")}
              onPress={() => removeRow(row.id)}
              hitSlop={8}
              style={styles.remove}
            >
              <CloseIcon color={colors.muted} />
            </Pressable>

            <View style={styles.fields}>
              {row.lowConfidence ? (
                <View style={styles.badge}>
                  <Text variant="micro" color={colors.text}>
                    {t("scan.confirm.checkThis")}
                  </Text>
                </View>
              ) : null}
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
            </View>
          </Card>
        ))}
      </ScrollView>

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
  remove: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
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
