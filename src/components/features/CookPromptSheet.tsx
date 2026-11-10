import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { FoodGlyph } from "../illustrations";
import { BottomSheet, Button, IconButton, Tappable, Text } from "../primitives";
import { colors, radii, spacing } from "../../theme";
import { CookingMode } from "@/repositories/recipeRepository";
import { BasePreference } from "@/services";

export type { BasePreference };
export type Cuisine =
  | "any"
  | "italian"
  | "mexican"
  | "american"
  | "greek"
  | "mediterranean"
  | "french"
  | "indian"
  | "middle_eastern"
  | "asian"
  | "japanese"
  | "thai"
  | "chinese"
  | "korean"
  | "british"
  | "spanish"
  | "eastern_european";

export type CookFilters = {
  mealType?: "breakfast" | "lunch" | "dinner" | "snack" | "side";
  maxMinutes?: number;
  minMinutes?: number;
  cuisine?: Cuisine;
  basePreference?: BasePreference;
};

type Meal = "breakfast" | "lunch" | "dinner" | "snack" | "side";
type MealOption = "any" | Meal;
type TimeOption = "any" | "15" | "30" | "norush";

type Props = {
  visible: boolean;
  labels: {
    title: string;
    meal: string;
    mealOptions: Record<MealOption, string>;
    buildAround: string;
    baseOptions: Record<BasePreference, string>;
    time: string;
    timeOptions: Record<Exclude<TimeOption, "any">, string>;
    timeSubtitles: Record<Exclude<TimeOption, "any">, string>;
    servingsLabel: string;
    peopleCount: (count: number) => string;
    cuisine: string;
    eatFirstNote: string;
    cuisineOptions: Record<Cuisine, string>;
    generate: string;
    cookingFor?: string;
    cookingForOptions?: Record<CookingMode, string>;
  };
  /** Build-around bases the household has stock for, most-stocked first. */
  baseOptions: BasePreference[];
  /** Shown only when provided (households with 2+ members). */
  cookingMode?: CookingMode;
  servings?: number;
  generating?: boolean;
  onCookingModeChange?: (mode: CookingMode) => void;
  onServingsChange?: (servings: number) => void;
  onDismiss: () => void;
  onGenerate: (filters?: CookFilters) => void;
};

const MEAL_OPTIONS: Meal[] = ["breakfast", "lunch", "dinner", "snack", "side"];
const TIME_OPTIONS: Exclude<TimeOption, "any">[] = ["15", "30", "norush"];
// Single-select cuisine guide, sent to the AI as a soft preference.
const CUISINE_OPTIONS: Cuisine[] = [
  "any",
  "italian",
  "mexican",
  "american",
  "greek",
  "mediterranean",
  "french",
  "indian",
  "middle_eastern",
  "asian",
  "japanese",
  "thai",
  "chinese",
  "korean",
  "british",
  "spanish",
  "eastern_european",
];
// Each base wears the food icon that reads as it.
const BASE_ICONS: Record<BasePreference, string> = {
  protein: "chicken",
  vegetables: "broccoli",
  pasta: "pasta",
  rice: "rice",
  potatoes: "potato",
  bread: "bread",
  cheese: "cheese",
};
const SERVINGS_MIN = 1;
const SERVINGS_MAX = 12;

