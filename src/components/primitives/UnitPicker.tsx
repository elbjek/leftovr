import { useState } from "react";
import { Pressable, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";

import { normalizeUnit, UNIT_OPTIONS, UnitOption } from "@/lib";
import { colors, fonts, radii, spacing } from "../../theme";
import { BottomSheet } from "./BottomSheet";
import { Text } from "./Text";

type Props = {
  label: string;
  value: string;
  onChange: (unit: UnitOption) => void;
  containerStyle?: StyleProp<ViewStyle>;
};

export function UnitPicker({ label, value, onChange, containerStyle }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = normalizeUnit(value);

  function select(unit: UnitOption) {
    onChange(unit);
    setOpen(false);
  }

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${t(`units.${selected}`)}`}
        style={styles.box}
        onPress={() => setOpen(true)}
      >
        <Text variant="micro" muted uppercase>
          {label}
        </Text>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{t(`units.${selected}`)}</Text>
          <ChevronDown color={colors.muted} />
        </View>
      </Pressable>

      <BottomSheet visible={open} onDismiss={() => setOpen(false)}>
        <Text variant="h2" style={styles.sheetTitle}>
          {t("units.selectTitle")}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {UNIT_OPTIONS.map((unit) => {
            const active = unit === selected;
            return (
              <Pressable
                key={unit}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => select(unit)}
              >
                <Text style={active ? styles.optionTextActive : undefined}>
                  {t(`units.${unit}`)}
                </Text>
                {active ? (
                  <Text variant="label" color={colors.primary}>
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function ChevronDown({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d="M3.5 5l3.5 3.5L10.5 5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  box: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 36,
  },
  value: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
  },
  sheetTitle: {
    marginBottom: spacing.lg,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  optionActive: {
    backgroundColor: colors.paper,
  },
  optionTextActive: {
    color: colors.primary,
  },
});
