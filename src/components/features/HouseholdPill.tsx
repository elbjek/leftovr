import { ComponentRef, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { colors, radii, shadows, spacing } from "../../theme";
import { Tappable, Text } from "../primitives";

type Props = {
  name: string;
  /** The letter in the avatar: the user's first name, else the household's. */
  initial: string;
  label: string;
  /** Opens the caller's household sheet (members, invite, switch). */
  onPress: () => void;
};

const MENU_WIDTH = 200;

// The household pill at the top right of the tab screens. Tapping it drops a
// small menu: Household (the caller's sheet) and Settings, which gave up its
// dock slot to the shopping list.
export function HouseholdPill({ name, initial, label, onPress }: Props) {
  const { t } = useTranslation();
  const pillRef = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  // Runs once the menu's Modal is gone: on iOS a sheet's Modal opened while
  // this one is still closing never shows.
  const pending = useRef<(() => void) | null>(null);

  function openMenu() {
    pillRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ top: y + height + spacing.xs, right: x + width });
    });
  }

  function choose(action: () => void) {
    pending.current = action;
    setAnchor(null);
  }

  return (
    <>
      <View ref={pillRef} collapsable={false} style={styles.anchor}>
        <Tappable label={label} onPress={openMenu} style={styles.pill}>
          <View style={styles.avatar}>
            <Text variant="small" color={colors.primary} weight="bold">
              {initial.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text variant="small" numberOfLines={1} weight="bold" style={styles.name}>
            {name}
          </Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" accessible={false}>
            <Path d="M6 9l6 6 6-6" fill="none" stroke={colors.text} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Tappable>
      </View>

      <Modal
        transparent
        visible={anchor != null}
        animationType="fade"
        onRequestClose={() => setAnchor(null)}
        onDismiss={() => {
          const action = pending.current;
          pending.current = null;
          action?.();
        }}
      >
        <Pressable accessibilityLabel={t("common.cancel")} style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} />
        {anchor ? (
          <View style={[styles.menu, { top: anchor.top, left: Math.max(spacing.screenX, anchor.right - MENU_WIDTH) }]}>
            <Tappable label={t("settings.household.title")} onPress={() => choose(onPress)} style={styles.row}>
              <HouseIcon />
              <Text variant="label">{t("settings.household.title")}</Text>
            </Tappable>
            <View style={styles.divider} />
            <Tappable
              label={t("settings.title")}
              onPress={() => choose(() => router.navigate("/(tabs)/settings"))}
              style={styles.row}
            >
              <SlidersIcon />
              <Text variant="label">{t("settings.title")}</Text>
            </Tappable>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

function HouseIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 10.5 12 4l8 6.5V20H4z" stroke={colors.primary} strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M10 20v-5h4v5" stroke={colors.primary} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}

// The old Settings tab icon.
function SlidersIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={8} x2={20} y2={8} stroke={colors.primary} strokeWidth={1.9} strokeLinecap="round" />
      <Circle cx={15} cy={8} r={2.6} fill={colors.surface} stroke={colors.primary} strokeWidth={1.9} />
      <Line x1={4} y1={16} x2={20} y2={16} stroke={colors.primary} strokeWidth={1.9} strokeLinecap="round" />
      <Circle cx={9} cy={16} r={2.6} fill={colors.surface} stroke={colors.primary} strokeWidth={1.9} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  anchor: {
    flexShrink: 1,
  },
  pill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
    paddingLeft: spacing.xxs,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  name: {
    flexShrink: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    paddingVertical: spacing.xs,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.hairline,
  },
});