// The cook prompt in the home's language: no cards, no tabs. Each question is
// a sentence-case label over a row of the home's ingredient chips (outlined
// pills, an icon and a name); the picked one fills tomato. Servings is one
// inline row with a stepper.
export function CookPromptSheet({
  visible,
  labels,
  baseOptions,
  cookingMode,
  servings = 2,
  generating = false,
  onCookingModeChange,
  onServingsChange,
  onDismiss,
  onGenerate,
}: Props) {
  const [meal, setMeal] = useState<MealOption>("any");
  const [base, setBase] = useState<BasePreference | null>(null);
  const [time, setTime] = useState<TimeOption>("any");
  const [cuisine, setCuisine] = useState<Cuisine>("any");

  function buildFilters(): CookFilters {
    const numericTime = time === "15" || time === "30" ? Number(time) : undefined;
    return {
      mealType: meal === "any" ? undefined : meal,
      maxMinutes: numericTime,
      cuisine: cuisine === "any" ? undefined : cuisine,
      basePreference: base ?? undefined,
    };
  }

  const showCookingFor = Boolean(cookingMode && onCookingModeChange && labels.cookingForOptions);

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} style={styles.sheet}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="h3" accessibilityRole="header" style={styles.headerText}>
            {labels.title}
          </Text>
          <IconButton label="Close" transparent onPress={onDismiss}>
            <CloseIcon />
          </IconButton>
        </View>

        {showCookingFor ? (
          <Section label={labels.cookingFor ?? ""}>
            <View style={styles.chipWrap}>
              {(["household", "just_me"] as CookingMode[]).map((option) => (
                <Chip
                  key={option}
                  label={labels.cookingForOptions?.[option] ?? option}
                  active={cookingMode === option}
                  onPress={() => onCookingModeChange?.(option)}
                />
              ))}
            </View>
          </Section>
        ) : null}

        <Section label={labels.meal}>
          <View style={styles.chipWrap}>
            {MEAL_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={labels.mealOptions[option]}
                icon={(color) => <MealIcon meal={option} color={color} />}
                active={meal === option}
                onPress={() => setMeal((current) => (current === option ? "any" : option))}
              />
            ))}
          </View>
        </Section>

        {baseOptions.length > 0 ? (
          <Section label={labels.buildAround}>
            <View style={styles.chipWrap}>
              {baseOptions.map((option) => (
                <Chip
                  key={option}
                  label={labels.baseOptions[option]}
                  icon={() => <FoodGlyph name={BASE_ICONS[option]} size={20} />}
                  active={base === option}
                  onPress={() => setBase((current) => (current === option ? null : option))}
                />
              ))}
            </View>
          </Section>
        ) : null}

        <Section label={labels.time}>
          <View style={styles.chipWrap}>
            {TIME_OPTIONS.map((option) => (
              <Chip
                key={option}
                // "Under 15 min" and "About 30 min" say more than "Quick" and
                // "Weeknight"; "No rush" says it best itself.
                label={option === "norush" ? labels.timeOptions.norush : labels.timeSubtitles[option]}
                icon={(color) => <TimeIcon option={option} color={color} />}
                active={time === option}
                onPress={() => setTime((current) => (current === option ? "any" : option))}
              />
            ))}
          </View>
        </Section>

        <View style={styles.servings}>
          <Text variant="title">{labels.servingsLabel}</Text>
          <View style={styles.stepper}>
            <StepperButton
              label="−"
              disabled={servings <= SERVINGS_MIN}
              onPress={() => onServingsChange?.(Math.max(SERVINGS_MIN, servings - 1))}
            />
            <Text variant="label" center style={styles.servingsValue}>
              {labels.peopleCount(servings)}
            </Text>
            <StepperButton
              label="+"
              disabled={servings >= SERVINGS_MAX}
              onPress={() => onServingsChange?.(Math.min(SERVINGS_MAX, servings + 1))}
            />
          </View>
        </View>

        <Section label={labels.cuisine}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CUISINE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={labels.cuisineOptions[option]}
                active={cuisine === option}
                onPress={() => setCuisine(option)}
              />
            ))}
          </ScrollView>
          <Text variant="small" muted>
            {labels.eatFirstNote}
          </Text>
        </Section>
      </ScrollView>

      <View style={styles.cta}>
        <Button
          title={labels.generate}
          loading={generating}
          disabled={generating}
          iconRight={<ChevronRightIcon />}
          onPress={() => onGenerate(buildFilters())}
        />
      </View>
    </BottomSheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title">{label}</Text>
      {children}
    </View>
  );
}

// The home's ingredient chip: outlined pill on the page cream, an icon, the
// name. Picked: solid tomato with white text (line icons go white too).
function Chip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: (color: string) => React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  const ink = active ? colors.onPrimary : colors.text;
  return (
    <Tappable label={label} selected={active} onPress={onPress} hitSlop={4} style={[styles.chip, active && styles.chipActive]}>
      {icon ? icon(active ? colors.onPrimary : colors.primary) : null}
      <Text variant="small" weight="bold" color={ink}>
        {label}
      </Text>
    </Tappable>
  );
}

function StepperButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Tappable label={label} disabled={disabled} hitSlop={spacing.xs} onPress={onPress} style={styles.stepBtn}>
      <Text variant="h3" color={colors.primary}>
        {label}
      </Text>
    </Tappable>
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
  if (meal === "side") {
    // Small side bowl beside a plate
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx={9} cy={12} r={6} {...props} />
        <Path d="M15.5 15h6a3 3 0 0 1-6 0Z" {...props} />
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

function TimeIcon({ option, color }: { option: Exclude<TimeOption, "any">; color: string }) {
  const p = { stroke: color, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  if (option === "15") {
    // Lightning — quick
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" {...p} />
      </Svg>
    );
  }
  if (option === "30") {
    // Clock — weeknight
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={8} {...p} />
        <Path d="M12 8v4l3 2" {...p} />
      </Svg>
    );
  }
  // Mug with steam — no rush, take your time
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M5 11h11v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-4Z" {...p} />
      <Path d="M16 12h1.5a2.5 2.5 0 0 1 0 5H16" {...p} />
      <Path d="M8.5 7.5c.7-.9.7-1.4 0-2.3M12 7.5c.7-.9.7-1.4 0-2.3" {...p} />
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
      <Path d="M6.5 4L11.5 9L6.5 14" stroke={colors.onPrimary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "92%",
  },
  // Lets the scroll area shrink so the CTA below it always stays in view.
  scroll: {
    flexShrink: 1,
  },
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  // Single-row carousel (cuisine): no wrap, scrolls sideways.
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.bg,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  servings: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  servingsValue: {
    minWidth: 76,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
  },
  cta: {
    paddingTop: spacing.md,
  },
});
