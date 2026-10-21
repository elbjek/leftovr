import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, fonts, radii, shadows, spacing, Urgency, urgencyColors } from "../../theme";
import { FoodGlyph, Logo } from "../illustrations";
import { Text } from "../primitives";
import { FoodCard } from "./FoodCard";
import { KitchenPulse } from "./KitchenPulse";
import { RecipeCard } from "./RecipeCard";
import { ScanMethod, ScanMethodIcon } from "./ScanMethodCard";

// Pre-sign-in feature presentation. Each slide is a "stage" built from the
// real app components fed with demo copy from the locale files
// (`onboarding.hook.slides[].demo`), so the deck always looks like the app.

export type ShowcaseSceneKey = "intro" | "scan" | "eatFirst" | "cook" | "save" | "share";

export type ShowcaseSlide = {
  key: ShowcaseSceneKey;
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  body: string;
  /** Plan needed for this feature, shown as a pill next to the eyebrow. */
  badge?: string;
  // ponytail: demo shape varies per scene; each scene reads its own fields.
  demo: any;
};

const stageTint: Record<ShowcaseSceneKey, string> = {
  intro: colors.primary,
  scan: colors.sageTint,
  eatFirst: colors.accentSoft,
  cook: colors.surface3,
  save: colors.sageTint,
  share: colors.accentSoft,
};

export function ShowcaseStage({ slide, active }: { slide: ShowcaseSlide; active: boolean }) {
  return (
    <View style={[styles.stage, { backgroundColor: stageTint[slide.key] }]}>
      {renderScene(slide, active)}
    </View>
  );
}

