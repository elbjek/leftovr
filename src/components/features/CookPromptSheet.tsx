import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { BottomSheet, Button, FilterChip, SegmentedControl, Text } from "../primitives";
import { spacing } from "../../theme";

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
  };
  onDismiss: () => void;
  onGenerate: (filters?: CookFilters) => void;
};

const MEAL_OPTIONS: MealOption[] = ["any", "breakfast", "lunch", "dinner", "snack"];
const TIME_OPTIONS: TimeOption[] = ["any", "20", "45"];
const VIBE_OPTIONS = ["comfort", "healthy", "veggie", "quick"];

export function CookPromptSheet({ visible, labels, onDismiss, onGenerate }: Props) {
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

        <View style={styles.block}>
          <Text variant="small" muted>
            {labels.meal}
          </Text>
          <SegmentedControl
            options={MEAL_OPTIONS.map((option) => ({
              label: labels.mealOptions[option],
              value: option,
            }))}
            value={meal}
            onChange={setMeal}
          />
        </View>

        <View style={styles.block}>
          <Text variant="small" muted>
            {labels.time}
          </Text>
          <SegmentedControl
            options={TIME_OPTIONS.map((option) => ({
              label: labels.timeOptions[option],
              value: option,
            }))}
            value={time}
            onChange={setTime}
          />
        </View>

        <View style={styles.block}>
          <Text variant="small" muted>
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

        <View style={styles.buttons}>
          <Button title={labels.generate} onPress={() => onGenerate(buildFilters())} />
          <Button title={labels.surprise} variant="text" onPress={() => onGenerate(undefined)} />
        </View>
      </ScrollView>
    </BottomSheet>
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
  buttons: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
