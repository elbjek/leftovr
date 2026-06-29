import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { BottomSheet, Button, IconButton, SegmentedControl, Text } from "../primitives";
import { colors, fonts, radii, spacing } from "../../theme";
import { CookingMode } from "@/repositories/recipeRepository";

export type BasePreference = "anything" | "protein" | "potatoes" | "pasta" | "vegetables";

export type CookFilters = {
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  maxMinutes?: number;
  minMinutes?: number;
  vibe?: string;
  basePreference?: BasePreference;
};

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
type MealOption = "any" | Meal;
type TimeOption = "any" | "15" | "30" | "45" | "norush";

type Props = {
  visible: boolean;
  labels: {
    eyebrow: string;
    title: string;
    meal: string;
    mealOptions: Record<MealOption, string>;
    mealSubtitles: Record<Meal, string>;
    buildAround: string;
    baseOptions: Record<BasePreference, string>;
    time: string;
    timeOptions: Record<Exclude<TimeOption, "any">, string>;
    servingsLabel: string;
    peopleCount: (count: number) => string;
    keepItTo: string;
    eatFirstNote: string;
    vibeOptions: Record<string, string>;
    surprise: string;
    generate: string;
    cookingFor?: string;
    cookingForOptions?: Record<CookingMode, string>;
  };
  /** Shown only when provided (households with 2+ members). */
  cookingMode?: CookingMode;
  servings?: number;
  generating?: boolean;
  onCookingModeChange?: (mode: CookingMode) => void;
  onServingsChange?: (servings: number) => void;
  onDismiss: () => void;
  onGenerate: (filters?: CookFilters) => void;
};

const MEAL_OPTIONS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
const BASE_OPTIONS: BasePreference[] = ["anything", "protein", "potatoes", "pasta", "vegetables"];
const TIME_OPTIONS: Exclude<TimeOption, "any">[] = ["15", "30", "45", "norush"];
// Single-select: maps to the recipe matcher's `vibe` tag (one value, server-side).
const VIBE_OPTIONS = [
  "comfort",
  "healthy",
  "veggie",
  "quick",
  "high_protein",
  "light",
  "family_friendly",
  "budget",
];
const SERVINGS_MIN = 1;
const SERVINGS_MAX = 12;

export function CookPromptSheet({
  visible,
  labels,
  cookingMode,
  servings = 2,
  generating = false,
  onCookingModeChange,
  onServingsChange,
  onDismiss,
  onGenerate,
}: Props) {
  const [meal, setMeal] = useState<MealOption>("any");
  const [base, setBase] = useState<BasePreference>("anything");
  const [time, setTime] = useState<TimeOption>("any");
  const [vibe, setVibe] = useState<string | null>(null);

  function buildFilters(): CookFilters {
    const numericTime = time === "15" || time === "30" || time === "45" ? Number(time) : undefined;
    return {
      mealType: meal === "any" ? undefined : meal,
      maxMinutes: numericTime,
      vibe: vibe ?? undefined,
      basePreference: base === "anything" ? undefined : base,
    };
  }

  function handleSurprise() {
    // Clear optional filters and fall back to no preference, then generate.
    setMeal("any");
    setBase("anything");
    setTime("any");
    setVibe(null);
    onGenerate(undefined);
  }

  const showCookingFor = Boolean(cookingMode && onCookingModeChange && labels.cookingForOptions);

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="micro" muted uppercase>
              {labels.eyebrow}
            </Text>
            <Text variant="h1">{labels.title}</Text>
          </View>
          <IconButton label="Close" transparent onPress={onDismiss}>
            <CloseIcon />
          </IconButton>
        </View>

        {showCookingFor ? (
          <Section label={labels.cookingFor ?? ""}>
            <SegmentedControl
              options={(["household", "just_me"] as CookingMode[]).map((option) => ({
                label: labels.cookingForOptions?.[option] ?? option,
                value: option,
              }))}
              value={cookingMode as CookingMode}
              onChange={onCookingModeChange!}
            />
          </Section>
        ) : null}

        <Section label={labels.meal}>
          <View style={styles.mealGrid}>
            {MEAL_OPTIONS.map((option) => (
              <MealCard
                key={option}
                meal={option}
                title={labels.mealOptions[option]}
                subtitle={labels.mealSubtitles[option]}
                active={meal === option}
                onPress={() => setMeal((current) => (current === option ? "any" : option))}
              />
            ))}
          </View>
        </Section>

        <Section label={labels.buildAround}>
          <View style={styles.chipWrap}>
            {BASE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={labels.baseOptions[option]}
                active={base === option}
                tone="primary"
                onPress={() => setBase(option)}
              />
            ))}
          </View>
        </Section>

        <Section label={labels.time}>
          <View style={styles.chipWrap}>
            {TIME_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={labels.timeOptions[option]}
                active={time === option}
                tone="primary"
                onPress={() => setTime((current) => (current === option ? "any" : option))}
              />
            ))}
          </View>
        </Section>

        <Section label={labels.servingsLabel}>
          <View style={styles.stepperRow}>
            <View style={styles.stepperLabel}>
              <PeopleIcon />
              <Text variant="body" style={styles.stepperValue}>
                {labels.peopleCount(servings)}
              </Text>
            </View>
            <View style={styles.stepperControls}>
              <StepperButton
                label="−"
                disabled={servings <= SERVINGS_MIN}
                onPress={() => onServingsChange?.(Math.max(SERVINGS_MIN, servings - 1))}
              />
              <StepperButton
                label="+"
                disabled={servings >= SERVINGS_MAX}
                onPress={() => onServingsChange?.(Math.min(SERVINGS_MAX, servings + 1))}
              />
            </View>
          </View>
        </Section>

        <Section label={labels.keepItTo}>
          <View style={styles.chipWrap}>
            {VIBE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={labels.vibeOptions[option] ?? option}
                active={vibe === option}
                tone="accent"
                onPress={() => setVibe((current) => (current === option ? null : option))}
              />
            ))}
          </View>
          <Text variant="small" muted style={styles.eatFirstNote}>
            {labels.eatFirstNote}
          </Text>
        </Section>

        <View style={styles.ctaGroup}>
          <Button
            title={labels.generate}
            loading={generating}
            disabled={generating}
            iconRight={<ChevronRightIcon />}
            onPress={() => onGenerate(buildFilters())}
          />
          <Button
            title={labels.surprise}
            variant="text"
            disabled={generating}
            onPress={handleSurprise}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="micro" muted uppercase style={styles.sectionLabel}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function MealCard({
  meal,
  title,
  subtitle,
  active,
  onPress,
}: {
  meal: Meal;
  title: string;
  subtitle: string;
  active: boolean;
  onPress: () => void;
}) {
  const iconColor = active ? colors.accent : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.mealCard, active && styles.mealCardActive, pressed && styles.pressed]}
    >
      <View style={[styles.mealIconTile, active && styles.mealIconTileActive]}>
        <MealIcon meal={meal} color={iconColor} />
      </View>
      <View style={styles.mealCardText}>
        <Text variant="label" color={active ? colors.surface : colors.text}>
          {title}
        </Text>
        <Text variant="small" color={active ? colors.accentSoft : colors.muted}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function Chip({
  label,
  active,
  tone,
  onPress,
}: {
  label: string;
  active: boolean;
  tone: "primary" | "accent";
  onPress: () => void;
}) {
  const activeStyle = tone === "accent" ? styles.chipAccentActive : styles.chipPrimaryActive;
  const activeText = tone === "accent" ? colors.text : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && activeStyle, pressed && styles.pressed]}
    >
      {active && tone === "accent" ? <CheckIcon /> : null}
      <Text variant="small" color={active ? activeText : colors.text} style={styles.chipText}>
        {label}
      </Text>
    </Pressable>
  );
}

function StepperButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={spacing.xs}
      onPress={onPress}
      style={({ pressed }) => [styles.stepBtn, disabled && styles.stepBtnDisabled, pressed && !disabled && styles.pressed]}
    >
      <Text variant="h3" color={colors.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

function MealIcon({ meal, color }: { meal: Meal; color: string }) {
  const props = { stroke: color, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  if (meal === "breakfast") {
    // Cloche / sunrise plate
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M4 16h16M5.5 16a6.5 6.5 0 0 1 13 0" {...props} />
        <Path d="M12 6.5v-1.5" {...props} />
      </Svg>
    );
  }
  if (meal === "lunch") {
    // Bowl with steam
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M4 11h16a8 8 0 0 1-16 0Z" {...props} />
        <Path d="M9 6.5c.6-.8.6-1.2 0-2M13 6.5c.6-.8.6-1.2 0-2" {...props} />
      </Svg>
    );
  }
  if (meal === "dinner") {
    // Fork + knife
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M8 4v6m-1.6-6v6M9.6 4v6M8 10v10" {...props} />
        <Path d="M16 4c-1.6 0-2.4 2-2.4 4.5S14.4 13 16 13v7" {...props} />
      </Svg>
    );
  }
  // Snack — apple
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M12 8c-1.5-2-5-2-6.2.5C4.4 11.2 6 18 9 19c1 .3 2-.4 3-.4s2 .7 3 .4c3-1 4.6-7.8 3.2-10.5C17 6 13.5 6 12 8Z" {...props} />
      <Path d="M12 8c0-1.6.8-3 2.5-3.5" {...props} />
    </Svg>
  );
}

function PeopleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3} stroke={colors.primary} strokeWidth={1.7} />
      <Path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke={colors.primary} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M15.5 5.5a3 3 0 0 1 0 5M16 13.8a5.5 5.5 0 0 1 4.5 5.2" stroke={colors.primary} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
      <Path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M6.5 4L11.5 9L6.5 14" stroke={colors.surface} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "92%",
  },
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    marginBottom: spacing.xxs,
  },
  mealGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  mealCard: {
    width: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
  },
  mealCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mealIconTile: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
  },
  mealIconTileActive: {
    backgroundColor: colors.primary700,
  },
  mealCardText: {
    flex: 1,
    gap: 1,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  chipPrimaryActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipAccentActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    fontWeight: "600",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
  },
  stepperLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepperValue: {
    fontWeight: "600",
  },
  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  eatFirstNote: {
    marginTop: spacing.xs,
  },
  ctaGroup: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
});
