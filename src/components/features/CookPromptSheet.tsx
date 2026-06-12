import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { BottomSheet, Button, FilterChip, IconButton, SegmentedControl, Text } from "../primitives";
import { colors, spacing } from "../../theme";
import { CookingMode } from "@/repositories/recipeRepository";

export type CookFilters = {
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  maxMinutes?: number;
  vibe?: string;
};

type MealOption = "any" | "breakfast" | "lunch" | "dinner" | "snack";
type TimeOption = "any" | "20" | "45";

type Props = {
  visible: boolean;
  labels: {
    title: string;
    meal: string;
    mealOptions: Record<MealOption, string>;
    time: string;
    timeOptions: Record<TimeOption, string>;
    vibe: string;
    vibeOptions: Record<string, string>;
    surprise: string;
    generate: string;
    cookingFor?: string;
    cookingForOptions?: Record<CookingMode, string>;
  };
  /** Shown only when provided (households with 2+ members). */
  cookingMode?: CookingMode;
  onCookingModeChange?: (mode: CookingMode) => void;
  onDismiss: () => void;
  onGenerate: (filters?: CookFilters) => void;
};

// "any" is the unselected state, not a chip — tapping a selected chip clears it.
const MEAL_OPTIONS: Exclude<MealOption, "any">[] = ["breakfast", "lunch", "dinner", "snack"];
const TIME_OPTIONS: Exclude<TimeOption, "any">[] = ["20", "45"];
const VIBE_OPTIONS = ["comfort", "healthy", "veggie", "quick"];

export function CookPromptSheet({
  visible,
  labels,
  cookingMode,
  onCookingModeChange,
  onDismiss,
  onGenerate,
}: Props) {
  const [meal, setMeal] = useState<MealOption>("any");
  const [time, setTime] = useState<TimeOption>("any");
  const [vibe, setVibe] = useState<string | null>(null);

  function buildFilters(): CookFilters {
    return {
      mealType: meal === "any" ? undefined : meal,
      maxMinutes: time === "any" ? undefined : Number(time),
      vibe: vibe ?? undefined,
    };
  }

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="h2">{labels.title}</Text>

        {cookingMode && onCookingModeChange && labels.cookingForOptions ? (
          <View style={styles.block}>
            <Text variant="small" muted>
              {labels.cookingFor}
            </Text>
            <SegmentedControl
              options={(["household", "just_me"] as CookingMode[]).map((option) => ({
                label: labels.cookingForOptions?.[option] ?? option,
                value: option,
              }))}
              value={cookingMode}
              onChange={onCookingModeChange}
            />
          </View>
        ) : null}

        <View style={styles.block}>
          <Text variant="micro" muted uppercase>
            {labels.meal}
          </Text>
          <View style={styles.chipWrap}>
            {MEAL_OPTIONS.map((option) => (
              <FilterChip
                key={option}
                label={labels.mealOptions[option]}
                active={meal === option}
                onPress={() => setMeal((current) => (current === option ? "any" : option))}
              />
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text variant="micro" muted uppercase>
            {labels.time}
          </Text>
          <View style={styles.chipWrap}>
            {TIME_OPTIONS.map((option) => (
              <FilterChip
                key={option}
                label={labels.timeOptions[option]}
                active={time === option}
                onPress={() => setTime((current) => (current === option ? "any" : option))}
              />
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text variant="micro" muted uppercase>
            {labels.vibe}
          </Text>
          <View style={styles.chipWrap}>
            {VIBE_OPTIONS.map((option) => (
              <FilterChip
                key={option}
                label={labels.vibeOptions[option] ?? option}
                active={vibe === option}
                onPress={() => setVibe((current) => (current === option ? null : option))}
              />
            ))}
          </View>
        </View>

        <View style={styles.ctaRow}>
          <Button
            title={labels.generate}
            onPress={() => onGenerate(buildFilters())}
            style={styles.generate}
          />
          <IconButton label={labels.surprise} size={56} onPress={() => onGenerate(undefined)}>
            <ShuffleIcon />
          </IconButton>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

// Shuffle arrows — "Surprise me" as a compact icon action beside Generate.
function ShuffleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path
        d="M3 6.5H6.5C8 6.5 9 7.2 10 8.5L12 11.5C13 12.8 14 13.5 15.5 13.5H19"
        stroke={colors.primary}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M3 15.5H6.5C7.6 15.5 8.4 15.1 9.2 14.3M19 6.5H15.5C14.4 6.5 13.6 6.9 12.8 7.7"
        stroke={colors.primary}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path d="M16.5 4L19 6.5L16.5 9M16.5 11L19 13.5L16.5 16" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "90%",
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  block: {
    gap: spacing.sm,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  generate: {
    flex: 1,
  },
});
