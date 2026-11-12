import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radii, shadows, spacing } from "../../theme";
import { Text } from "../primitives";
import { FoodGlyph } from "../illustrations";
import { RecipeCover } from "./RecipeCover";

// Recipe ideas, TinyMeals-style: the "Try next" hero and list cards on the
// home, and the "N ideas" screen a generation lands on.

export type IngredientChip = { label: string; tag?: string };

/** The home's hero: tonight's dish with what you have of it and why it fits. */
export function TryNextCard({
  eyebrow,
  title,
  time,
  complexity,
  description,
  ingredientsLabel,
  stepsLabel,
  ingredients,
  why,
  favorite,
  favoriteLabel,
  onFavorite,
  onPress,
  ctaLabel,
  secondaryLabel,
  onSecondary,
  coverPath,
}: {
  eyebrow: string;
  title: string;
  time: string;
  complexity: string;
  description?: string | null;
  ingredientsLabel: string;
  stepsLabel?: string;
  ingredients: IngredientChip[];
  why?: string;
  favorite?: boolean;
  favoriteLabel: string;
  onFavorite?: () => void;
  onPress: () => void;
  /** A button at the bottom ("Cook this") doing the same as tapping the card. */
  ctaLabel?: string;
  /** A soft button beside the CTA (e.g. "More ideas"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  coverPath?: string | null;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.hero}>
      {/* Layout C: the dish leads on the left on a peach blob; the pill,
          title and meta stack beside it, so long titles wrap in a real
          column. The heart sits in the card's corner. */}
      <View style={styles.heroTop}>
        <View style={styles.heroArt}>
          <View style={styles.heroBlob} />
          <View style={styles.heroDish}>
            <RecipeCover path={coverPath} glyphSize={52} />
          </View>
        </View>
        <View style={styles.heroCopy}>
          <View style={styles.eyebrowPill}>
            <Text variant="micro" uppercase color={colors.primary} numberOfLines={1}>
              {eyebrow}
            </Text>
          </View>
          <Text variant="h3" style={styles.heroTitle}>{title}</Text>
          <View style={styles.heroMeta}>
            <ClockIcon size={16} />
            <Text variant="small" color={colors.text}>
              {time}
            </Text>
            <Text variant="small" muted>
              ·
            </Text>
            <View style={styles.metaDot} />
            <Text variant="small" color={colors.text}>
              {complexity}
            </Text>
          </View>
        </View>
      </View>
      {onFavorite ? (
        <View style={styles.heroHeart}>
          <Heart active={favorite} label={favoriteLabel} onPress={onFavorite} />
        </View>
      ) : null}
      <View style={styles.heroBody}>
        {/* Why it's tonight's pick (e.g. what it saves from going off) leads. */}
        {why ? (
          <View style={styles.why}>
            <SparkIcon />
            <Text variant="small" color={colors.text} style={styles.whyText}>
              {why}
            </Text>
          </View>
        ) : null}
        {description ? (
          <Text variant="small" color={colors.text} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        {ingredients.length > 0 ? (
          <>
            <View style={styles.rowBetween}>
              <Text variant="title">
                {ingredientsLabel}
              </Text>
              {stepsLabel ? (
                <Text variant="small" color={colors.primary} weight="bold">
                  {stepsLabel}
                </Text>
              ) : null}
            </View>
            <View style={styles.chips}>
              {ingredients.map((chip) => (
                <View key={chip.label} style={styles.chip}>
                  <FoodGlyph name={chip.label} size={18} color={colors.text} />
                  <Text variant="small" color={colors.text} weight="bold">
                    {chip.label}
                  </Text>
                  {chip.tag ? (
                    <View style={styles.chipTag}>
                      <Text variant="micro" color={colors.primary}>
                        {chip.tag}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}
        {ctaLabel ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onPress}
              style={({ pressed }) => [styles.cook, pressed && styles.pressed]}
            >
              <Text variant="label" color={colors.onPrimary} numberOfLines={1}>
                {ctaLabel}
              </Text>
              <ArrowIcon />
            </Pressable>
            {secondaryLabel && onSecondary ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSecondary}
                style={({ pressed }) => [styles.soft, pressed && styles.pressed]}
              >
                <BulbIcon />
                <Text variant="label" numberOfLines={1}>
                  {secondaryLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      </View>
    </Pressable>
  );
}

/** One recipe in a list: tile, a badge line ("Uses: spinach"), name, meta, heart. */
export function RecipeListCard({
  badge,
  badgeAccent,
  highlight,
  title,
  meta,
  favorite,
  favoriteLabel,
  onFavorite,
  onPress,
  coverPath,
}: {
  badge: string;
  /** Yellow badge (something to use soon) instead of the muted one. */
  badgeAccent?: boolean;
  /** Gold card for one of tonight's generated ideas. */
  highlight?: boolean;
  title: string;
  meta: string;
  favorite?: boolean;
  favoriteLabel: string;
  onFavorite?: () => void;
  onPress: () => void;
  coverPath?: string | null;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, styles.listCard, highlight && styles.listCardHighlight, pressed && styles.pressed]}>
      <View style={styles.listThumb}>
        <RecipeCover path={coverPath} glyphSize={36} />
      </View>
      <View style={styles.copy}>
        <Text variant="micro" uppercase numberOfLines={1} color={badgeAccent ? colors.primary : colors.muted} style={styles.eyebrow}>
          {badge}
        </Text>
        <Text variant="title" numberOfLines={2} style={styles.listTitle}>
          {title}
        </Text>
        <MetaLine text={meta} />
      </View>
      {onFavorite ? <Heart active={favorite} label={favoriteLabel} onPress={onFavorite} /> : null}
    </Pressable>
  );
}

type Idea = {
  key: string;
  title: string;
  meta: string;
  description?: string;
  pill?: string;
  coverPath?: string | null;
  onPress: () => void;
};

/** Where a generation lands: the best match, the others, and "Give me 3 more". */
export function IdeasResults({
  title,
  subtitle,
  backLabel,
  onBack,
  bestLabel,
  viewLabel,
  othersLabel,
  ideas,
  moreLabel,
  onMore,
}: {
  title: string;
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
  bestLabel: string;
  viewLabel: string;
  othersLabel: string;
  ideas: Idea[];
  moreLabel: string;
  onMore: () => void;
}) {
  const [best, ...others] = ideas;
  return (
    <ScrollView contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={6} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M15 5l-7 7 7 7" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text variant="label">
          {backLabel}
        </Text>
      </Pressable>
      <View style={styles.resultsHead}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" muted>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {best ? (
        <View style={[styles.card, styles.best]}>
          <View style={styles.heroTop}>
            <View style={styles.copy}>
              <Text variant="micro" uppercase color={colors.accentInk} style={styles.eyebrow}>
                {bestLabel}
              </Text>
              <Text variant="h3" style={styles.heroTitle}>{best.title}</Text>
              <Text variant="small" muted>
                {best.meta}
              </Text>
            </View>
            <View style={styles.tileLarge}>
              <RecipeCover path={best.coverPath} glyphSize={40} />
            </View>
          </View>
          {best.description ? <Text variant="body">{best.description}</Text> : null}
          {best.pill ? <Pill label={best.pill} /> : null}
          <Pressable accessibilityRole="button" onPress={best.onPress} style={({ pressed }) => [styles.view, pressed && styles.pressed]}>
            <Text variant="label" color={colors.onPrimary}>
              {viewLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {others.length > 0 ? (
        <View style={styles.section}>
          <Text variant="micro" uppercase muted style={styles.eyebrow}>
            {othersLabel}
          </Text>
          {others.map((idea) => (
            <Pressable
              key={idea.key}
              accessibilityRole="button"
              onPress={idea.onPress}
              style={({ pressed }) => [styles.card, styles.listCard, pressed && styles.pressed]}
            >
              <View style={styles.tileSmall}>
                <RecipeCover path={idea.coverPath} glyphSize={28} />
              </View>
              <View style={[styles.copy, styles.otherCopy]}>
                <Text variant="title" numberOfLines={2} style={styles.listTitle}>
                  {idea.title}
                </Text>
                <Text variant="small" muted>
                  {idea.meta}
                </Text>
                {idea.pill ? <Pill label={idea.pill} /> : null}
              </View>
              <Chevron />
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={onMore} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" stroke={colors.accentInk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text variant="label">
          {moreLabel}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function MetaLine({ text }: { text: string }) {
  return (
    <View style={styles.meta}>
      <ClockIcon size={14} />
      <Text variant="small" color={colors.text} numberOfLines={1} style={styles.copy}>
        {text}
      </Text>
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text variant="small" color={colors.primary} weight="bold">
        {label}
      </Text>
    </View>
  );
}

function Heart({ active, label, onPress }: { active?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.heart, pressed && styles.pressed]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill={active ? colors.primary : "none"}>
        <Path
          d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
          stroke={colors.primary}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

function ClockIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2" stroke={colors.text} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArrowIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={colors.onPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BulbIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SparkIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" stroke={colors.accentInk} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function Chevron() {
  return (
    <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
      <Path d="M5 2.5 9.5 7 5 11.5" stroke={colors.muted2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    ...shadows.soft,
  },
  hero: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    // Clear of the heart in the corner.
    paddingRight: spacing.xxl,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  heroArt: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBlob: {
    position: "absolute",
    width: 104,
    height: 96,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    transform: [{ rotate: "-14deg" }],
  },
  heroDish: {
    width: 84,
    height: 84,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroHeart: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
  },
  eyebrowPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  heroBody: {
    gap: spacing.md,
  },
  whyText: {
    flexShrink: 1,
  },
  chipTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
  },
  cook: {
    flex: 1,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  soft: {
    flex: 1,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
  },
  // The original list size: a 64pt square, so the list stays compact.
  listThumb: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileLarge: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileSmall: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.bodyExtraBold,
    letterSpacing: 0.66,
  },
  heroTitle: {
    color: colors.text,
  },
  listTitle: {
    color: colors.text,
    marginTop: 2,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: -spacing.xs,
  },
  // Outlined pills with the food's icon; "Use soon" is a small peach tag.
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.bg,
  },
  why: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
  },
  heart: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  listCardHighlight: {
    backgroundColor: colors.accentSoft,
  },
  results: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.tabBarClearance,
    gap: spacing.lg,
  },
  back: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  resultsHead: {
    gap: spacing.xs,
  },
  best: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  pill: {
    alignSelf: "flex-start",
    minHeight: 28,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    justifyContent: "center",
    // Peach, like the home's "Use soon" tag: tomato on sage clashed.
    backgroundColor: colors.surface2,
  },
  view: {
    minHeight: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    gap: spacing.sm,
  },
  otherCopy: {
    gap: 4,
  },
  more: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
});
