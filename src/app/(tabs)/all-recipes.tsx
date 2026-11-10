import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Path } from "react-native-svg";

import { BottomSheet, Button, FilterChip, SavedRecipeRow, Screen, Tappable, Text } from "@/components";
import { isPremium as resolvePremium, openSavedRecipe, useAuth } from "@/features";
import { useHousehold, useInventory, useRecipes } from "@/hooks";
import { formatCategory, parseRecipeIngredients } from "@/services/recipeService";
import { colors, radii, shadows, spacing, typography } from "@/theme";

type RecipeTab = "all" | "saved" | "cooked" | "household";

const TABS: RecipeTab[] = ["all", "saved", "cooked", "household"];

// Every recipe, for when the home's short shelves aren't enough: search,
// filters, and the All / Saved / Cooked / Household tabs. A long household
// history scrolls here, not on the home.
export default function AllRecipesRoute() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { profile, activeHousehold } = useAuth();
  const { lots: inventory } = useInventory(activeHousehold?.id);
  const { members } = useHousehold(activeHousehold?.id);
  const {
    savedRecipes,
    cookedRecipes,
    cookedSummaries,
    toggleFavorite,
    refresh: refreshRecipes,
  } = useRecipes(activeHousehold?.id, {
    inventory,
    avoidances: profile?.avoidances ?? [],
    isPremium: resolvePremium(profile, activeHousehold),
    freeGenerationUsed: Boolean(profile?.free_recipe_generation_used_at),
    servings: activeHousehold?.default_servings ?? profile?.default_servings ?? 2,
    userId: profile?.id,
  });

  const [tab, setTab] = useState<RecipeTab>("all");
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterTime, setFilterTime] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // "See all" on a home shelf opens straight onto its tab. The screen stays
  // mounted between visits, so follow the param whenever it changes.
  const paramTab = TABS.find((candidate) => candidate === params.tab);
  const [lastParamTab, setLastParamTab] = useState(paramTab);
  if (paramTab !== lastParamTab) {
    setLastParamTab(paramTab);
    if (paramTab) setTab(paramTab);
  }

  useFocusEffect(
    useCallback(() => {
      void refreshRecipes();
    }, [refreshRecipes]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshRecipes();
    } finally {
      setRefreshing(false);
    }
  }, [refreshRecipes]);

  const memberName = useCallback(
    (id: string | null) =>
      id === profile?.id
        ? t("settings.household.you")
        : members.find((m) => m.user_id === id)?.display_name ?? "?",
    [members, profile?.id, t],
  );

  const myRecipes = savedRecipes.filter((r) => r.generated_by === profile?.id);
  const favoriteRecipes = savedRecipes.filter((r) => r.is_favorite);
  const visibleTabs: RecipeTab[] = members.length >= 2 ? TABS : TABS.filter((t_) => t_ !== "household");
  const cookedEventCount = cookedRecipes.reduce((sum, recipe) => sum + (recipe.cooked_count ?? 0), 0);
  const tabRecipes =
    tab === "all"
      ? myRecipes
      : tab === "saved"
        ? favoriteRecipes
        : tab === "cooked"
          ? cookedRecipes
          : savedRecipes;

  const categories = [
    ...new Set([
      ...savedRecipes.flatMap((recipe) => recipe.tags ?? []),
      ...cookedRecipes.flatMap((recipe) => recipe.tags ?? []),
    ]),
  ].sort();
  const query = search.trim().toLowerCase();
  const hasActiveFilters = filterTag !== null || filterTime !== null;
  const filteredRecipes = tabRecipes.filter((recipe) => {
    const ingredientNames = parseRecipeIngredients(recipe.ingredients).map((ing) => ing.name);
    return (
      (!filterTag || (recipe.tags ?? []).includes(filterTag)) &&
      (!filterTime || (recipe.time_minutes ?? 0) <= filterTime) &&
      (!query ||
        recipe.title.toLowerCase().includes(query) ||
        ingredientNames.some((name) => name.toLowerCase().includes(query)))
    );
  });
  const inventoryNames = new Set(inventory.map((lot) => lot.normalized_name));

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Tappable
            label={t("recipes.detail.backLabel")}
            onPress={() => router.replace("/(tabs)/recipes")}
            style={[styles.filterButton]}
          >
            <BackIcon />
          </Tappable>
          <Text variant="h3" style={styles.title}>{t("recipes.all.title")}</Text>
          <Tappable
            label={t("recipes.filterSheet.title")}
            onPress={() => setShowFilters(true)}
            style={[styles.filterButton]}
          >
            <FilterIcon />
            {hasActiveFilters ? <View style={styles.filterDot} /> : null}
          </Tappable>
        </View>

        <View style={styles.searchField}>
          <SearchIcon />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("recipes.searchPlaceholder")}
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t("recipes.searchPlaceholder")}
          />
          {search.length > 0 ? (
            <Tappable
              label={t("common.cancel")}
              onPress={() => setSearch("")}
              hitSlop={10}
            >
              <CloseIcon color={colors.muted} />
            </Tappable>
          ) : null}
        </View>
      </View>

      <View style={styles.tabBar}>
        {visibleTabs.map((t_) => {
          const label =
            t_ === "all"
              ? `${t("recipes.tabs.all")} · ${myRecipes.length}`
              : t_ === "saved"
                ? `${t("recipes.tabs.saved")} · ${favoriteRecipes.length}`
                : t_ === "cooked"
                  ? `${t("recipes.tabs.cooked")} · ${cookedEventCount}`
                  : t("recipes.tabs.household");
          return (
            <Tappable
              key={t_}
              role="tab"
              selected={tab === t_}
              onPress={() => setTab(t_)}
              style={[styles.tabItem, tab === t_ && styles.tabItemActive]}
            >
              <Text
                variant="label"
                color={tab === t_ ? colors.text : colors.muted}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Tappable>
          );
        })}
      </View>

      {hasActiveFilters ? (
        <View style={styles.activeFilterRow}>
          {filterTag ? (
            <ActiveFilterToken label={formatCategory(filterTag)} onRemove={() => setFilterTag(null)} />
          ) : null}
          {filterTime ? (
            <ActiveFilterToken
              label={t(`recipes.cookPrompt.timeOptions.${filterTime}`)}
              onRemove={() => setFilterTime(null)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen padded={false} bottomInset={false}>
      <FlatList
        data={filteredRecipes}
        keyExtractor={(recipe) => recipe.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text variant="small" muted style={[styles.filterEmpty, styles.listGutter]}>
            {query || hasActiveFilters ? t("recipes.filterEmpty") : t("recipes.all.empty")}
          </Text>
        }
        renderItem={({ item: recipe }) => (
          <View style={styles.listGutter}>
            <SavedRecipeRow
              recipe={recipe}
              onPress={() => openSavedRecipe(recipe, "all-recipes")}
              onFavorite={() => toggleFavorite(recipe.id, recipe.is_favorite)}
              cookedSummary={cookedSummaries[recipe.id]}
              memberCount={members.length}
              memberName={memberName}
              inventoryNames={inventoryNames}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      />

      <BottomSheet visible={showFilters} onDismiss={() => setShowFilters(false)}>
        <Text variant="h3" style={styles.filterSheetTitle}>{t("recipes.filterSheet.title")}</Text>

        <Text variant="small" muted style={styles.filterSectionLabel}>
          {t("recipes.filterSheet.category")}
        </Text>
        <View style={styles.filterChipWrap}>
          <FilterChip
            label={t("recipes.filterSheet.all")}
            active={filterTag === null}
            onPress={() => setFilterTag(null)}
          />
          {categories.map((tag) => (
            <FilterChip
              key={tag}
              label={formatCategory(tag)}
              active={filterTag === tag}
              onPress={() => setFilterTag((current) => (current === tag ? null : tag))}
            />
          ))}
        </View>

        <Text variant="small" muted style={styles.filterSectionLabel}>
          {t("recipes.filterSheet.time")}
        </Text>
        <View style={styles.filterChipWrap}>
          <FilterChip
            label={t("recipes.cookPrompt.timeOptions.any")}
            active={filterTime === null}
            onPress={() => setFilterTime(null)}
          />
          {[20, 45].map((minutes) => (
            <FilterChip
              key={minutes}
              label={t(`recipes.cookPrompt.timeOptions.${minutes}`)}
              active={filterTime === minutes}
              onPress={() => setFilterTime((current) => (current === minutes ? null : minutes))}
            />
          ))}
        </View>

        <View style={styles.filterSheetButtons}>
          <Button
            title={t("recipes.filterSheet.show", { count: filteredRecipes.length })}
            onPress={() => setShowFilters(false)}
          />
          {hasActiveFilters ? (
            <Button
              title={t("recipes.filterSheet.reset")}
              variant="text"
              onPress={() => {
                setFilterTag(null);
                setFilterTime(null);
              }}
            />
          ) : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}

function ActiveFilterToken({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <Tappable
      label={t("recipes.filterSheet.remove", { label })}
      onPress={onRemove}
      hitSlop={{ top: 6, bottom: 6 }}
      style={styles.activeFilterToken}
    >
      <Text variant="micro" color={colors.onPrimary}>
        {label}
      </Text>
      <CloseIcon color="rgba(243,239,232,0.75)" />
    </Tappable>
  );
}

function BackIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d="M9 2L3 7L9 12" stroke={colors.primary} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Path d="M3 3l6 6M9 3l-6 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Circle cx={7} cy={7} r={5} stroke={colors.muted} strokeWidth={1.6} fill="none" />
      <Path d="M11 11l3 3" stroke={colors.muted} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function FilterIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M2 4h12M4 8h8M6 12h4" stroke={colors.primary} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    paddingTop: spacing.screenTop,
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: spacing.tabBarClearance,
  },
  listGutter: {
    paddingHorizontal: spacing.screenX,
  },
  separator: {
    height: 10,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radii.lg,
    minHeight: 50,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.md,
    ...typography.body,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: spacing.screenX,
    marginBottom: spacing.xs,
    padding: spacing.xxs,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
  },
  tabItem: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
  },
  tabItemActive: {
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  activeFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
    marginBottom: spacing.lg,
  },
  activeFilterToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  filterEmpty: {
    paddingVertical: spacing.lg,
  },
  filterSheetTitle: {
    marginBottom: spacing.md,
  },
  filterSectionLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  filterChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterSheetButtons: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  savedRowPressed: {
    transform: [{ scale: 0.98 }],
  },
});
