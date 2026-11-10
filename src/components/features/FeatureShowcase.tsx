import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, radii, shadows, spacing, Urgency, urgencyColors } from "../../theme";
import { Logo } from "../illustrations";
import { Text } from "../primitives";
import { FoodCard } from "./FoodCard";
import { KitchenPulse } from "./KitchenPulse";
import { ScanMethod, ScanMethodIcon } from "./ScanMethodCard";

// Pre-sign-in feature tour. Each slide has its own page colour from the app's
// tints, alternating pink and white, with white lifted cards on top, like the
// home; Recipes is the one tomato slide. Each "stage" is built from app components fed with demo copy
// from the locale files (`onboarding.hook.slides[].demo`), so the deck always
// looks like the app.

export type ShowcaseSceneKey =
  | "welcome"
  | "add"
  | "kitchen"
  | "recipes"
  | "cook"
  | "insights"
  | "household"
  | "start";

export type ShowcaseSlide = {
  key: ShowcaseSceneKey;
  eyebrow?: string;
  /** Words wrapped in *asterisks* render bold. */
  title: string;
  body: string;
  /** Plan needed for this feature, shown as a pill next to the eyebrow. */
  badge?: string;
  // ponytail: demo shape varies per scene; each scene reads its own fields.
  demo: any;
};

export type ShowcaseTheme = {
  bg: string;
  ink: string;
  muted: string;
  eyebrow: string;
  /** Fill for small controls sitting straight on the page (Back, plan badge). */
  chip: string;
  dark: boolean;
};

const light = (bg: string, chip: string = colors.surface): ShowcaseTheme => ({
  bg,
  ink: colors.text,
  muted: colors.muted,
  eyebrow: colors.muted,
  chip,
  dark: false,
});
const pink = light(colors.surface3);
// White chips would vanish on the white page, so they take the peach well.
const white = light(colors.white, colors.surface2);
const dark: ShowcaseTheme = {
  bg: colors.primary,
  ink: colors.onPrimary,
  muted: colors.onPrimary,
  eyebrow: colors.onPrimary,
  chip: colors.inverseHairline,
  dark: true,
};

export const showcaseThemes: Record<ShowcaseSceneKey, ShowcaseTheme> = {
  // Pink and white take turns; Recipes keeps the tomato slot in the rhythm.
  welcome: pink,
  add: white,
  kitchen: pink,
  recipes: dark,
  cook: white,
  insights: pink,
  household: white,
  start: pink,
};

export function ShowcaseStage({ slide, active }: { slide: ShowcaseSlide; active: boolean }) {
  const { demo } = slide;
  if (slide.key === "welcome") return <WelcomeScene demo={demo} active={active} />;
  if (slide.key === "add") return <AddScene demo={demo} active={active} />;
  if (slide.key === "kitchen") return <KitchenScene demo={demo} active={active} />;
  if (slide.key === "recipes") return <RecipesScene demo={demo} active={active} />;
  if (slide.key === "cook") return <CookScene demo={demo} active={active} />;
  if (slide.key === "insights") return <InsightsScene demo={demo} active={active} />;
  if (slide.key === "household") return <HouseholdScene demo={demo} active={active} />;
  return <StartScene active={active} />;
}

