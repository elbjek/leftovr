import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CategoryTone, categoryColors, colors, fonts, radii, shadows, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { BottomSheet, FoodLoader, Text } from "../primitives";
import { RecipeGlyph } from "./RecipeGlyph";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  /** Null while the day is loading. */
  activity: {
    cooked: { recipeId: string; title: string }[];
    used: { name: string; category: string }[];
  } | null;
  /** e.g. "€4.20 saved" — premium only, left out when nothing was saved. */
  saved?: string;
  /** Foods to use soon, soonest first (home, today, premium only). */
  soon?: { id: string; name: string; category: string; when: string; today: boolean }[];
  labels: { cooked: string; used: string; empty: string; soon?: string };
  /** Opens that food's sheet in Kitchen (by group key). */
  onOpenSoon?: (id: string) => void;
  /** Opens a cooked recipe; recipes that no longer exist aren't tappable. */
  onOpenRecipe?: (recipeId: string) => void;
};

// What a day was: the foods used up (by cooking or by hand) and the recipes
// cooked, with what that saved. From the home goal box it also lists what
// to use next.
export function DaySheet({ visible, onDismiss, title, activity, saved, soon, labels, onOpenRecipe, onOpenSoon }: Props) {
  const empty = activity != null && activity.cooked.length === 0 && activity.used.length === 0;
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="h3">
          {title}
        </Text>
        {saved ? (
          <Text variant="small" color={colors.green} weight="bold">
            {saved}
          </Text>
        ) : null}

        {activity == null ? (
          <View style={styles.loading}>
            <FoodLoader />
          </View>
        ) : empty ? (
          <Text variant="small" muted style={styles.empty}>
            {labels.empty}
          </Text>
        ) : (
          <>
            {activity.used.length ? (
              <View style={styles.section}>
                <Text variant="micro" uppercase muted style={styles.label}>
                  {labels.used}
                </Text>
                <View style={styles.foods}>
                  {activity.used.map((food) => {
                    const tone = categoryColors[food.category as CategoryTone] ?? categoryColors.other;
                    return (
                      <View key={food.name} style={[styles.food, { backgroundColor: tone.background }]}>
                        <FoodGlyph name={food.name} category={food.category} color={tone.mark} size={18} />
                        <Text variant="small" weight="bold">
                          {food.name.charAt(0).toUpperCase() + food.name.slice(1)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
            {activity.cooked.length ? (
              <View style={styles.section}>
                <Text variant="micro" uppercase muted style={styles.label}>
                  {labels.cooked}
                </Text>
                {activity.cooked.map((recipe) => (
                  <Pressable
                    key={recipe.recipeId}
                    accessibilityRole={onOpenRecipe ? "button" : undefined}
                    disabled={!onOpenRecipe}
                    onPress={() => onOpenRecipe?.(recipe.recipeId)}
                    style={({ pressed }) => [styles.recipe, pressed && styles.pressed]}
                  >
                    <View style={styles.recipeTile}>
                      <RecipeGlyph size={30} />
                    </View>
                    <Text variant="title" numberOfLines={2} style={styles.recipeTitle}>
                      {recipe.title}
                    </Text>
                    {onOpenRecipe ? (
                      <Text variant="label" muted>
                        ›
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

          </>
        )}

        {activity != null && soon?.length ? (
          <View style={styles.section}>
            <Text variant="micro" uppercase muted style={styles.label}>
              {labels.soon}
            </Text>
            {soon.map((food) => {
              const tone = categoryColors[food.category as CategoryTone] ?? categoryColors.other;
              return (
                <Pressable
                  key={food.id}
                  accessibilityRole={onOpenSoon ? "button" : undefined}
                  accessibilityLabel={`${food.name}, ${food.when}`}
                  disabled={!onOpenSoon}
                  onPress={() => onOpenSoon?.(food.id)}
                  style={({ pressed }) => [styles.soon, pressed && styles.pressed]}
                >
                  <View style={[styles.soonTile, { backgroundColor: tone.background }]}>
                    <FoodGlyph name={food.name} category={food.category} color={tone.mark} size={22} />
                  </View>
                  <Text variant="title" numberOfLines={1} style={styles.recipeTitle}>
                    {food.name}
                  </Text>
                  <Text variant="small" weight="bold" color={food.today ? colors.redInk : colors.muted}>
                    {food.when}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  loading: {
    marginVertical: spacing.xl,
  },
  empty: {
    marginTop: spacing.sm,
  },
  section: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.bodyExtraBold,
    letterSpacing: 0.66,
  },
  recipe: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  recipeTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeTitle: {
    flex: 1,
  },
  foods: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  food: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
  },
  soon: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  soonTile: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
