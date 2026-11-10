import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { FoodGlyph } from "../illustrations";
import { BottomSheet, Button, IconButton, Tappable, Text } from "../primitives";
import { colors, radii, shadows, spacing } from "../../theme";
import { CookingMode } from "@/repositories/recipeRepository";
import { BasePreference, estimateServings, type InventoryLot } from "@/services";

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
    /** "Your kitchen has about enough for 3…" when the servings ask for more. */
    feedsAbout: (count: number, servings: number) => string;
    cuisineOptions: Record<Cuisine, string>;
    generate: string;
    cookingFor?: string;
    cookingForOptions?: Record<CookingMode, string>;
  };
  /** The kitchen, for the on-device "about enough for N" estimate. */
  inventory: InventoryLot[];
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

// The cook prompt built like the home and Kitchen pages: the sheet is the page
// cream, every choice is a white lifted tile (a peach rounded-square icon
// well over its name, like the Kitchen's category tiles and the home's recipe
// thumbnails), and the picked tile fills tomato. Cuisine, the one long list,
// is the home's "More for you" filter chips. Servings is a white card row.
export function CookPromptSheet({
  visible,
  labels,
  inventory,
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
  // On-device guess at how many the kitchen feeds for the picked meal and
  // base; a warning only, never a block. Nothing to say for an empty kitchen.
  const feeds = estimateServings(inventory, { meal: meal === "any" ? undefined : meal, base: base ?? undefined });
  const short = feeds > 0 && feeds < servings;

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="micro" muted uppercase>
            {labels.eyebrow}
          </Text>
          <Text variant="h3" accessibilityRole="header">
            {labels.title}
          </Text>
        </View>
        <IconButton label="Close" transparent onPress={onDismiss}>
          <CloseIcon />
        </IconButton>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {showCookingFor ? (
          <Section label={labels.cookingFor ?? ""}>
            <View style={styles.grid}>
              {(["household", "just_me"] as CookingMode[]).map((option) => (
                <Tile
                  key={option}
                  width="quarter"
                  bare
                  label={labels.cookingForOptions?.[option] ?? option}
                  icon={(color) => <PeopleIcon many={option === "household"} color={color} />}
                  active={cookingMode === option}
                  onPress={() => onCookingModeChange?.(option)}
                />
              ))}
            </View>
          </Section>
        ) : null}

        <Section label={labels.meal}>
          <View style={styles.grid}>
            {MEAL_OPTIONS.map((option) => (
              <Tile
                key={option}
                width="third"
                label={labels.mealOptions[option]}
                detail={labels.mealSubtitles[option]}
                icon={(color) => <MealIcon meal={option} color={color} />}
                active={meal === option}
                onPress={() => setMeal((current) => (current === option ? "any" : option))}
              />
            ))}
          </View>
        </Section>

        <Section label={labels.buildAround}>
          <View style={styles.grid}>
            {baseOptions.map((option) => (
              <Tile
                key={option}
                width="quarter"
                label={labels.baseOptions[option]}
                icon={() => <FoodGlyph name={BASE_ICONS[option]} size={30} />}
                active={base === option}
                onPress={() => setBase((current) => (current === option ? null : option))}
              />
            ))}
          </View>
        </Section>

        <Section label={labels.time}>
          <View style={styles.grid}>
            {TIME_OPTIONS.map((option) => (
              <Tile
                key={option}
                width="third"
                label={labels.timeOptions[option]}
                detail={labels.timeSubtitles[option]}
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
        {short ? (
          <View style={styles.note} accessibilityLiveRegion="polite">
            <WarnIcon />
            <Text variant="small" color={colors.text} style={styles.noteText}>
              {labels.feedsAbout(feeds, servings)}
            </Text>
          </View>
        ) : null}

        <Section label={labels.cuisine}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chipRow}>
            {/* Text-only white tiles, the same surface as the tiles above. */}
            {CUISINE_OPTIONS.map((option) => (
              <Tappable
                key={option}
                label={labels.cuisineOptions[option]}
                selected={cuisine === option}
                onPress={() => setCuisine(option)}
                hitSlop={0}
                style={[styles.cuisine, cuisine === option && styles.tileActive]}
              >
                <Text variant="small" weight="extrabold" color={cuisine === option ? colors.onPrimary : colors.text}>
                  {labels.cuisineOptions[option]}
                </Text>
              </Tappable>
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

const TILE_WIDTHS = { third: "31.6%", quarter: "23.2%" } as const;

// A white lifted tile like the Kitchen's category tiles: the icon on a peach
// rounded-square well, the name under it. Picked: tomato fill, white well,
// white text. `bare` drops the card: just the well and the name, the well
// going tomato with a white icon when picked.
function Tile({
  label,
  detail,
  icon,
  width,
  bare = false,
  active,
  onPress,
}: {
  label: string;
  detail?: string;
  icon: (color: string) => React.ReactNode;
  width: keyof typeof TILE_WIDTHS;
  bare?: boolean;
  active: boolean;
  onPress: () => void;
}) {
  if (bare) {
    return (
      <Tappable label={label} selected={active} onPress={onPress} hitSlop={0} style={[styles.bare, { width: TILE_WIDTHS[width] }]}>
        <View style={[styles.well, styles.wellBare, active && styles.wellBareActive]}>{icon(active ? colors.onPrimary : colors.primary)}</View>
        <Text variant="small" weight="extrabold" center numberOfLines={1}>
          {label}
        </Text>
      </Tappable>
    );
  }
  return (
    <Tappable
      label={detail ? `${label}, ${detail}` : label}
      selected={active}
      onPress={onPress}
      hitSlop={0}
      style={[styles.tile, { width: TILE_WIDTHS[width] }, active && styles.tileActive]}
    >
      <View style={[styles.well, active && styles.wellActive]}>{icon(colors.primary)}</View>
      <Text variant="small" weight="extrabold" center numberOfLines={1} color={active ? colors.onPrimary : colors.text}>
        {label}
      </Text>
      {detail ? (
        <Text variant="micro" center numberOfLines={1} color={active ? colors.onPrimary : colors.muted}>
          {detail}
        </Text>
      ) : null}
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

function WarnIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5 21 20H3L12 3.5Z" stroke={colors.accentInk} strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M12 10v4.5M12 17.2v.3" stroke={colors.accentInk} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

function PeopleIcon({ many, color }: { many: boolean; color: string }) {
  const p = { stroke: color, strokeWidth: 1.7, strokeLinecap: "round" as const, fill: "none" };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={many ? 9 : 12} cy={8} r={3} {...p} />
      <Path d={many ? "M3.5 19a5.5 5.5 0 0 1 11 0" : "M6.5 19a5.5 5.5 0 0 1 11 0"} {...p} />
      {many ? <Path d="M15.5 5.5a3 3 0 0 1 0 5M16 13.8a5.5 5.5 0 0 1 4.5 5.2" {...p} /> : null}
    </Svg>
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
  // The page cream, so the white tiles read as cards, like on the home.
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  // Full sheet width with the padding inside, so tile shadows aren't clipped;
  // shrinks so the Generate button below always stays in view.
  scroll: {
    flexShrink: 1,
    marginHorizontal: -spacing.xxl,
  },
  content: {
    gap: spacing.xl,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tile: {
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxs,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  tileActive: {
    backgroundColor: colors.primary,
  },
  well: {
    width: 44,
    height: 44,
    marginBottom: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  wellActive: {
    backgroundColor: colors.surface,
  },
  bare: {
    alignItems: "center",
  },
  // Bigger than a tile's well: here it is the whole control.
  wellBare: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
  },
  wellBareActive: {
    backgroundColor: colors.primary,
  },
  // RecipeListCard's surface: a white card row.
  servings: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.md,
    paddingLeft: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  // The home's butter note ("Uses Milk before they go off").
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: -spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
  },
  noteText: {
    flex: 1,
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
  // The cuisine row runs to the screen edges; vertical padding keeps the
  // tiles' shadow inside the scroller.
  bleed: {
    marginHorizontal: -spacing.xxl,
  },
  chipRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xs,
  },
  cuisine: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  cta: {
    paddingTop: spacing.md,
  },
});