// Builds a stage in like a presentation slide: plays once, the first time the
// slide becomes active, then stays put.
function Reveal({
  active,
  delay = 0,
  style,
  children,
}: {
  active: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const played = useRef(false);

  useEffect(() => {
    if (!active || played.current) return;
    played.current = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: 600,
        delay,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }).start();
    });
  }, [active, delay, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

function Check({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M2.5 6.5L5 9l4.5-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text variant="micro" color={color} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

type SceneProps<T> = { demo: T; active: boolean };

type WelcomeDemo = {
  cards: { label: string; name: string; qty: string; urgency: Urgency }[];
  recipe: { uses: string; time: string; title: string };
};

const urgencyInk: Record<Urgency, string> = {
  urgent: colors.redInk,
  useSoon: colors.accentInk,
  safe: colors.primary,
  expired: colors.muted,
};

function WelcomeScene({ demo, active }: SceneProps<WelcomeDemo>) {
  const [first, second] = demo.cards;
  return (
    <View style={styles.stage}>
      <Logo size={26} />
      <View style={styles.welcomeBoard}>
        {[first, second].map((card, index) => (
          <Reveal
            key={card.name}
            active={active}
            delay={50 + index * 130}
            style={index === 0 ? styles.welcomeCardLeft : styles.welcomeCardRight}
          >
            {/* Tilt lives inside Reveal: its animated transform replaces any in its style. */}
            <View style={[styles.miniCard, { transform: [{ rotate: index === 0 ? "-6deg" : "5deg" }] }]}>
              <View style={styles.rowBetween}>
                <Text variant="label" color={urgencyInk[card.urgency]}>
                  {card.label}
                </Text>
                <View style={[styles.dot9, { backgroundColor: urgencyColors[card.urgency] }]} />
              </View>
              <View>
                <Text variant="h3">{card.name}</Text>
                <Text variant="small" muted>
                  {card.qty}
                </Text>
              </View>
            </View>
          </Reveal>
        ))}
        <Reveal active={active} delay={320} style={styles.welcomeRecipe}>
          <View style={[styles.darkCard, styles.tiltRecipe]}>
            <View style={styles.rowBetween}>
              <Pill label={demo.recipe.uses} bg={colors.primary700} color={colors.onPrimary} />
              <Text variant="label" color={colors.onPrimary} style={styles.onDarkQuiet}>
                {demo.recipe.time}
              </Text>
            </View>
            <Text variant="h3" color={colors.onPrimary}>
              {demo.recipe.title}
            </Text>
          </View>
        </Reveal>
      </View>
    </View>
  );
}

type AddDemo = {
  methods: { method: ScanMethod; label: string; sub: string }[];
  checkTitle: string;
  items: { name: string; meta: string; source: string }[];
};

function AddScene({ demo, active }: SceneProps<AddDemo>) {
  return (
    <View style={[styles.stage, styles.stageGap]}>
      <View style={styles.row3}>
        {demo.methods.map((entry, index) => (
          <Reveal key={entry.method} active={active} delay={50 + index * 120} style={styles.flex1}>
            <View style={styles.methodTile}>
              <View style={styles.methodArt}>
                <ScanMethodIcon method={entry.method} />
              </View>
              <View style={styles.methodCopy}>
                <Text variant="label" numberOfLines={1}>
                  {entry.label}
                </Text>
                <Text variant="micro" muted numberOfLines={1}>
                  {entry.sub}
                </Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
      <Reveal active={active} delay={500}>
        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.rowGap}>
            <View style={[styles.dot8, { backgroundColor: colors.accent }]} />
            <Text variant="label" color={colors.accentInk}>
              {demo.checkTitle}
            </Text>
          </View>
          {demo.items.map((item, index) => (
            <Reveal key={item.name} active={active} delay={800 + index * 150} style={styles.rowGap}>
              <View style={styles.flex1}>
                <Text variant="label">{item.name}</Text>
                <Text variant="micro" muted>
                  {item.meta}
                </Text>
              </View>
              <Pill label={item.source} bg={colors.surface2} color={colors.muted} />
              <View style={styles.checkCircle}>
                <Check color={colors.primary} />
              </View>
            </Reveal>
          ))}
        </View>
      </Reveal>
    </View>
  );
}

type KitchenDemo = {
  items: { name: string; category: string; meta: string; bestBy: string; urgency: Urgency }[];
  check: { name: string; meta: string; keep: string; toss: string };
  pulse: { fresh: number; soon: number; urgent: number };
  pulseLabels: { today: string; soon: string; fresh: string; total: string };
};

function KitchenScene({ demo, active }: SceneProps<KitchenDemo>) {
  const { pulseLabels } = demo;
  return (
    <View style={[styles.stage, styles.stageGap]}>
      <View style={styles.row3}>
        {demo.items.map((item, index) => (
          <Reveal key={item.name} active={active} delay={50 + index * 100} style={styles.flex1}>
            <FoodCard
              name={item.name}
              category={item.category}
              meta={item.meta}
              bestBy={item.bestBy}
              urgency={item.urgency}
              style={styles.fullWidth}
            />
          </Reveal>
        ))}
      </View>
      <Reveal active={active} delay={450}>
        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.rowGap}>
            <View style={styles.unknownTile}>
              <Text variant="label" muted>
                ?
              </Text>
            </View>
            <View style={styles.flex1}>
              <Text variant="h3">{demo.check.name}</Text>
              <Text variant="small" muted>
                {demo.check.meta}
              </Text>
            </View>
          </View>
          <View style={styles.row2}>
            <View style={[styles.choice, { backgroundColor: colors.sageTint }]}>
              <Text variant="label" color={colors.primary}>
                {demo.check.keep}
              </Text>
            </View>
            <View style={[styles.choice, { backgroundColor: colors.redSoft }]}>
              <Text variant="label" color={colors.redInk}>
                {demo.check.toss}
              </Text>
            </View>
          </View>
        </View>
      </Reveal>
      <Reveal active={active} delay={700}>
        <KitchenPulse
          {...demo.pulse}
          labels={{
            today: pulseLabels.today,
            soon: pulseLabels.soon,
            fresh: pulseLabels.fresh,
            total: (count) => pulseLabels.total.replace("{{count}}", String(count)),
          }}
        />
      </Reveal>
    </View>
  );
}

type RecipesDemo = {
  reading: string;
  uses: string;
  time: string;
  title: string;
  ingredients: { name: string; urgency?: Urgency; note?: string }[];
  chips: string[];
};

const darkNoteInk: Partial<Record<Urgency, string>> = {
  urgent: colors.redSoft,
  useSoon: colors.accent,
};
// urgencyColors' red sinks into the tomato card, so its dots use the lighter tints.
const darkDot: Record<Urgency, string> = {
  urgent: colors.redSoft,
  useSoon: colors.accent,
  safe: colors.sageTint,
  expired: colors.surface3,
};

function RecipesScene({ demo, active }: SceneProps<RecipesDemo>) {
  return (
    <View style={[styles.stage, styles.stageGap]}>
      <Reveal active={active} style={styles.center}>
        <View style={styles.readingPill}>
          <View style={[styles.dot8, { backgroundColor: colors.onPrimary }]} />
          <Text variant="label" color={colors.onPrimary}>
            {demo.reading}
          </Text>
        </View>
      </Reveal>
      <View style={styles.deck}>
        <View style={[styles.deckLayer, styles.deckLayerBack]} />
        <View style={[styles.deckLayer, styles.deckLayerMid]} />
        <Reveal active={active} delay={300}>
          <View style={[styles.darkCard, styles.recipeFront]}>
            <View style={styles.rowBetween}>
              <Pill label={demo.uses} bg={colors.primary} color={colors.onPrimary} />
              <Text variant="label" color={colors.onPrimary} style={styles.onDarkQuiet}>
                {demo.time}
              </Text>
            </View>
            <Text variant="h3" color={colors.onPrimary}>
              {demo.title}
            </Text>
            <View style={styles.ingredients}>
              {demo.ingredients.map((item) => (
                <View key={item.name} style={styles.rowGap}>
                  <View
                    style={[
                      styles.dot8,
                      item.urgency
                        ? { backgroundColor: darkDot[item.urgency] }
                        : styles.dotHollow,
                    ]}
                  />
                  <Text
                    variant="label"
                    color={colors.onPrimary}
                    style={[styles.flex1, !item.urgency && styles.onDarkQuiet]}
                  >
                    {item.name}
                  </Text>
                  {item.note ? (
                    <Text
                      variant="small"
                      color={(item.urgency && darkNoteInk[item.urgency]) || colors.onPrimary}
                      style={!(item.urgency && darkNoteInk[item.urgency]) && styles.onDarkQuiet}
                    >
                      {item.note}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        </Reveal>
      </View>
      <Reveal active={active} delay={800} style={styles.chips}>
        {demo.chips.map((chip) => (
          <View key={chip} style={styles.darkChip}>
            <Text variant="micro" color={colors.onPrimary}>
              {chip}
            </Text>
          </View>
        ))}
      </Reveal>
    </View>
  );
}

type CookDemo = {
  title: string;
  recipe: string;
  rows: { name: string; was: string; now: string; usedUp?: boolean }[];
  swap: string;
  toast: string;
};

function CookScene({ demo, active }: SceneProps<CookDemo>) {
  return (
    <View style={[styles.stage, styles.stageGap]}>
      <Reveal active={active}>
        <View style={[styles.card, styles.cardGap]}>
          <View>
            <Text variant="h3">
              {demo.title}
            </Text>
            <Text variant="small" muted>
              {demo.recipe}
            </Text>
          </View>
          <View>
            {demo.rows.map((row, index) => (
              <View
                key={row.name}
                style={[styles.cookRow, index < demo.rows.length - 1 && styles.cookRowLine]}
              >
                <View style={styles.checkbox}>
                  <Check color={colors.onPrimary} size={11} />
                </View>
                <Text variant="title" style={styles.flex1}>
                  {row.name}
                </Text>
                <Text variant="small" color={colors.muted2} style={styles.struck}>
                  {row.was}
                </Text>
                <Reveal active={active} delay={600 + index * 150}>
                  <Text
                    variant="label"
                    color={row.usedUp ? colors.redInk : colors.text}
                  >
                    {row.now}
                  </Text>
                </Reveal>
              </View>
            ))}
          </View>
          <Text variant="label" color={colors.primary}>
            {demo.swap}
          </Text>
        </View>
      </Reveal>
      <Reveal active={active} delay={1300} style={styles.center}>
        <View style={styles.toast}>
          <View style={styles.toastCheck}>
            <Check color={colors.white} size={12} />
          </View>
          <Text variant="label" color={colors.onPrimary}>
            {demo.toast}
          </Text>
        </View>
      </Reveal>
    </View>
  );
}

type InsightsDemo = {
  scopes: [string, string];
  premium: string;
  period: string;
  count: string;
  unit: string;
  delta: string;
  tiles: { label: string; value: string; kind: "spent" | "saved" | "wasted" }[];
};

const tileTone = {
  spent: { ink: colors.text, label: colors.muted },
  saved: { ink: colors.primary, label: colors.primary },
  wasted: { ink: colors.redInk, label: colors.redInk },
};

function InsightsScene({ demo, active }: SceneProps<InsightsDemo>) {
  return (
    <View style={[styles.stage, styles.stageGap]}>
      <Reveal active={active}>
        <View style={[styles.card, styles.insightsCard]}>
          <View style={[styles.rowBetween, styles.insightsHead]}>
            <View style={styles.segmented}>
              <View style={[styles.segment, styles.segmentOn]}>
                <Text variant="micro">{demo.scopes[0]}</Text>
              </View>
              <View style={styles.segment}>
                <Text variant="micro" muted>
                  {demo.scopes[1]}
                </Text>
              </View>
            </View>
            <Pill label={demo.premium} bg={colors.accentSoft} color={colors.accentInk} />
          </View>
          <Text variant="label" muted>
            {demo.period}
          </Text>
          <View style={styles.bigRow}>
            <Text style={styles.bigNumber} allowFontScaling={false}>
              {demo.count}
            </Text>
            <Text variant="h2">{demo.unit}</Text>
          </View>
          <View style={styles.alignStart}>
            <Pill label={demo.delta} bg={colors.sageTint} color={colors.primary} />
          </View>
        </View>
      </Reveal>
      <View style={styles.row3}>
        {demo.tiles.map((tile, index) => {
          const tone = tileTone[tile.kind];
          return (
            <Reveal key={tile.label} active={active} delay={350 + index * 100} style={styles.flex1}>
              <View style={styles.statTile}>
                <Text variant="micro" color={tone.label}>
                  {tile.label}
                </Text>
                <Text variant="h2" color={tone.ink} numberOfLines={1} adjustsFontSizeToFit>
                  {tile.value}
                </Text>
              </View>
            </Reveal>
          );
        })}
      </View>
    </View>
  );
}

type HouseholdDemo = {
  members: string[];
  caption: string;
  codeLabel: string;
  code: string;
  copy: string;
  share: string;
  activity: { initial: string; title: string; text: string; time: string };
};

const memberTint = [colors.primary, colors.sage, colors.accent];

function HouseholdScene({ demo, active }: SceneProps<HouseholdDemo>) {
  return (
    <View style={[styles.stage, styles.stageGap]}>
      <View style={styles.center}>
        <View style={styles.avatars}>
          {demo.members.map((initial, index) => (
            <Reveal
              key={initial}
              active={active}
              delay={50 + index * 100}
              style={index > 0 && styles.avatarOverlap}
            >
              <View style={[styles.avatar, { backgroundColor: memberTint[index % memberTint.length] }]}>
                <Text style={styles.avatarText} color={index === 0 ? colors.onPrimary : colors.text}>
                  {initial}
                </Text>
              </View>
            </Reveal>
          ))}
        </View>
        <Text variant="label" muted style={styles.caption}>
          {demo.caption}
        </Text>
      </View>
      <Reveal active={active} delay={400}>
        <View style={[styles.card, styles.cardGap]}>
          <Text variant="label" muted>
            {demo.codeLabel}
          </Text>
          <Text style={styles.code} allowFontScaling={false}>
            {demo.code}
          </Text>
          <View style={styles.row2}>
            <View style={[styles.choice, { backgroundColor: colors.surface2 }]}>
              <Text variant="label">{demo.copy}</Text>
            </View>
            <View style={[styles.choice, { backgroundColor: colors.primary }]}>
              <Text variant="label" color={colors.onPrimary}>
                {demo.share}
              </Text>
            </View>
          </View>
        </View>
      </Reveal>
      <Reveal active={active} delay={800}>
        <View style={[styles.card, styles.activity]}>
          <View style={styles.activityAvatar}>
            <Text variant="h3">{demo.activity.initial}</Text>
          </View>
          <View style={styles.flex1}>
            <View style={styles.rowBetween}>
              <Text variant="label">{demo.activity.title}</Text>
              <Text variant="micro" muted>
                {demo.activity.time}
              </Text>
            </View>
            <Text variant="small" muted>
              {demo.activity.text}
            </Text>
          </View>
        </View>
      </Reveal>
    </View>
  );
}

function StartScene({ active }: { active: boolean }) {
  return (
    <View style={[styles.stage, styles.startStage]}>
      <Reveal active={active}>
        {/* The app icon: the stacked badge with its steam wisps. */}
        <View style={styles.startBadgeLift}>
          <Image
            source={require("../../../assets/images/icon.png")}
            style={styles.startBadge}
            accessibilityRole="image"
            accessibilityLabel="leftovr"
          />
        </View>
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: "center",
  },
  stageGap: {
    gap: spacing.lg,
  },
  flex1: {
    flex: 1,
  },
  fullWidth: {
    width: "100%",
  },
  center: {
    alignItems: "center",
  },
  alignStart: {
    alignItems: "flex-start",
    marginTop: spacing.xxs,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rowGap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  row2: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  row3: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadows.soft,
  },
  cardGap: {
    gap: spacing.md,
  },
  darkCard: {
    padding: 18,
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    ...shadows.elevated,
  },
  // Secondary text on tomato: white, one step back (as WeekStrip's detail line).
  onDarkQuiet: {
    opacity: 0.8,
  },
  pill: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    justifyContent: "center",
  },
  dot8: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dot9: {
    width: 9,
    height: 9,
    borderRadius: radii.xs,
  },
  dotHollow: {
    borderWidth: 1.5,
    borderColor: colors.inverseHairlineStrong,
  },
  // welcome
  welcomeBoard: {
    height: 290,
    marginTop: spacing.xxl,
  },
  welcomeCardLeft: {
    position: "absolute",
    left: 6,
    top: 0,
    width: "56%",
  },
  welcomeCardRight: {
    position: "absolute",
    right: 0,
    top: 54,
    width: "54%",
  },
  welcomeRecipe: {
    position: "absolute",
    left: 24,
    right: 16,
    top: 176,
  },
  tiltRecipe: {
    transform: [{ rotate: "-2deg" }],
  },
  miniCard: {
    padding: spacing.lg,
    gap: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadows.soft,
  },
  // add
  methodTile: {
    padding: spacing.sm,
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    ...shadows.soft,
  },
  methodArt: {
    height: 92,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  methodCopy: {
    paddingHorizontal: spacing.xxs,
    paddingBottom: spacing.xs,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: radii.xs,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  // kitchen
  unknownTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  choice: {
    flex: 1,
    height: 40,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  // recipes
  readingPill: {
    height: 32,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary700,
  },
  deck: {
    marginHorizontal: spacing.md,
  },
  deckLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.xl,
    backgroundColor: colors.primary700,
  },
  deckLayerBack: {
    opacity: 0.5,
    transform: [{ translateY: 24 }, { scale: 0.88 }],
  },
  deckLayerMid: {
    opacity: 0.8,
    transform: [{ translateY: 12 }, { scale: 0.94 }],
  },
  recipeFront: {
    backgroundColor: colors.primary700,
    borderWidth: 1,
    borderColor: colors.inverseHairline,
  },
  ingredients: {
    gap: 10,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  darkChip: {
    height: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.primary700,
    justifyContent: "center",
  },
  // cook
  cookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
  },
  cookRowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  struck: {
    textDecorationLine: "line-through",
  },
  toast: {
    height: 44,
    paddingLeft: spacing.sm,
    paddingRight: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    ...shadows.elevated,
  },
  toastCheck: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  // insights
  insightsCard: {
    padding: spacing.xl,
    gap: spacing.xs,
  },
  insightsHead: {
    marginBottom: spacing.sm,
  },
  segmented: {
    flexDirection: "row",
    padding: 3,
    gap: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.surface2,
  },
  segment: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.xs,
    justifyContent: "center",
  },
  segmentOn: {
    backgroundColor: colors.card,
  },
  bigRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  bigNumber: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 72,
    lineHeight: 78,
    letterSpacing: -3,
    color: colors.text,
  },
  statTile: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  // household
  avatars: {
    flexDirection: "row",
  },
  avatarOverlap: {
    marginLeft: -16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: radii.xxl,
    borderWidth: 5,
    borderColor: white.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 26,
    lineHeight: 32,
  },
  caption: {
    marginTop: 10,
  },
  code: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: 4,
    color: colors.text,
  },
  activity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  activityAvatar: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  // start
  startStage: {
    alignItems: "center",
  },
  // The shadow sits on a wrapper: the image clips to its rounded corners.
  startBadgeLift: {
    borderRadius: radii.xxl + spacing.sm,
    ...shadows.soft,
  },
  startBadge: {
    width: 148,
    height: 148,
    borderRadius: radii.xxl + spacing.sm,
  },
});
