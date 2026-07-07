import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { BottomSheet, Button, IconButton, SegmentedControl, Text } from "../primitives";
import { colors, fonts, radii, spacing } from "../../theme";
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
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  maxMinutes?: number;
  minMinutes?: number;
  cuisine?: Cuisine;
  basePreference?: BasePreference;
};

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
type MealOption = "any" | Meal;
type TimeOption = "any" | "15" | "30" | "norush";

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

const MEAL_OPTIONS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
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
const SERVINGS_MIN = 1;
const SERVINGS_MAX = 12;

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
            {baseOptions.map((option) => (
              <Chip
                key={option}
                label={labels.baseOptions[option]}
                active={base === option}
                onPress={() => setBase((current) => (current === option ? null : option))}
              />
            ))}
          </View>
        </Section>

        <Section label={labels.time}>
          <View style={styles.timeRow}>
            {TIME_OPTIONS.map((option) => (
              <IconOptionCard
                key={option}
                compact
                title={labels.timeOptions[option]}
                subtitle={labels.timeSubtitles[option]}
                icon={<TimeIcon option={option} color={colors.primary} />}
                active={time === option}
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

        <Section label={labels.cuisine}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CUISINE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={labels.cuisineOptions[option]}
                active={cuisine === option}
                onPress={() => setCuisine(option)}
              />
            ))}
          </ScrollView>
          <Text variant="small" muted style={styles.eatFirstNote}>
            {labels.eatFirstNote}
          </Text>
        </Section>
      </ScrollView>

      <View style={styles.ctaGroup}>
        <Button
          title={labels.generate}
          loading={generating}
          disabled={generating}
          iconRight={<ChevronRightIcon />}
          onPress={() => onGenerate(buildFilters())}
          style={styles.ctaPrimary}
        />
      </View>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.mealCard, active && styles.mealCardActive, pressed && styles.pressed]}
    >
      <View style={[styles.mealIconTile, active && styles.mealIconTileActive]}>
        <MealIcon meal={meal} color={colors.primary} />
      </View>
      <View style={styles.mealCardText}>
        <Text variant="label" color={colors.text}>
          {title}
        </Text>
        <Text variant="small" color={colors.muted}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function IconOptionCard({
  title,
  subtitle,
  icon,
  active,
  compact,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  active: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mealCard,
        compact && styles.mealCardCompact,
        active && styles.mealCardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.mealIconTile, active && styles.mealIconTileActive]}>{icon}</View>
      <View style={[styles.mealCardText, compact && styles.mealCardTextCompact]}>
        <Text variant="label" color={colors.text}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="small"
            color={colors.muted}
            style={compact ? styles.compactSubtitle : undefined}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      {active ? <CheckIcon /> : null}
      <Text variant="small" color={colors.text} style={styles.chipText}>
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
  // Lets the scroll area shrink so the CTA footer below it always stays in view.
  scroll: {
    flexShrink: 1,
  },
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
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
  // Inline 3-up variant (time): icon stacked over centered label.
  timeRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  mealCardCompact: {
    width: undefined,
    flex: 1,
    flexBasis: 0,
    flexDirection: "column",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  mealCardTextCompact: {
    alignItems: "center",
  },
  compactSubtitle: {
    textAlign: "center",
  },
  mealCardActive: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.sage,
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
    backgroundColor: colors.surface,
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
  // Single-row horizontal carousel (cuisine) — no wrap, scrolls sideways.
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.sage,
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
  // Pinned footer below the scroll area — separated by a hairline so it reads
  // as a fixed action bar even when content scrolls behind it.
  ctaGroup: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  ctaPrimary: {
    flex: 2,
  },
  pressed: {
    opacity: 0.85,
  },
});
