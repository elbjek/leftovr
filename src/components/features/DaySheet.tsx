import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { categoryColors, CategoryTone, colors, fonts, radii, spacing } from "../../theme";
import { FoodGlyph } from "../illustrations";
import { BottomSheet, Text } from "../primitives";
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
  labels: { cooked: string; used: string; empty: string };
  /** Opens a cooked recipe; recipes that no longer exist aren't tappable. */
  onOpenRecipe?: (recipeId: string) => void;
};

// What a day on the home week strip was: the recipes cooked and the foods
// used up (by cooking or by hand), with what that saved.
export function DaySheet({ visible, onDismiss, title, activity, saved, labels, onOpenRecipe }: Props) {
  const empty = activity != null && activity.cooked.length === 0 && activity.used.length === 0;
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.title}>
          {title}
        </Text>
        {saved ? (
          <Text variant="small" color={colors.green} style={styles.bold}>
            {saved}
          </Text>
        ) : null}

        {activity == null ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : empty ? (
          <Text variant="small" muted style={styles.empty}>
            {labels.empty}
          </Text>
        ) : (
          <>
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
                    <Text variant="label" numberOfLines={2} style={[styles.recipeTitle, styles.bold]}>
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
                        <Text variant="small" style={styles.bold}>
                          {food.name.charAt(0).toUpperCase() + food.name.slice(1)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        )}
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
  title: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "700",
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
    fontWeight: "700",
    letterSpacing: 0.66,
  },
  recipe: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.cardLine,
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
  bold: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
});
