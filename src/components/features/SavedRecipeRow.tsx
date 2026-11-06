import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Path } from "react-native-svg";

import type { CookedSummary } from "@/hooks";
import type { RecipeRow } from "@/repositories/recipeRepository";
import { formatCategory, fridgeCoverage } from "@/services/recipeService";
import { colors, fonts, radii, shadows, spacing } from "../../theme";
import { Text } from "../primitives";
import { RecipeCover } from "./RecipeCover";

type Props = {
  recipe: RecipeRow;
  onPress: () => void;
  onFavorite: () => void;
  cookedSummary?: CookedSummary;
  /** Household size: names show only when there's more than one cook. */
  memberCount: number;
  memberName: (userId: string | null) => string;
  inventoryNames: Set<string>;
};

// One saved recipe in a list (Recipes home shelves, All recipes): tile, name,
// time, how much of it the kitchen covers, tag, who cooked it, and a star.
export function SavedRecipeRow({ recipe, onPress, onFavorite, cookedSummary, memberCount, memberName, inventoryNames }: Props) {
  const { t } = useTranslation();
  const time = recipe.time_minutes ? `${recipe.time_minutes} min` : "";
  const shared = memberCount >= 2;
  const cookedLabel = cookedSummary
    ? shared && cookedSummary.cookedBy.length === 1
      ? t("recipes.cooked.countBy", { count: cookedSummary.count, name: memberName(cookedSummary.cookedBy[0]) })
      : t("recipes.cooked.count", { count: cookedSummary.count })
    : undefined;
  const attribution = shared ? t("recipes.byName", { name: memberName(recipe.generated_by) }) : undefined;
  const coverage = fridgeCoverage(recipe.ingredients, inventoryNames);
  const haveAll = coverage.total > 0 && coverage.have === coverage.total;
  const coverageLabel = coverage.total === 0
    ? undefined
    : haveAll
      ? t("recipes.haveAll")
      : t("recipes.needItems", { count: coverage.total - coverage.have });
  const tagLabel = recipe.tags?.[0] ? formatCategory(recipe.tags[0]) : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.savedRow, pressed && styles.savedRowPressed]}
    >
      <View style={[styles.savedRowThumb, { backgroundColor: thumbColorFor(recipe.title) }]}>
        <RecipeCover path={recipe.cover_path} glyphSize={38} glyphVariant="simple" />
      </View>
      <View style={styles.savedRowCopy}>
        <Text style={styles.savedRowTitle} numberOfLines={2}>{recipe.title}</Text>
        <View style={styles.savedRowMeta}>
          {time ? (
            <View style={styles.inlineMeta}>
              <ClockIcon />
              <Text variant="small" muted>{time}</Text>
            </View>
          ) : null}
          {coverageLabel ? (
            <View style={styles.coverageWrap}>
              {haveAll ? <View style={styles.coverageDot} /> : null}
              <Text variant="micro" color={haveAll ? colors.green : colors.muted} weight="semibold">
                {coverageLabel}
              </Text>
            </View>
          ) : null}
          {tagLabel ? (
            <View style={styles.tagPill}>
              <Text variant="micro" color={colors.primary} weight="bold">{tagLabel}</Text>
            </View>
          ) : null}
          {cookedLabel ? (
            <View style={styles.cookedBadge}>
              <Text variant="micro" color={colors.primary}>{cookedLabel}</Text>
            </View>
          ) : null}
          {attribution ? (
            <Text variant="micro" muted>{attribution}</Text>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recipe.is_favorite ? t("recipes.detail.savedCta") : t("recipes.detail.saveCta")}
        accessibilityState={{ checked: recipe.is_favorite }}
        onPress={onFavorite}
        hitSlop={10}
        style={styles.favoriteTap}
      >
        <StarIcon filled={recipe.is_favorite} />
      </Pressable>
      <Chevron />
    </Pressable>
  );
}

const THUMB_COLORS = ["#C8D5C2", "#E8C3B0", "#F0DDA8", "#E8B59E", "#E5D9C4"] as const;

function thumbColorFor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash + title.charCodeAt(i)) % 997;
  return THUMB_COLORS[hash % THUMB_COLORS.length];
}

function ClockIcon({ color = colors.muted }: { color?: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={5.4} stroke={color} strokeWidth={1.4} fill="none" />
      <Path d="M7 4.2V7l1.8 1.4" stroke={color} strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7L10 2.5z"
        fill={filled ? colors.accent : "none"}
        stroke={filled ? colors.accent : colors.muted}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Chevron() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path
        d="M5 3L9 7L5 11"
        stroke={colors.muted2}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  savedRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    ...shadows.soft,
  },
  savedRowPressed: {
    transform: [{ scale: 0.98 }],
  },
  savedRowThumb: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  savedRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  savedRowTitle: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 16,
    lineHeight: 20,
  },
  savedRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  inlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coverageWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coverageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  tagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
  },
  cookedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.sageTint,
    borderRadius: radii.pill,
  },
  favoriteTap: {
    minWidth: 32,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
