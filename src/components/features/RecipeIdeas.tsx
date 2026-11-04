import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radii, spacing } from "../../theme";
import { Button, Text } from "../primitives";
import { RecipeGlyph } from "./RecipeGlyph";

// Recipe ideas, TinyMeals-style: the "Try next" hero and list cards on the
// home, and the "N ideas" screen a generation lands on.

export type IngredientChip = { label: string; tag?: string };

/** The home's hero: tonight's dish with what you have of it and why it fits. */
export function TryNextCard({
  eyebrow,
  title,
  meta,
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
}: {
  eyebrow: string;
  title: string;
  meta: string;
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
  /** An outline button beside the CTA (e.g. "What should I cook?"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, styles.hero, pressed && styles.pressed]}>
      <View style={styles.heroTop}>
        <View style={styles.tileLarge}>
          <RecipeGlyph size={40} />
        </View>
        <View style={styles.copy}>
          <Text variant="micro" uppercase muted style={styles.eyebrow}>
            {eyebrow}
          </Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <MetaLine text={meta} />
        </View>
        {onFavorite ? <Heart active={favorite} label={favoriteLabel} onPress={onFavorite} /> : null}
      </View>
      {description ? (
        <Text variant="small" numberOfLines={2} style={styles.description}>
          {description}
        </Text>
      ) : null}
      {ingredients.length > 0 ? (
        <>
          <View style={styles.rowBetween}>
            <Text variant="micro" uppercase muted style={styles.eyebrow}>
              {ingredientsLabel}
            </Text>
            {stepsLabel ? (
              <Text variant="small" color={colors.accentInk} style={styles.bold}>
                {stepsLabel}
              </Text>
            ) : null}
          </View>
          <View style={styles.chips}>
            {ingredients.map((chip) => (
              <View key={chip.label} style={styles.chip}>
                <Text variant="small" color={colors.primary} style={styles.bold}>
                  {chip.label}
                </Text>
                {chip.tag ? (
                  <Text variant="micro" color={colors.accentInk} style={styles.bold}>
                    {chip.tag}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}
      {why ? (
        <View style={styles.why}>
          <SparkIcon />
          <Text variant="small" color={colors.primary} style={[styles.copy, styles.bold]}>
            {why}
          </Text>
        </View>
      ) : null}
      {ctaLabel ? (
        <View style={styles.actions}>
          <Button title={ctaLabel} onPress={onPress} style={[styles.action, styles.actionPrimary]} />
          {secondaryLabel && onSecondary ? (
            <Button title={secondaryLabel} variant="ghost" onPress={onSecondary} style={[styles.action, styles.actionSecondary]} />
          ) : null}
        </View>
      ) : null}
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
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, styles.listCard, highlight && styles.listCardHighlight, pressed && styles.pressed]}>
      <View style={styles.tileLarge}>
        <RecipeGlyph size={36} />
      </View>
      <View style={styles.copy}>
        <Text variant="micro" uppercase numberOfLines={1} color={badgeAccent ? colors.accentInk : colors.muted} style={styles.eyebrow}>
          {badge}
        </Text>
        <Text numberOfLines={2} style={styles.listTitle}>
          {title}
        </Text>
        <MetaLine text={meta} />
      </View>
      {onFavorite ? <Heart active={favorite} label={favoriteLabel} onPress={onFavorite} /> : null}
    </Pressable>
  );
}

type Idea = { key: string; title: string; meta: string; description?: string; pill?: string; onPress: () => void };

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
        <Text variant="label" style={styles.bold}>
          {backLabel}
        </Text>
      </Pressable>
      <View style={styles.resultsHead}>
        <Text variant="h1" accessibilityRole="header">
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
              <Text style={styles.heroTitle}>{best.title}</Text>
              <Text variant="small" muted>
                {best.meta}
              </Text>
            </View>
            <View style={styles.tileLarge}>
              <RecipeGlyph size={40} />
            </View>
          </View>
          {best.description ? <Text variant="body">{best.description}</Text> : null}
          {best.pill ? <Pill label={best.pill} /> : null}
          <Pressable accessibilityRole="button" onPress={best.onPress} style={({ pressed }) => [styles.view, pressed && styles.pressed]}>
            <Text variant="label" color={colors.surface} style={styles.viewLabel}>
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
                <RecipeGlyph size={28} />
              </View>
              <View style={[styles.copy, styles.otherCopy]}>
                <Text numberOfLines={2} style={styles.listTitle}>
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
        <Text variant="label" style={styles.bold}>
          {moreLabel}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function MetaLine({ text }: { text: string }) {
  return (
    <View style={styles.meta}>
      <View style={styles.metaDot} />
      <Text variant="small" color={colors.primary} numberOfLines={1} style={[styles.bold, styles.copy]}>
        {text}
      </Text>
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text variant="small" color={colors.primary} style={styles.bold}>
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
      <Svg width={16} height={16} viewBox="0 0 24 24" fill={active ? colors.accent : "none"}>
        <Path
          d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
          stroke={active ? colors.accent : colors.accentInk}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

function SparkIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" stroke={colors.primary} strokeWidth={1.8} strokeLinejoin="round" />
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
    backgroundColor: colors.paper,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  hero: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  tileLarge: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  tileSmall: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.sageTint,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    letterSpacing: 0.66,
  },
  heroTitle: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 25,
    color: colors.text,
    marginTop: 2,
  },
  listTitle: {
    fontFamily: fonts.bodyExtraBold,
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 21,
    color: colors.text,
    marginTop: 2,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  metaDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
  },
  description: {
    color: colors.text,
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
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: colors.sageTint,
  },
  why: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  heart: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  // Tighter side padding so both labels fit side by side on a phone.
  action: {
    paddingHorizontal: spacing.md,
  },
  actionPrimary: {
    flex: 1,
  },
  actionSecondary: {
    flex: 1.5,
  },
  listCardHighlight: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1.5,
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
    borderRadius: radii.pill,
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
    paddingHorizontal: 11,
    borderRadius: 14,
    justifyContent: "center",
    backgroundColor: colors.sageTint,
  },
  view: {
    minHeight: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  viewLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
    fontSize: 16,
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
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.paper,
  },
  bold: {
    fontFamily: fonts.bodyBold,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
});