function renderScene(slide: ShowcaseSlide, active: boolean) {
  const { demo } = slide;
  if (slide.key === "intro") return <IntroScene demo={demo} active={active} />;
  if (slide.key === "scan") return <ScanScene demo={demo} active={active} />;
  if (slide.key === "eatFirst") return <EatFirstScene demo={demo} active={active} />;
  if (slide.key === "cook") return <CookScene demo={demo} active={active} />;
  if (slide.key === "save") return <SaveScene demo={demo} active={active} />;
  return <ShareScene demo={demo} active={active} />;
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
        duration: 520,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [active, delay, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

type SceneProps<T> = { demo: T; active: boolean };

function IntroScene({ demo, active }: SceneProps<{ kicker: string; agenda: string[] }>) {
  return (
    <View style={styles.intro}>
      <Reveal active={active} style={styles.introLogo}>
        <Logo size={44} variant="inverse" />
        <Text variant="micro" color={colors.sage} uppercase>
          {demo.kicker}
        </Text>
      </Reveal>
      <View style={styles.agenda}>
        {demo.agenda.map((item, index) => (
          <Reveal key={item} active={active} delay={180 + index * 90} style={styles.agendaRow}>
            <Text variant="label" color={colors.accent} style={styles.agendaNumber}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <Text variant="label" color={colors.surface} style={styles.agendaLabel}>
              {item}
            </Text>
          </Reveal>
        ))}
      </View>
    </View>
  );
}

type ScanDemo = {
  store: string;
  totalLabel: string;
  total: string;
  lines: { name: string; price: string }[];
  items: { name: string; meta: string }[];
  methods: { method: ScanMethod; label: string }[];
};

function ScanScene({ demo, active }: SceneProps<ScanDemo>) {
  return (
    <View style={styles.sceneFill}>
      <View style={styles.scanRow}>
        <Reveal active={active} style={styles.receipt}>
          <Text variant="micro" muted center>
            {demo.store}
          </Text>
          <View style={styles.receiptRule} />
          {demo.lines.map((line) => (
            <View key={line.name} style={styles.receiptLine}>
              <Text variant="micro" style={styles.receiptText} numberOfLines={1}>
                {line.name}
              </Text>
              <Text variant="micro" style={styles.receiptText}>
                {line.price}
              </Text>
            </View>
          ))}
          <View style={styles.receiptRule} />
          <View style={styles.receiptLine}>
            <Text variant="micro" style={styles.receiptTotal}>
              {demo.totalLabel}
            </Text>
            <Text variant="micro" style={styles.receiptTotal}>
              {demo.total}
            </Text>
          </View>
          <View style={styles.receiptEdge}>
            {Array.from({ length: 9 }, (_, index) => (
              <View key={index} style={styles.receiptNotch} />
            ))}
          </View>
        </Reveal>
        <View style={styles.scanItems}>
          {demo.items.map((item, index) => (
            <Reveal key={item.name} active={active} delay={320 + index * 140} style={styles.scanItem}>
              <View style={styles.scanGlyph}>
                <FoodGlyph name={item.name} size={26} />
              </View>
              <View style={styles.flexShrink}>
                <Text variant="label" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text variant="micro" muted numberOfLines={1}>
                  {item.meta}
                </Text>
              </View>
            </Reveal>
          ))}
        </View>
      </View>
      <Reveal active={active} delay={820} style={styles.methods}>
        {demo.methods.map((entry) => (
          <View key={entry.method} style={styles.methodPill}>
            <ScanMethodIcon method={entry.method} />
            <Text variant="micro" color={colors.primary}>
              {entry.label}
            </Text>
          </View>
        ))}
      </Reveal>
    </View>
  );
}

type EatFirstDemo = {
  pulse: { fresh: number; soon: number; urgent: number };
  pulseLabels: { today: string; soon: string; fresh: string; total: string };
  items: { name: string; category: string; meta: string; bestBy: string; urgency: Urgency }[];
};

function EatFirstScene({ demo, active }: SceneProps<EatFirstDemo>) {
  const { pulseLabels } = demo;

  return (
    <View style={styles.sceneFill}>
      <Reveal active={active} style={styles.pulseCard}>
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
      <View style={styles.eatRow}>
        {demo.items.map((item, index) => (
          <Reveal
            key={item.name}
            active={active}
            delay={260 + index * 140}
            style={styles.eatSlot}
          >
            <FoodCard
              name={item.name}
              category={item.category}
              meta={item.meta}
              bestBy={item.bestBy}
              urgency={item.urgency}
              style={styles.eatCard}
            />
          </Reveal>
        ))}
      </View>
    </View>
  );
}

type CookDemo = {
  fromKitchen: string;
  ingredients: string[];
  usesLabel: string;
  recipes: { title: string; time: string; complexity: string; usedItems: string[]; isNew?: boolean }[];
  newLabel: string;
};

function CookScene({ demo, active }: SceneProps<CookDemo>) {
  return (
    <View style={styles.sceneFill}>
      <Reveal active={active}>
        <Text variant="micro" muted uppercase>
          {demo.fromKitchen}
        </Text>
      </Reveal>
      <View style={styles.chips}>
        {demo.ingredients.map((name, index) => (
          <Reveal key={name} active={active} delay={100 + index * 80} style={styles.chip}>
            <FoodGlyph name={name} size={18} />
            <Text variant="small" style={styles.chipText}>
              {name}
            </Text>
          </Reveal>
        ))}
      </View>
      <View style={styles.recipes}>
        {demo.recipes.map((recipe, index) => (
          <Reveal
            key={recipe.title}
            active={active}
            delay={560 + index * 160}
            style={index > 0 && styles.recipeBehind}
          >
            <RecipeCard
              title={recipe.title}
              timeLabel={recipe.time}
              complexityLabel={recipe.complexity}
              metaSeparator=" · "
              usedItems={recipe.usedItems}
              usesLabel={demo.usesLabel}
              newLabel={recipe.isNew ? demo.newLabel : undefined}
            />
          </Reveal>
        ))}
      </View>
    </View>
  );
}

type SaveDemo = {
  period: string;
  amount: string;
  delta: string;
  bars: { label: string; value: string; share: number; kind: "saved" | "wasted" }[];
  footnote: string;
};

function SaveScene({ demo, active }: SceneProps<SaveDemo>) {
  return (
    <View style={styles.sceneCenter}>
      <Reveal active={active} style={styles.saveCard}>
        <Text variant="micro" muted uppercase>
          {demo.period}
        </Text>
        <Text style={styles.saveAmount} allowFontScaling={false}>
          {demo.amount}
        </Text>
        <View style={styles.saveBars}>
          {demo.bars.map((bar) => (
            <View key={bar.label} style={styles.saveBarRow}>
              <View style={styles.saveBarLabels}>
                <Text variant="small" muted>
                  {bar.label}
                </Text>
                <Text variant="label">{bar.value}</Text>
              </View>
              <View style={styles.saveTrack}>
                <View
                  style={[
                    styles.saveFill,
                    {
                      width: `${bar.share * 100}%`,
                      backgroundColor: bar.kind === "saved" ? urgencyColors.safe : urgencyColors.urgent,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
        <View style={styles.saveFootnote}>
          <View style={styles.saveDot} />
          <Text variant="small" muted style={styles.flexShrink}>
            {demo.footnote}
          </Text>
        </View>
      </Reveal>
      <Reveal active={active} delay={480} style={styles.sticker}>
        <Text variant="label">{demo.delta}</Text>
      </Reveal>
    </View>
  );
}

type ShareDemo = {
  kitchen: string;
  members: { initials: string; name: string }[];
  capacity: string;
  feed: { initials: string; name: string; action: string; time: string }[];
};

const memberTint = [colors.accent, colors.sage, colors.primary];

function ShareScene({ demo, active }: SceneProps<ShareDemo>) {
  return (
    <View style={styles.sceneFill}>
      <Reveal active={active} style={styles.household}>
        <View style={styles.avatars}>
          {demo.members.map((member, index) => (
            <View
              key={member.name}
              style={[
                styles.avatar,
                index > 0 && styles.avatarOverlap,
                { backgroundColor: memberTint[index % memberTint.length] },
              ]}
            >
              <Text variant="label" color={index === 2 ? colors.surface : colors.text}>
                {member.initials}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.flexShrink}>
          <Text variant="h3">{demo.kitchen}</Text>
          <Text variant="small" muted>
            {demo.capacity}
          </Text>
        </View>
      </Reveal>
      <View style={styles.feed}>
        {demo.feed.map((entry, index) => (
          <Reveal key={entry.action} active={active} delay={300 + index * 180} style={styles.feedRow}>
            <View style={[styles.feedAvatar, { backgroundColor: memberTint[index % memberTint.length] }]}>
              <Text variant="micro">{entry.initials}</Text>
            </View>
            <Text variant="small" style={styles.feedText} numberOfLines={2}>
              <Text variant="small" style={styles.feedName}>
                {entry.name}
              </Text>{" "}
              {entry.action}
            </Text>
            <Text variant="micro" muted>
              {entry.time}
            </Text>
          </Reveal>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    overflow: "hidden",
    justifyContent: "center",
  },
  sceneFill: {
    gap: spacing.lg,
  },
  sceneCenter: {
    alignItems: "center",
  },
  flexShrink: {
    flexShrink: 1,
  },
  // intro
  intro: {
    gap: spacing.xl,
  },
  introLogo: {
    gap: spacing.xs,
  },
  agenda: {
    borderTopWidth: 1,
    borderTopColor: colors.inverseHairlineStrong,
  },
  agendaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.inverseHairline,
  },
  agendaNumber: {
    width: 24,
    fontFamily: fonts.bodyExtraBold,
  },
  agendaLabel: {
    fontFamily: fonts.bodySemiBold,
  },
  // scan
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  receipt: {
    width: 150,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xs,
    borderTopRightRadius: radii.xs,
    transform: [{ rotate: "-4deg" }],
    ...shadows.elevated,
  },
  receiptRule: {
    marginVertical: spacing.sm,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.muted2,
  },
  receiptLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  receiptText: {
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
  receiptTotal: {
    fontFamily: fonts.bodyExtraBold,
  },
  // Scalloped tear-off edge: notches punched in the stage colour.
  receiptEdge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -6,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  receiptNotch: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.sageTint,
  },
  scanItems: {
    flex: 1,
    marginLeft: -14,
    gap: spacing.sm,
  },
  scanItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardLine,
    ...shadows.card,
  },
  scanGlyph: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  methods: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  methodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
  },
  // eat first
  pulseCard: {
    padding: spacing.lg,
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
  },
  eatRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  eatSlot: {
    flex: 1,
  },
  eatCard: {
    width: "100%",
  },
  // cook
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: -spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.sageBorder,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  recipes: {
    gap: spacing.sm,
  },
  recipeBehind: {
    opacity: 0.55,
    transform: [{ scale: 0.95 }],
  },
  // save
  saveCard: {
    alignSelf: "stretch",
    padding: spacing.xl,
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    ...shadows.elevated,
  },
  saveAmount: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 64,
    lineHeight: 70,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  saveBars: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  saveBarRow: {
    gap: spacing.xs,
  },
  saveBarLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  saveTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.hairline,
    overflow: "hidden",
  },
  saveFill: {
    height: "100%",
    borderRadius: radii.pill,
  },
  saveFootnote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  saveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: urgencyColors.safe,
  },
  sticker: {
    position: "absolute",
    top: -spacing.lg,
    right: -spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    transform: [{ rotate: "4deg" }],
  },
  // share
  household: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
  },
  avatars: {
    flexDirection: "row",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlap: {
    marginLeft: -12,
  },
  feed: {
    gap: spacing.sm,
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  feedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  feedText: {
    flex: 1,
  },
  feedName: {
    fontFamily: fonts.bodyBold,
  },
});
