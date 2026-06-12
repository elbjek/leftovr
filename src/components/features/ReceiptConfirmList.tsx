import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ReceiptConfirmItem } from "@/services";
import { colors, radii, spacing } from "../../theme";
import { Button, Card, Text, TextField } from "../primitives";

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
    items.map((item) => ({ ...item, quantityText: String(item.quantity) })),
  );

  const includedCount = rows.filter((row) => row.included).length;

  function patchRow(id: string, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function handleConfirm() {
    const finalItems: ReceiptConfirmItem[] = rows.map((row) => {
      const { quantityText, ...item } = row;
      const parsed = Number(quantityText.replace(",", "."));
      const name = item.name.trim();
      return {
        ...item,
        // Blank or invalid edits fall back to the scanned values.
        name: name.length > 0 ? name : items.find((i) => i.id === item.id)?.name ?? item.name,
        quantity: Number.isFinite(parsed) && parsed > 0 ? parsed : item.quantity,
        unit: item.unit.trim() || "item",
      };
    });
    onConfirm(finalItems);
  }

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {rows.map((row) => (
          <Card key={row.id} style={[styles.row, !row.included && styles.rowExcluded]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: row.included }}
              onPress={() => patchRow(row.id, { included: !row.included })}
              style={[styles.check, row.included && styles.checkOn]}
            >
              {row.included ? (
                <Text variant="micro" color={colors.surface}>
                  ✓
                </Text>
              ) : null}
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
                editable={row.included}
                style={!row.included && styles.excludedInput}
                onChangeText={(text) => patchRow(row.id, { name: text })}
              />
              <View style={styles.inlineFields}>
                <View style={styles.qtyField}>
                  <TextField
                    label={t("scan.manual.quantityLabel")}
                    value={row.quantityText}
                    editable={row.included}
                    keyboardType="decimal-pad"
                    style={!row.included && styles.excludedInput}
                    onChangeText={(text) => patchRow(row.id, { quantityText: text })}
                  />
                </View>
                <View style={styles.unitField}>
                  <TextField
                    label={t("scan.manual.unitLabel")}
                    value={row.unit}
                    editable={row.included}
                    autoCapitalize="none"
                    style={!row.included && styles.excludedInput}
                    onChangeText={(text) => patchRow(row.id, { unit: text })}
                  />
                </View>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t("scan.confirm.addCta", { count: includedCount })}
          loading={confirming}
          disabled={includedCount === 0}
          onPress={handleConfirm}
        />
        <Button title={t("common.cancel")} variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  rowExcluded: {
    opacity: 0.45,
  },
  excludedInput: {
    textDecorationLine: "line-through",
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  checkOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fields: {
    flex: 1,
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
  footer: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
});
